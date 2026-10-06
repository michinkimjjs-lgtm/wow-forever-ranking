/**
 * 캐릭터 검색 / 상세 조회 (명세서 §12, §21)
 * 모든 함수는 dataEnvironment 범위를 필수 인자로 받는다(명세서 §6.4-8).
 */
import { and, asc, count, desc, eq, ilike, inArray, max, sql, type SQL } from "drizzle-orm";
import { characterItems, characters, guilds, items, levelMilestones } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { resolveGearProfile } from "@/lib/config";
import type { DataEnvironment } from "@/lib/domain/enums";
import { escapeLikePattern, normalizeName } from "@/lib/domain/names";
import { getCharacterRanks, type CharacterRank } from "@/lib/ranking";
import { staleCutoff } from "@/lib/ranking/common";
import type { Pagination } from "@/lib/ranking/types";

export interface DataScope {
  dataEnvironment: DataEnvironment;
}

export interface CharacterSearchInput {
  q: string;
  gameMode?: string;
  region?: string;
  classCode?: string;
  factionCode?: string;
  guildId?: string;
}

export interface CharacterSummary {
  id: string;
  characterName: string;
  slug: string;
  region: string;
  gameMode: string;
  level: number;
  classCode: string | null;
  raceCode: string | null;
  factionCode: string | null;
  guild: { id: string; name: string; slug: string } | null;
  averageItemLevel: number | null;
  highestItemLevel: number | null;
  lastSeenAt: Date;
  isStale: boolean;
  verificationStatus: (typeof characters.$inferSelect)["verificationStatus"];
  dataSource: (typeof characters.$inferSelect)["dataSource"];
}

const summaryColumns = {
  id: characters.id,
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
  lastSeenAt: characters.lastSeenAt,
  verificationStatus: characters.verificationStatus,
  dataSource: characters.dataSource,
  dataEnvironment: characters.dataEnvironment,
};

interface SummaryRow {
  id: string;
  characterName: string;
  slug: string;
  region: string;
  gameMode: string;
  level: number;
  classCode: string | null;
  raceCode: string | null;
  factionCode: string | null;
  guildId: string | null;
  guildName: string | null;
  guildSlug: string | null;
  averageItemLevel: number | null;
  highestItemLevel: number | null;
  lastSeenAt: Date;
  verificationStatus: CharacterSummary["verificationStatus"];
  dataSource: CharacterSummary["dataSource"];
  dataEnvironment: DataEnvironment;
}

function toSummary(row: SummaryRow, now: Date): CharacterSummary {
  const cutoff = staleCutoff({ dataEnvironment: row.dataEnvironment, gameMode: row.gameMode }, now);
  return {
    id: row.id,
    characterName: row.characterName,
    slug: row.slug,
    region: row.region,
    gameMode: row.gameMode,
    level: row.level,
    classCode: row.classCode,
    raceCode: row.raceCode,
    factionCode: row.factionCode,
    guild: row.guildId && row.guildName && row.guildSlug ? { id: row.guildId, name: row.guildName, slug: row.guildSlug } : null,
    averageItemLevel: row.averageItemLevel,
    highestItemLevel: row.highestItemLevel,
    lastSeenAt: row.lastSeenAt,
    isStale: row.lastSeenAt < cutoff,
    verificationStatus: row.verificationStatus,
    dataSource: row.dataSource,
  };
}

/**
 * 캐릭터 이름 검색. 오래된 캐릭터도 결과에 포함한다(랭킹에서만 제외).
 * 정렬: 정확히 일치 → 앞부분 일치 → 레벨 높은 순 → 이름 → id
 */
