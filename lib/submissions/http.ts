/**
 * POST /api/v1/submissions/character 처리 (docs/SUBMISSION-SYSTEM.md, docs/ARCHITECTURE.md §8)
 *
 * 두 가지 경로가 있다.
 * 1. 관리자 API (Authorization: Bearer 관리자 토큰) — 기존 동작. 본문은 export 원본.
 *    FEATURE_CHARACTER_SUBMISSIONS가 꺼져 있으면 404.
 * 2. 공개 제출 (Authorization 헤더 없음) — /submit 화면이 보낸다. 본문은 { export, consent }.
 *    FEATURE_PUBLIC_SUBMISSIONS가 꺼져 있으면 404. Origin + 화면 보안 토큰(CSRF) + 요청 제한 + 동의 필수.
 *    저장하면 관리자 검토 대기(PENDING)가 되고, 승인 전에는 랭킹에 반영하지 않는다.
 *
 * - ?dryRun=true : 검증·정규화·식별·장비 계산·중복/충돌 확인만 하고 저장하지 않는다.
 * - mock 배포 : DB에 실제 데이터를 넣을 수 없으므로 dryRun만 허용하고, beta 기준 설정으로 검증한다(DB 조회 없음).
 */
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SubmissionPolicy } from "@/config/submissions";
import type { AppDatabase } from "@/db/types";
import type { ExportMapping, GearProfile } from "@/lib/config";
import type { DataEnvironment } from "@/lib/domain/enums";
import { getMessages } from "@/lib/i18n";
import type { FixedWindowRateLimiter } from "./rate-limit";
import { parseJsonWithLimits } from "./json-limits";
import { isSameOriginRequest, temporaryClientKey, verifyCsrfToken } from "./security";
import { findSensitiveData } from "./sensitive";
import { resolveSubmissionConfig, submitCharacterExport, type SubmissionResult } from "./submit";

export const MAX_SUBMISSION_BYTES = 256 * 1024;

export interface SubmissionHttpDeps {
  settings: { enabled: boolean; adminToken: string | null };
  appEnv: DataEnvironment;
  db: AppDatabase | null;
  now: Date;
  rateLimiter: FixedWindowRateLimiter;
  config: {
    mapping: (env: "beta" | "live") => ExportMapping;
    slotProfile: (env: "beta" | "live", gameMode: string) => GearProfile | null;
    rankingProfile: (env: "beta" | "live", gameMode: string) => GearProfile | null;
  };
  /** 공개 제출 설정. 없으면 공개 제출을 받지 않는다(404). */
  publicSubmission?: {
    settings: { enabled: boolean; secret: string | null };
    policy: SubmissionPolicy;
    /** 허용하는 Origin (사이트 주소) */
    allowedOrigins: readonly string[];
    clientLimiter: RateLimiter;
    globalLimiter: RateLimiter;
  };
}

/** 요청 제한 인터페이스. 지금은 메모리 구현(FixedWindowRateLimiter), 여러 서버로 늘리면 Redis 구현으로 바꾼다. */
export interface RateLimiter {
  take(key: string, now?: number): boolean;
}

export const CONSENT_AGREEMENTS = ["dataUsage", "noPersonalData"] as const;

const publicEnvelopeSchema = z
  .object({
    export: z.unknown(),
    consent: z
      .object({
        consentVersion: z.string().max(64),
        policyVersion: z.string().max(64),
        agreements: z.object({ dataUsage: z.literal(true), noPersonalData: z.literal(true) }).strict(),
      })
      .strict()
      .optional(),
  })
  .strict();

type Json = Record<string, unknown>;

