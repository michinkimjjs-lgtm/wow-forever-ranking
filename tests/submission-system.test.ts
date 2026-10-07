/**
 * Phase 3A: 공개 제출 시스템 (파일 확인, 미리보기, 동의, 보안, 중복·충돌, 관리자 검토)
 * fixture와 매핑 값은 모두 가상 테스트 값이다 (tests/fixtures/character-export/README.md).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { submissionPolicy, type SubmissionPolicy } from "@/config/submissions";
import { characterSubmissions, characters } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { getExportMapping, loadConfig, type ExportMapping } from "@/lib/config";
import { getLevelRanking } from "@/lib/ranking";
import { acceptSubmission, rejectSubmission, type ReviewConfig } from "@/lib/submissions/admin-review";
import { characterExportV1Schema } from "@/lib/submissions/export-schema";
import { handleCharacterSubmission, type SubmissionHttpDeps } from "@/lib/submissions/http";
import { checkJsonLimits, parseJsonWithLimits } from "@/lib/submissions/json-limits";
import { buildExportPreview, extractExportJson } from "@/lib/submissions/preview";
import { FixedWindowRateLimiter } from "@/lib/submissions/rate-limit";
import {
  adminTokenMatches,
  isSameOriginRequest,
  issueCsrfToken,
  signAdminSession,
  temporaryClientKey,
  verifyAdminSession,
  verifyCsrfToken,
} from "@/lib/submissions/security";
import { findSensitiveData } from "@/lib/submissions/sensitive";
import { submitCharacterExport } from "@/lib/submissions/submit";
import { ko } from "@/locales/ko";
import { createTestDb } from "./helpers/db";

const FIXTURES = "tests/fixtures/character-export";
const fixtureText = (name: string) => readFileSync(join(FIXTURES, name), "utf8");
const fixture = (name: string) => JSON.parse(fixtureText(name)) as Record<string, unknown>;

const NOW = new Date("2026-10-07T06:00:00Z");
const minutesLater = (m: number) => new Date(NOW.getTime() + m * 60_000);
const SECRET = "s".repeat(40);
const ADMIN_TOKEN = "a".repeat(40);
const ORIGIN = "http://localhost:3000";

const TEST_MAPPING: ExportMapping = {
  regionById: { "901": "test-region" },
  gameModeByActiveGameMode: { "902": "test-mode" },
  classByFile: { TESTCLASS: "warrior", OTHERCLASS: "mage" },
  raceByFile: { TestRace: "orc" },
  factionByTag: { TestFaction: "horde" },
  qualityById: { "3": "rare" },
  twoHandInventoryTypes: [17],
  nameSeparator: " ",
  maxObservationAgeDays: 14,
  maxFutureSkewSeconds: 300,
};
const forever = loadConfig().gearProfiles.find((p) => p.id === "forever-draft")!;
const reviewConfig: ReviewConfig = { mapping: () => TEST_MAPPING, slotProfile: () => forever, rankingProfile: () => null };

/** 브라우저 제출 화면과 같은 순서로 파일을 확인한다 */
function checkFile(name: string, content = fixtureText(name)) {
  if (Buffer.byteLength(content) > submissionPolicy.limits.maxBytes) return { error: "TOO_LARGE" as const };
  const extracted = extractExportJson(name, content);
  if (!extracted.ok) return { error: extracted.error };
  const parsed = parseJsonWithLimits(extracted.json, submissionPolicy.limits);
  if (!parsed.ok) return { error: parsed.error };
  if (findSensitiveData(parsed.value).length > 0) return { error: "SENSITIVE" as const };
  const checked = characterExportV1Schema.safeParse(parsed.value);
  if (!checked.success) return { error: "SCHEMA" as const };
  return { preview: buildExportPreview(checked.data, forever) };
}

// ---------------------------------------------------------------------------

