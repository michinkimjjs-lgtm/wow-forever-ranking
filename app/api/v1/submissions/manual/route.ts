/**
 * POST /api/v1/submissions/manual — 애드온 없이 웹 직접 등록 (/contribute/register 화면)
 * - 공개 제출과 같은 설정(FEATURE_PUBLIC_SUBMISSIONS)·보안 검사·동의를 쓴다. 꺼져 있으면 404.
 * - 항상 관리자 검토 대기로 저장한다. 자동으로 랭킹에 반영하거나 검증 상태를 올리지 않는다.
 * 자세한 동작: lib/submissions/http.ts, lib/submissions/manual.ts, docs/DATA-COLLECTION-STRATEGY.md §2
 */
import { submissionPolicy } from "@/config/submissions";
import { getPublicSubmissionSettings, getSiteUrl, getSubmissionSettings } from "@/lib/config/env";
import { getExportMapping, resolveGearProfile, resolveSlotMappingProfile } from "@/lib/config";
import { handleApiError } from "@/lib/api/response";
import { getServerContext } from "@/lib/server/context";
import { FixedWindowRateLimiter } from "@/lib/submissions/rate-limit";
import { handleManualRegistration, type SubmissionHttpDeps } from "@/lib/submissions/http";

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
  const publicSettings = getPublicSubmissionSettings();
  const publicSubmission: SubmissionHttpDeps["publicSubmission"] = {
    settings: publicSettings,
    policy: submissionPolicy,
    allowedOrigins: [new URL(getSiteUrl()).origin],
    clientLimiter,
    globalLimiter,
  };
  const base = { settings: getSubmissionSettings(), rateLimiter: adminLimiter, config, publicSubmission };
  if (!publicSettings.enabled) {
    // 꺼져 있으면 DB에 연결하지 않고 404로 응답한다.
    return handleManualRegistration(request, { ...base, appEnv: "mock", db: null, now: new Date() });
  }
  try {
    const ctx = await getServerContext();
    return await handleManualRegistration(request, { ...base, appEnv: ctx.appEnv, db: ctx.db, now: ctx.now });
  } catch (err) {
    return handleApiError(err);
  }
}