export async function searchCharacters(
  db: AppDatabase,
  scope: DataScope,
  input: CharacterSearchInput,
  pagination: Pagination,
  now: Date,
): Promise<{ rows: CharacterSummary[]; total: number; lastUpdatedAt: Date | null }> {
  const q = normalizeName(input.q);
  const pattern = escapeLikePattern(q);
  const conditions: SQL[] = [
    eq(characters.dataEnvironment, scope.dataEnvironment),
    ilike(characters.nameNormalized, `%${pattern}%`),
  ];
  if (input.gameMode) conditions.push(eq(characters.gameMode, input.gameMode));
  if (input.region) conditions.push(eq(characters.region, input.region));
  if (input.classCode) conditions.push(eq(characters.classCode, input.classCode));
  if (input.factionCode) conditions.push(eq(characters.factionCode, input.factionCode));
  if (input.guildId) conditions.push(eq(characters.guildId, input.guildId));
  const where = and(...conditions);

  const [summary] = await db
    .select({ total: count(), lastUpdatedAt: max(characters.lastSeenAt) })
    .from(characters)
    .where(where);

  const rows = await db
    .select(summaryColumns)
    .from(characters)
    .leftJoin(guilds, eq(guilds.id, characters.guildId))
    .where(where)
    .orderBy(
      sql`case when ${characters.nameNormalized} = ${q} then 0 when ${characters.nameNormalized} like ${`${pattern}%`} then 1 else 2 end`,
      desc(characters.level),
      sql`${characters.characterName} collate "C" asc`,
      asc(characters.id),
    )
    .limit(pagination.pageSize)
    .offset((pagination.page - 1) * pagination.pageSize);

  return {
    rows: rows.map((r) => toSummary(r, now)),
    total: summary?.total ?? 0,
    lastUpdatedAt: summary?.lastUpdatedAt ? new Date(summary.lastUpdatedAt) : null,
  };
}

export interface EquippedSlot {
  slotCode: string;
  displayOrder: number;
  rankable: boolean;
  item: {
    name: string;
    qualityCode: string | null;
    itemLevel: number | null;
    itemSlotCode: string | null;
  } | null;
}

export interface CharacterDetail extends CharacterSummary {
  dataEnvironment: DataEnvironment;
  firstSeenAt: Date;
  sourceUpdatedAt: Date | null;
  sourceBuild: string | null;
  gearCoverage: number | null;
  gearObservedAt: Date | null;
  gearProfile: { id: string; version: number; status: "PROVISIONAL" | "APPROVED"; meetsCoverage: boolean } | null;
  currentLevel: {
    level: number;
    effectiveReachedAt: Date;
    timingBasis: (typeof levelMilestones.$inferSelect)["timingBasis"];
  } | null;
  equipment: EquippedSlot[];
  ranks: CharacterRank[];
}

async function loadDetail(db: AppDatabase, where: SQL, now: Date): Promise<CharacterDetail | null> {
  const [row] = await db
    .select({
      ...summaryColumns,
      firstSeenAt: characters.firstSeenAt,
      sourceUpdatedAt: characters.sourceUpdatedAt,
      sourceBuild: characters.sourceBuild,
      gearCoverage: characters.gearCoverage,
      gearObservedAt: characters.gearObservedAt,
      gearProfileId: characters.gearProfileId,
      gearProfileVersion: characters.gearProfileVersion,
    })
    .from(characters)
    .leftJoin(guilds, eq(guilds.id, characters.guildId))
    .where(where)
    .limit(1);
  if (!row) return null;

  const [milestone] = await db
    .select({
      level: levelMilestones.level,
      effectiveReachedAt: levelMilestones.effectiveReachedAt,
      timingBasis: levelMilestones.timingBasis,
    })
    .from(levelMilestones)
    .where(and(eq(levelMilestones.characterId, row.id), eq(levelMilestones.level, row.level)))
    .limit(1);

  const equippedRows = await db
    .select({
      slotCode: characterItems.slotCode,
      itemLevel: characterItems.itemLevel,
      name: items.name,
      qualityCode: items.qualityCode,
      itemSlotCode: items.slotCode,
    })
    .from(characterItems)
    .innerJoin(items, eq(items.id, characterItems.itemId))
    .where(eq(characterItems.characterId, row.id));

  // 표시할 슬롯은 Gear Profile을 따른다. 프로필이 없으면 관측된 슬롯만 표시한다.
  const profile = resolveGearProfile(row.dataEnvironment, row.gameMode);
  const bySlot = new Map(equippedRows.map((e) => [e.slotCode, e]));
  const equipment: EquippedSlot[] = profile
    ? [...profile.slots]
        .filter((s) => !profile.excludedSlots.includes(s.code))
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => {
          const e = bySlot.get(s.code);
          return {
            slotCode: s.code,
            displayOrder: s.displayOrder,
            rankable: s.rankable,
            item: e ? { name: e.name, qualityCode: e.qualityCode, itemLevel: e.itemLevel, itemSlotCode: e.itemSlotCode } : null,
          };
        })
    : equippedRows.map((e, i) => ({
        slotCode: e.slotCode,
        displayOrder: i,
        rankable: false,
        item: { name: e.name, qualityCode: e.qualityCode, itemLevel: e.itemLevel, itemSlotCode: e.itemSlotCode },
      }));

  const ranks = await getCharacterRanks(db, { id: row.id, dataEnvironment: row.dataEnvironment, gameMode: row.gameMode }, now);
  const gearRank = ranks.find((r) => r.type === "gear");
  const usesCurrentProfile =
    profile && row.gearProfileId === profile.id && row.gearProfileVersion === profile.version;

  return {
    ...toSummary(row, now),
    dataEnvironment: row.dataEnvironment,
    firstSeenAt: row.firstSeenAt,
    sourceUpdatedAt: row.sourceUpdatedAt,
    sourceBuild: row.sourceBuild,
    gearCoverage: row.gearCoverage,
    gearObservedAt: row.gearObservedAt,
    gearProfile: profile
      ? {
          id: profile.id,
          version: profile.version,
          status: profile.status,
          meetsCoverage: Boolean(usesCurrentProfile && gearRank && gearRank.exclusion !== "GEAR_INSUFFICIENT"),
        }
      : null,
    currentLevel: milestone ?? null,
    equipment,
    ranks,
  };
}

