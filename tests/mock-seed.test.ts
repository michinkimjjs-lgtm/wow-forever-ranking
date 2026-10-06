import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { characters, guilds } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { generateMockDataset } from "@/lib/mock/generator";
import { MockSeedRefusedError, seedMockDatabase } from "@/lib/mock/seed";
import { getLevelRanking, getGearRanking } from "@/lib/ranking";
import { MockCharacterProvider } from "@/providers/mock/MockCharacterProvider";
import { createTestDb } from "./helpers/db";

const anchor = new Date("2026-10-06T00:00:00Z");

describe("결정적 Mock 데이터", () => {
  it("같은 seed와 기준 시각이면 항상 같은 데이터를 만든다", () => {
    const a = generateMockDataset({ seed: 7, anchor });
    const b = generateMockDataset({ seed: 7, anchor });
    expect(JSON.stringify(a.observations)).toBe(JSON.stringify(b.observations));
  });

  it("seed가 다르면 다른 데이터를 만든다", () => {
    const a = generateMockDataset({ seed: 7, anchor });
    const b = generateMockDataset({ seed: 8, anchor });
    expect(JSON.stringify(a.observations)).not.toBe(JSON.stringify(b.observations));
  });

  it("최소 요구 조건: 캐릭터 100명 이상, 여러 직업, 양쪽 진영, 여러 길드, 레벨 1~30", () => {
    const { observations } = generateMockDataset({ anchor });
    const latest = new Map(observations.map((o) => [o.identity.externalId, o]));
    expect(latest.size).toBeGreaterThanOrEqual(100);
    const all = [...latest.values()];
    expect(new Set(all.map((o) => o.classCode)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(all.map((o) => o.factionCode))).toEqual(new Set(["alliance", "horde"]));
    expect(new Set(all.map((o) => o.guild?.name).filter(Boolean)).size).toBeGreaterThanOrEqual(4);
    const levels = all.map((o) => o.level);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...levels)).toBeLessThanOrEqual(30);
  });

  it("모든 Mock 데이터는 dataSource = mock이고, 기준 시각 이후의 관측은 없다", () => {
    const { observations } = generateMockDataset({ anchor });
    expect(observations.every((o) => o.dataSource === "mock")).toBe(true);
    expect(observations.every((o) => new Date(o.observedAt as Date) <= anchor)).toBe(true);
  });

  it("MockProvider는 Provider 인터페이스로 최신 캐릭터와 장비를 제공한다", async () => {
    const provider = new MockCharacterProvider({ anchor, characterCount: 5 });
    const sample = provider.listObservations().at(-1)!;
    const lookup = { region: "kr", gameMode: sample.identity.gameMode, characterName: sample.identity.characterName };
    const character = await provider.getCharacter(lookup);
    const gear = await provider.getCharacterGear(lookup);
    expect(character?.dataSource).toBe("mock");
    expect(character && "equipment" in character).toBe(false);
    expect(gear?.equipment.length).toBeGreaterThan(0);
  });
});

describe("Mock seed", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  const options = { seed: 99, anchor, characterCount: 30 };
  const now = new Date("2026-10-06T03:00:00Z");

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
  });
  afterAll(() => close());

  it("여러 번 실행해도 같은 결과(같은 ID와 순위)가 나온다", async () => {
    const first = await seedMockDatabase(db, { appEnv: "mock", confirmed: true, options });
    const rankingA = await getLevelRanking(db, { scope: { dataEnvironment: "mock", gameMode: "standard" }, pagination: { page: 1, pageSize: 100 }, now });
    const gearA = await getGearRanking(db, { scope: { dataEnvironment: "mock", gameMode: "standard" }, pagination: { page: 1, pageSize: 100 }, now });

    const second = await seedMockDatabase(db, { appEnv: "mock", confirmed: true, options });
    const rankingB = await getLevelRanking(db, { scope: { dataEnvironment: "mock", gameMode: "standard" }, pagination: { page: 1, pageSize: 100 }, now });
    const gearB = await getGearRanking(db, { scope: { dataEnvironment: "mock", gameMode: "standard" }, pagination: { page: 1, pageSize: 100 }, now });

    expect(first.accepted).toBe(first.observations);
    expect(second).toEqual(first);
    expect(JSON.stringify(rankingB)).toBe(JSON.stringify(rankingA));
    expect(JSON.stringify(gearB)).toBe(JSON.stringify(gearA));
    // 이전 데이터가 남지 않는다.
    expect(await db.$count(characters)).toBe(30);
    const rows = await db.select().from(characters);
    expect(rows.every((r) => r.dataSource === "mock" && r.verificationStatus === "MOCK" && r.dataEnvironment === "mock")).toBe(true);
    expect((await db.select().from(guilds)).every((g) => g.verificationStatus === "MOCK")).toBe(true);
  });

  it("--confirm-mock 없이 실행하면 거부한다", async () => {
    await expect(seedMockDatabase(db, { appEnv: "mock", confirmed: false, options })).rejects.toThrow(MockSeedRefusedError);
  });

  it("APP_DATA_ENVIRONMENT가 mock이 아니면 거부한다", async () => {
    await expect(seedMockDatabase(db, { appEnv: "beta", confirmed: true, options })).rejects.toThrow(MockSeedRefusedError);
  });
});

describe("실제 데이터베이스에서의 Mock seed", () => {
  it("DB 식별 표식이 mock이 아니면 아무것도 쓰지 않고 거부한다", async () => {
    const { db, close } = await createTestDb(["beta", "live"]);
    try {
      await expect(seedMockDatabase(db, { appEnv: "mock", confirmed: true, options: { anchor, characterCount: 3 } })).rejects.toThrow(
        MockSeedRefusedError,
      );
      expect(await db.$count(characters)).toBe(0);
    } finally {
      await close();
    }
  });
});
