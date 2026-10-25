/**
 * 애드온 없이 웹 직접 등록 (lib/submissions/manual*.ts, POST /api/v1/submissions/manual)
 * 이름·매핑 값은 모두 가상 테스트 값이다. 실제 지역·직업 매핑 표는 비어 있어야 한다(확인 전 추측 금지).
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registrationConfig, type RegistrationConfig } from "@/config/registration";
import { submissionPolicy } from "@/config/submissions";
import { characterSubmissions, characters, levelMilestones } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { getExportMapping, loadConfig, type ExportMapping } from "@/lib/config";
import { acceptSubmission, type ReviewConfig } from "@/lib/submissions/admin-review";
import { handleManualRegistration, type SubmissionHttpDeps } from "@/lib/submissions/http";
import { normalizeManualCharacter, submitManualRegistration } from "@/lib/submissions/manual";
import { MANUAL_SCHEMA, REGISTRABLE_RULESETS, manualCharacterSchema } from "@/lib/submissions/manual-schema";
import { FixedWindowRateLimiter } from "@/lib/submissions/rate-limit";
import { issueCsrfToken } from "@/lib/submissions/security";
import { createTestDb } from "./helpers/db";

const NOW = new Date("2026-10-07T06:00:00Z");
const minutesLater = (m: number) => new Date(NOW.getTime() + m * 60_000);
const SECRET = "s".repeat(40);
const ORIGIN = "http://localhost:3000";

const TEST_MAPPING: ExportMapping = {
  regionById: {},
  gameModeByActiveGameMode: {},
  classByFile: {},
  raceByFile: {},
  factionByTag: {},
  qualityById: {},
  twoHandInventoryTypes: [17],
  nameSeparator: " ",
  maxObservationAgeDays: 14,
  maxFutureSkewSeconds: 300,
};
/** 테스트에서만 주입하는 가상 매핑 */
const TEST_REGISTRATION: RegistrationConfig = {
  ...registrationConfig,
  regionCodeByBattleNetRegion: { beta: { kr: "test-region" }, live: {} },
  classCodeByName: { beta: { 테스트직업: "warrior" }, live: {} },
};
const testGameMode = (_env: string, ruleset: string) => (ruleset === "normal" ? "test-mode" : null);
const forever = loadConfig().gearProfiles.find((p) => p.id === "forever-draft")!;

function registration(overrides: Record<string, unknown> = {}) {
  return {
    schema: MANUAL_SCHEMA,
    schemaVersion: 1,
    region: "kr",
    ruleset: "normal",
    name: "가상",
    surname: "등록자",
    level: 25,
    className: "테스트직업",
    observedAt: "2026-10-07T14:50:00+09:00",
    equipment: [
      { slot: "head", itemName: "가상 투구", itemId: 9001, itemLevel: 30 },
      { slot: "chest", itemName: "번호 모르는 갑옷", itemLevel: 28 },
    ],
    evidence: { screenshotUrl: "https://images.example.test/char.png" },
    ...overrides,
  };
}

const CONSENT = {
  consentVersion: submissionPolicy.consentVersion,
  policyVersion: submissionPolicy.policyVersion,
  agreements: { dataUsage: true, noPersonalData: true, accurateInformation: true },
};

function deps(partial: Partial<SubmissionHttpDeps> = {}): SubmissionHttpDeps {
  return {
    settings: { enabled: false, adminToken: null },
    appEnv: "mock",
    db: null,
    now: NOW,
    rateLimiter: new FixedWindowRateLimiter(100, 60_000),
    config: { mapping: () => TEST_MAPPING, slotProfile: () => forever, rankingProfile: () => null },
    publicSubmission: {
      settings: { enabled: true, secret: SECRET },
      policy: submissionPolicy,
      allowedOrigins: [ORIGIN],
      clientLimiter: new FixedWindowRateLimiter(100, 60_000),
      globalLimiter: new FixedWindowRateLimiter(1000, 60_000),
    },
    ...partial,
  };
}

