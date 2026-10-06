/**
 * 랭킹 공통 조건과 조회 (명세서 §10)
 */
import { and, count, eq, gte, inArray, isNotNull, max, sql, type SQL } from "drizzle-orm";
import { characterItems, characters, guilds, items } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import {
  getAllowedVerificationStatuses,
  getStaleAfterDays,
  resolveGearProfile,
  type GearProfile,
} from "@/lib/config";
import { VERIFIED_ONLY_STATUSES } from "@/lib/domain/enums";
import { rankableSlotCodes } from "@/lib/gear/calculate";
import type { RankingFilters, RankingPolicy, RankingQuery, RankingRow, RankingScope } from "./types";

const DAY_MS = 86_400_000;

export function staleCutoff(scope: RankingScope, now: Date): Date {
  return new Date(now.getTime() - getStaleAfterDays(scope.dataEnvironment) * DAY_MS);
}

/** 랭킹에 포함할 검증 상태 */
export function rankingVerificationStatuses(scope: RankingScope, verifiedOnly?: boolean) {
  const allowed = getAllowedVerificationStatuses(scope.dataEnvironment);
  if (!verifiedOnly) return allowed;
  return allowed.filter((s) => (VERIFIED_ONLY_STATUSES as readonly string[]).includes(s));
}

/** 레벨 랭킹 대상 조건 (명세서 §10.3 1~4) + 필터 */
export function baseEligibility(scope: RankingScope, filters: RankingFilters | undefined, now: Date): SQL[] {
  const statuses = rankingVerificationStatuses(scope, filters?.verifiedOnly);
  const conditions: SQL[] = [
    eq(characters.dataEnvironment, scope.dataEnvironment),
    eq(characters.gameMode, scope.gameMode),
    gte(characters.lastSeenAt, staleCutoff(scope, now)),
    statuses.length > 0 ? inArray(characters.verificationStatus, statuses) : sql`false`,
  ];
  if (filters?.region) conditions.push(eq(characters.region, filters.region));
  if (filters?.classCode) conditions.push(eq(characters.classCode, filters.classCode));
  if (filters?.factionCode) conditions.push(eq(characters.factionCode, filters.factionCode));
  if (filters?.guildId) conditions.push(eq(characters.guildId, filters.guildId));
  return conditions;
}

/** 장비 / 최고 아이템 랭킹 추가 조건 (명세서 §10.3-5, §10.4) */
export function gearEligibility(
  scope: RankingScope,
  profile: GearProfile,
  now: Date,
  options: { requireCoverage: boolean; requireAverage: boolean },
): SQL[] {
  const conditions: SQL[] = [
    eq(characters.gearProfileId, profile.id),
    eq(characters.gearProfileVersion, profile.version),
    gte(characters.gearObservedAt, staleCutoff(scope, now)),
    isNotNull(characters.highestItemLevel),
  ];
  if (options.requireAverage) conditions.push(isNotNull(characters.averageItemLevel));
  if (options.requireCoverage) {
    const { minRankableSlotRatio, minRankableSlotCount } = profile.minimumCoverage;
    if (minRankableSlotRatio !== undefined) {
      conditions.push(gte(characters.gearCoverage, minRankableSlotRatio));
    }
    if (minRankableSlotCount !== undefined) {
      const slots = rankableSlotCodes(profile);
      conditions.push(
        sql`(select count(*) from ${characterItems} ci where ci.character_id = ${characters.id} and ci.slot_code in ${slots} and ci.item_level is not null) >= ${minRankableSlotCount}`,
      );
    }
  }
  return conditions;
}

export function policyFor(scope: RankingScope, profile: GearProfile | null): RankingPolicy {
  return {
    staleAfterDays: getStaleAfterDays(scope.dataEnvironment),
    gearProfile: profile ? { id: profile.id, version: profile.version, status: profile.status } : null,
  };
}

export function gearProfileFor(scope: RankingScope): GearProfile | null {
  return resolveGearProfile(scope.dataEnvironment, scope.gameMode);
}