describe("파일 확인과 미리보기 (브라우저 단계)", () => {
  it("정상 export는 미리보기를 만든다. GUID는 미리보기에 없다", () => {
    const result = checkFile("valid.json");
    expect(result.preview).toMatchObject({
      name: "가상",
      surname: "캐릭터",
      level: 20,
      className: "테스트직업",
      raceName: "테스트종족",
      factionName: "테스트진영",
      guildName: "가상 길드",
      gearCount: 17,
      averageItemLevel: 21,
      highestItemLevel: 37,
      coverage: 1,
      coverageStatus: "OK",
      sourceBuild: "0.0.0.00000",
      observedAt: "2026-10-07T05:50:00.000Z",
    });
    expect(JSON.stringify(result.preview)).not.toContain("FIXTURE-GUID");
  });

  it("Collector SavedVariables(.lua)에서 같은 export를 꺼낸다", () => {
    expect(checkFile("collector-savedvariables.lua").preview).toEqual(checkFile("valid.json").preview);
  });

  it.each([
    ["invalid-schema.json", "SCHEMA"],
    ["too-large.json", "TOO_LARGE"],
    ["invalid-json.json", "INVALID_JSON"],
    ["sensitive.json", "SENSITIVE"],
  ])("%s → %s", (name, error) => {
    expect(checkFile(name).error).toBe(error);
  });

  it("레벨 누락·장비 누락·coverage 부족은 형식상 통과하고 미리보기에 드러난다", () => {
    expect(checkFile("missing-level.json").preview?.level).toBeNull();
    expect(checkFile("missing-gear.json").preview).toMatchObject({ gearCount: 0, coverageStatus: "NO_GEAR_DATA" });
    expect(checkFile("low-coverage.json").preview).toMatchObject({ gearCount: 5, coverageStatus: "INSUFFICIENT_COVERAGE" });
  });

  it("지원하지 않는 확장자와 export가 없는 .lua를 거부한다", () => {
    expect(checkFile("export.txt", "{}").error).toBe("UNSUPPORTED_FILE");
    expect(checkFile("Other.lua", "OtherDB = {}").error).toBe("EXPORT_NOT_FOUND");
  });

  it("오류 문구는 한국어다", () => {
    expect(ko.submit.errors.UNSUPPORTED_FILE).toBe("지원하지 않는 파일입니다.");
    expect(ko.submit.errors.SCHEMA).toBe("캐릭터 데이터 형식이 올바르지 않습니다.");
  });
});

describe("JSON 제한과 민감정보 검사", () => {
  const limits = { maxDepth: 4, maxStringLength: 10, maxNodes: 50 };
  it("깊이·문자열 길이·값 개수·금지 키를 제한한다", () => {
    expect(checkJsonLimits({ a: { b: { c: { d: { e: 1 } } } } }, limits)).toBe("JSON_TOO_DEEP");
    expect(checkJsonLimits({ a: { b: { c: { d: 1 } } } }, limits)).toBeNull();
    expect(checkJsonLimits({ a: "x".repeat(11) }, limits)).toBe("STRING_TOO_LONG");
    expect(checkJsonLimits(Array.from({ length: 60 }, () => 1), limits)).toBe("TOO_MANY_VALUES");
    expect(parseJsonWithLimits('{"__proto__": {"polluted": true}}', limits)).toEqual({ ok: false, error: "FORBIDDEN_KEY" });
    expect(checkJsonLimits({ a: [1, 2], b: "ok" }, limits)).toBeNull();
  });

  it("깊이가 매우 큰 JSON도 스택 오류 없이 거부한다", () => {
    const deep = "[".repeat(5000) + "]".repeat(5000);
    expect(parseJsonWithLimits(deep, submissionPolicy.limits)).toEqual({ ok: false, error: "JSON_TOO_DEEP" });
  });

  it("가짜 이메일·비밀번호·BattleTag·카드번호·민감 키를 찾는다", () => {
    expect(findSensitiveData(fixture("sensitive.json")).map((f) => f.kind)).toEqual(
      expect.arrayContaining(["EMAIL", "CREDENTIAL_KEYWORD"]),
    );
    expect(findSensitiveData({ note: "FakeUser#12345" })[0]?.kind).toBe("BATTLE_TAG");
    expect(findSensitiveData({ note: "0000 0000 0000 0000" })[0]?.kind).toBe("CARD_NUMBER");
    expect(findSensitiveData({ password: "x" })[0]?.kind).toBe("SENSITIVE_KEY");
  });

  it("정상 export에서는 아무것도 찾지 않는다 (아이템 링크·GUID 오탐 없음)", () => {
    for (const name of ["valid.json", "conflict.json", "low-coverage.json", "missing-gear.json"]) {
      expect(findSensitiveData(fixture(name))).toEqual([]);
    }
  });
});

