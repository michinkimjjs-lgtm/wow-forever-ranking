/**
 * 랭킹·캐릭터·길드·통계 화면 미리보기 (components/demo/)
 *
 * - 실제 데이터 설정이 확인되지 않은 영역(beta·live)에서만 준비 중 안내 아래에 가상 데이터 미리보기를 보여 준다.
 * - 미리보기는 DB에 접근하지 않고, 가상 캐릭터·길드를 실제 페이지로 연결하지 않는다.
 * - mock 배포의 실제 화면에는 미리보기를 넣지 않는다.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_ARMORY_CHARACTER,
  DEMO_SEARCH_QUERY,
  DEMO_SLOTS,
  demoCharacterByName,
  demoEquipment,
  demoFaction,
  demoFactionCounts,
  demoGuilds,
  demoLevelBuckets,
  demoMilestones,
  demoRanks,
  demoSearch,
  homeDemoFixture,
} from "@/lib/demo/home-preview-fixture";
import type { DataEnvironment } from "@/lib/domain/enums";
import { ko } from "@/locales/ko";

const forbiddenDb = new Proxy(
  {},
  {
    get(_target, prop) {
      throw new Error(`화면 미리보기는 DB를 사용하면 안 된다 (${String(prop)})`);
    },
  },
);

const serverState: { appEnv: DataEnvironment } = { appEnv: "live" };
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/server/context", () => ({
  getServerContext: async () => ({ appEnv: serverState.appEnv, now: new Date("2026-10-30T06:00:00Z"), cache: null, db: forbiddenDb }),
  getAppEnvironmentSafe: () => serverState.appEnv,
}));

afterEach(() => {
  serverState.appEnv = "live";
});

const demo = ko.demo;
const notice = ko.home.demo.notice;
const noParams = Promise.resolve({});

async function renderPage(path: "level" | "gear" | "highest-item" | "characters" | "guilds" | "stats", env: DataEnvironment = "live") {
  serverState.appEnv = env;
  if (path === "characters") {
    const { default: Page } = await import("@/app/characters/page");
    return renderToStaticMarkup(await Page({ searchParams: noParams }));
  }
  if (path === "guilds") {
    const { default: Page } = await import("@/app/guilds/page");
    return renderToStaticMarkup(await Page());
  }
  if (path === "stats") {
    const { default: Page } = await import("@/app/stats/page");
    return renderToStaticMarkup(Page());
  }
  // 랭킹 페이지(app/rankings/*/page.tsx)가 그리는 화면 그대로
  const { RankingPageView } = await import("@/components/ranking/ranking-page");
  return renderToStaticMarkup(await RankingPageView({ type: path, searchParams: {} }));
}

const PAGES = ["level", "gear", "highest-item", "characters", "guilds", "stats"] as const;

