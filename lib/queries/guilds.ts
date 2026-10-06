/**
 * 길드 조회 (명세서 §4, Phase 1 길드 상세)
 */
import { and, asc, count, eq, max, sql, type SQL } from "drizzle-orm";
import { characters, guilds } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { resolveGearProfile } from "@/lib/config";
import { ORDER_BY, staleCutoff } from "@/lib/ranking/common";
import type { CharacterSummary, DataScope } from "./characters";

export interface GuildSummary {
  id: string;
  name: string;
  slug: string;
  region: string;
  gameMode: string;
  factionCode: string | null;
  memberCount: number;
  lastSeenAt: Date | null;
}

export interface GuildDetail extends GuildSummary {
  verificationStatus: (typeof guilds.$inferSelect)["verificationStatus"];
  dataSource: (typeof guilds.$inferSelect)["dataSource"];
  firstSeenAt: Date;
  maxLevel: number | null;
  /** 현재 Gear Profile 기준 최소 커버리지를 충족한 길드원 중 최고 평균 장비 레벨 */
  maxAverageItemLevel: number | null;
  /** 레벨 랭킹 정렬 기준으로 가장 앞선 길드원 */
  representative: CharacterSummary | null;
  members: CharacterSummary[];
}

export async function listGuilds(
  db: AppDatabase,
  scope: DataScope & { gameMode?: string },
): Promise<GuildSummary[]> {
  const conditions: SQL[] = [eq(guilds.dataEnvironment, scope.dataEnvironment)];
  if (scope.gameMode) conditions.push(eq(guilds.gameMode, scope.gameMode));
  const rows = await db
    .select({
      id: guilds.id,
      name: guilds.name,
      slug: guilds.slug,
      region: guilds.region,
      gameMode: guilds.gameMode,
      factionCode: guilds.factionCode,
      memberCount: count(characters.id),
      lastSeenAt: max(characters.lastSeenAt),
    })
    .from(guilds)
    .leftJoin(characters, eq(characters.guildId, guilds.id))
    .where(and(...conditions))
    .groupBy(guilds.id)
    .orderBy(sql`count(${characters.id}) desc`, sql`${guilds.name} collate "C" asc`, asc(guilds.id));
  return rows.map((r) => ({ ...r, lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt) : null }));
}

async function loadGuild(db: AppDatabase, where: SQL, now: Date): Promise<GuildDetail | null> {
  const [guild] = await db.select().from(guilds).where(where).limit(1);
  if (!guild) return null;

  const memberRows = await db
    .select({
      id: characters.id,
      characterName: characters.characterName,
      slug: characters.slug,
      region: characters.region,
      gameMode: characters.gameMode,
      level: characters.level,
      classCode: characters.classCode,
      raceCode: characters.raceCode,
      factionCode: characters.factionCode,
      averageItemLevel: characters.averageItemLevel,
      highestItemLevel: characters.highestItemLevel,
      gearCoverage: characters.gearCoverage,
      gearProfileId: characters.gearProfileId,
      gearProfileVersion: characters.gearProfileVersion,
      lastSeenAt: characters.lastSeenAt,
      verificationStatus: characters.verificationStatus,
      dataSource: characters.dataSource,
    })
    .from(characters)
    .where(and(eq(characters.dataEnvironment, guild.dataEnvironment), eq(characters.guildId, guild.id)))
    .orderBy(...ORDER_BY.level);

  const cutoff = staleCutoff({ dataEnvironment: guild.dataEnvironment, gameMode: guild.gameMode }, now);
  const guildRef = { id: guild.id, name: guild.name, slug: guild.slug };
  const members: CharacterSummary[] = memberRows.map((m) => ({
    id: m.id,
    characterName: m.characterName,
    slug: m.slug,
    region: m.region,
    gameMode: m.gameMode,
    level: m.level,
    classCode: m.classCode,
    raceCode: m.raceCode,
    factionCode: m.factionCode,
    guild: guildRef,
    averageItemLevel: m.averageItemLevel,
    highestItemLevel: m.highestItemLevel,
    lastSeenAt: m.lastSeenAt,
    isStale: m.lastSeenAt < cutoff,
    verificationStatus: m.verificationStatus,
    dataSource: m.dataSource,
  }));

  const profile = resolveGearProfile(guild.dataEnvironment, guild.gameMode);
  const ratio = profile?.minimumCoverage.minRankableSlotRatio ?? 0;
  const gearValues = profile
    ? memberRows
        .filter(
          (m) =>
            m.gearProfileId === profile.id &&
            m.gearProfileVersion === profile.version &&
            m.averageItemLevel !== null &&
            (m.gearCoverage ?? 0) >= ratio,
        )
        .map((m) => m.averageItemLevel as number)
    : [];

  return {
    id: guild.id,
    name: guild.name,
    slug: guild.slug,
    region: guild.region,
    gameMode: guild.gameMode,
    factionCode: guild.factionCode,
    memberCount: members.length,
    lastSeenAt: members.length > 0 ? new Date(Math.max(...members.map((m) => m.lastSeenAt.getTime()))) : guild.lastSeenAt,
    verificationStatus: guild.verificationStatus,
    dataSource: guild.dataSource,
    firstSeenAt: guild.firstSeenAt,
    maxLevel: members.length > 0 ? Math.max(...members.map((m) => m.level)) : null,
    maxAverageItemLevel: gearValues.length > 0 ? Math.max(...gearValues) : null,
    representative: members[0] ?? null,
    members,
  };
}

export function getGuildById(db: AppDatabase, scope: DataScope, id: string, now: Date) {
  return loadGuild(db, and(eq(guilds.dataEnvironment, scope.dataEnvironment), eq(guilds.id, id))!, now);
}

export function getGuildBySlug(
  db: AppDatabase,
  scope: DataScope,
  key: { region: string; gameMode: string; slug: string },
  now: Date,
) {
  return loadGuild(
    db,
    and(
      eq(guilds.dataEnvironment, scope.dataEnvironment),
      eq(guilds.region, key.region),
      eq(guilds.gameMode, key.gameMode),
      eq(guilds.slug, key.slug),
    )!,
    now,
  );
}
