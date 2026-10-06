/**
 * 레벨 랭킹 (명세서 §8.1)
 * level DESC → 현재 레벨 milestone 시각 ASC (NULL 마지막) → firstSeenAt ASC → characterName ASC → id ASC
 */
import type { AppDatabase } from "@/db/types";
import { baseEligibility, gearProfileFor, ORDER_BY, policyFor, runRankingQuery } from "./common";
import type { RankingQuery, RankingResult } from "./types";

export async function getLevelRanking(db: AppDatabase, query: RankingQuery): Promise<RankingResult> {
  const profile = gearProfileFor(query.scope);
  const conditions = baseEligibility(query.scope, query.filters, query.now);
  const result = await runRankingQuery(db, query, conditions, ORDER_BY.level, profile);
  return { status: "ok", ...result, policy: policyFor(query.scope, profile) };
}
