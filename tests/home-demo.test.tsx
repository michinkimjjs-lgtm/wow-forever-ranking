/**
 * 홈 기능 미리보기 (설정 미완료 배포의 가상 데이터 화면)
 *
 * - live / beta 홈에 준비 중 안내와 DEMO 표시가 붙은 미리보기가 함께 나온다.
 * - 가상 데이터는 홈 화면 전용 정적 값이다. DB·랭킹 API·검색 API·랭킹 엔진으로 흘러가지 않는다.
 * - 가상 캐릭터는 실제 캐릭터 페이지로 연결하지 않고, 등록이 가능한 것처럼 안내하지 않는다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGameScope } from "@/lib/config";
import { DEMO_CLASSES, DEMO_RACES, demoDistribution, demoSummary, HOME_DEMO_FIXTURE_KIND, homeDemoFixture } from "@/lib/demo/home-preview-fixture";
import type { DataEnvironment } from "@/lib/domain/enums";
import { ko } from "@/locales/ko";

/** 어떤 방식으로든 DB를 쓰려고 하면 실패하는 가짜 연결 */
const forbiddenDb = new Proxy(
  {},
  {
    get(_target, prop) {
      throw new Error(`홈 미리보기는 DB를 사용하면 안 된다 (${String(prop)})`);
    },
  },
);

const serverState: { appEnv: DataEnvironment } = { appEnv: "live" };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/context", () => ({
  getServerContext: async () => ({ appEnv: serverState.appEnv, now: new Date("2026-10-30T06:00:00Z"), cache: null, db: forbiddenDb }),
  getAppEnvironmentSafe: () => serverState.appEnv,
}));

afterEach(() => {
  serverState.appEnv = "live";
});

const d = ko.home.demo;
const names = homeDemoFixture.characters.map((c) => c.name);

