/**
 * GET /api/v1/characters/:region/:gameMode/:slug (자연 키 조회, 명세서 §17)
 */
import type { NextRequest } from "next/server";
import { assertNoParams } from "@/lib/api/params";
import { buildMeta, handleApiError, jsonError, jsonOk } from "@/lib/api/response";
import { serializeCharacterDetail } from "@/lib/api/serialize";
import { normalizeSlugParam } from "@/lib/domain/names";
import { loadCharacterBySlug } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string; gameMode: string; slug: string }> },
) {
  const { key: region, gameMode, slug } = await params;
  try {
    assertNoParams(request.nextUrl.searchParams, { strict: true });
    const { ctx, character } = await loadCharacterBySlug({
      region,
      gameMode,
      slug: normalizeSlugParam(slug),
    });
    if (!character) return jsonError("CHARACTER_NOT_FOUND", 404);
    return jsonOk(
      serializeCharacterDetail(character),
      buildMeta({ dataEnvironment: ctx.appEnv, now: ctx.now, lastUpdatedAt: character.lastSeenAt }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