describe("설정 미완료 영역의 화면 미리보기", () => {
  it.each(PAGES)("%s: live·beta 모두 준비 중 안내와 DEMO 미리보기를 보여 주고 DB를 쓰지 않는다", async (page) => {
    for (const env of ["live", "beta"] as const) {
      const out = await renderPage(page, env);
      // 통계 화면은 원래의 "준비 중" 안내를 그대로 둔다
      expect(out).toContain(page === "stats" ? ko.stats.body : ko.common.setupPending.title);
      expect(out).toContain(demo.pageBanner.title);
      expect(out).toContain(notice);
      expect(out).toContain('data-demo="true"');
    }
  });

  it.each(PAGES)("%s: 가상 캐릭터·길드를 실제 페이지로 연결하지 않고 입력 양식이 없다", async (page) => {
    const out = await renderPage(page);
    expect(out).not.toContain('href="/characters/');
    // 가상 캐릭터 이름은 상세 예시(/demo/characters/…)로만 연결한다
    for (const m of out.matchAll(/data-demo-character-link="(c\d+)"/g)) expect(m[1]).toMatch(/^c\d{2}$/);
    for (const m of out.matchAll(/href="([^"]+)"/g)) {
      if (m[1]!.startsWith("/demo/")) expect(m[1]).toMatch(/^\/demo\/characters\/[^/]+$/);
    }
    expect(out).not.toContain('href="/guilds/');
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<input");
  });

  it.each(["level", "gear", "highest-item"] as const)("랭킹(%s): 미리 정해 둔 12명 순서 그대로, 초상화는 종족·테두리는 직업", async (type) => {
    const out = await renderPage(type);
    const keys = homeDemoFixture.rankingsFull[type === "highest-item" ? "highestItem" : type];
    expect(keys).toHaveLength(homeDemoFixture.characters.length);
    expect(out).toContain(demo.ranking.title[type]);
    const rows = out.split("data-demo-row=").slice(1);
    expect(rows.map((row) => row.slice(1, 4))).toEqual([...keys]);
    keys.forEach((key, i) => {
      const c = homeDemoFixture.characters.find((x) => x.key === key)!;
      expect(rows[i]).toContain(`data-demo-portrait="${c.demoRace}"`);
      expect(rows[i]).toContain(`border-demo-${c.demoClass}`);
      expect(rows[i]).toContain(`data-demo-faction="${demoFaction(c.demoRace)}"`);
    });
  });

  it("홈 카드의 상위 8명은 랭킹 화면 순서의 앞부분과 같다", () => {
    for (const kind of ["level", "gear", "highestItem"] as const) {
      expect(homeDemoFixture.rankings[kind]).toEqual(homeDemoFixture.rankingsFull[kind].slice(0, 8));
    }
  });

  it("캐릭터: 검색 예시는 이름에 검색어가 든 캐릭터만, Armory는 장비·성장 기록을 보여 준다", async () => {
    const out = await renderPage("characters");
    const results = demoSearch();
    expect(results.length).toBeGreaterThan(0);
    for (const c of results) expect(c.name).toContain(DEMO_SEARCH_QUERY);
    for (const c of homeDemoFixture.characters) {
      if (!c.name.includes(DEMO_SEARCH_QUERY)) expect(results).not.toContain(c);
    }
    expect(out).toContain(`data-demo-search-results="true"`);
    expect(out).toContain(`data-demo-armory="${DEMO_ARMORY_CHARACTER}"`);
    for (const item of demoEquipment(DEMO_ARMORY_CHARACTER)) {
      expect(out).toContain(`data-demo-slot="${item.slot}"`);
      expect(out).toContain(demo.characters.equipment.slots[item.slot]);
    }
    expect(out).toContain(`data-demo-growth="true"`);
    expect(out).toContain(`data-demo-milestones="true"`);
  });

  it.each(homeDemoFixture.characters.map((c) => [c.name, c] as const))(
    "%s: 예시 장비의 평균·최고 아이템 레벨이 캐릭터 값과 맞고, 달성 기록이 현재 레벨에서 시작한다",
    (_name, c) => {
      const items = demoEquipment(c.key);
      expect(items.map((i) => i.slot)).toEqual([...DEMO_SLOTS]);
      const levels = items.flatMap((i): number[] => (i.itemLevel === null ? [] : [i.itemLevel]));
      // 빈 칸(양손 무기의 보조 무기)은 평균에서 제외
      expect(Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 100) / 100).toBe(c.averageItemLevel);
      expect(Math.max(...levels)).toBe(c.highestItemLevel);
      expect(levels.filter((v) => v === c.highestItemLevel)).toHaveLength(1);
      expect(items.find((i) => i.itemLevel === c.highestItemLevel)?.name).toBe(c.highestItemName);
      for (const i of items) if (i.name) expect(i.name).toContain("예시");
      const milestones = demoMilestones(c.key);
      expect(milestones[0]!.level).toBe(c.level);
      for (let i = 1; i < milestones.length; i++) {
        expect(milestones[i]!.level).toBeLessThan(milestones[i - 1]!.level);
        expect(milestones[i]!.daysAgo).toBeGreaterThanOrEqual(milestones[i - 1]!.daysAgo);
      }
      const ranks = demoRanks(c.key);
      for (const r of Object.values(ranks)) expect(r).toBeGreaterThanOrEqual(1);
    },
  );

  it("길드: 같은 길드 캐릭터는 같은 진영이고, 목록과 상세를 보여 준다", async () => {
    const guilds = demoGuilds();
    expect(guilds).toHaveLength(4);
    for (const g of guilds) {
      for (const m of g.members) expect(demoFaction(m.demoRace)).toBe(g.faction);
    }
    const out = await renderPage("guilds");
    for (const g of guilds) expect(out).toContain(`data-demo-guild="${g.name}"`);
    expect(out).toContain(`data-demo-guild-detail="${guilds[0]!.name}"`);
  });

  it("통계: 모든 수치는 샘플 캐릭터만 센 값이다", async () => {
    const total = homeDemoFixture.characters.length;
    expect(demoLevelBuckets().reduce((n, b) => n + b.count, 0)).toBe(total);
    const f = demoFactionCounts();
    expect(f.alliance + f.horde).toBe(total);
    const out = await renderPage("stats");
    for (const kind of ["levels", "factions", "classes", "races", "guilds"]) expect(out).toContain(`data-demo-stat="${kind}"`);
  });
});

