/**
 * GET /api/v1/rankings/level
 * GET /api/v1/rankings/gear
 * GET /api/v1/rankings/highest-item
 */
import type { NextRequest } from "next/server";
import { parseListParams } from "@/lib/api/params";
import { buildMeta, handleApiError, jsonError, jsonOk } from "@/lib/api/response";
import { serializeRankingRow } from "@/lib/api/serialize";
import { RANKING_TYPES, type RankingType } from "@/lib/ranking";
import { getServerContext } from "@/lib/server/context";
import { loadRanking } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!RANKING_TYPES.includes(type as RankingType)) return jsonError("NOT_FOUND", 404);
  try {
    const { appEnv } = await getServerContext();
    const parsed = parseListParams(request.nextUrl.searchParams, appEnv, { strict: true });
    const { ctx, result } = await loadRanking(type as RankingType, parsed);
    if (result.status === "unavailable") {
      return jsonOk(
        [],
        buildMeta({
          dataEnvironment: parsed.scope.dataEnvironment,
          now: ctx.now,
          lastUpdatedAt: null,
          page: parsed.pagination.page,
          pageSize: parsed.pagination.pageSize,
          total: 0,
          policy: result.policy,
          status: "unavailable",
          unavailableReason: result.reason,
        }),
      );
    }
    return jsonOk(
      result.rows.map(serializeRankingRow),
      buildMeta({
        dataEnvironment: parsed.scope.dataEnvironment,
        now: ctx.now,
        lastUpdatedAt: result.lastUpdatedAt,
        page: parsed.pagination.page,
        pageSize: parsed.pagination.pageSize,
        total: result.total,
        policy: result.policy,
        status: "ok",
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
