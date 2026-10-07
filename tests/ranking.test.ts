import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { characterItems, items } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { getGearRanking, getHighestItemRanking, getLevelRanking, type RankingResult } from "@/lib/ranking";
import type { RankingFilters } from "@/lib/ranking/types";
import { createTestDb } from "./helpers/db";
import { daysAgo, hoursAgo, insertCharacter, NOW } from "./helpers/fixtures";

const scope = { dataEnvironment: "mock" as const, gameMode: "standard" };
const page1 = { page: 1, pageSize: 50 };

function names(result: RankingResult) {
  if (result.status !== "ok") throw new Error("랭킹을 계산하지 못했습니다.");
  return result.rows.map((r) => r.characterName);
}

const gear = (avg: number, highest: number, coverage = 1) => ({
  averageItemLevel: avg,
  highestItemLevel: highest,
  gearCoverage: coverage,
  gearProfileId: "mock-provisional",
  gearProfileVersion: 1,
  gearObservedAt: hoursAgo(1),
});

describe("레벨 랭킹", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
    // 레벨 동률: 도달 시각이 빠른 캐릭터가 앞선다.
    await insertCharacter(db, { characterName: "늦은도달", level: 30, currentLevelReachedAt: hoursAgo(5) });
    await insertCharacter(db, { characterName: "빠른도달", level: 30, currentLevelReachedAt: hoursAgo(50) });
    // 도달 시각이 같으면 firstSeenAt이 빠른 캐릭터가 앞선다.
    await insertCharacter(db, {
      characterName: "나중발견",
      level: 25,
      currentLevelReachedAt: hoursAgo(20),
      firstSeenAt: daysAgo(2),
    });
    await insertCharacter(db, {
      characterName: "먼저발견",
      level: 25,
      currentLevelReachedAt: hoursAgo(20),
      firstSeenAt: daysAgo(5),
    });
    // 도달 시각과 firstSeenAt이 같으면 이름 순
    const same = { level: 20, currentLevelReachedAt: hoursAgo(30), firstSeenAt: daysAgo(4) };
    await insertCharacter(db, { characterName: "나다", ...same });
    await insertCharacter(db, { characterName: "가나", ...same });
    // 도달 시각을 모르면(NULL) 같은 레벨 안에서 마지막
    await insertCharacter(db, { characterName: "시각없음", level: 30, currentLevelReachedAt: null });
    // 랭킹 대상이 아닌 캐릭터
    await insertCharacter(db, { characterName: "오래된캐릭", level: 40, lastSeenAt: daysAgo(8) });
    await insertCharacter(db, { characterName: "다른모드", level: 40, gameMode: "alternate" });
  });
  afterAll(() => close());

  it("level DESC → 도달 시각 ASC → firstSeenAt ASC → 이름 ASC 순서로 정렬한다", async () => {
    const result = await getLevelRanking(db, { scope, pagination: page1, now: NOW });
    expect(names(result)).toEqual(["빠른도달", "늦은도달", "시각없음", "먼저발견", "나중발견", "가나", "나다"]);
  });

  it("순위는 서버가 1부터 연속으로 매긴다 (동순위 없음)", async () => {
    const result = await getLevelRanking(db, { scope, pagination: page1, now: NOW });
    if (result.status !== "ok") throw new Error();
    expect(result.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("7일 이상 확인되지 않은 캐릭터와 다른 게임 모드 캐릭터는 제외한다", async () => {
    const result = await getLevelRanking(db, { scope, pagination: page1, now: NOW });
    expect(names(result)).not.toContain("오래된캐릭");
    expect(names(result)).not.toContain("다른모드");
    // 기준 시각을 과거로 옮기면 7일 이내가 되어 포함된다.
    const earlier = await getLevelRanking(db, { scope, pagination: page1, now: daysAgo(2) });
    expect(names(earlier)[0]).toBe("오래된캐릭");
  });

  it("서버 측 페이지네이션: 다음 페이지의 순위는 이어서 매긴다", async () => {
    const first = await getLevelRanking(db, { scope, pagination: { page: 1, pageSize: 3 }, now: NOW });
    const second = await getLevelRanking(db, { scope, pagination: { page: 2, pageSize: 3 }, now: NOW });
    const third = await getLevelRanking(db, { scope, pagination: { page: 3, pageSize: 3 }, now: NOW });
    if (first.status !== "ok" || second.status !== "ok" || third.status !== "ok") throw new Error();
    expect(first.total).toBe(7);
    expect(second.rows.map((r) => [r.rank, r.characterName])).toEqual([
      [4, "먼저발견"],
      [5, "나중발견"],
      [6, "가나"],
    ]);
    expect(third.rows.map((r) => r.rank)).toEqual([7]);
  });

  it("lastUpdatedAt은 랭킹 대상 데이터의 가장 최근 관측 시각이다", async () => {
    const result = await getLevelRanking(db, { scope, pagination: page1, now: NOW });
    if (result.status !== "ok") throw new Error();
    expect(result.lastUpdatedAt?.toISOString()).toBe(hoursAgo(1).toISOString());
  });
});

describe("장비 / 최고 아이템 랭킹", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
    await insertCharacter(db, { characterName: "평균1위", ...gear(40, 42) });
    await insertCharacter(db, { characterName: "평균동률최고높음", ...gear(35.5, 45) });
    await insertCharacter(db, { characterName: "평균동률최고낮음", ...gear(35.5, 38) });
    await insertCharacter(db, { characterName: "나동률", ...gear(30, 33) });
    await insertCharacter(db, { characterName: "가동률", ...gear(30, 33) });
    await insertCharacter(db, { characterName: "단일아이템강자", ...gear(28, 50) });
    // 제외 대상
    await insertCharacter(db, { characterName: "장비부족", ...gear(60, 60, 0.5) });
    await insertCharacter(db, { characterName: "장비오래됨", ...gear(60, 60), gearObservedAt: daysAgo(9) });
    await insertCharacter(db, { characterName: "다른프로필", ...gear(60, 60), gearProfileVersion: 99 });
    await insertCharacter(db, { characterName: "장비없음", level: 30 });

    // 최고 아이템 이름 확인용 장착 아이템
    const [item] = await db
      .insert(items)
      .values({ dataEnvironment: "mock", externalItemId: "best", name: "가장 좋은 검", dataSource: "mock" })
      .returning();
    const strongest = await db.query.characters.findFirst({ where: (c, { eq }) => eq(c.characterName, "단일아이템강자") });
    await db.insert(characterItems).values({
      characterId: strongest!.id,
      dataEnvironment: "mock",
      slotCode: "main_hand",
      itemId: item!.id,
      itemLevel: 50,
      observedAt: hoursAgo(1),
      dataSource: "mock",
    });
  });
  afterAll(() => close());

  it("장비 랭킹: averageItemLevel DESC → highestItemLevel DESC → 이름 ASC", async () => {
    const result = await getGearRanking(db, { scope, pagination: page1, now: NOW });
    expect(names(result)).toEqual(["평균1위", "평균동률최고높음", "평균동률최고낮음", "가동률", "나동률", "단일아이템강자"]);
  });

  it("장비 랭킹은 최소 커버리지 미달, 오래된 장비, 다른 프로필 버전, 장비 없음을 제외한다", async () => {
    const result = await getGearRanking(db, { scope, pagination: page1, now: NOW });
    for (const excluded of ["장비부족", "장비오래됨", "다른프로필", "장비없음"]) {
      expect(names(result)).not.toContain(excluded);
    }
  });

  it("최고 아이템 랭킹: highestItemLevel DESC → averageItemLevel DESC → 이름 ASC", async () => {
    const result = await getHighestItemRanking(db, { scope, pagination: page1, now: NOW });
    expect(names(result)).toEqual(["단일아이템강자", "평균동률최고높음", "평균1위", "평균동률최고낮음", "가동률", "나동률"]);
    if (result.status !== "ok") throw new Error();
    expect(result.rows[0]!.highestItemName).toBe("가장 좋은 검");
  });

  it("응답 정책에 사용한 Gear Profile과 오래된 데이터 기준을 담는다", async () => {
    const result = await getGearRanking(db, { scope, pagination: page1, now: NOW });
    expect(result.policy).toEqual({
      staleAfterDays: 7,
      gearProfile: { id: "mock-provisional", version: 1, status: "DRAFT" },
    });
  });
});

