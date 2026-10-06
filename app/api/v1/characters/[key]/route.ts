/**
 * GET /api/v1/characters/:id (내부 UUID)
 */
import type { NextRequest } from "next/server";
import { assertNoParams, isUuid } from "@/lib/api/params";
import { buildMeta, handleApiError, jsonError, jsonOk } from "@/lib/api/response";
import { serializeCharacterDetail } from "@/lib/api/serialize";
import { loadCharacterById } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  try {
    assertNoParams(request.nextUrl.searchParams, { strict: true });
    if (!isUuid(key)) return jsonError("INVALID_QUERY", 400);
    const { ctx, character } = await loadCharacterById(key);
    if (!character) return jsonError("CHARACTER_NOT_FOUND", 404);
    return jsonOk(
      serializeCharacterDetail(character),
      buildMeta({ dataEnvironment: ctx.appEnv, now: ctx.now, lastUpdatedAt: character.lastSeenAt }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