async function renderHome(env: DataEnvironment) {
  serverState.appEnv = env;
  const { default: HomePage } = await import("@/app/page");
  return renderToStaticMarkup(await HomePage());
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("설정 미완료 홈: 준비 중 안내 + 기능 미리보기", () => {
  it("live·beta 모두 아직 지역·게임 규칙 설정이 없다 (이 화면이 나오는 조건)", () => {
    expect(getGameScope("live")).toBeNull();
    expect(getGameScope("beta")).toBeNull();
    expect(getGameScope("mock")).not.toBeNull();
  });

  it.each(["live", "beta"] as const)("%s: 히어로, 서비스 상태, 준비 중 안내를 함께 보여 준다", async (env) => {
    const out = await renderHome(env);
    expect(out).toContain(d.hero.title);
    expect(out).toContain(d.hero.body);
    expect(out).toContain(d.hero.statusLive);
    expect(out).toContain(d.hero.statusDemo);
    // 기존 준비 중 안내를 유지한다
    expect(out).toContain(ko.common.setupPending.title);
    expect(out).toContain(ko.game.dataEnvironments[env]);
    expect(out).toContain(ko.home.title);
  });

  it.each(["live", "beta"] as const)("%s: 가상 데이터가 있는 모든 영역에 DEMO 안내가 붙는다", async (env) => {
    const out = await renderHome(env);
    const sections = out.split('data-demo="true"').slice(1);
    expect(sections.length).toBe(4); // 샘플 통계, 랭킹 미리보기, 직업·종족 분포, 성장 기록
    // 각 가상 데이터 영역은 다음 영역이 시작되기 전에 DEMO 안내 문장을 갖는다
    for (const section of sections) expect(section).toContain(d.notice);
    expect(out.split(d.notice).length - 1).toBe(sections.length);
    // 샘플 수치 카드마다 샘플 표시
    expect(out.split(`>${d.sampleTag}<`).length - 1).toBe(4);
  });

  it("세 가지 랭킹 미리보기를 각각 5~10명으로 보여 주고, 샘플 통계는 가상 데이터에서만 센다", async () => {
    const out = await renderHome("live");
    for (const kind of ["level", "gear", "highestItem"] as const) {
      expect(out).toContain(`data-demo-ranking="${kind}"`);
      expect(homeDemoFixture.rankings[kind].length).toBeGreaterThanOrEqual(5);
      expect(homeDemoFixture.rankings[kind].length).toBeLessThanOrEqual(10);
    }
    for (const name of homeDemoFixture.rankings.level.map((k) => homeDemoFixture.characters.find((c) => c.key === k)!.name)) {
      expect(out).toContain(name);
    }
    const s = demoSummary();
    expect(s).toEqual({
      characters: homeDemoFixture.characters.length,
      rankingTypes: 3,
      growthRecords: homeDemoFixture.characters.reduce((n, c) => n + c.growthRecords, 0),
      guilds: 4,
    });
    for (const kind of Object.keys(d.activity.kinds) as (keyof typeof d.activity.kinds)[]) {
      expect(out).toContain(d.activity.kinds[kind]);
    }
  });

  it("랭킹 행마다 직업 아이콘(직업 색상)과 직업·종족 이름을 텍스트로 함께 보여 준다", async () => {
    const out = await renderHome("live");
    expect(out).toContain(d.classRaceNote);
    for (const kind of ["level", "gear", "highestItem"] as const) {
      const card = out.split(`data-demo-ranking="${kind}"`)[1]!.split("data-demo-ranking=")[0]!.split('data-demo="true"')[0]!;
      for (const key of homeDemoFixture.rankings[kind]) {
        const c = homeDemoFixture.characters.find((x) => x.key === key)!;
        const row = card.slice(card.indexOf(`data-demo-class="${c.demoClass}"`));
        expect(row).toContain(c.name);
        // 직업 이름은 직업 색상, 종족 이름은 텍스트로 (아이콘만으로 구분하지 않음)
        expect(card).toContain(`text-demo-${c.demoClass}">${d.classes[c.demoClass]}<`);
        expect(card).toContain(d.races[c.demoRace]);
        expect(card).toContain(`aria-label="${d.classes[c.demoClass]} 직업 기호"`);
      }
    }
    // 종족 표시는 직업 색상을 쓰지 않는다
    for (const mark of out.split('data-demo-race="').slice(1)) expect(mark.slice(0, mark.indexOf(">"))).not.toMatch(/demo-(warrior|paladin|hunter|rogue|priest|shaman|mage|warlock|druid)/);
  });

  it("직업·종족 분포는 가상 데이터에서만 세고, 이름과 수치를 텍스트로 보여 준다", async () => {
    const out = await renderHome("live");
    const { classes, races } = demoDistribution();
    expect(classes.reduce((n, r) => n + r.count, 0)).toBe(homeDemoFixture.characters.length);
    expect(races.reduce((n, r) => n + r.count, 0)).toBe(homeDemoFixture.characters.length);
    expect(classes[0]).toEqual({ key: "warrior", count: 3 });
    for (const row of classes) expect(out).toContain(`title="${d.classes[row.key]} ${row.count}명 (샘플)"`);
    for (const row of races) expect(out).toContain(`title="${d.races[row.key]} ${row.count}명 (샘플)"`);
    expect(out).toContain('data-demo-distribution="classes"');
    expect(out).toContain('data-demo-distribution="races"');
  });

  it("구현 완료 기능과 개발 예정 기능을 구분하고, 아직 제공하지 않는 단계는 준비 중으로 표시한다", async () => {
    const out = await renderHome("live");
    expect(out).toContain(`data-feature-status="done"`);
    expect(out).toContain(`data-feature-status="partial"`);
    expect(out).toContain('data-flow-ready="false"');
    expect(out).toContain(d.flow.pending);
    for (const step of Object.values(d.flow.steps)) expect(out).toContain(step.title);
    expect(out).toContain(d.closing.title);
  });

  it("가상 캐릭터를 실제 페이지로 연결하지 않고, 등록이 가능한 것처럼 안내하지 않는다", async () => {
    const out = await renderHome("live");
    expect(out).not.toContain('href="/characters/');
    expect(out).not.toContain('href="/guilds/');
    expect(out).not.toContain('href="/contribute/register"');
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<input");
    // 등록·제출이 랭킹에 반영되는 것처럼 안내하는 기존 홈 문구를 쓰지 않는다 (준비 중 안내의 "안내 보기" 링크는 유지)
    expect(out).not.toContain(ko.home.contributeCta.body);
    expect(out).toContain('href="/contribute"');
  });

  it("홈 미리보기는 DB에 접근하지 않는다 (가상 데이터를 저장하거나 조회하지 않음)", async () => {
    // getServerContext가 돌려주는 db는 어떤 접근에도 예외를 던진다. 렌더링이 성공하면 DB를 쓰지 않은 것이다.
    await expect(renderHome("live")).resolves.toContain(d.notice);
    await expect(renderHome("beta")).resolves.toContain(d.notice);
  });
});

describe("가상 데이터가 실제 API로 흘러가지 않는다", () => {
  it.each(["level", "gear", "highest-item"])("live 랭킹 API(%s): 설정 미완료 응답 그대로, 가상 캐릭터 없음", async (type) => {
    const { GET } = await import("@/app/api/v1/rankings/[type]/route");
    const res = await GET(new NextRequest(`http://localhost/api/v1/rankings/${type}`), { params: Promise.resolve({ type }) });
    const raw = await res.text();
    const body = JSON.parse(raw) as { data: unknown[]; meta: Record<string, unknown> };
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.meta).toMatchObject({ status: "unavailable", unavailableReason: "GAME_SCOPE_NOT_CONFIGURED", isMockData: false });
    for (const name of names) expect(raw).not.toContain(name);
  });

  it("live 캐릭터 검색 API: 가상 캐릭터 이름으로 검색해도 결과가 없다", async () => {
    const { GET } = await import("@/app/api/v1/characters/search/route");
    const res = await GET(new NextRequest(`http://localhost/api/v1/characters/search?q=${encodeURIComponent(names[0]!)}`));
    const raw = await res.text();
    const body = JSON.parse(raw) as { data: unknown[]; meta: Record<string, unknown> };
    expect(body.data).toEqual([]);
    expect(body.meta).toMatchObject({ unavailableReason: "GAME_SCOPE_NOT_CONFIGURED" });
    expect(raw.replace(encodeURIComponent(names[0]!), "")).not.toContain(names[1]!);
  });

  it("가상 데이터 파일은 홈 미리보기 컴포넌트만 가져다 쓴다 (DB·API·랭킹·수집·mock seed 코드는 쓰지 않음)", () => {
    const importers = ["app", "components", "lib", "db", "providers", "scripts", "config"]
      .flatMap((dir) => sourceFiles(dir))
      .filter((file) => /from "@\/lib\/demo\/home-preview-fixture"/.test(readFileSync(file, "utf8")));
    expect(importers.sort()).toEqual([join("components", "home", "demo-class-icons.tsx"), join("components", "home", "home-demo-preview.tsx")]);
    const iconUsers = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(dir))
      .filter((file) => /from "@\/components\/home\/demo-class-icons"/.test(readFileSync(file, "utf8")));
    expect(iconUsers).toEqual([join("components", "home", "home-demo-preview.tsx")]);
    const previewUsers = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(dir))
      .filter((file) => /from "@\/components\/home\/home-demo-preview"/.test(readFileSync(file, "utf8")));
    expect(previewUsers).toEqual([join("app", "page.tsx")]);
  });

  it("가상 데이터는 지역·게임 규칙 값이 없고, 직업·종족은 게임 설정이 아닌 화면 예시용 목록만 쓴다", () => {
    expect(homeDemoFixture.kind).toBe(HOME_DEMO_FIXTURE_KIND);
    for (const c of homeDemoFixture.characters) {
      expect(Object.keys(c).sort()).toEqual(
        ["averageItemLevel", "demoClass", "demoRace", "growthRecords", "guild", "highestItemLevel", "highestItemName", "highestItemQuality", "key", "level", "name"].sort(),
      );
      expect(DEMO_CLASSES).toContain(c.demoClass);
      expect(DEMO_RACES).toContain(c.demoRace);
    }
    // 화면 예시용 이름은 홈 미리보기 문구에 따로 있다 (게임 코드 설정을 읽지 않음)
    expect(Object.keys(d.classes).sort()).toEqual([...DEMO_CLASSES].sort());
    expect(Object.keys(d.races).sort()).toEqual([...DEMO_RACES].sort());
    for (const file of ["lib/demo/home-preview-fixture.ts", "components/home/demo-class-icons.tsx", "components/home/home-demo-preview.tsx"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/@\/config\/|locales\/ko\/game|m\.game\.|getGameScope/);
    }
  });
});