function request(body: unknown, options: { dryRun?: boolean; origin?: string; csrf?: string | null; now?: Date } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: options.origin ?? ORIGIN };
  const csrf = options.csrf === undefined ? issueCsrfToken(SECRET, options.now ?? NOW) : options.csrf;
  if (csrf !== null) headers["x-forever-rank-csrf"] = csrf;
  return new Request(`${ORIGIN}/api/v1/submissions/manual${options.dryRun ? "?dryRun=true" : ""}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function read(res: Response) {
  return (await res.json()) as { data?: Record<string, unknown>; error?: { code: string; message: string } };
}

// ---------------------------------------------------------------------------

describe("선택지는 확인된 값만", () => {
  it("지역은 Battle.net 문서의 us / eu / kr / tw이고, Forever 제공 여부는 모두 미확인이다", () => {
    expect(registrationConfig.battleNetRegions.map((r) => r.code)).toEqual(["us", "eu", "kr", "tw"]);
    for (const region of registrationConfig.battleNetRegions) {
      expect(region.foreverAvailability).toBe("UNKNOWN");
      expect(region.evidence.url).toMatch(/^https:\/\/community\.developer\.battle\.net\//);
    }
  });

  it("데이터 영역 region 코드와 직업 코드 매핑은 확인 전이라 비어 있다 (추측 금지)", () => {
    expect(registrationConfig.regionCodeByBattleNetRegion).toEqual({ beta: {}, live: {} });
    expect(registrationConfig.classCodeByName).toEqual({ beta: {}, live: {} });
  });

  it("게임 규칙은 출시 시 제공(AVAILABLE)되는 공식 규칙만, 하드코어는 제외", () => {
    expect([...REGISTRABLE_RULESETS].sort()).toEqual(["normal", "pvp", "roleplaying"]);
  });
});

describe("입력 스키마", () => {
  it("정상 입력을 받는다. 빈 선택 항목은 없는 값으로 정리한다", () => {
    const parsed = manualCharacterSchema.parse(registration({ raceName: "  ", guildName: "가상 길드" }));
    expect(parsed.raceName).toBeUndefined();
    expect(parsed.guildName).toBe("가상 길드");
  });

  it.each([
    ["성 누락", { surname: "" }],
    ["하드코어 규칙", { ruleset: "hardcore" }],
    ["확인되지 않은 규칙", { ruleset: "seasonal" }],
    ["목록 밖 지역", { region: "cn" }],
    ["레벨 소수", { level: 2.5 }],
    ["시간대 없는 시각", { observedAt: "2026-10-07T14:50:00" }],
    ["http 주소", { evidence: { screenshotUrl: "http://images.example.test/a.png" } }],
    ["계정 정보가 든 주소", { evidence: { screenshotUrl: "https://user:pw@images.example.test/a.png" } }],
    ["확인 자료 없음", { evidence: {} }],
    ["너무 짧은 설명", { evidence: { note: "짧음" } }],
    ["같은 슬롯 두 번", { equipment: [{ slot: "head", itemName: "가" }, { slot: "head", itemName: "나" }] }],
    ["알 수 없는 필드", { rank: 1 }],
  ])("%s → 거부", (_label, overrides) => {
    expect(manualCharacterSchema.safeParse(registration(overrides)).success).toBe(false);
  });

  it("설명만으로도 확인 자료가 된다 (10자 이상)", () => {
    expect(manualCharacterSchema.safeParse(registration({ evidence: { note: "캐릭터 정보 창에서 직접 확인했습니다." } })).success).toBe(true);
  });

  it("오류 문구는 한국어다", () => {
    const result = manualCharacterSchema.safeParse(registration({ surname: "", evidence: {} }));
    expect(result.success).toBe(false);
    for (const issue of result.error!.issues) expect(issue.message).toMatch(/[가-힣]/);
  });
});

describe("정규화", () => {
  const data = manualCharacterSchema.parse(registration());

  it("실제 설정(매핑 비어 있음)에서는 지역·규칙·직업이 매핑 대기다", () => {
    const result = normalizeManualCharacter(data, { env: "beta", mapping: getExportMapping("beta"), slotProfile: forever, now: NOW });
    expect(result.ok).toBe(false);
    const paths = !result.ok ? result.issues.map((i) => `${i.code}:${i.path}`) : [];
    expect(paths).toEqual(expect.arrayContaining(["MAPPING_MISSING:region", "MAPPING_MISSING:ruleset", "MAPPING_MISSING:className"]));
  });

  it("매핑이 주어지면 직접 제출 관측 데이터가 된다. 달성 시각·빌드는 비우고, 번호 없는 장비는 계산에서 뺀다", () => {
    const result = normalizeManualCharacter(data, {
      env: "beta",
      mapping: TEST_MAPPING,
      slotProfile: forever,
      now: NOW,
      registration: TEST_REGISTRATION,
      gameModeForRuleset: testGameMode,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation).toMatchObject({
      dataSource: "user_submission",
      levelReachedAt: null,
      sourceBuild: null,
      identity: { externalId: null, region: "test-region", gameMode: "test-mode", characterName: "가상 등록자" },
      classCode: "warrior",
      level: 25,
    });
    expect(result.observation.equipment).toEqual([{ slotCode: "head", externalItemId: "9001", name: "가상 투구", itemLevel: 30 }]);
    expect(result.warnings).toHaveLength(1);
  });

  it("미래 시각은 사용자가 고칠 문제로 돌려준다", () => {
    const future = manualCharacterSchema.parse(registration({ observedAt: "2026-10-08T00:00:00+09:00" }));
    const result = normalizeManualCharacter(future, { env: "beta", mapping: TEST_MAPPING, slotProfile: forever, now: NOW });
    expect(!result.ok && result.issues.map((i) => i.code)).toContain("OBSERVED_AT_IN_FUTURE");
  });
});

describe("직접 등록 HTTP (mock 배포, DB 없음)", () => {
  it("공개 제출이 꺼져 있으면 404", async () => {
    const d = deps();
    d.publicSubmission!.settings = { enabled: false, secret: null };
    expect((await handleManualRegistration(request({ registration: registration(), consent: CONSENT }), d)).status).toBe(404);
  });

  it("Origin이 다르거나 보안 토큰이 없으면 403", async () => {
    const body = { registration: registration(), consent: CONSENT };
    const r1 = await handleManualRegistration(request(body, { origin: "https://evil.test.invalid" }), deps());
    expect([r1.status, (await read(r1)).error?.code]).toEqual([403, "FORBIDDEN_ORIGIN"]);
    const r2 = await handleManualRegistration(request(body, { csrf: null }), deps());
    expect([r2.status, (await read(r2)).error?.code]).toEqual([403, "CSRF_INVALID"]);
  });

  it("세 가지 동의가 모두 있어야 저장 요청을 받는다", async () => {
    const r1 = await handleManualRegistration(request({ registration: registration() }), deps());
    expect([r1.status, (await read(r1)).error?.code]).toEqual([400, "CONSENT_REQUIRED"]);
    const partial = { ...CONSENT, agreements: { dataUsage: true, noPersonalData: true } };
    const r2 = await handleManualRegistration(request({ registration: registration(), consent: partial }), deps());
    expect(r2.status).toBe(400);
  });

  it("개인정보로 보이는 값은 422", async () => {
    const res = await handleManualRegistration(
      request({ registration: registration({ evidence: { note: "문의는 someone@example.test 로 주세요" } }), consent: CONSENT }, { dryRun: true }),
      deps(),
    );
    expect([res.status, (await read(res)).error?.code]).toEqual([422, "SENSITIVE_DATA"]);
  });

  it("mock 배포는 저장하지 않고 검증만 한다. 결과는 매핑 대기·커뮤니티 제출이다", async () => {
    const stored = await handleManualRegistration(request({ registration: registration(), consent: CONSENT }), deps());
    expect([stored.status, (await read(stored)).error?.code]).toEqual([409, "MOCK_ENVIRONMENT"]);
    const dry = await handleManualRegistration(request({ registration: registration() }, { dryRun: true }), deps());
    expect(dry.status).toBe(200);
    expect((await read(dry)).data).toMatchObject({
      mode: "dry-run",
      submissionId: null,
      dataSource: "user_submission",
      verificationStatus: "COMMUNITY_SUBMITTED",
      blockedReason: "MAPPING_PENDING",
    });
  });

  it("형식 오류는 한국어 메시지와 함께 400", async () => {
    const res = await handleManualRegistration(request({ registration: registration({ surname: "" }) }, { dryRun: true }), deps());
    const body = await read(res);
    expect([res.status, body.error?.code]).toEqual([400, "VALIDATION_FAILED"]);
    expect(body.error?.message).toMatch(/[가-힣]/);
  });
});

describe("직접 등록 저장과 관리자 검토 (beta DB)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["beta"]));
  });
  afterAll(async () => close());

  const rowFor = async (id: string) => (await db.select().from(characterSubmissions).where(eq(characterSubmissions.id, id)))[0]!;

  it("실제 설정으로 등록하면 검토 대기 + 매핑 대기로 저장되고 캐릭터는 만들지 않는다", async () => {
    const res = await handleManualRegistration(request({ registration: registration(), consent: CONSENT }), deps({ appEnv: "beta", db }));
    const body = await read(res);
    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({ mode: "queued", reviewStatus: "PENDING", blockedReason: "MAPPING_PENDING" });
    const row = await rowFor(body.data!.submissionId as string);
    expect(row).toMatchObject({
      dataEnvironment: "beta",
      dataSource: "user_submission",
      verificationStatus: "COMMUNITY_SUBMITTED",
      channel: "public",
      reviewStatus: "PENDING",
      blockedReason: "MAPPING_PENDING",
      characterId: null,
    });
    expect(await db.select().from(characters)).toHaveLength(0);
  });

  it("같은 내용을 다시 보내면 중복으로 처리하고, 바로 다른 내용을 보내면 반복 제출 제한에 걸린다", async () => {
    const again = await handleManualRegistration(request({ registration: registration(), consent: CONSENT }), deps({ appEnv: "beta", db }));
    expect((await read(again)).data).toMatchObject({ mode: "duplicate", duplicate: true });
    const changed = await handleManualRegistration(
      request({ registration: registration({ level: 26 }), consent: CONSENT }, { now: minutesLater(1) }),
      deps({ appEnv: "beta", db, now: minutesLater(1) }),
    );
    expect([changed.status, (await read(changed)).error?.code]).toEqual([429, "TOO_FREQUENT"]);
  });

  it("매핑이 확인돼도 자동 반영하지 않는다. 관리자가 승인하면 반영되고 검증 상태는 커뮤니티 제출이다", async () => {
    const result = await submitManualRegistration(registration({ name: "승인", observedAt: "2026-10-07T15:20:00+09:00" }), {
      targetEnvironment: "beta",
      mapping: TEST_MAPPING,
      slotProfile: forever,
      now: minutesLater(30),
      dryRun: false,
      db,
      consent: { consentVersion: CONSENT.consentVersion, policyVersion: CONSENT.policyVersion, consentedAt: minutesLater(30) },
      frequency: null,
      registration: TEST_REGISTRATION,
      gameModeForRuleset: testGameMode,
    });
    expect(result.ok && [result.mode, result.reviewStatus, result.blockedReason]).toEqual(["queued", "PENDING", null]);
    const id = result.ok ? result.submissionId! : "";
    expect(await db.select().from(characters)).toHaveLength(0);

    const config: ReviewConfig = {
      mapping: () => TEST_MAPPING,
      slotProfile: () => forever,
      rankingProfile: () => null,
      registration: TEST_REGISTRATION,
      gameModeForRuleset: testGameMode,
    };
    const outcome = await acceptSubmission(db, "beta", id, { now: minutesLater(40), config });
    expect(outcome.ok).toBe(true);
    const [character] = await db.select().from(characters);
    expect(character).toMatchObject({
      characterName: "승인 등록자",
      level: 25,
      dataSource: "user_submission",
      verificationStatus: "COMMUNITY_SUBMITTED",
    });
    const milestones = await db.select().from(levelMilestones).where(eq(levelMilestones.characterId, character!.id));
    expect(milestones.find((m) => m.level === 25)).toMatchObject({ timingBasis: "FIRST_OBSERVED", reachedAt: null });
  });

  it("매핑이 비어 있는 등록은 승인해도 매핑 대기로 남는다", async () => {
    const [pending] = await db
      .select()
      .from(characterSubmissions)
      .where(eq(characterSubmissions.blockedReason, "MAPPING_PENDING"));
    const config: ReviewConfig = { mapping: () => TEST_MAPPING, slotProfile: () => forever, rankingProfile: () => null };
    expect(await acceptSubmission(db, "beta", pending!.id, { now: minutesLater(50), config })).toEqual({ ok: false, reason: "MAPPING_PENDING" });
  });

  it("DB는 제출 표에 addon / user_submission 외의 출처를 받지 않는다", async () => {
    await expect(db.execute(sql`update character_submissions set data_source = 'blizzard'`)).rejects.toThrow();
  });
});