function json(body: Json, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

type ErrorCode = keyof ReturnType<typeof getMessages>["submissions"]["errors"] | "NOT_FOUND";

function error(code: ErrorCode, status: number, extra: Json = {}) {
  const messages = getMessages();
  const message = code === "NOT_FOUND" ? messages.api.NOT_FOUND : messages.submissions.errors[code];
  return json({ error: { code, message, ...extra } }, status);
}

function tokenMatches(expected: string, header: string | null): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function handleCharacterSubmission(request: Request, deps: SubmissionHttpDeps): Promise<Response> {
  if (request.headers.get("authorization") === null) return handlePublicSubmission(request, deps);
  return handleAdminSubmission(request, deps);
}

async function handleAdminSubmission(request: Request, deps: SubmissionHttpDeps): Promise<Response> {
  const { settings } = deps;
  if (!settings.enabled || !settings.adminToken) return error("NOT_FOUND", 404);
  if (!tokenMatches(settings.adminToken, request.headers.get("authorization"))) return error("UNAUTHORIZED", 401);
  if (!deps.rateLimiter.take(`token:${settings.adminToken.slice(0, 8)}`, deps.now.getTime())) {
    return error("RATE_LIMITED", 429);
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return error("UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_SUBMISSION_BYTES) return error("PAYLOAD_TOO_LARGE", 413);
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_SUBMISSION_BYTES) return error("PAYLOAD_TOO_LARGE", 413);

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "true";
  if (deps.appEnv === "mock" && !dryRun) return error("MOCK_ENVIRONMENT", 409);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error("INVALID_JSON", 400);
  }

  const target: "beta" | "live" = deps.appEnv === "live" ? "live" : "beta";
  const result: SubmissionResult = await submitCharacterExport(body, {
    targetEnvironment: target,
    ...resolveSubmissionConfig(body, target, deps.config),
    now: deps.now,
    dryRun,
    db: deps.appEnv === "mock" ? null : deps.db,
    allowMockFixture: deps.appEnv === "mock" && dryRun,
  });

  if (!result.ok) return failure(result);
  return json(
    {
      data: result,
      meta: {
        targetEnvironment: target,
        dryRun: result.mode === "dry-run",
        generatedAt: deps.now.toISOString(),
      },
    },
    200,
  );
}

function failure(result: Extract<SubmissionResult, { ok: false }>): Response {
  if (result.stage === "limit") return error(result.limit ?? "TOO_FREQUENT", 429);
  const issueMessages = getMessages().submissions.issues;
  return error("VALIDATION_FAILED", result.stage === "validate" ? 400 : 422, {
    stage: result.stage,
    issues: result.issues.map((i) => ({ ...i, message: issueMessages[i.code] })),
    ...(result.preview ? { preview: result.preview } : {}),
  });
}

/** 공개 제출 (docs/SUBMISSION-SYSTEM.md §5). 응답에는 내부 ID(캐릭터, 수집 기록)를 넣지 않는다. */
async function handlePublicSubmission(request: Request, deps: SubmissionHttpDeps): Promise<Response> {
  const pub = deps.publicSubmission;
  if (!pub || !pub.settings.enabled || !pub.settings.secret) return error("NOT_FOUND", 404);
  const { policy, settings } = pub;
  const secret = settings.secret!;

  // 1. 같은 사이트에서 보낸 요청인지 (CSRF / Origin)
  if (!isSameOriginRequest(request, pub.allowedOrigins)) return error("FORBIDDEN_ORIGIN", 403);
  if (!verifyCsrfToken(secret, request.headers.get("x-forever-rank-csrf"), deps.now, policy.csrfTokenTtlMinutes)) {
    return error("CSRF_INVALID", 403);
  }

  // 2. 요청 제한 (일시 식별값만 사용, 저장하지 않음)
  const nowMs = deps.now.getTime();
  if (!pub.globalLimiter.take("global", nowMs) || !pub.clientLimiter.take(temporaryClientKey(secret, request, deps.now), nowMs)) {
    return error("RATE_LIMITED", 429);
  }

  // 3. 형식·크기·깊이
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return error("UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const maxBytes = policy.limits.maxBytes + 4096; // 동의 정보 등 감싸는 필드 여유
  if (Number(request.headers.get("content-length") ?? "0") > maxBytes) return error("PAYLOAD_TOO_LARGE", 413);
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) return error("PAYLOAD_TOO_LARGE", 413);
  const parsed = parseJsonWithLimits(text, policy.limits);
  if (!parsed.ok) return error(parsed.error === "INVALID_JSON" ? "INVALID_JSON" : "JSON_LIMIT", 400, { reason: parsed.error });
  const envelope = publicEnvelopeSchema.safeParse(parsed.value);
  if (!envelope.success) return error("INVALID_ENVELOPE", 400);

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";

  // 4. 개인정보로 보이는 값
  if (findSensitiveData(envelope.data.export).length > 0) return error("SENSITIVE_DATA", 422);

  // 5. 동의 (저장할 때만 필수)
  const consent = envelope.data.consent;
  if (!dryRun) {
    if (!consent) return error("CONSENT_REQUIRED", 400);
    if (consent.consentVersion !== policy.consentVersion || consent.policyVersion !== policy.policyVersion) {
      return error("CONSENT_OUTDATED", 409);
    }
  }
  if (deps.appEnv === "mock" && !dryRun) return error("MOCK_ENVIRONMENT", 409);

  const target: "beta" | "live" = deps.appEnv === "live" ? "live" : "beta";
  const result = await submitCharacterExport(envelope.data.export, {
    targetEnvironment: target,
    ...resolveSubmissionConfig(envelope.data.export, target, deps.config),
    now: deps.now,
    dryRun,
    db: deps.appEnv === "mock" ? null : deps.db,
    // mock 배포의 검증 전용 제출에서만 테스트 fixture를 검증한다(검증 상태 MOCK, 저장 없음).
    allowMockFixture: deps.appEnv === "mock" && dryRun,
    review: {
      channel: "public",
      mode: "queue",
      consent: consent ? { consentVersion: consent.consentVersion, policyVersion: consent.policyVersion, consentedAt: deps.now } : null,
      frequency: { perCharacterMinIntervalMinutes: policy.perCharacterMinIntervalMinutes, maxOpenPerCharacter: policy.maxOpenPerCharacter },
      autoAcceptNonConflicting: policy.autoAcceptNonConflicting,
    },
  });
  if (!result.ok) return failure(result);
  return json(
    {
      data: {
        mode: result.mode,
        submissionId: result.submissionId,
        reviewStatus: result.reviewStatus,
        verificationStatus: result.verificationStatus,
        testFixture: result.testFixture,
        duplicate: result.duplicate,
        blockedReason: result.blockedReason ?? null,
        preview: result.preview,
        changes: result.comparison?.changes ?? [],
        conflict: result.comparison?.conflict ?? false,
        warnings: result.warnings,
      },
      meta: { dryRun: result.mode === "dry-run", generatedAt: deps.now.toISOString() },
    },
    200,
  );
}
