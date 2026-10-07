/**
 * POST /api/v1/submissions/character — Character Export v1 제출 (비공개, 기능 플래그 기본 꺼짐)
 * 자세한 동작: lib/submissions/http.ts, docs/ARCHITECTURE.md §8
 */
import { getSubmissionSettings } from "@/lib/config/env";
import { getExportMapping, resolveGearProfile, resolveSlotMappingProfile } from "@/lib/config";
import { handleApiError } from "@/lib/api/response";
import { getServerContext } from "@/lib/server/context";
import { FixedWindowRateLimiter } from "@/lib/submissions/rate-limit";
import { handleCharacterSubmission } from "@/lib/submissions/http";

export const dynamic = "force-dynamic";

const limiter = new FixedWindowRateLimiter(30, 60_000);

export async function POST(request: Request) {
  const settings = getSubmissionSettings();
  if (!settings.enabled) {
    return handleCharacterSubmission(request, {
      settings,
      appEnv: "mock",
      db: null,
      now: new Date(),
      rateLimiter: limiter,
      config: { mapping: getExportMapping, slotProfile: () => null, rankingProfile: () => null },
    });
  }
  try {
    const ctx = await getServerContext();
    return await handleCharacterSubmission(request, {
      settings,
      appEnv: ctx.appEnv,
      db: ctx.db,
      now: ctx.now,
      rateLimiter: limiter,
      config: {
        mapping: getExportMapping,
        slotProfile: (env, gameMode) => resolveSlotMappingProfile(env, gameMode),
        rankingProfile: (env, gameMode) => resolveGearProfile(env, gameMode),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
