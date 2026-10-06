/**
 * 홈 화면 데이터 (명세서 §5)
 * KPI는 현재 dataEnvironment와 기본 gameMode 안에서, 랭킹 대상 조건을 만족하는 캐릭터로만 계산한다.
 */
import { and, count, eq, max } from "drizzle-orm";
import { characters } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { getGearRanking, getHighestItemRanking, getLevelRanking, type RankingResult } from "@/lib/ranking";
import type { RankingScope } from "@/lib/ranking/types";
import { getRecentLevelUps, getRecentlyUpdatedCharacters, type CharacterSummary, type RecentLevelUp } from "./characters";

export interface HomeOverview {
  scope: RankingScope;
  kpi: {
    topLevel: number | null;
    topAverageItemLevel: number | null;
    topHighestItemLevel: number | null;
    trackedCharacters: number;
    rankedCharacters: number;
    lastUpdatedAt: Date | null;
  };
  level: RankingResult;
  gear: RankingResult;
  highestItem: RankingResult;
  recentlyUpdated: CharacterSummary[];
  recentLevelUps: RecentLevelUp[];
}

export async function getHomeOverview(db: AppDatabase, scope: RankingScope, now: Date): Promise<HomeOverview> {
  const pagination = { page: 1, pageSize: 10 };
  const [level, gear, highestItem, recentlyUpdated, recentLevelUps, tracked] = await Promise.all([
    getLevelRanking(db, { scope, pagination, now }),
    getGearRanking(db, { scope, pagination, now }),
    getHighestItemRanking(db, { scope, pagination, now }),
    getRecentlyUpdatedCharacters(db, scope, 10, now),
    getRecentLevelUps(db, scope, 10, now),
    db
      .select({ total: count(), lastUpdatedAt: max(characters.lastSeenAt) })
      .from(characters)
      .where(and(eq(characters.dataEnvironment, scope.dataEnvironment), eq(characters.gameMode, scope.gameMode))),
  ]);

  const first = (r: RankingResult) => (r.status === "ok" ? r.rows[0] : undefined);
  const trackedRow = tracked[0];
  return {
    scope,
    kpi: {
      topLevel: first(level)?.level ?? null,
      topAverageItemLevel: first(gear)?.averageItemLevel ?? null,
      topHighestItemLevel: first(highestItem)?.highestItemLevel ?? null,
      trackedCharacters: trackedRow?.total ?? 0,
      rankedCharacters: level.status === "ok" ? level.total : 0,
      lastUpdatedAt: trackedRow?.lastUpdatedAt ? new Date(trackedRow.lastUpdatedAt) : null,
    },
    level,
    gear,
    highestItem,
    recentlyUpdated,
    recentLevelUps,
  };
}
