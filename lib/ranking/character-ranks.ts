/**
 * 캐릭터 한 명의 현재 순위 (Armory "현재 랭킹", 명세서 §10.2)
 * 기본 범위: 캐릭터의 dataEnvironment, 해당 gameMode, 전체 지역, 필터 없음
 */
import { and, eq, sql } from "drizzle-orm";
import { characters } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { baseEligibility, gearEligibility, gearProfileFor, ORDER_BY } from "./common";
import type { RankingScope, RankingType } from "./types";

export type RankExclusionReason =
  | "STALE"
  | "VERIFICATION_EXCLUDED"
  | "GEAR_PROFILE_NOT_APPROVED"
  | "GEAR_INSUFFICIENT";

export interface CharacterRank {
  type: RankingType;
  rank: number | null;
  exclusion: RankExclusionReason | null;
}

async function rankWithin(db: AppDatabase, conditions: ReturnType<typeof baseEligibility>, orderBy: readonly ReturnType<typeof sql>[], characterId: string) {
  const ranked = db
    .select({
      id: characters.id,
      position: sql<number>`(row_number() over (order by ${sql.join([...orderBy], sql`, `)}))::int`.as("position"),
    })
    .from(characters)
    .where(and(...conditions))
    .as("ranked");
  const [row] = await db.select({ position: ranked.position }).from(ranked).where(eq(ranked.id, characterId));
  return row ? Number(row.position) : null;
}

export async function getCharacterRanks(
  db: AppDatabase,
  character: { id: string; dataEnvironment: RankingScope["dataEnvironment"]; gameMode: string },
  now: Date,
): Promise<CharacterRank[]> {
  const scope: RankingScope = { dataEnvironment: character.dataEnvironment, gameMode: character.gameMode };
  const base = baseEligibility(scope, undefined, now);
  const profile = gearProfileFor(scope);

  // 제외 사유 판단: 최근 확인 조건(앞 3개 조건)과 전체 조건을 따로 확인한다.
  const [self] = await db
    .select({
      eligible: sql<boolean>`(${and(...base)})`,
      fresh: sql<boolean>`(${and(...base.slice(0, 3))})`,
    })
    .from(characters)
    .where(eq(characters.id, character.id));
  const baseExclusion: RankExclusionReason | null = self?.eligible
    ? null
    : self?.fresh
      ? "VERIFICATION_EXCLUDED"
      : "STALE";

  const levelRank = baseExclusion ? null : await rankWithin(db, base, ORDER_BY.level, character.id);
  const results: CharacterRank[] = [{ type: "level", rank: levelRank, exclusion: baseExclusion }];

  for (const type of ["gear", "highest-item"] as const) {
    if (baseExclusion) {
      results.push({ type, rank: null, exclusion: baseExclusion });
      continue;
    }
    if (!profile) {
      results.push({ type, rank: null, exclusion: "GEAR_PROFILE_NOT_APPROVED" });
      continue;
    }
    const conditions = [
      ...base,
      ...gearEligibility(scope, profile, now, {
        requireCoverage: type === "gear" || profile.highestItemRequiresCoverage,
        requireAverage: type === "gear",
      }),
    ];
    const rank = await rankWithin(db, conditions, ORDER_BY[type], character.id);
    results.push({ type, rank, exclusion: rank === null ? "GEAR_INSUFFICIENT" : null });
  }
  return results;
}
