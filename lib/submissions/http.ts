/**
 * POST /api/v1/submissions/character 처리 (docs/ARCHITECTURE.md §8)
 *
 * 공개 API가 아니다. 기능 플래그가 꺼져 있으면 404로 응답한다.
 * 켜져 있어도 관리자 토큰(Authorization: Bearer ...)이 있어야 한다.
 *
 * - ?dryRun=true : 검증·정규화·식별·장비 계산만 하고 저장하지 않는다.
 * - mock 배포 : DB에 실제 데이터를 넣을 수 없으므로 dryRun만 허용하고, beta 기준 설정으로 검증한다(DB 조회 없음).
 */
import { timingSafeEqual } from "node:crypto";
import type { AppDatabase } from "@/db/types";
import type { ExportMapping, GearProfile } from "@/lib/config";
import type { DataEnvironment } from "@/lib/domain/enums";
import { getMessages } from "@/lib/i18n";
import type { FixedWindowRateLimiter } from "./rate-limit";
import { submitCharacterExport, type SubmissionResult } from "./submit";

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
}

type Json = Record<string, unknown>;

function json(body: Json, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function error(code: keyof ReturnType<typeof getMessages>["submissions"]["errors"] | "NOT_FOUND", status: number, extra: Json = {}) {
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

/** 슬롯 / 랭킹 프로필 선택에 쓸 gameMode 코드를 원본에서 미리 계산한다. (매핑이 없으면 "*" 기준 프로필) */
function gameModeHint(body: unknown, mapping: ExportMapping): string {
  const raw = (body as { gameMode?: { activeGameMode?: unknown } } | null)?.gameMode?.activeGameMode;
  return (raw !== undefined && mapping.gameModeByActiveGameMode[String(raw)]) || "*";
}

export async function handleCharacterSubmission(request: Request, deps: SubmissionHttpDeps): Promise<Response> {
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
  const mapping = deps.config.mapping(target);
  const gameMode = gameModeHint(body, mapping);
  const result: SubmissionResult = await submitCharacterExport(body, {
    targetEnvironment: target,
    mapping,
    slotProfile: deps.config.slotProfile(target, gameMode),
    rankingProfile: deps.config.rankingProfile(target, gameMode),
    now: deps.now,
    dryRun,
    db: deps.appEnv === "mock" ? null : deps.db,
  });

  if (!result.ok) {
    const issueMessages = getMessages().submissions.issues;
    return error("VALIDATION_FAILED", result.stage === "validate" ? 400 : 422, {
      stage: result.stage,
      issues: result.issues.map((i) => ({ ...i, message: issueMessages[i.code] })),
    });
  }
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
