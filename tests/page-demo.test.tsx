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
  DEMO_SEARCH_QUERY,
  demoArmory,
  demoFaction,
  demoFactionCounts,
  demoGuilds,
  demoLevelBuckets,
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
    expect(out).toContain(`data-demo-armory="true"`);
    for (const item of demoArmory.equipment) {
      expect(out).toContain(`data-demo-slot="${item.slot}"`);
      expect(out).toContain(demo.characters.equipment.slots[item.slot]);
    }
    expect(out).toContain(`data-demo-growth="true"`);
    expect(out).toContain(`data-demo-milestones="true"`);
  });

  it("Armory 예시 장비의 평균·최고 아이템 레벨은 예시 캐릭터 값과 맞는다 (빈 칸은 평균에서 제외)", () => {
    const c = homeDemoFixture.characters.find((x) => x.key === demoArmory.character)!;
    const levels = demoArmory.equipment.flatMap((i): number[] => (i.itemLevel === null ? [] : [i.itemLevel]));
    expect(Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 100) / 100).toBe(c.averageItemLevel);
    expect(Math.max(...levels)).toBe(c.highestItemLevel);
    expect(demoArmory.equipment.find((i) => i.itemLevel === c.highestItemLevel)?.name).toBe(c.highestItemName);
    // 달성 기록은 최신이 현재 레벨이고, 레벨·날짜가 함께 줄어든다
    expect(demoArmory.milestones[0]!.level).toBe(c.level);
    for (let i = 1; i < demoArmory.milestones.length; i++) {
      expect(demoArmory.milestones[i]!.level).toBeLessThan(demoArmory.milestones[i - 1]!.level);
      expect(demoArmory.milestones[i]!.daysAgo).toBeGreaterThanOrEqual(demoArmory.milestones[i - 1]!.daysAgo);
    }
  });

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