/** 정렬 순서 (명세서 §8.1, §9.3). 마지막 기준 id ASC로 완전히 정렬해 동순위가 없다. */
export const ORDER_BY = {
  level: [
    sql`${characters.level} desc`,
    sql`${characters.currentLevelReachedAt} asc nulls last`,
    sql`${characters.firstSeenAt} asc`,
    sql`${characters.characterName} collate "C" asc`,
    sql`${characters.id} asc`,
  ],
  gear: [
    sql`${characters.averageItemLevel} desc nulls last`,
    sql`${characters.highestItemLevel} desc nulls last`,
    sql`${characters.characterName} collate "C" asc`,
    sql`${characters.id} asc`,
  ],
  "highest-item": [
    sql`${characters.highestItemLevel} desc nulls last`,
    sql`${characters.averageItemLevel} desc nulls last`,
    sql`${characters.characterName} collate "C" asc`,
    sql`${characters.id} asc`,
  ],
} as const;

/** 최고 아이템 이름: 랭킹 대상 슬롯 중 최고 아이템 레벨을 가진 아이템 (표시 순서가 앞선 슬롯 우선) */
function highestItemNameExpr(profile: GearProfile | null): SQL<string | null> {
  if (!profile) return sql<string | null>`null`;
  const slots = rankableSlotCodes(profile);
  const order = profile.slots
    .filter((s) => slots.includes(s.code))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => s.code);
  return sql<string | null>`(
    select i.name from ${characterItems} ci
    join ${items} i on i.id = ci.item_id
    where ci.character_id = ${characters.id}
      and ci.slot_code in ${slots}
      and ci.item_level = ${characters.highestItemLevel}
    order by array_position(${sql.raw(`ARRAY[${order.map((c) => `'${c}'`).join(",")}]::text[]`)}, ci.slot_code)
    limit 1
  )`;
}

export async function runRankingQuery(
  db: AppDatabase,
  query: RankingQuery,
  conditions: SQL[],
  orderBy: readonly SQL[],
  profile: GearProfile | null,
): Promise<{ rows: RankingRow[]; total: number; lastUpdatedAt: Date | null }> {
  const where = and(...conditions);
  const { page, pageSize } = query.pagination;

  const [summary] = await db
    .select({ total: count(), lastUpdatedAt: max(characters.lastSeenAt) })
    .from(characters)
    .where(where);

  const rows = await db
    .select({
      characterId: characters.id,
      characterName: characters.characterName,
      slug: characters.slug,
      region: characters.region,
      gameMode: characters.gameMode,
      level: characters.level,
      classCode: characters.classCode,
      raceCode: characters.raceCode,
      factionCode: characters.factionCode,
      guildId: guilds.id,
      guildName: guilds.name,
      guildSlug: guilds.slug,
      averageItemLevel: characters.averageItemLevel,
      highestItemLevel: characters.highestItemLevel,
      highestItemName: highestItemNameExpr(profile),
      currentLevelReachedAt: characters.currentLevelReachedAt,
      currentLevelTimingBasis: characters.currentLevelTimingBasis,
      firstSeenAt: characters.firstSeenAt,
      lastSeenAt: characters.lastSeenAt,
      dataSource: characters.dataSource,
      verificationStatus: characters.verificationStatus,
    })
    .from(characters)
    .leftJoin(guilds, eq(guilds.id, characters.guildId))
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const lastUpdated = summary?.lastUpdatedAt ?? null;
  return {
    total: summary?.total ?? 0,
    lastUpdatedAt: lastUpdated ? new Date(lastUpdated) : null,
    rows: rows.map((r, index) => ({
      rank: (page - 1) * pageSize + index + 1,
      characterId: r.characterId,
      characterName: r.characterName,
      slug: r.slug,
      region: r.region,
      gameMode: r.gameMode,
      level: r.level,
      classCode: r.classCode,
      raceCode: r.raceCode,
      factionCode: r.factionCode,
      guild: r.guildId && r.guildName && r.guildSlug ? { id: r.guildId, name: r.guildName, slug: r.guildSlug } : null,
      averageItemLevel: r.averageItemLevel,
      highestItemLevel: r.highestItemLevel,
      highestItemName: r.highestItemName,
      currentLevelReachedAt: r.currentLevelReachedAt,
      currentLevelTimingBasis: r.currentLevelTimingBasis,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
      dataSource: r.dataSource,
      verificationStatus: r.verificationStatus,
    })),
  };
}
