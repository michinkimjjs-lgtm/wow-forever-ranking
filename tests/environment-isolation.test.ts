import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { databaseIdentity, characters } from "@/db/schema";
import { DatabaseIdentityError, assertDatabaseIdentityMatches, initDatabaseIdentity, validateAllowedEnvironments } from "@/db/identity";
import type { AppDatabase } from "@/db/types";
import { InvalidQueryError, parseListParams } from "@/lib/api/params";
import { cacheKey } from "@/lib/cache";
import { ingestObservation, IngestionError } from "@/lib/ingestion/ingest";
import { getGearRanking, getLevelRanking } from "@/lib/ranking";
import { searchCharacters } from "@/lib/queries/characters";
import { getProvider, ProviderRegistrationError } from "@/providers/registry";
import { ProviderNotConfiguredError } from "@/providers/types";
import { createTestDb } from "./helpers/db";
import { hoursAgo, insertCharacter, NOW, observation } from "./helpers/fixtures";

const page = { page: 1, pageSize: 50 };

describe("실제 DB(beta/live)의 Mock 유입 방지", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["beta", "live"]));
  });
  afterAll(() => close());

  it("쓰기 트리거가 mock 행을 거부한다", async () => {
    await expect(insertCharacter(db, { characterName: "목업", dataEnvironment: "mock" })).rejects.toThrow();
    expect(await db.$count(characters)).toBe(0);
  });

  it("CHECK 제약이 beta 영역의 mock 공급원 / MOCK 상태를 거부한다", async () => {
    await expect(
      insertCharacter(db, { characterName: "가짜", dataEnvironment: "beta", dataSource: "mock", verificationStatus: "MOCK" }),
    ).rejects.toThrow();
    await expect(
      insertCharacter(db, { characterName: "가짜2", dataEnvironment: "beta", dataSource: "addon", verificationStatus: "MOCK" }),
    ).rejects.toThrow();
  });

  it("수집 파이프라인은 실제 영역에 mock 공급원 데이터를 받지 않는다", async () => {
    await expect(
      ingestObservation(db, { dataEnvironment: "beta", parserVersion: "t" }, observation({ name: "목업" })),
    ).rejects.toThrow(IngestionError);
  });

  it("beta와 live 데이터는 같은 이름이어도 섞이지 않는다", async () => {
    const ctxBeta = { dataEnvironment: "beta" as const, parserVersion: "t" };
    const ctxLive = { dataEnvironment: "live" as const, parserVersion: "t" };
    await ingestObservation(db, ctxBeta, observation({ name: "공통이름", dataSource: "addon", level: 30, observedAt: hoursAgo(2) }));
    await ingestObservation(db, ctxLive, observation({ name: "공통이름", dataSource: "addon", level: 5, observedAt: hoursAgo(2) }));
    await ingestObservation(db, ctxLive, observation({ name: "라이브전용", dataSource: "addon", level: 7, observedAt: hoursAgo(2) }));

    const beta = await getLevelRanking(db, { scope: { dataEnvironment: "beta", gameMode: "standard" }, pagination: page, now: NOW });
    const live = await getLevelRanking(db, { scope: { dataEnvironment: "live", gameMode: "standard" }, pagination: page, now: NOW });
    if (beta.status !== "ok" || live.status !== "ok") throw new Error();
    expect(beta.rows.map((r) => [r.characterName, r.level])).toEqual([["공통이름", 30]]);
    expect(live.rows.map((r) => [r.characterName, r.level])).toEqual([
      ["라이브전용", 7],
      ["공통이름", 5],
    ]);
    expect(beta.rows[0]!.verificationStatus).toBe("COMMUNITY_SUBMITTED");

    const search = await searchCharacters(db, { dataEnvironment: "beta" }, { q: "이름" }, page, NOW);
    expect(search.rows.map((r) => r.level)).toEqual([30]);
  });

  it("beta / live에 승인된 Gear Profile이 없으면 장비 랭킹을 계산하지 않는다", async () => {
    const result = await getGearRanking(db, { scope: { dataEnvironment: "beta", gameMode: "standard" }, pagination: page, now: NOW });
    expect(result.status).toBe("unavailable");
  });

  it("DB 식별 표식은 바꾸거나 지울 수 없다", async () => {
    await expect(db.update(databaseIdentity).set({ allowedDataEnvironments: ["mock"] })).rejects.toThrow();
    await expect(db.delete(databaseIdentity)).rejects.toThrow();
    await expect(initDatabaseIdentity(db, ["mock"])).rejects.toThrow(DatabaseIdentityError);
  });

  it("앱 시작 검사: mock 배포는 실제 DB에 연결할 수 없다", async () => {
    await expect(assertDatabaseIdentityMatches(db, "mock")).rejects.toThrow(DatabaseIdentityError);
    await expect(assertDatabaseIdentityMatches(db, "beta")).resolves.toBeUndefined();
  });
});

describe("Mock DB의 실제 데이터 유입 방지", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
  });
  afterAll(() => close());

  it("쓰기 트리거가 beta 행을 거부한다", async () => {
    await expect(insertCharacter(db, { characterName: "베타", dataEnvironment: "beta" })).rejects.toThrow();
  });

  it("앱 시작 검사: 실제 배포는 mock DB에 연결할 수 없다", async () => {
    await expect(assertDatabaseIdentityMatches(db, "live")).rejects.toThrow(DatabaseIdentityError);
  });
});

describe("식별 표식이 없는 DB", () => {
  it("어떤 게임 데이터도 쓸 수 없고 앱 시작 검사도 실패한다", async () => {
    const { db, close } = await createTestDb(null);
    try {
      await expect(insertCharacter(db, { characterName: "무표식" })).rejects.toThrow();
      await expect(assertDatabaseIdentityMatches(db, "mock")).rejects.toThrow(DatabaseIdentityError);
    } finally {
      await close();
    }
  });
});

describe("배포 수준 안전장치", () => {
  it("mock과 실제 영역을 함께 허용하는 식별 표식은 만들 수 없다", () => {
    expect(() => validateAllowedEnvironments(["mock", "beta"])).toThrow(DatabaseIdentityError);
    expect(validateAllowedEnvironments(["live", "beta"])).toEqual(["beta", "live"]);
  });

  it("MockProvider는 mock 배포에서만, 실제 Provider는 실제 배포에서만 등록된다", async () => {
    expect(() => getProvider("beta", "mock")).toThrow(ProviderRegistrationError);
    expect(() => getProvider("mock", "blizzard")).toThrow(ProviderRegistrationError);
    expect(getProvider("mock", "mock", { characterCount: 1 }).dataSource).toBe("mock");
    // 존재가 확인되지 않은 API는 구현하지 않는다.
    await expect(getProvider("beta", "blizzard").getCharacter({ region: "kr", gameMode: "x", characterName: "y" })).rejects.toThrow(
      ProviderNotConfiguredError,
    );
  });

  it("실제 배포의 요청은 mock 데이터를 지정할 수 없고, mock 배포의 요청은 실제 데이터를 지정할 수 없다", () => {
    expect(() => parseListParams(new URLSearchParams("dataEnvironment=beta"), "mock", { strict: true })).toThrow(InvalidQueryError);
    expect(() => parseListParams(new URLSearchParams("dataEnvironment=mock"), "beta", { strict: true })).toThrow(InvalidQueryError);
  });

  it("캐시 키는 항상 dataEnvironment로 시작한다", () => {
    expect(cacheKey("mock", "rankings", "level")).toBe("mock:rankings:level");
    expect(cacheKey("live", "rankings", "level")).not.toBe(cacheKey("beta", "rankings", "level"));
  });
});