describe("mock 배포에는 화면 미리보기를 넣지 않는다", () => {
  it("통계 화면", async () => {
    const out = await renderPage("stats", "mock");
    expect(out).not.toContain(demo.pageBanner.title);
    expect(out).not.toContain('data-demo="true"');
  });
});

describe("가상 캐릭터 상세 예시 (/demo/characters/{이름})", () => {
  async function renderDetail(name: string, env: DataEnvironment = "live") {
    serverState.appEnv = env;
    const { default: Page } = await import("@/app/demo/characters/[name]/page");
    return renderToStaticMarkup(await Page({ params: Promise.resolve({ name: encodeURIComponent(name) }) }));
  }

  it.each(homeDemoFixture.characters.map((c) => c.name))("%s: 상세 예시를 DB 없이 보여 준다", async (name) => {
    const c = demoCharacterByName(name)!;
    const out = await renderDetail(name);
    expect(out).toContain(notice);
    expect(out).toContain(demo.pageBanner.title);
    expect(out).toContain(`data-demo-armory="${c.key}"`);
    expect(out).toContain('data-demo-ranks="true"');
    for (const slot of DEMO_SLOTS) expect(out).toContain(`data-demo-slot="${slot}"`);
    expect(out).not.toContain('href="/characters/');
  });

  it("없는 이름이나 mock 배포에서는 404", async () => {
    await expect(renderDetail("없는캐릭터")).rejects.toThrow();
    await expect(renderDetail(homeDemoFixture.characters[0]!.name, "mock")).rejects.toThrow();
  });

  it("검색 엔진에 노출하지 않는다", async () => {
    serverState.appEnv = "live";
    const { generateMetadata } = await import("@/app/demo/characters/[name]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ name: encodeURIComponent(homeDemoFixture.characters[0]!.name) }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
    const { default: robots } = await import("@/app/robots");
    expect(JSON.stringify(robots())).toContain("/demo/");
  });

  it("랭킹 미리보기의 캐릭터 이름은 각자의 상세 예시로 연결된다", async () => {
    serverState.appEnv = "live";
    const { RankingPageView } = await import("@/components/ranking/ranking-page");
    const out = renderToStaticMarkup(await RankingPageView({ type: "level", searchParams: {} }));
    for (const c of homeDemoFixture.characters) {
      expect(out).toContain(`href="/demo/characters/${encodeURIComponent(c.name)}"`);
    }
  });
});