export async function getCharacterById(db: AppDatabase, scope: DataScope, id: string, now: Date) {
  return loadDetail(db, and(eq(characters.dataEnvironment, scope.dataEnvironment), eq(characters.id, id))!, now);
}

export async function getCharacterBySlug(
  db: AppDatabase,
  scope: DataScope,
  key: { region: string; gameMode: string; slug: string },
  now: Date,
) {
  return loadDetail(
    db,
    and(
      eq(characters.dataEnvironment, scope.dataEnvironment),
      eq(characters.region, key.region),
      eq(characters.gameMode, key.gameMode),
      eq(characters.slug, key.slug),
    )!,
    now,
  );
}

/** 최근 데이터가 갱신된 캐릭터 */
export async function getRecentlyUpdatedCharacters(
  db: AppDatabase,
  scope: DataScope & { gameMode: string },
  limit: number,
  now: Date,
): Promise<CharacterSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(characters)
    .leftJoin(guilds, eq(guilds.id, characters.guildId))
    .where(and(eq(characters.dataEnvironment, scope.dataEnvironment), eq(characters.gameMode, scope.gameMode)))
    .orderBy(desc(characters.lastSeenAt), asc(characters.id))
    .limit(limit);
  return rows.map((r) => toSummary(r, now));
}

export interface RecentLevelUp {
  character: CharacterSummary;
  level: number;
  effectiveReachedAt: Date;
  timingBasis: (typeof levelMilestones.$inferSelect)["timingBasis"];
}

/** 최근 레벨이 상승한 캐릭터 (level_milestones 기준, 추정 기록 제외) */
export async function getRecentLevelUps(
  db: AppDatabase,
  scope: DataScope & { gameMode: string },
  limit: number,
  now: Date,
): Promise<RecentLevelUp[]> {
  const rows = await db
    .select({
      ...summaryColumns,
      milestoneLevel: levelMilestones.level,
      effectiveReachedAt: levelMilestones.effectiveReachedAt,
      timingBasis: levelMilestones.timingBasis,
    })
    .from(levelMilestones)
    .innerJoin(characters, eq(characters.id, levelMilestones.characterId))
    .leftJoin(guilds, eq(guilds.id, characters.guildId))
    .where(
      and(
        eq(levelMilestones.dataEnvironment, scope.dataEnvironment),
        eq(characters.gameMode, scope.gameMode),
        inArray(levelMilestones.timingBasis, ["SOURCE_REPORTED", "FIRST_OBSERVED"]),
        sql`${levelMilestones.level} > 1`,
      ),
    )
    .orderBy(desc(levelMilestones.effectiveReachedAt), asc(levelMilestones.id))
    .limit(limit);
  return rows.map((r) => ({
    character: toSummary(r, now),
    level: r.milestoneLevel,
    effectiveReachedAt: r.effectiveReachedAt,
    timingBasis: r.timingBasis,
  }));
}
