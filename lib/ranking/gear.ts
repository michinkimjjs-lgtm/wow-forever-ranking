/**
 * 장비 랭킹 (명세서 §9.3)
 * averageItemLevel DESC → highestItemLevel DESC → characterName ASC → id ASC
 *
 * 적용 가능한 Gear Profile이 없으면 계산하지 않는다(명세서 §9.5).
 */
import type { AppDatabase } from "@/db/types";
import { baseEligibility, gearEligibility, gearProfileFor, ORDER_BY, policyFor, runRankingQuery } from "./common";
import type { RankingQuery, RankingResult } from "./types";

export async function getGearRanking(db: AppDatabase, query: RankingQuery): Promise<RankingResult> {
  const profile = gearProfileFor(query.scope);
  if (!profile) {
    return { status: "unavailable", reason: "GEAR_PROFILE_NOT_APPROVED", policy: policyFor(query.scope, null) };
  }
  const conditions = [
    ...baseEligibility(query.scope, query.filters, query.now),
    ...gearEligibility(query.scope, profile, query.now, { requireCoverage: true, requireAverage: true }),
  ];
  const result = await runRankingQuery(db, query, conditions, ORDER_BY.gear, profile);
  return { status: "ok", ...result, policy: policyFor(query.scope, profile) };
}
