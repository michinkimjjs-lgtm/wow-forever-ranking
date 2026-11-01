/**
 * 랭킹·캐릭터·길드·통계 화면 미리보기 (components/demo/)
 *
 * - 실제 데이터 설정이 확인되지 않은 영역(beta·live)에서만 준비 중 안내 아래에 가상 데이터 미리보기를 보여 준다.
 * - 미리보기는 DB에 접근하지 않고, 가상 캐릭터·길드를 실제 페이지로 연결하지 않는다.
 * - mock 배포의 실제 화면에는 미리보기를 넣지 않는다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import { DEMO_ITEMS } from "@/lib/demo/demo-items";
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
      expect(items.find((i) => i.itemLevel === c.highestItemLevel)?.quality).toBe(c.highestItemQuality);
      // 실제 아이템: 이름이 아이템 목록과 같고, 요구 레벨이 캐릭터 레벨 이하이며, 칸에 맞는 부위다
      const SLOT_PARTS: Record<string, string[]> = {
        head: ["머리"], neck: ["목"], shoulder: ["어깨"], back: ["등"], chest: ["가슴"], wrist: ["손목"], hands: ["손"],
        waist: ["허리"], legs: ["다리"], feet: ["발"], finger1: ["손가락"], finger2: ["손가락"], trinket1: ["장신구"],
        trinket2: ["장신구"], mainHand: ["한손", "주장비", "양손"], offHand: ["한손", "보조장비"], ranged: ["원거리"],
      };
      for (const i of items) {
        if (i.itemId === null) continue;
        const item = DEMO_ITEMS[i.itemId as keyof typeof DEMO_ITEMS];
        expect(item.name).toBe(i.name);
        expect(item.name).not.toContain("예시");
        expect(item.requiredLevel).toBeLessThanOrEqual(c.level);
        expect(SLOT_PARTS[i.slot]).toContain(item.slot);
      }
      // 양손 무기를 들면 보조 장비 칸은 비어 있다
      const main = items.find((i) => i.slot === "mainHand")!;
      const off = items.find((i) => i.slot === "offHand")!;
      if (main.itemId && DEMO_ITEMS[main.itemId as keyof typeof DEMO_ITEMS].slot === "양손") {
        expect(off.itemId).toBeNull();
        expect(off.blockedByTwoHand).toBe(true);
      }
      const rings = items.filter((i) => i.slot.startsWith("finger") && i.itemId !== null).map((i) => i.itemId);
      expect(new Set(rings).size).toBe(rings.length);
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

describe("가상 캐릭터의 착용 아이템", () => {
  it("모든 아이템은 이름·등급·아이템 레벨이 있는 실제 아이템 목록에서 온다 (지어낸 '예시' 이름 없음)", () => {
    for (const [id, item] of Object.entries(DEMO_ITEMS)) {
      expect(Number(id)).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.name).not.toContain("예시");
      expect(item.itemLevel).toBeGreaterThan(0);
    }
    const names = homeDemoFixture.activity.flatMap((a) => ("itemName" in a ? [a.itemName] : []));
    const all = Object.values(DEMO_ITEMS).map((i) => i.name);
    for (const n of names) expect(all).toContain(n);
  });

  it("장비·최고 아이템 랭킹 예시 순서는 정렬 규칙(평균 → 최고 → 이름, 최고 → 평균 → 이름)과 같다", () => {
    const chars = [...homeDemoFixture.characters];
    const gear = chars
      .slice()
      .sort((a, b) => b.averageItemLevel - a.averageItemLevel || b.highestItemLevel - a.highestItemLevel || a.name.localeCompare(b.name, "ko"))
      .map((c) => c.key);
    const high = chars
      .slice()
      .sort((a, b) => b.highestItemLevel - a.highestItemLevel || b.averageItemLevel - a.averageItemLevel || a.name.localeCompare(b.name, "ko"))
      .map((c) => c.key);
    expect([...homeDemoFixture.rankingsFull.gear]).toEqual(gear);
    expect([...homeDemoFixture.rankingsFull.highestItem]).toEqual(high);
  });
});

describe("아이템 아이콘", () => {
  const ICON_DIR = "public/demo/items";

  it("예시 아이템마다 로컬 아이콘 파일(56×56 JPEG)이 있고, 쓰지 않는 파일은 없다", () => {
    const used = new Set(Object.values(DEMO_ITEMS).map((i) => i.icon));
    const files = readdirSync(ICON_DIR);
    expect(new Set(files)).toEqual(new Set([...used].map((icon) => `${icon}.jpg`)));
    for (const file of files) {
      const b = readFileSync(join(ICON_DIR, file));
      expect([b[0], b[1], b[2]]).toEqual([0xff, 0xd8, 0xff]);
      // JPEG SOF0/SOF2 프레임에서 크기를 읽는다
      let i = 2;
      let size: [number, number] | null = null;
      while (i < b.length) {
        const marker = b[i + 1]!;
        const len = b.readUInt16BE(i + 2);
        if (marker === 0xc0 || marker === 0xc2) {
          size = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
          break;
        }
        i += 2 + len;
      }
      expect(size).toEqual([56, 56]);
    }
  });

  it("상세 화면의 장착 장비는 아이템마다 로컬 아이콘을 보여 주고 외부 이미지 주소를 쓰지 않는다", async () => {
    serverState.appEnv = "live";
    const c = homeDemoFixture.characters[0]!;
    const { default: Page } = await import("@/app/demo/characters/[name]/page");
    const out = renderToStaticMarkup(await Page({ params: Promise.resolve({ name: encodeURIComponent(c.name) }) }));
    for (const item of demoEquipment(c.key)) {
      if (item.icon) expect(out).toContain(`data-demo-item-icon="${item.icon}"`);
    }
    expect(out).not.toContain("tigrisfiles");
    expect(out).not.toContain("wowf.io");
  });
});

describe("아이템 툴팁", () => {
  it("예시 아이템마다 툴팁 정보가 있다", async () => {
    const { DEMO_ITEM_TOOLTIPS } = await import("@/lib/demo/demo-item-tooltips");
    expect(new Set(Object.keys(DEMO_ITEM_TOOLTIPS))).toEqual(new Set(Object.keys(DEMO_ITEMS)));
  });

  it("게임 툴팁 순서와 표기로 보여 준다 (기가볼트 전자반응기)", async () => {
    const { DemoItemTooltipCard } = await import("@/components/demo/demo-item");
    const out = renderToStaticMarkup(DemoItemTooltipCard({ itemId: 9492 }));
    const text = out.replace(/<[^>]+>/g, "|");
    const order = ["기가볼트 전자반응기", "아이템 레벨 36", "획득 시 귀속", "머리", "천", "방어도 43", "+9 정신력", "+8 지능", "최소 요구 레벨: 31", "착용 효과: +8 주문력", "사용 효과: 번개를", "(5분 재사용 대기시간)"];
    let at = -1;
    for (const part of order) {
      const i = text.indexOf(part, at + 1);
      expect(i, part).toBeGreaterThan(at);
      at = i;
    }
  });

  it("무기·방패 정보와 공격 시 효과를 보여 준다", async () => {
    const { DemoItemTooltipCard } = await import("@/components/demo/demo-item");
    const dagger = renderToStaticMarkup(DemoItemTooltipCard({ itemId: 6681 }));
    expect(dagger).toContain("공격력 24 - 46");
    expect(dagger).toContain("속도 1.70");
    expect(dagger).toContain("(초당 공격력 20.6)");
    expect(dagger).toContain("공격 시:");
    const shield = renderToStaticMarkup(DemoItemTooltipCard({ itemId: 7726 }));
    expect(shield).toContain("방어도 1548");
    expect(shield).toContain("방패 막기 21");
  });

  it("상세 화면의 장착한 아이템마다 툴팁을 여는 버튼이 있다 (빈 칸은 없음)", async () => {
    serverState.appEnv = "live";
    const c = homeDemoFixture.characters[0]!;
    const { default: Page } = await import("@/app/demo/characters/[name]/page");
    const out = renderToStaticMarkup(await Page({ params: Promise.resolve({ name: encodeURIComponent(c.name) }) }));
    const armory = out.slice(out.indexOf('data-demo-equipment="true"'), out.indexOf('data-demo-growth="true"'));
    const equipped = demoEquipment(c.key).filter((i) => i.itemId !== null).length;
    expect(armory.match(/data-demo-item-tooltip-trigger="true"/g)).toHaveLength(equipped);
    expect(armory).toContain('type="button"');
    expect(armory).toContain('aria-label="');
  });
});
