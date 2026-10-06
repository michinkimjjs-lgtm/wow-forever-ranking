/**
 * API 응답용 직렬화. 시각은 UTC ISO 문자열로 내보낸다.
 */
import type { CharacterDetail, CharacterSummary } from "@/lib/queries/characters";
import type { GuildDetail } from "@/lib/queries/guilds";
import type { RankingRow } from "@/lib/ranking/types";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function serializeRankingRow(row: RankingRow) {
  return {
    rank: row.rank,
    character: {
      id: row.characterId,
      name: row.characterName,
      slug: row.slug,
      region: row.region,
      gameMode: row.gameMode,
    },
    level: row.level,
    classCode: row.classCode,
    raceCode: row.raceCode,
    factionCode: row.factionCode,
    guild: row.guild,
    averageItemLevel: row.averageItemLevel,
    highestItemLevel: row.highestItemLevel,
    highestItemName: row.highestItemName,
    currentLevelReachedAt: iso(row.currentLevelReachedAt),
    currentLevelTimingBasis: row.currentLevelTimingBasis,
    firstSeenAt: iso(row.firstSeenAt),
    lastSeenAt: iso(row.lastSeenAt),
    dataSource: row.dataSource,
    verificationStatus: row.verificationStatus,
  };
}

export function serializeCharacterSummary(c: CharacterSummary) {
  return {
    id: c.id,
    name: c.characterName,
    slug: c.slug,
    region: c.region,
    gameMode: c.gameMode,
    level: c.level,
    classCode: c.classCode,
    raceCode: c.raceCode,
    factionCode: c.factionCode,
    guild: c.guild,
    averageItemLevel: c.averageItemLevel,
    highestItemLevel: c.highestItemLevel,
    lastSeenAt: iso(c.lastSeenAt),
    isStale: c.isStale,
    dataSource: c.dataSource,
    verificationStatus: c.verificationStatus,
  };
}

export function serializeCharacterDetail(c: CharacterDetail) {
  return {
    ...serializeCharacterSummary(c),
    dataEnvironment: c.dataEnvironment,
    firstSeenAt: iso(c.firstSeenAt),
    sourceUpdatedAt: iso(c.sourceUpdatedAt),
    sourceBuild: c.sourceBuild,
    gearCoverage: c.gearCoverage,
    gearObservedAt: iso(c.gearObservedAt),
    gearProfile: c.gearProfile,
    currentLevel: c.currentLevel
      ? {
          level: c.currentLevel.level,
          effectiveReachedAt: iso(c.currentLevel.effectiveReachedAt),
          timingBasis: c.currentLevel.timingBasis,
        }
      : null,
    equipment: c.equipment.map((e) => ({ slotCode: e.slotCode, rankable: e.rankable, item: e.item })),
    rankings: c.ranks.map((r) => ({ type: r.type, rank: r.rank, exclusion: r.exclusion })),
  };
}

export function serializeGuildDetail(g: GuildDetail) {
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    region: g.region,
    gameMode: g.gameMode,
    factionCode: g.factionCode,
    memberCount: g.memberCount,
    maxLevel: g.maxLevel,
    maxAverageItemLevel: g.maxAverageItemLevel,
    representative: g.representative ? serializeCharacterSummary(g.representative) : null,
    firstSeenAt: iso(g.firstSeenAt),
    lastSeenAt: iso(g.lastSeenAt),
    dataSource: g.dataSource,
    verificationStatus: g.verificationStatus,
    members: g.members.map(serializeCharacterSummary),
  };
}
