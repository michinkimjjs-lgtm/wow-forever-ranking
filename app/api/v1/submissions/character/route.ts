/**
 * POST /api/v1/submissions/character — Character Export v1 제출
 * - 관리자 API(Bearer 토큰, FEATURE_CHARACTER_SUBMISSIONS)와 공개 제출(/submit 화면, FEATURE_PUBLIC_SUBMISSIONS) 두 경로
 * 자세한 동작: lib/submissions/http.ts, docs/SUBMISSION-SYSTEM.md
 */
import { submissionPolicy } from "@/config/submissions";
import { getPublicSubmissionSettings, getSiteUrl, getSubmissionSettings } from "@/lib/config/env";
import { getExportMapping, resolveGearProfile, resolveSlotMappingProfile } from "@/lib/config";
import { handleApiError } from "@/lib/api/response";
import { getServerContext } from "@/lib/server/context";
import { FixedWindowRateLimiter } from "@/lib/submissions/rate-limit";
import { handleCharacterSubmission, type SubmissionHttpDeps } from "@/lib/submissions/http";

export const dynamic = "force-dynamic";

const adminLimiter = new FixedWindowRateLimiter(30, 60_000);
const clientLimiter = new FixedWindowRateLimiter(submissionPolicy.rateLimit.perClient.limit, submissionPolicy.rateLimit.perClient.windowMs);
const globalLimiter = new FixedWindowRateLimiter(submissionPolicy.rateLimit.global.limit, submissionPolicy.rateLimit.global.windowMs);

const config: SubmissionHttpDeps["config"] = {
  mapping: getExportMapping,
  slotProfile: (env, gameMode) => resolveSlotMappingProfile(env, gameMode),
  rankingProfile: (env, gameMode) => resolveGearProfile(env, gameMode),
};

export async function POST(request: Request) {
  const settings = getSubmissionSettings();
  const publicSettings = getPublicSubmissionSettings();
  const publicSubmission: SubmissionHttpDeps["publicSubmission"] = {
    settings: publicSettings,
    policy: submissionPolicy,
    allowedOrigins: [new URL(getSiteUrl()).origin],
    clientLimiter,
    globalLimiter,
  };
  if (!settings.enabled && !publicSettings.enabled) {
    // 두 경로 모두 꺼져 있으면 DB에 연결하지 않고 404로 응답한다.
    return handleCharacterSubmission(request, {
      settings,
      appEnv: "mock",
      db: null,
      now: new Date(),
      rateLimiter: adminLimiter,
      config,
      publicSubmission,
    });
  }
  try {
    const ctx = await getServerContext();
    return await handleCharacterSubmission(request, {
      settings,
      appEnv: ctx.appEnv,
      db: ctx.db,
      now: ctx.now,
      rateLimiter: adminLimiter,
      config,
      publicSubmission,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
