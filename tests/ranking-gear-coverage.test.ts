import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppDatabase } from "@/db/types";
import { getCharacterRanks, getGearRanking, getHighestItemRanking, type RankingResult } from "@/lib/ranking";
import { createTestDb } from "./helpers/db";
import { hoursAgo, insertCharacter, NOW } from "./helpers/fixtures";

const mockScope = { dataEnvironment: "mock" as const, gameMode: "standard" };
const page = { page: 1, pageSize: 50 };

const gear = (avg: number | null, highest: number | null, coverage: number) => ({
  averageItemLevel: avg,
  highestItemLevel: highest,
  gearCoverage: coverage,
  gearProfileId: "mock-provisional",
  gearProfileVersion: 1,
  gearObservedAt: hoursAgo(1),
});

function rows(result: RankingResult) {
  if (result.status !== "ok") throw new Error(`랭킹 상태: ${result.status}`);
  return result.rows.map((r) => [r.rank, r.characterName]);
}

describe("장비 / 최고 아이템 랭킹과 coverage 정책", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  let lowCoverageId: string;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
    await insertCharacter(db, { characterName: "다동률", ...gear(30, 40, 1) });
    await insertCharacter(db, { characterName: "가동률", ...gear(30, 40, 1) }); // 평균·최고 동률 → 이름순
    await insertCharacter(db, { characterName: "평균높음", ...gear(31, 32, 0.8) });
    await insertCharacter(db, { characterName: "최고높음", ...gear(29, 45, 0.75) }); // 기준선(0.75)은 포함
    const low = await insertCharacter(db, { characterName: "커버리지부족", ...gear(60, 70, 0.74) });
    lowCoverageId = low.id;
    await insertCharacter(db, { characterName: "장비없음", ...gear(null, null, 0) });
  });
  afterAll(() => close());

  it("장비 랭킹: 평균 DESC → 최고 DESC → 이름 ASC, 동률이어도 순위는 연속", async () => {
    const result = await getGearRanking(db, { scope: mockScope, pagination: page, now: NOW });
    expect(rows(result)).toEqual([
      [1, "평균높음"],
      [2, "가동률"],
      [3, "다동률"],
      [4, "최고높음"],
    ]);
  });

  it("최고 아이템 랭킹: 최고 DESC → 평균 DESC → 이름 ASC", async () => {
    const result = await getHighestItemRanking(db, { scope: mockScope, pagination: page, now: NOW });
    expect(rows(result)).toEqual([
      [1, "최고높음"],
      [2, "가동률"],
      [3, "다동률"],
      [4, "평균높음"],
    ]);
  });

  it("coverage가 최소 기준보다 낮으면 장비 랭킹과 최고 아이템 랭킹에서 모두 제외한다", async () => {
    const gearResult = await getGearRanking(db, { scope: mockScope, pagination: page, now: NOW });
    const highestResult = await getHighestItemRanking(db, { scope: mockScope, pagination: page, now: NOW });
    expect(rows(gearResult).map((r) => r[1])).not.toContain("커버리지부족");
    expect(rows(highestResult).map((r) => r[1])).not.toContain("커버리지부족");
    expect(rows(gearResult).map((r) => r[1])).not.toContain("장비없음");
  });

  it("coverage 부족 캐릭터는 상세 화면에서 '장비 정보 부족' 사유를 받는다", async () => {
    const ranks = await getCharacterRanks(db, { id: lowCoverageId, dataEnvironment: "mock", gameMode: "standard" }, NOW);
    expect(ranks.find((r) => r.type === "gear")).toMatchObject({ rank: null, exclusion: "GEAR_INSUFFICIENT" });
    expect(ranks.find((r) => r.type === "highest-item")).toMatchObject({ rank: null, exclusion: "GEAR_INSUFFICIENT" });
    expect(ranks.find((r) => r.type === "level")?.rank).not.toBeNull();
  });
});

describe("승인된 Gear Profile이 없는 영역", () => {
  it("beta는 초안(DRAFT)만 있으므로 장비·최고 아이템 랭킹을 계산하지 않는다 (숫자를 만들지 않음)", async () => {
    const { db, close } = await createTestDb(["beta", "live"]);
    try {
      await insertCharacter(db, {
        characterName: "베타캐릭",
        dataEnvironment: "beta",
        averageItemLevel: 50,
        highestItemLevel: 55,
        gearCoverage: 1,
        gearProfileId: "forever-draft",
        gearProfileVersion: 1,
        gearObservedAt: hoursAgo(1),
      });
      const scope = { dataEnvironment: "beta" as const, gameMode: "standard" };
      const gearResult = await getGearRanking(db, { scope, pagination: page, now: NOW });
      const highestResult = await getHighestItemRanking(db, { scope, pagination: page, now: NOW });
      expect(gearResult).toMatchObject({ status: "unavailable", reason: "GEAR_PROFILE_NOT_APPROVED" });
      expect(highestResult).toMatchObject({ status: "unavailable", reason: "GEAR_PROFILE_NOT_APPROVED" });
      expect(gearResult.policy.gearProfile).toBeNull();
    } finally {
      await close();
    }
  });
});
