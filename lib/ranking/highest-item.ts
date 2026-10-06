/**
 * 최고 아이템 랭킹 (명세서 §9.3)
 * highestItemLevel DESC → averageItemLevel DESC → characterName ASC → id ASC
 */
import type { AppDatabase } from "@/db/types";
import { baseEligibility, gearEligibility, gearProfileFor, ORDER_BY, policyFor, runRankingQuery } from "./common";
import type { RankingQuery, RankingResult } from "./types";

export async function getHighestItemRanking(db: AppDatabase, query: RankingQuery): Promise<RankingResult> {
  const profile = gearProfileFor(query.scope);
  if (!profile) {
    return { status: "unavailable", reason: "GEAR_PROFILE_NOT_APPROVED", policy: policyFor(query.scope, null) };
  }
  const conditions = [
    ...baseEligibility(query.scope, query.filters, query.now),
    ...gearEligibility(query.scope, profile, query.now, {
      requireCoverage: profile.highestItemRequiresCoverage,
      requireAverage: false,
    }),
  ];
  const result = await runRankingQuery(db, query, conditions, ORDER_BY["highest-item"], profile);
  return { status: "ok", ...result, policy: policyFor(query.scope, profile) };
}