describe("CSRF / Origin / 관리자 로그인 서명", () => {
  it("화면 보안 토큰은 서명과 유효 시간을 확인한다", () => {
    const token = issueCsrfToken(SECRET, NOW);
    expect(verifyCsrfToken(SECRET, token, minutesLater(10), 120)).toBe(true);
    expect(verifyCsrfToken(SECRET, token, minutesLater(121), 120)).toBe(false);
    expect(verifyCsrfToken("x".repeat(40), token, NOW, 120)).toBe(false);
    expect(verifyCsrfToken(SECRET, token.replace(/.$/, "A"), NOW, 120)).toBe(false);
    expect(verifyCsrfToken(SECRET, null, NOW, 120)).toBe(false);
  });

  it("Origin이 없거나 다르면 거부하고, 다른 사이트에서 보낸 요청(Sec-Fetch-Site)도 거부한다", () => {
    const make = (headers: Record<string, string>) => new Request(`${ORIGIN}/x`, { method: "POST", headers });
    expect(isSameOriginRequest(make({ origin: ORIGIN }), [ORIGIN])).toBe(true);
    expect(isSameOriginRequest(make({}), [ORIGIN])).toBe(false);
    expect(isSameOriginRequest(make({ origin: "https://evil.test.invalid" }), [ORIGIN])).toBe(false);
    expect(isSameOriginRequest(make({ origin: ORIGIN, "sec-fetch-site": "cross-site" }), [ORIGIN])).toBe(false);
  });

  it("요청 제한용 일시 식별값은 날짜가 바뀌면 달라지고 IP 원문을 담지 않는다", () => {
    const request = new Request(`${ORIGIN}/x`, { headers: { "x-forwarded-for": "203.0.113.7", "user-agent": "test" } });
    const today = temporaryClientKey(SECRET, request, NOW);
    expect(today).not.toContain("203.0.113.7");
    expect(temporaryClientKey(SECRET, request, minutesLater(60))).toBe(today);
    expect(temporaryClientKey(SECRET, request, minutesLater(24 * 60))).not.toBe(today);
  });

  it("관리자 로그인 값은 만료되거나 토큰이 바뀌면 무효다", () => {
    const value = signAdminSession(SECRET, ADMIN_TOKEN, minutesLater(60));
    expect(verifyAdminSession(SECRET, ADMIN_TOKEN, value, NOW)).toBe(true);
    expect(verifyAdminSession(SECRET, ADMIN_TOKEN, value, minutesLater(61))).toBe(false);
    expect(verifyAdminSession(SECRET, "b".repeat(40), value, NOW)).toBe(false);
    expect(verifyAdminSession(SECRET, ADMIN_TOKEN, undefined, NOW)).toBe(false);
    expect(adminTokenMatches(ADMIN_TOKEN, ADMIN_TOKEN)).toBe(true);
    expect(adminTokenMatches(ADMIN_TOKEN, "wrong")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 공개 제출 HTTP
// ---------------------------------------------------------------------------

function publicDeps(partial: Partial<SubmissionHttpDeps> = {}, policy: Partial<SubmissionPolicy> = {}): SubmissionHttpDeps {
  return {
    settings: { enabled: false, adminToken: null },
    appEnv: "mock",
    db: null,
    now: NOW,
    rateLimiter: new FixedWindowRateLimiter(100, 60_000),
    config: { mapping: () => TEST_MAPPING, slotProfile: () => forever, rankingProfile: () => null },
    publicSubmission: {
      settings: { enabled: true, secret: SECRET },
      policy: { ...submissionPolicy, ...policy },
      allowedOrigins: [ORIGIN],
      clientLimiter: new FixedWindowRateLimiter(100, 60_000),
      globalLimiter: new FixedWindowRateLimiter(1000, 60_000),
    },
    ...partial,
  };
}

const CONSENT = {
  consentVersion: submissionPolicy.consentVersion,
  policyVersion: submissionPolicy.policyVersion,
  agreements: { dataUsage: true, noPersonalData: true },
};

function publicRequest(
  body: unknown,
  options: { dryRun?: boolean; origin?: string | null; csrf?: string | null; now?: Date; ip?: string } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": options.ip ?? "198.51.100.1" };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  const csrf = options.csrf === undefined ? issueCsrfToken(SECRET, options.now ?? NOW) : options.csrf;
  if (csrf !== null) headers["x-forever-rank-csrf"] = csrf;
  return new Request(`${ORIGIN}/api/v1/submissions/character${options.dryRun ? "?dryRun=true" : ""}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const envelope = (name: string, consent: unknown = CONSENT) => ({ export: fixture(name), consent });

async function errorCode(res: Response) {
  return ((await res.json()) as { error: { code: string } }).error.code;
}

describe("공개 제출 HTTP (mock 배포, DB 없음)", () => {
  it("공개 제출이 꺼져 있으면 404", async () => {
    const deps = publicDeps();
    deps.publicSubmission!.settings = { enabled: false, secret: null };
    expect((await handleCharacterSubmission(publicRequest(envelope("valid.json")), deps)).status).toBe(404);
  });

  it("Origin이 다르거나 보안 토큰이 없으면 403", async () => {
    const res1 = await handleCharacterSubmission(publicRequest(envelope("valid.json"), { origin: "https://evil.test.invalid" }), publicDeps());
    expect([res1.status, await errorCode(res1)]).toEqual([403, "FORBIDDEN_ORIGIN"]);
    const res2 = await handleCharacterSubmission(publicRequest(envelope("valid.json"), { csrf: null }), publicDeps());
    expect([res2.status, await errorCode(res2)]).toEqual([403, "CSRF_INVALID"]);
  });

  it("동의가 없거나 버전이 다르면 저장 요청을 거부한다", async () => {
    const res1 = await handleCharacterSubmission(publicRequest({ export: fixture("valid.json") }), publicDeps());
    expect([res1.status, await errorCode(res1)]).toEqual([400, "CONSENT_REQUIRED"]);
    const res2 = await handleCharacterSubmission(publicRequest(envelope("valid.json", { ...CONSENT, consentVersion: "old" })), publicDeps());
    expect([res2.status, await errorCode(res2)]).toEqual([409, "CONSENT_OUTDATED"]);
    const res3 = await handleCharacterSubmission(
      publicRequest(envelope("valid.json", { ...CONSENT, agreements: { dataUsage: true, noPersonalData: false } })),
      publicDeps(),
    );
    expect(res3.status).toBe(400);
  });

  it("mock 배포는 저장하지 않고 검증(dryRun)만 한다", async () => {
    const stored = await handleCharacterSubmission(publicRequest(envelope("valid.json")), publicDeps());
    expect([stored.status, await errorCode(stored)]).toEqual([409, "MOCK_ENVIRONMENT"]);
    const dry = await handleCharacterSubmission(publicRequest(envelope("valid.json"), { dryRun: true }), publicDeps());
    expect(dry.status).toBe(200);
    const body = (await dry.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ mode: "dry-run", verificationStatus: "COMMUNITY_SUBMITTED", submissionId: null });
    expect(JSON.stringify(body)).not.toContain("FIXTURE-GUID");
  });

  it("실제 매핑이 없으면 검증(dryRun)은 통과하되 매핑 대기로 알려 준다", async () => {
    const deps = publicDeps();
    deps.config = { ...deps.config, mapping: () => getExportMapping("beta") };
    const res = await handleCharacterSubmission(publicRequest(envelope("valid.json"), { dryRun: true }), deps);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { blockedReason: string } }).data.blockedReason).toBe("MAPPING_PENDING");
  });

  it("잘못된 형식·크기·깊이·민감정보·감싸는 필드를 거부한다", async () => {
    const cases: [unknown, number, string][] = [
      [envelope("invalid-schema.json"), 400, "VALIDATION_FAILED"],
      [envelope("sensitive.json"), 422, "SENSITIVE_DATA"],
      [fixtureText("invalid-json.json"), 400, "INVALID_JSON"],
      [{ ...envelope("valid.json"), extra: 1 }, 400, "INVALID_ENVELOPE"],
      [{ export: JSON.parse("[".repeat(30) + "]".repeat(30)), consent: CONSENT }, 400, "JSON_LIMIT"],
    ];
    for (const [body, status, code] of cases) {
      const res = await handleCharacterSubmission(publicRequest(body, { dryRun: true }), publicDeps());
      expect([res.status, await errorCode(res)]).toEqual([status, code]);
    }
    const big = await handleCharacterSubmission(publicRequest({ export: fixture("too-large.json"), consent: CONSENT }), publicDeps());
    expect(big.status).toBe(413);
  });

  it("같은 클라이언트의 과도한 요청을 막는다 (429)", async () => {
    const deps = publicDeps();
    deps.publicSubmission!.clientLimiter = new FixedWindowRateLimiter(2, 60_000);
    const send = (ip: string) => handleCharacterSubmission(publicRequest(envelope("valid.json"), { dryRun: true, ip }), deps);
    expect((await send("198.51.100.9")).status).toBe(200);
    expect((await send("198.51.100.9")).status).toBe(200);
    expect((await send("198.51.100.9")).status).toBe(429);
    expect((await send("198.51.100.10")).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 실제 영역 DB: 저장, 중복, 충돌, 관리자 검토
// ---------------------------------------------------------------------------

describe("공개 제출 저장과 관리자 검토 (beta DB)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  const betaDeps = (now: Date) => publicDeps({ appEnv: "beta", db, now });
  const submit = async (name: string, now = NOW) => {
    const res = await handleCharacterSubmission(publicRequest(envelope(name), { now }), betaDeps(now));
    return { status: res.status, body: (await res.json()) as { data: Record<string, unknown>; error?: { code: string } } };
  };
  const rowsFor = async (id: string) => (await db.select().from(characterSubmissions).where(eq(characterSubmissions.id, id)))[0]!;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["beta", "live"]));
  });
  afterAll(() => close());

  let validId = "";

  it("정상 제출은 검토 대기(PENDING)로 저장되고 랭킹에는 아직 반영되지 않는다", async () => {
    const { status, body } = await submit("valid.json");
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ mode: "queued", reviewStatus: "PENDING", verificationStatus: "COMMUNITY_SUBMITTED", duplicate: false });
    validId = body.data.submissionId as string;
    const row = await rowsFor(validId);
    expect(row).toMatchObject({
      dataEnvironment: "beta",
      dataSource: "addon",
      verificationStatus: "COMMUNITY_SUBMITTED",
      reviewStatus: "PENDING",
      channel: "public",
      characterName: "가상 캐릭터",
      level: 20,
      consentVersion: submissionPolicy.consentVersion,
      policyVersion: submissionPolicy.policyVersion,
    });
    expect(row.consentedAt?.getTime()).toBe(NOW.getTime());
    // 알 수 없는 필드는 보관하지 않는다. IP 같은 요청 정보도 저장하지 않는다.
    expect(JSON.stringify(row)).not.toContain("198.51.100.1");
    expect(row.identityKey).not.toContain("FIXTURE-GUID");
    expect(await db.$count(characters)).toBe(0);
  });

  it("같은 export를 다시 제출하면 중복으로 처리하고 새로 저장하지 않는다", async () => {
    const { body } = await submit("duplicate.json", minutesLater(30));
    expect(body.data).toMatchObject({ mode: "duplicate", duplicate: true, submissionId: validId, reviewStatus: "PENDING" });
    expect(await db.$count(characterSubmissions)).toBe(1);
    expect((await rowsFor(validId)).duplicateCount).toBe(1);
  });

  it("같은 캐릭터를 너무 자주 제출하면 429 (TOO_FREQUENT)", async () => {
    const valid = fixture("valid.json");
    const next = { ...valid, observedAt: (valid.observedAt as number) + 120, character: { ...(valid.character as object), level: 21 } };
    const res = await handleCharacterSubmission(
      publicRequest({ export: next, consent: CONSENT }, { now: minutesLater(5) }),
      betaDeps(minutesLater(5)),
    );
    const { status, body } = { status: res.status, body: (await res.json()) as { error?: { code: string } } };
    expect(status).toBe(429);
    expect(body.error?.code).toBe("TOO_FREQUENT");
  });

  let conflictId = "";

  it("이전 제출과 충돌하는 데이터는 CONFLICT로 표시하고 차이를 기록한다", async () => {
    const { body } = await submit("conflict.json", minutesLater(20));
    expect(body.data).toMatchObject({ mode: "queued", reviewStatus: "CONFLICT", conflict: true });
    conflictId = body.data.submissionId as string;
    const row = await rowsFor(conflictId);
    const comparison = row.comparison as { previousSubmissionId: string; changes: { field: string }[]; issues: { code: string }[] };
    expect(comparison.previousSubmissionId).toBe(validId);
    expect(comparison.changes.map((c) => c.field)).toEqual(expect.arrayContaining(["level", "classCode"]));
    expect(comparison.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["LEVEL_DECREASE", "CLASS_CHANGED"]));
    expect(await db.$count(characters)).toBe(0);
  });

  it("레벨 누락은 저장하지 않고 422", async () => {
    const before = await db.$count(characterSubmissions);
    const { status } = await submit("missing-level.json", minutesLater(40));
    expect(status).toBe(422);
    expect(await db.$count(characterSubmissions)).toBe(before);
  });

  it("장비 누락·coverage 부족 제출도 검토 대기로 저장된다 (장비 값은 참고용)", async () => {
    const noGear = await submit("missing-gear.json", minutesLater(41));
    expect(noGear.body.data.reviewStatus).toBe("PENDING");
    const low = await submit("low-coverage.json", minutesLater(42));
    const row = await rowsFor(low.body.data.submissionId as string);
    expect(row.gearCoverage).toBeLessThan(0.75);
  });

  it("관리자가 승인하면 랭킹에 반영되지만 검증 상태는 커뮤니티 제출 그대로다", async () => {
    const outcome = await acceptSubmission(db, "beta", validId, { now: minutesLater(60), note: "확인", config: reviewConfig });
    expect(outcome.ok).toBe(true);
    const row = await rowsFor(validId);
    expect(row).toMatchObject({ reviewStatus: "ACCEPTED", verificationStatus: "COMMUNITY_SUBMITTED", reviewNote: "확인" });
    expect(row.characterId).not.toBeNull();
    const [character] = await db.select().from(characters);
    expect(character).toMatchObject({ verificationStatus: "COMMUNITY_SUBMITTED", dataSource: "addon", level: 20 });
    const ranking = await getLevelRanking(db, {
      scope: { dataEnvironment: "beta", gameMode: "test-mode" },
      pagination: { page: 1, pageSize: 50 },
      now: minutesLater(60),
    });
    expect(ranking.status === "ok" && ranking.rows.map((r) => r.characterName)).toEqual(["가상 캐릭터"]);
  });

  it("이미 처리한 제출은 다시 처리하지 않는다", async () => {
    expect(await rejectSubmission(db, "beta", validId, { now: minutesLater(61) })).toEqual({ ok: false, reason: "NOT_REVIEWABLE" });
  });

  it("충돌 제출은 확인 표시 없이 승인할 수 없고, 거부하면 랭킹이 바뀌지 않는다", async () => {
    expect(await acceptSubmission(db, "beta", conflictId, { now: minutesLater(62), config: reviewConfig })).toEqual({
      ok: false,
      reason: "CONFLICT_NEEDS_OVERRIDE",
    });
    const rejected = await rejectSubmission(db, "beta", conflictId, { now: minutesLater(63), note: "레벨 감소" });
    expect(rejected.ok && rejected.submission.reviewStatus).toBe("REJECTED");
    const [character] = await db.select().from(characters);
    expect(character!.level).toBe(20);
  });

  it("게임 값 매핑이 없으면 MAPPING_PENDING으로 보관하고, 매핑이 생긴 뒤 승인할 수 있다", async () => {
    const deps = publicDeps({ appEnv: "beta", db, now: minutesLater(70) });
    deps.config = { ...deps.config, mapping: () => getExportMapping("beta") };
    const data = { ...fixture("valid.json"), character: { ...(fixture("valid.json").character as object), guid: "FIXTURE-GUID-0009", name: "매핑대기" } };
    const res = await handleCharacterSubmission(
      publicRequest({ export: data, consent: CONSENT }, { now: minutesLater(70) }),
      deps,
    );
    const body = (await res.json()) as { data: { submissionId: string; blockedReason: string; reviewStatus: string } };
    expect(body.data).toMatchObject({ reviewStatus: "PENDING", blockedReason: "MAPPING_PENDING" });
    const emptyConfig: ReviewConfig = { ...reviewConfig, mapping: () => getExportMapping("beta") };
    expect(await acceptSubmission(db, "beta", body.data.submissionId, { now: minutesLater(71), config: emptyConfig })).toEqual({
      ok: false,
      reason: "MAPPING_PENDING",
    });
    const accepted = await acceptSubmission(db, "beta", body.data.submissionId, { now: minutesLater(72), config: reviewConfig });
    expect(accepted.ok && accepted.submission.reviewStatus).toBe("ACCEPTED");
  });

  it("DB가 VERIFIED 제출, mock 영역 제출, 동의 기록 없는 공개 제출을 거부한다", async () => {
    const base = {
      dataEnvironment: "beta" as const,
      dataSource: "addon" as const,
      verificationStatus: "COMMUNITY_SUBMITTED" as const,
      reviewStatus: "PENDING" as const,
      channel: "admin_api" as const,
      payload: {},
      payloadHash: "h",
      summary: {},
      characterName: "x",
      submittedAt: NOW,
    };
    await expect(db.insert(characterSubmissions).values({ ...base, payloadHash: "h1", verificationStatus: "VERIFIED" })).rejects.toThrow();
    await expect(db.insert(characterSubmissions).values({ ...base, payloadHash: "h2", channel: "public" })).rejects.toThrow();
    await expect(db.update(characterSubmissions).set({ verificationStatus: "VERIFIED" })).rejects.toThrow();
    await expect(db.insert(characterSubmissions).values({ ...base, payloadHash: "h3", dataEnvironment: "mock", dataSource: "mock", verificationStatus: "MOCK" })).rejects.toThrow();
  });

  it("관리자 API 경로도 제출 기록을 남기고, 같은 export는 중복으로 처리한다", async () => {
    const data = { ...fixture("valid.json"), character: { ...(fixture("valid.json").character as object), guid: "FIXTURE-GUID-0100", name: "관리자경로" } };
    const ctx = {
      targetEnvironment: "beta" as const,
      mapping: TEST_MAPPING,
      slotProfile: forever,
      rankingProfile: null,
      now: minutesLater(80),
      dryRun: false,
      db,
    };
    const first = await submitCharacterExport(data, ctx);
    expect(first).toMatchObject({ ok: true, mode: "stored", reviewStatus: "ACCEPTED", verificationStatus: "COMMUNITY_SUBMITTED" });
    const again = await submitCharacterExport(data, { ...ctx, now: minutesLater(81) });
    expect(again).toMatchObject({ ok: true, mode: "duplicate", duplicate: true });
  });
});

describe("Mock DB 격리", () => {
  it("mock 전용 DB는 실제 영역 제출 기록을 받지 않는다 (쓰기 트리거)", async () => {
    const { db, close } = await createTestDb(["mock"]);
    try {
      await expect(
        db.insert(characterSubmissions).values({
          dataEnvironment: "beta",
          dataSource: "addon",
          verificationStatus: "COMMUNITY_SUBMITTED",
          reviewStatus: "PENDING",
          channel: "admin_api",
          payload: {},
          payloadHash: "h",
          summary: {},
          characterName: "x",
          submittedAt: NOW,
        }),
      ).rejects.toThrow();
      const rows = (await db.execute(sql`SELECT count(*)::int AS n FROM character_submissions`)).rows as { n: number }[];
      expect(rows[0]!.n).toBe(0);
    } finally {
      await close();
    }
  });
});