describe("랭킹 필터", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  let guildA: string;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
    const { guilds } = await import("@/db/schema");
    const [g] = await db
      .insert(guilds)
      .values({
        dataEnvironment: "mock",
        region: "kr",
        gameMode: "standard",
        name: "필터 길드",
        nameNormalized: "필터 길드",
        slug: "필터-길드",
        factionCode: "horde",
        firstSeenAt: daysAgo(3),
        lastSeenAt: hoursAgo(1),
        dataSource: "mock",
        verificationStatus: "MOCK",
      })
      .returning();
    guildA = g!.id;
    await insertCharacter(db, { characterName: "호드전사", level: 20, classCode: "warrior", factionCode: "horde", guildId: guildA });
    await insertCharacter(db, { characterName: "호드마법사", level: 19, classCode: "mage", factionCode: "horde" });
    await insertCharacter(db, { characterName: "얼라전사", level: 18, classCode: "warrior", factionCode: "alliance" });
  });
  afterAll(() => close());

  const run = (filters: RankingFilters) => getLevelRanking(db, { scope, filters, pagination: page1, now: NOW });

  it("직업 필터", async () => {
    expect(names(await run({ classCode: "warrior" }))).toEqual(["호드전사", "얼라전사"]);
  });

  it("진영 필터", async () => {
    expect(names(await run({ factionCode: "horde" }))).toEqual(["호드전사", "호드마법사"]);
  });

  it("길드 필터", async () => {
    expect(names(await run({ guildId: guildA }))).toEqual(["호드전사"]);
  });

  it("필터를 함께 쓰면 모든 조건을 만족해야 한다", async () => {
    expect(names(await run({ classCode: "warrior", factionCode: "alliance" }))).toEqual(["얼라전사"]);
  });

  it("필터 결과 안에서 순위를 다시 매긴다", async () => {
    const result = await run({ factionCode: "alliance" });
    if (result.status !== "ok") throw new Error();
    expect(result.rows[0]!.rank).toBe(1);
  });

  it("검증된 데이터만: mock 영역에는 검증된 데이터가 없으므로 비어 있다", async () => {
    const result = await run({ verifiedOnly: true });
    if (result.status !== "ok") throw new Error();
    expect(result.total).toBe(0);
  });

  it("지역 필터", async () => {
    expect(names(await run({ region: "kr" }))).toHaveLength(3);
    expect(names(await run({ region: "other" }))).toHaveLength(0);
  });
});
