/**
 * GET /api/v1/guilds/:id (내부 UUID)
 */
import type { NextRequest } from "next/server";
import { assertNoParams, isUuid } from "@/lib/api/params";
import { buildMeta, handleApiError, jsonError, jsonOk } from "@/lib/api/response";
import { serializeGuildDetail } from "@/lib/api/serialize";
import { loadGuildById } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertNoParams(request.nextUrl.searchParams, { strict: true });
    if (!isUuid(id)) return jsonError("INVALID_QUERY", 400);
    const { ctx, guild } = await loadGuildById(id);
    if (!guild) return jsonError("GUILD_NOT_FOUND", 404);
    return jsonOk(
      serializeGuildDetail(guild),
      buildMeta({ dataEnvironment: ctx.appEnv, now: ctx.now, lastUpdatedAt: guild.lastSeenAt }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
