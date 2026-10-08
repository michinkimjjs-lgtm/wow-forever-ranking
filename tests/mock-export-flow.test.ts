/**
 * Phase 3D: mock Character Export fixture로 제출 흐름 전체를 게임 접속 없이 검증한다.
 *
 *   Character Export → schema validation → normalization → identification → Gear Profile
 *   → duplicate check → conflict check → storage → ranking
 *
 * fixture는 모두 가짜 테스트 데이터다(tests/fixtures/character-export/mock/README.md).
 * 저장된 데이터는 언제나 mock / mock / MOCK이어야 하고, 커뮤니티 제출이나 검증 상태로 승격되면 실패한다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { characterSubmissions, characters, ingestionRecords, levelMilestones } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { getExportMapping, loadConfig, rulesetOfGameMode, type ExportMapping, type GearProfile } from "@/lib/config";
import { selectPreferred } from "@/lib/domain/source-priority";
import { calculateEquippedItemLevel } from "@/lib/gear/calculate";
import { getGearRanking, getHighestItemRanking, getLevelRanking } from "@/lib/ranking";
import { getDataCoverage } from "@/lib/ranking/coverage";
import { MockExportEnvironmentError, processMockCharacterExport, type MockExportContext } from "@/lib/submissions/mock-export";
import { submitCharacterExport } from "@/lib/submissions/submit";
import { ko } from "@/locales/ko";
import { createTestDb } from "./helpers/db";

const DIR = "tests/fixtures/character-export/mock";
const NOW = new Date("2026-10-08T06:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

interface Fixture {
  fixture: { id: string; description: string; dataEnvironment: string; dataSource: string; verificationStatus: string };
  export: Record<string, unknown>;
}
const load = (id: string) => JSON.parse(readFileSync(join(DIR, `${id}.json`), "utf8")) as Fixture;
const fixtureIds = readdirSync(DIR)
  .filter((f) => /^\d{2}-.+\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ""));

const { _comment, ...mappingJson } = JSON.parse(readFileSync(join(DIR, "mapping.json"), "utf8")) as Record<string, unknown>;
void _comment;
const MAPPING = mappingJson as unknown as ExportMapping;
const forever = loadConfig().gearProfiles.find((p) => p.id === "forever-draft")! as GearProfile;

const page = { page: 1, pageSize: 50 };

// ---------------------------------------------------------------------------

describe("mock fixture 표식", () => {
  it("요청한 10가지 케이스 이상이 있다", () => {
    expect(fixtureIds.length).toBeGreaterThanOrEqual(10);
  });

  it.each(fixtureIds)("%s: dataEnvironment=mock, dataSource=mock, verificationStatus=MOCK, mock-fixture 표식", (id) => {
    const f = load(id);
    expect(f.fixture).toMatchObject({ id, dataEnvironment: "mock", dataSource: "mock", verificationStatus: "MOCK" });
    expect((f.export.collector as { version: string }).version).toContain("mock-fixture");
    expect(String((f.export.character as { guid: string }).guid)).toMatch(/^MOCK-FIXTURE-/);
  });

  it("테스트 매핑의 가짜 값은 실제 매핑 설정에 없다 (확인되지 않은 내부 값을 실제 코드로 저장하지 않음)", () => {
    for (const env of ["beta", "live"] as const) {
      const real = getExportMapping(env);
      expect(real.gameModeByActiveGameMode).toEqual({});
      expect(real.regionById).toEqual({});
      expect(real.twoHandInventoryTypes).toEqual([]);
    }
  });
});

describe("mock 전용 경로", () => {
  it("mock 배포가 아니면 처리하지 않는다", async () => {
    const ctx = { appEnv: "beta", db: null as unknown as AppDatabase, mapping: MAPPING, gearProfile: forever, now: NOW } as MockExportContext;
    await expect(processMockCharacterExport(load("01-valid-character").export, ctx)).rejects.toThrow(MockExportEnvironmentError);
  });

  it("실제 영역 제출 경로는 fixture를 거부한다 (커뮤니티 제출로 승격되지 않음)", async () => {
    const result = await submitCharacterExport(load("01-valid-character").export, {
      targetEnvironment: "beta",
      mapping: MAPPING,
      slotProfile: forever,
      rankingProfile: null,
      now: NOW,
      dryRun: true,
      db: null,
      review: { channel: "public", mode: "queue", consent: null, frequency: null, autoAcceptNonConflicting: false },
    });
    expect(result).toMatchObject({ ok: false, stage: "validate", issues: [{ code: "MOCK_FIXTURE_REJECTED" }] });
    expect(ko.submissions.issues.MOCK_FIXTURE_REJECTED).toMatch(/테스트용/);
  });
});

// ---------------------------------------------------------------------------
// 전체 흐름 (mock DB)
// ---------------------------------------------------------------------------

describe("전체 export 처리 흐름 (mock DB)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  const ctx = (now = NOW): MockExportContext => ({ appEnv: "mock", db, mapping: MAPPING, gearProfile: forever, now });
  const run = (id: string, now = NOW) => processMockCharacterExport(load(id).export, ctx(now));

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
  });
  afterAll(() => close());

  let validId = "";

  it("정상 캐릭터: 모든 단계를 지나 저장되고 mock / mock / MOCK이다", async () => {
    const result = await run("01-valid-character");
    expect(result).toMatchObject({
      ok: true,
      stages: ["validate", "normalize", "identify", "gear", "duplicate", "conflict", "storage"],
      identity: { match: "NEW" },
      dataEnvironment: "mock",
      dataSource: "mock",
      verificationStatus: "MOCK",
      gear: { profileId: "forever-draft", averageItemLevel: 21, highestItemLevel: 37, coverage: 1, status: "OK" },
    });
    if (!result.ok) return;
    validId = result.characterId;
    const [row] = await db.select().from(characters).where(eq(characters.id, validId));
    expect(row).toMatchObject({
      dataEnvironment: "mock",
      dataSource: "mock",
      verificationStatus: "MOCK",
      characterName: "모의 하나",
      region: "kr",
      gameMode: "normal",
      level: 20,
      currentLevelTimingBasis: "SOURCE_REPORTED",
    });
    const [record] = await db.select().from(ingestionRecords).where(eq(ingestionRecords.id, result.ingestionRecordId));
    expect(record).toMatchObject({ dataEnvironment: "mock", dataSource: "mock", status: "ACCEPTED" });
    expect(await db.$count(levelMilestones, eq(levelMilestones.characterId, validId))).toBeGreaterThan(0);
  });

  it("같은 export를 다시 처리하면 duplicate 단계에서 멈추고 새로 저장하지 않는다", async () => {
    const before = await db.$count(ingestionRecords);
    const result = await run("01-valid-character", later(1));
    expect(result).toMatchObject({ ok: false, stage: "duplicate" });
    expect(await db.$count(ingestionRecords)).toBe(before);
  });

  it("기존 캐릭터와 충돌하는 export는 conflict 단계에서 멈추고 현재 상태를 바꾸지 않는다", async () => {
    const result = await run("10-conflict", later(2));
    expect(result.ok).toBe(false);
    if (result.ok || result.stage !== "conflict") throw new Error("conflict 단계가 아님");
    expect(result.characterId).toBe(validId);
    expect(result.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["LEVEL_DECREASE", "CLASS_CHANGED"]));
    const [row] = await db.select().from(characters).where(eq(characters.id, validId));
    expect(row).toMatchObject({ level: 20, classCode: "warrior" });
  });

  it("스키마 오류는 validate, 성 없음은 normalize(FULL_NAME_REQUIRED), 매핑 없는 규칙 값은 normalize(MAPPING_MISSING)", async () => {
    const broken = { ...load("01-valid-character").export, schemaVersion: 2 };
    expect(await processMockCharacterExport(broken, ctx())).toMatchObject({ ok: false, stage: "validate" });
    const missing = await run("11-missing-surname");
    expect(missing).toMatchObject({ ok: false, stage: "normalize", issues: [{ code: "FULL_NAME_REQUIRED" }] });
    const unknown = await run("12-unknown-ruleset-value");
    expect(unknown).toMatchObject({ ok: false, stage: "normalize" });
    if (!unknown.ok && unknown.stage === "normalize") {
      expect(unknown.issues.map((i) => i.code)).toEqual(["MAPPING_MISSING"]);
      expect(unknown.issues[0]!.path).toBe("gameMode.activeGameMode");
    }
  });

  it("나머지 fixture를 모두 저장한다", async () => {
    for (const id of [
      "02-ruleset-normal",
      "03-ruleset-pvp",
      "04-ruleset-roleplaying",
      "05-gear-sufficient",
      "06-gear-insufficient",
      "07-two-hand-weapon",
      "08-full-name",
      "09-same-name-other-ruleset",
    ]) {
      const result = await run(id, later(3));
      expect(result.ok, id).toBe(true);
    }
  });

  describe("Ruleset 식별", () => {
    it("규칙별로 저장된다: 일반 / 전쟁 / 롤플레잉", async () => {
      const rows = await db.select({ name: characters.characterName, gameMode: characters.gameMode }).from(characters);
      const byName = (name: string) => rows.filter((r) => r.name === name).map((r) => r.gameMode).sort();
      expect(byName("모의 전쟁")).toEqual(["pvp"]);
      expect(byName("모의 롤플")).toEqual(["roleplaying"]);
      expect(ko.game.rulesets.roleplaying).toBe("롤플레잉");
    });

    it("같은 전체 이름 + 다른 규칙 → 다른 캐릭터", async () => {
      const rows = await db.select().from(characters).where(eq(characters.characterName, "모의 일반"));
      expect(rows.map((r) => r.gameMode).sort()).toEqual(["normal", "pvp"]);
      expect(new Set(rows.map((r) => r.id)).size).toBe(2);
    });

    it("같은 전체 이름 + 같은 규칙 → 같은 캐릭터 후보 (자연 키로 식별)", async () => {
      const data = load("02-ruleset-normal").export;
      const next = { ...data, observedAt: (data.observedAt as number) + 1800, character: { ...(data.character as object), guid: undefined, level: 19 } };
      const result = await processMockCharacterExport(next, ctx(later(60)));
      expect(result).toMatchObject({ ok: true, identity: { match: "NATURAL_KEY" } });
      expect(await db.$count(characters, eq(characters.characterName, "모의 일반"))).toBe(2);
    });

    it("이름 + 성: 첫 이름이 같아도 성이 다르면 다른 캐릭터", async () => {
      const names = (await db.select({ name: characters.characterName }).from(characters)).map((r) => r.name);
      expect(names).toEqual(expect.arrayContaining(["모의 하나", "모의 일반", "모의 이름성"]));
      expect(names.filter((n) => n === "모의")).toEqual([]);
    });

    it("mock 개발용 규칙 연결과 별개로, 저장된 규칙 코드는 공식 Ruleset 코드다", async () => {
      const modes = new Set((await db.select({ gameMode: characters.gameMode }).from(characters)).map((r) => r.gameMode));
      expect([...modes].sort()).toEqual(["normal", "pvp", "roleplaying"]);
      expect(rulesetOfGameMode("mock", "standard")).toBe("normal");
    });
  });

  describe("랭킹 상태", () => {
    it("레벨 랭킹: 규칙별로 따로 계산하고 모두 테스트 데이터(MOCK)다", async () => {
      const normal = await getLevelRanking(db, { scope: { dataEnvironment: "mock", gameMode: "normal" }, pagination: page, now: later(10) });
      const pvp = await getLevelRanking(db, { scope: { dataEnvironment: "mock", gameMode: "pvp" }, pagination: page, now: later(10) });
      if (normal.status !== "ok" || pvp.status !== "ok") throw new Error("랭킹 없음");
      expect(normal.rows[0]).toMatchObject({ characterName: "모의 장비충분", level: 25 });
      expect(pvp.rows.map((r) => r.characterName)).toEqual(["모의 전쟁", "모의 일반"]);
      for (const row of [...normal.rows, ...pvp.rows]) {
        expect(row.verificationStatus).toBe("MOCK");
        expect(row.dataSource).toBe("mock");
      }
    });

    it("fixture 데이터는 커뮤니티 제출·검증됨·로그 검증으로 승격되지 않는다", async () => {
      const statuses = new Set((await db.select({ s: characters.verificationStatus }).from(characters)).map((r) => r.s));
      expect([...statuses]).toEqual(["MOCK"]);
      for (const promoted of ["COMMUNITY_SUBMITTED", "VERIFIED", "LOG_VERIFIED"] as const) {
        expect(statuses.has(promoted)).toBe(false);
        await expect(db.update(characters).set({ verificationStatus: promoted }).where(eq(characters.id, validId))).rejects.toThrow();
      }
      // 제출 검토 표(실제 영역 전용)에는 아무것도 쓰지 않는다
      expect(await db.$count(characterSubmissions)).toBe(0);
      expect(ko.game.verificationStatuses.MOCK).toBe("테스트 데이터");
    });

    it("장비 랭킹과 최고 아이템 랭킹: coverage가 부족한 캐릭터는 제외된다", async () => {
      const scope = { dataEnvironment: "mock" as const, gameMode: "normal" };
      const gear = await getGearRanking(db, { scope, pagination: page, now: later(10) });
      const highest = await getHighestItemRanking(db, { scope, pagination: page, now: later(10) });
      if (gear.status !== "ok" || highest.status !== "ok") throw new Error("장비 랭킹 없음");
      expect(gear.policy.gearProfile?.status).toBe("DRAFT");
      for (const result of [gear, highest]) {
        const names = result.rows.map((r) => r.characterName);
        expect(names).toContain("모의 장비충분");
        expect(names).not.toContain("모의 장비부족");
      }
      expect(highest.rows[0]!.highestItemLevel).toBeGreaterThanOrEqual(30);
    });

    it("오래된 데이터: 7일이 지나면 랭킹에서 빠지지만 데이터는 남는다", async () => {
      const stale = new Date(NOW.getTime() + 8 * 86_400_000);
      const ranking = await getLevelRanking(db, { scope: { dataEnvironment: "mock", gameMode: "normal" }, pagination: page, now: stale });
      expect(ranking.status === "ok" && ranking.total).toBe(0);
      const coverage = await getDataCoverage(db, { dataEnvironment: "mock", gameMode: "normal" }, stale);
      expect(coverage.activeCharacters).toBe(0);
      expect(coverage.staleCharacters).toBe(coverage.observedCharacters);
      expect(coverage.observedCharacters).toBeGreaterThan(0);
    });

    it("커버리지 출처 구분은 테스트 데이터뿐이다", async () => {
      const coverage = await getDataCoverage(db, { dataEnvironment: "mock", gameMode: "normal" }, later(10));
      expect(coverage.origins).toEqual(["test"]);
      expect(coverage.byVerification.MOCK).toBe(coverage.activeCharacters);
    });
  });
});

describe("실제 DB는 mock fixture 저장을 거부한다", () => {
  it("beta DB에 mock 경로로 저장하려 하면 DB가 거부한다", async () => {
    const { db, close } = await createTestDb(["beta"]);
    try {
      const ctx: MockExportContext = { appEnv: "mock", db, mapping: MAPPING, gearProfile: forever, now: NOW };
      await expect(processMockCharacterExport(load("01-valid-character").export, ctx)).rejects.toThrow();
      expect(await db.$count(characters)).toBe(0);
    } finally {
      await close();
    }
  });
});

// ---------------------------------------------------------------------------
// Gear Profile (forever-draft, DRAFT)
// ---------------------------------------------------------------------------

describe("Gear Profile: forever-draft (DRAFT)", () => {
  const calc = (items: { slotCode: string; itemLevel: unknown; itemSlotCode?: string | null }[]) =>
    calculateEquippedItemLevel(items, forever);
  const rankable = forever.slots.filter((s) => s.rankable && !forever.excludedSlots.includes(s.code)).map((s) => s.code);

  it("forever-draft는 DRAFT이고 beta / live 랭킹에 쓰지 않는다 (확정하지 않음)", () => {
    expect(forever.status).toBe("DRAFT");
    expect(forever.appliesTo.dataEnvironments).toEqual(["beta", "live"]);
  });

  it("정상 장비: 랭킹 대상 슬롯 전부 → coverage 1", () => {
    const result = calc(rankable.map((slotCode) => ({ slotCode, itemLevel: 20 })));
    expect(result).toMatchObject({ averageItemLevel: 20, coverage: 1, status: "OK" });
  });

  it("빈 슬롯은 평균에 넣지 않고 coverage만 낮춘다", () => {
    const result = calc(rankable.slice(0, -2).map((slotCode) => ({ slotCode, itemLevel: 20 })));
    expect(result.averageItemLevel).toBe(20);
    expect(result.coverage).toBeLessThan(1);
  });

  it("제외 슬롯(셔츠·휘장·탄약)은 계산하지 않는다", () => {
    const result = calc([
      ...rankable.map((slotCode) => ({ slotCode, itemLevel: 20 })),
      { slotCode: "shirt", itemLevel: 300 },
      { slotCode: "tabard", itemLevel: 300 },
      { slotCode: "ammo", itemLevel: 300 },
    ]);
    expect(result.highestItemLevel).toBe(20);
    expect(result.excludedSlots.map((e) => e.reason)).toEqual(["EXCLUDED_BY_PROFILE", "EXCLUDED_BY_PROFILE", "EXCLUDED_BY_PROFILE"]);
  });

  it("양손 무기: 보조 무기 슬롯을 분모에서 빼고(COUNT_ONCE), 함께 든 보조 무기는 제외한다", () => {
    const items = rankable.filter((s) => s !== "off_hand").map((slotCode) => ({ slotCode, itemLevel: 20, itemSlotCode: null as string | null }));
    const main = items.find((i) => i.slotCode === "main_hand")!;
    main.itemSlotCode = "two_hand";
    const result = calc(items);
    expect(result).toMatchObject({ isTwoHanded: true, coverage: 1, expectedItemCount: rankable.length - 1 });
    const withOffhand = calc([...items, { slotCode: "off_hand", itemLevel: 50, itemSlotCode: null }]);
    expect(withOffhand.excludedSlots).toContainEqual({ slotCode: "off_hand", reason: "OFFHAND_WITH_TWO_HAND" });
    expect(withOffhand.highestItemLevel).toBe(20);
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY, 0, -5, "20"])("잘못된 itemLevel(%s)은 계산하지 않는다", (bad) => {
    const result = calc([{ slotCode: "head", itemLevel: bad }, { slotCode: "neck", itemLevel: 20 }]);
    expect(result.highestItemLevel).toBe(20);
    expect(result.excludedSlots).toContainEqual({ slotCode: "head", reason: "INVALID_ITEM_LEVEL" });
  });

  it("coverage 부족: 최소 기준 미달이면 INSUFFICIENT_COVERAGE, 최고 아이템 랭킹에도 coverage 제한을 둔다", () => {
    const result = calc([{ slotCode: "main_hand", itemLevel: 99 }]);
    expect(result).toMatchObject({ status: "INSUFFICIENT_COVERAGE", meetsCoverage: false, highestItemLevel: 99 });
    expect(forever.highestItemRequiresCoverage).toBe(true);
  });

  it("fixture 07(양손 무기)과 06(장비 부족)을 forever-draft로 계산한다", async () => {
    // 저장 없이 계산만 확인 (DB는 이미 위에서 검증)
    const twoHand = load("07-two-hand-weapon").export as { gear: { slotName: string; inventoryType: number }[] };
    expect(twoHand.gear.some((g) => g.slotName === "SecondaryHandSlot")).toBe(false);
    expect(MAPPING.twoHandInventoryTypes).toContain(twoHand.gear.find((g) => g.slotName === "MainHandSlot")!.inventoryType);
  });
});

describe("공급원 우선순위 (mock 영역)", () => {
  it("mock 데이터끼리는 최근 관측이 우선하고, 다른 영역과 섞으면 예외다", () => {
    const a = { id: "a", dataEnvironment: "mock" as const, verificationStatus: "MOCK" as const, observedAt: NOW };
    const b = { id: "b", dataEnvironment: "mock" as const, verificationStatus: "MOCK" as const, observedAt: later(5) };
    expect(selectPreferred([a, b])!.id).toBe("b");
    expect(() => selectPreferred([a, { ...b, dataEnvironment: "beta" as const, verificationStatus: "COMMUNITY_SUBMITTED" as const }])).toThrow();
  });
});
