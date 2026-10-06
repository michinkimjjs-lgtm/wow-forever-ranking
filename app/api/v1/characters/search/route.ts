/**
 * GET /api/v1/characters/search?q=
 */
import type { NextRequest } from "next/server";
import { parseSearchParams } from "@/lib/api/params";
import { buildMeta, handleApiError, jsonOk } from "@/lib/api/response";
import { serializeCharacterSummary } from "@/lib/api/serialize";
import { getServerContext } from "@/lib/server/context";
import { loadCharacterSearch } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { appEnv } = await getServerContext();
    const parsed = parseSearchParams(request.nextUrl.searchParams, appEnv, { strict: true, requireQuery: true });
    const { ctx, result } = await loadCharacterSearch(parsed, {
      q: parsed.q ?? "",
      gameMode: parsed.gameModeSpecified ? parsed.scope.gameMode : undefined,
      region: parsed.filters.region,
      classCode: parsed.filters.classCode,
      factionCode: parsed.filters.factionCode,
      guildId: parsed.filters.guildId,
    });
    return jsonOk(
      result.rows.map(serializeCharacterSummary),
      buildMeta({
        dataEnvironment: parsed.scope.dataEnvironment,
        now: ctx.now,
        lastUpdatedAt: result.lastUpdatedAt,
        page: parsed.pagination.page,
        pageSize: parsed.pagination.pageSize,
        total: result.total,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
