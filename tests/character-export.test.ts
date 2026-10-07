/**
 * Character Export v1 제출 처리 테스트
 * 여기의 export와 매핑 값은 모두 테스트용 가짜 값이다. 실제 WoW: Forever 데이터나 확인된 매핑이 아니다.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { characterItems, characters, ingestionRecords } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { getExportMapping, loadConfig, type ExportMapping, type GearProfile } from "@/lib/config";
import { characterExportV1Schema } from "@/lib/submissions/export-schema";
import { handleCharacterSubmission, type SubmissionHttpDeps } from "@/lib/submissions/http";
import { itemNameFromLink, normalizeCharacterExport } from "@/lib/submissions/normalize";
import { FixedWindowRateLimiter } from "@/lib/submissions/rate-limit";
import { submitCharacterExport, type SubmissionContext } from "@/lib/submissions/submit";
import { createTestDb } from "./helpers/db";

const NOW = new Date("2026-10-07T06:00:00Z");
const NOW_S = Math.floor(NOW.getTime() / 1000);

const TEST_MAPPING: ExportMapping = {
  regionById: { "901": "test-region" },
  gameModeByActiveGameMode: { "902": "test-mode" },
  classByFile: { TESTCLASS: "warrior" },
  raceByFile: { TestRace: "orc" },
  factionByTag: { TestFaction: "horde" },
  qualityById: { "3": "rare" },
  twoHandInventoryTypes: [17],
  nameSeparator: " ",
  maxObservationAgeDays: 14,
  maxFutureSkewSeconds: 300,
};

const forever = loadConfig().gearProfiles.find((p) => p.id === "forever-draft")!;
const APPROVED_FOR_TEST: GearProfile = { ...forever, id: "test-approved", status: "APPROVED" };

const SLOT_NAMES = [
  "HeadSlot", "NeckSlot", "ShoulderSlot", "BackSlot", "ChestSlot", "WristSlot", "HandsSlot", "WaistSlot",
  "LegsSlot", "FeetSlot", "Finger0Slot", "Finger1Slot", "Trinket0Slot", "Trinket1Slot", "MainHandSlot",
  "SecondaryHandSlot", "RangedSlot",
];

function validExport(overrides: Record<string, unknown> = {}) {
  return {
    schema: "forever-rank/character-export",
    schemaVersion: 1,
    collector: { name: "ForeverRankCollector", version: "0.1.0" },
    observedAt: NOW_S - 600,
    observedAtSource: "GetServerTime",
    trigger: "logout",
    client: { buildVersion: "0.0.0", buildNumber: "00000", interfaceVersion: 16001, regionId: 901 },
    gameMode: { activeGameMode: 902 },
    character: {
      guid: "TEST-GUID-1",
      name: "테스트",
      surname: "캐릭터",
      level: 20,
      classFile: "TESTCLASS",
      raceFile: "TestRace",
      faction: "TestFaction",
      isInGuild: true,
      guildName: "테스트 길드",
    },
    gear: SLOT_NAMES.map((slotName, index) => ({
      slotName,
      slotId: 100 + index,
      itemId: 5000 + index,
      itemLink: `|cff0070dd|Hitem:${5000 + index}::::|h[테스트 아이템 ${index}]|h|r`,
      itemLevel: slotName === "HeadSlot" ? 37 : 20,
      quality: 3,
      inventoryType: 1,
    })),
    levelEvents: [{ level: 20, observedAt: NOW_S - 3600, event: "PLAYER_LEVEL_UP" }],
    unavailable: [],
    ...overrides,
  };
}

function ctx(partial: Partial<SubmissionContext> = {}): SubmissionContext {
  return {
    targetEnvironment: "beta",
    mapping: TEST_MAPPING,
    slotProfile: forever,
    rankingProfile: null,
    now: NOW,
    dryRun: true,
    db: null,
    ...partial,
  };
}

describe("Character Export v1 검증 (validate)", () => {
  it("정상 JSON은 통과한다", () => {
    expect(characterExportV1Schema.safeParse(validExport()).success).toBe(true);
  });

  it.each(["schema", "schemaVersion", "collector", "client", "gameMode", "character", "gear", "levelEvents", "unavailable"])(
    "필수 필드(%s)가 없으면 거부한다",
    async (field) => {
      const data: Record<string, unknown> = validExport();
      delete data[field];
      const result = await submitCharacterExport(data, ctx());
      expect(result).toMatchObject({ ok: false, stage: "validate" });
    },
  );

  it.each([
    ["schemaVersion이 2", { schemaVersion: 2 }],
    ["observedAt이 문자열", { observedAt: "2026-10-07" }],
    ["character.level이 문자열", { character: { ...validExport().character, level: "20" } }],
    ["gear가 객체", { gear: {} }],
    ["isInGuild가 문자열", { character: { ...validExport().character, isInGuild: "yes" } }],
  ])("잘못된 타입(%s)은 거부한다", async (_label, override) => {
    const result = await submitCharacterExport(validExport(override), ctx());
    expect(result).toMatchObject({ ok: false, stage: "validate" });
  });

  it.each([
    ["음수", -1],
    ["0", 0],
    ["문자열", "20"],
    ["null", null],
  ])("잘못된 itemLevel(%s)은 거부한다", async (_label, itemLevel) => {
    const data = validExport();
    (data.gear[0] as Record<string, unknown>).itemLevel = itemLevel;
    const result = await submitCharacterExport(data, ctx());
    expect(result).toMatchObject({ ok: false, stage: "validate" });
    if (!result.ok) expect(result.issues[0]?.path).toBe("gear[0].itemLevel");
  });

  it("잘못된 gear slot: 형식 오류는 validate, 모르는 슬롯 이름은 normalize에서 거부한다", async () => {
    const badFormat = validExport();
    (badFormat.gear[0] as Record<string, unknown>).slotName = "Head Slot!";
    expect(await submitCharacterExport(badFormat, ctx())).toMatchObject({ ok: false, stage: "validate" });

    const unknown = validExport();
    (unknown.gear[0] as Record<string, unknown>).slotName = "RelicSlot";
    const result = await submitCharacterExport(unknown, ctx());
    expect(result).toMatchObject({ ok: false, stage: "normalize" });
    if (!result.ok) expect(result.issues).toContainEqual(expect.objectContaining({ code: "UNKNOWN_SLOT" }));
  });

  it("같은 슬롯 이름이 두 번 있으면 거부한다", async () => {
    const data = validExport();
    data.gear.push({ ...data.gear[0]! });
    expect(await submitCharacterExport(data, ctx())).toMatchObject({ ok: false, stage: "validate" });
  });
});

describe("정규화 (normalize)", () => {
  it("매핑 값으로 바꾸고, 이름+성, 레벨 달성 시각, 빌드를 만든다", () => {
    const parsed = characterExportV1Schema.parse(validExport());
    const result = normalizeCharacterExport(parsed, { mapping: TEST_MAPPING, slotProfile: forever, now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const o = result.observation;
    expect(o.dataSource).toBe("addon");
    expect(o.identity).toEqual({ externalId: "TEST-GUID-1", region: "test-region", gameMode: "test-mode", characterName: "테스트 캐릭터" });
    expect(o).toMatchObject({ classCode: "warrior", raceCode: "orc", factionCode: "horde", sourceBuild: "0.0.0.00000" });
    expect((o.levelReachedAt as Date).toISOString()).toBe(new Date((NOW_S - 3600) * 1000).toISOString());
    expect(o.equipment?.[0]).toMatchObject({ slotCode: "head", externalItemId: "5000", name: "테스트 아이템 0", itemLevel: 37 });
    expect("dataEnvironment" in o).toBe(false);
  });

  it("실제 설정(매핑 미확인)으로는 추정하지 않고 거부한다", async () => {
    const result = await submitCharacterExport(validExport(), ctx({ mapping: getExportMapping("beta") }));
    expect(result).toMatchObject({ ok: false, stage: "normalize" });
    if (!result.ok) {
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("MAPPING_MISSING");
      expect(codes).toContain("NAME_SEPARATOR_UNCONFIRMED");
    }
  });

  it("관측 시각이 없거나, 미래이거나, 너무 오래되면 거부한다", async () => {
    for (const observedAt of [undefined, NOW_S + 3600, NOW_S - 30 * 86400]) {
      const result = await submitCharacterExport(validExport({ observedAt }), ctx());
      expect(result).toMatchObject({ ok: false, stage: "normalize" });
    }
  });

  it("아이템 ID나 링크 이름이 없는 슬롯은 빼고 경고한다", async () => {
    const data = validExport();
    delete (data.gear[1] as Record<string, unknown>).itemId;
    (data.gear[2] as Record<string, unknown>).itemLink = "no-link-format";
    const result = await submitCharacterExport(data, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toHaveLength(2);
    expect(itemNameFromLink("|cff|Hitem:1|h[이름]|h|r")).toBe("이름");
  });
});

describe("제출 저장 (beta DB)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["beta", "live"]));
  });
  afterAll(() => close());

  it("검증에 실패하면 DB에 아무것도 쓰지 않는다", async () => {
    await submitCharacterExport({ schema: "wrong" }, ctx({ db, dryRun: false }));
    await submitCharacterExport(validExport({ observedAt: undefined }), ctx({ db, dryRun: false }));
    expect(await db.$count(ingestionRecords)).toBe(0);
    expect(await db.$count(characters)).toBe(0);
  });

  it("dryRun은 식별과 장비 계산만 하고 저장하지 않는다", async () => {
    const result = await submitCharacterExport(validExport(), ctx({ db, dryRun: true, rankingProfile: APPROVED_FOR_TEST }));
    expect(result).toMatchObject({ ok: true, mode: "dry-run", status: "VALID", identity: { match: "NEW" } });
    if (result.ok) {
      expect(result.gear?.calculation).toMatchObject({ averageItemLevel: 21, highestItemLevel: 37, coverage: 1, status: "OK" });
      expect(result.gear?.usableForRanking).toBe(true);
    }
    expect(await db.$count(characters)).toBe(0);
  });

  it("저장하면 COMMUNITY_SUBMITTED로 들어가고 VERIFIED가 되지 않는다. 원본 export를 보관한다", async () => {
    const tampered = { ...validExport(), verificationStatus: "VERIFIED", rank: 1, dataEnvironment: "live" };
    const result = await submitCharacterExport(tampered, ctx({ db, dryRun: false }));
    expect(result).toMatchObject({ ok: true, mode: "stored", status: "ACCEPTED", verificationStatus: "COMMUNITY_SUBMITTED" });
    const [row] = await db.select().from(characters);
    expect(row).toMatchObject({
      dataEnvironment: "beta",
      dataSource: "addon",
      verificationStatus: "COMMUNITY_SUBMITTED",
      characterName: "테스트 캐릭터",
      level: 20,
      currentLevelTimingBasis: "SOURCE_REPORTED",
    });
    // beta에는 APPROVED 프로필이 없으므로 평균 장비 레벨을 저장하지 않는다 (랭킹에 쓰지 않음)
    expect(row!.averageItemLevel).toBeNull();
    expect(row!.gearProfileId).toBeNull();
    expect(await db.$count(characterItems, eq(characterItems.characterId, row!.id))).toBe(17);
    const [record] = await db.select().from(ingestionRecords);
    expect((record!.payload as { schema: string }).schema).toBe("forever-rank/character-export");
    expect(record!.parserVersion).toBe("character-export-v1@1");
    if (result.ok) {
      expect(result.gear?.profileStatus).toBe("DRAFT");
      expect(result.gear?.usableForRanking).toBe(false);
    }
  });

  it("같은 GUID로 다시 제출하면 같은 캐릭터로 식별한다", async () => {
    const result = await submitCharacterExport(
      validExport({ observedAt: NOW_S - 60, character: { ...validExport().character, level: 21 } }),
      ctx({ db, dryRun: false }),
    );
    expect(result).toMatchObject({ ok: true, identity: { match: "EXTERNAL_ID" } });
    expect(await db.$count(characters)).toBe(1);
  });
});

describe("POST /api/v1/submissions/character 처리", () => {
  const TOKEN = "t".repeat(40);
  function deps(partial: Partial<SubmissionHttpDeps> = {}): SubmissionHttpDeps {
    return {
      settings: { enabled: true, adminToken: TOKEN },
      appEnv: "mock",
      db: null,
      now: NOW,
      rateLimiter: new FixedWindowRateLimiter(100, 60_000),
      config: { mapping: () => TEST_MAPPING, slotProfile: () => forever, rankingProfile: () => null },
      ...partial,
    };
  }
  function request(body: unknown, options: { token?: string; query?: string; contentType?: string } = {}) {
    return new Request(`http://localhost/api/v1/submissions/character${options.query ?? "?dryRun=true"}`, {
      method: "POST",
      headers: {
        "content-type": options.contentType ?? "application/json",
        ...(options.token !== undefined ? { authorization: `Bearer ${options.token}` } : { authorization: `Bearer ${TOKEN}` }),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("기능 플래그가 꺼져 있으면 404", async () => {
    const res = await handleCharacterSubmission(request(validExport()), deps({ settings: { enabled: false, adminToken: null } }));
    expect(res.status).toBe(404);
  });

  it("관리자 토큰이 없거나 틀리면 401", async () => {
    expect((await handleCharacterSubmission(request(validExport(), { token: "wrong" }), deps())).status).toBe(401);
  });

  it("JSON이 아니면 415, 너무 크면 413, 읽을 수 없으면 400", async () => {
    expect((await handleCharacterSubmission(request("{}", { contentType: "text/plain" }), deps())).status).toBe(415);
    expect((await handleCharacterSubmission(request("x".repeat(300 * 1024)), deps())).status).toBe(413);
    expect((await handleCharacterSubmission(request("{not json"), deps())).status).toBe(400);
  });

  it("mock 배포에서는 dryRun만 허용한다", async () => {
    expect((await handleCharacterSubmission(request(validExport(), { query: "" }), deps())).status).toBe(409);
    const res = await handleCharacterSubmission(request(validExport()), deps());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { mode: string; identity: { match: string } } };
    expect(body.data.mode).toBe("dry-run");
    expect(body.data.identity.match).toBe("SKIPPED");
  });

  it("검증 실패는 400 / 정규화 실패는 422이고, 한국어 메시지를 준다", async () => {
    const bad = await handleCharacterSubmission(request({ schema: "x" }), deps());
    expect(bad.status).toBe(400);
    const unmapped = await handleCharacterSubmission(request(validExport()), deps({ config: { ...deps().config, mapping: () => getExportMapping("beta") } }));
    expect(unmapped.status).toBe(422);
    const body = (await unmapped.json()) as { error: { message: string; issues: { message: string }[] } };
    expect(body.error.message).toBe("제출 데이터를 처리할 수 없습니다.");
    expect(body.error.issues[0]?.message).toMatch(/[가-힣]/);
  });

  it("요청 제한을 넘으면 429", async () => {
    const limited = deps({ rateLimiter: new FixedWindowRateLimiter(1, 60_000) });
    expect((await handleCharacterSubmission(request(validExport()), limited)).status).toBe(200);
    expect((await handleCharacterSubmission(request(validExport()), limited)).status).toBe(429);
  });
});
