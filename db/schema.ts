/**
 * Drizzle 스키마 (명세서 §14).
 *
 * 공통 규칙
 * - 기본 키는 UUID
 * - 시각은 timestamptz (UTC)
 * - 모든 게임 데이터 테이블은 data_environment를 가지며, 쓰기 트리거(마이그레이션 0002)로
 *   database_identity가 허용하지 않는 영역의 행을 거부한다.
 * - 하위 테이블은 (부모 id, data_environment) 복합 외래 키로 부모와 같은 영역임을 보장한다.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  DATA_ENVIRONMENTS,
  DATA_SOURCES,
  INGESTION_STATUSES,
  MILESTONE_TIMING_BASES,
  VERIFICATION_STATUSES,
} from "../lib/domain/enums";

export const dataEnvironmentEnum = pgEnum("data_environment", DATA_ENVIRONMENTS);
export const dataSourceEnum = pgEnum("data_source", DATA_SOURCES);
export const verificationStatusEnum = pgEnum("verification_status", VERIFICATION_STATUSES);
export const milestoneTimingBasisEnum = pgEnum("milestone_timing_basis", MILESTONE_TIMING_BASES);
export const ingestionStatusEnum = pgEnum("ingestion_status", INGESTION_STATUSES);

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => tz("created_at").notNull().defaultNow();
const updatedAt = () => tz("updated_at").notNull().defaultNow();

/** 불변 규칙: mock 영역 ⇔ mock 공급원 ⇔ MOCK 검증 상태 (명세서 §6.2) */
const mockTripleCheck = (name: string) =>
  check(
    name,
    sql`((data_environment = 'mock') = (data_source = 'mock')) AND ((data_environment = 'mock') = (verification_status = 'MOCK'))`,
  );
/** 검증 상태가 없는 테이블: mock 영역 ⇔ mock 공급원 */
const mockPairCheck = (name: string) =>
  check(name, sql`(data_environment = 'mock') = (data_source = 'mock')`);

// ---------------------------------------------------------------------------
// database_identity (명세서 §14.3)
// ---------------------------------------------------------------------------
export const databaseIdentity = pgTable(
  "database_identity",
  {
    id: integer("id").primaryKey().default(1),
    allowedDataEnvironments: dataEnvironmentEnum("allowed_data_environments").array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("database_identity_singleton", sql`${t.id} = 1`),
    check("database_identity_not_empty", sql`cardinality(${t.allowedDataEnvironments}) > 0`),
    // mock DB는 mock만 받는다. mock과 실제 영역을 함께 허용할 수 없다.
    check(
      "database_identity_mock_isolated",
      sql`NOT ('mock' = ANY(${t.allowedDataEnvironments}) AND cardinality(${t.allowedDataEnvironments}) > 1)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// ingestion_records (명세서 §14.4)
// ---------------------------------------------------------------------------
export const ingestionRecords = pgTable(
  "ingestion_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    dataSource: dataSourceEnum("data_source").notNull(),
    sourceBuild: text("source_build"),
    parserVersion: text("parser_version").notNull(),
    receivedAt: tz("received_at").notNull(),
    payload: jsonb("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: ingestionStatusEnum("status").notNull(),
    warnings: jsonb("warnings").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    rejectionReason: text("rejection_reason"),
  },
  (t) => [
    mockPairCheck("ingestion_records_mock_pair"),
    unique("ingestion_records_id_env").on(t.id, t.dataEnvironment),
    index("ingestion_records_env_received_idx").on(t.dataEnvironment, t.receivedAt),
  ],
);

// ---------------------------------------------------------------------------
// guilds (명세서 §14.5)
// ---------------------------------------------------------------------------
export const guilds = pgTable(
  "guilds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    region: text("region").notNull(),
    gameMode: text("game_mode").notNull(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    slug: text("slug").notNull(),
    factionCode: text("faction_code"),
    firstSeenAt: tz("first_seen_at").notNull(),
    lastSeenAt: tz("last_seen_at").notNull(),
    dataSource: dataSourceEnum("data_source").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull(),
    sourceUpdatedAt: tz("source_updated_at"),
    sourceBuild: text("source_build"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    mockTripleCheck("guilds_mock_triple"),
    unique("guilds_id_env").on(t.id, t.dataEnvironment),
    uniqueIndex("guilds_scope_slug_uq").on(t.dataEnvironment, t.region, t.gameMode, t.slug),
    index("guilds_scope_name_idx").on(t.dataEnvironment, t.region, t.gameMode, t.nameNormalized),
  ],
);

export const guildExternalRefs = pgTable(
  "guild_external_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id").notNull(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    dataSource: dataSourceEnum("data_source").notNull(),
    externalId: text("external_id").notNull(),
    firstSeenAt: tz("first_seen_at").notNull(),
    lastSeenAt: tz("last_seen_at").notNull(),
  },
  (t) => [
    mockPairCheck("guild_external_refs_mock_pair"),
    foreignKey({
      name: "guild_external_refs_guild_fk",
      columns: [t.guildId, t.dataEnvironment],
      foreignColumns: [guilds.id, guilds.dataEnvironment],
    }).onDelete("cascade"),
    uniqueIndex("guild_external_refs_uq").on(t.dataEnvironment, t.dataSource, t.externalId),
  ],
);

// ---------------------------------------------------------------------------
// characters (명세서 §14.7)
// ---------------------------------------------------------------------------
export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    region: text("region").notNull(),
    gameMode: text("game_mode").notNull(),
    characterName: text("character_name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    slug: text("slug").notNull(),
    factionCode: text("faction_code"),
    raceCode: text("race_code"),
    classCode: text("class_code"),
    level: integer("level").notNull(),
    /** level_milestones에서 파생된 캐시 값. 원본은 level_milestones. */
    currentLevelReachedAt: tz("current_level_reached_at"),
    currentLevelTimingBasis: milestoneTimingBasisEnum("current_level_timing_basis"),
    averageItemLevel: numeric("average_item_level", { precision: 6, scale: 2, mode: "number" }),
    highestItemLevel: integer("highest_item_level"),
    gearCoverage: numeric("gear_coverage", { precision: 4, scale: 3, mode: "number" }),
    gearProfileId: text("gear_profile_id"),
    gearProfileVersion: integer("gear_profile_version"),
    gearObservedAt: tz("gear_observed_at"),
    guildId: uuid("guild_id"),
    firstSeenAt: tz("first_seen_at").notNull(),
    lastSeenAt: tz("last_seen_at").notNull(),
    dataSource: dataSourceEnum("data_source").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull(),
    sourceUpdatedAt: tz("source_updated_at"),
    sourceBuild: text("source_build"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    mockTripleCheck("characters_mock_triple"),
    check("characters_level_positive", sql`${t.level} >= 1`),
    unique("characters_id_env").on(t.id, t.dataEnvironment),
    foreignKey({
      name: "characters_guild_fk",
      columns: [t.guildId, t.dataEnvironment],
      foreignColumns: [guilds.id, guilds.dataEnvironment],
    }),
    uniqueIndex("characters_scope_slug_uq").on(t.dataEnvironment, t.region, t.gameMode, t.slug),
    index("characters_scope_name_idx").on(t.dataEnvironment, t.gameMode, t.nameNormalized),
    index("characters_name_trgm_idx").using("gin", t.nameNormalized.op("gin_trgm_ops")),
    index("characters_level_rank_idx").on(
      t.dataEnvironment,
      t.gameMode,
      t.level.desc(),
      t.currentLevelReachedAt,
      t.firstSeenAt,
    ),
    index("characters_gear_rank_idx").on(
      t.dataEnvironment,
      t.gameMode,
      t.averageItemLevel.desc(),
      t.highestItemLevel.desc(),
    ),
    index("characters_highest_rank_idx").on(
      t.dataEnvironment,
      t.gameMode,
      t.highestItemLevel.desc(),
      t.averageItemLevel.desc(),
    ),
    index("characters_env_last_seen_idx").on(t.dataEnvironment, t.lastSeenAt),
    index("characters_guild_idx").on(t.guildId),
  ],
);

export const characterExternalRefs = pgTable(
  "character_external_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id").notNull(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    dataSource: dataSourceEnum("data_source").notNull(),
    externalId: text("external_id").notNull(),
    firstSeenAt: tz("first_seen_at").notNull(),
    lastSeenAt: tz("last_seen_at").notNull(),
  },
  (t) => [
    mockPairCheck("character_external_refs_mock_pair"),
    foreignKey({
      name: "character_external_refs_character_fk",
      columns: [t.characterId, t.dataEnvironment],
      foreignColumns: [characters.id, characters.dataEnvironment],
    }).onDelete("cascade"),
    uniqueIndex("character_external_refs_uq").on(t.dataEnvironment, t.dataSource, t.externalId),
  ],
);

// ---------------------------------------------------------------------------
// items (명세서 §14.9)
// ---------------------------------------------------------------------------
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    externalItemId: text("external_item_id").notNull(),
    name: text("name").notNull(),
    nameLocale: text("name_locale"),
    slotCode: text("slot_code"),
    qualityCode: text("quality_code"),
    baseItemLevel: integer("base_item_level"),
    iconUrl: text("icon_url"),
    description: text("description"),
    dataSource: dataSourceEnum("data_source").notNull(),
    sourceUpdatedAt: tz("source_updated_at"),
    sourceBuild: text("source_build"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    mockPairCheck("items_mock_pair"),
    unique("items_id_env").on(t.id, t.dataEnvironment),
    uniqueIndex("items_env_external_uq").on(t.dataEnvironment, t.externalItemId),
  ],
);

// ---------------------------------------------------------------------------
// character_items — 현재 장착 장비만 (명세서 §14.10)
// ---------------------------------------------------------------------------
export const characterItems = pgTable(
  "character_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id").notNull(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    slotCode: text("slot_code").notNull(),
    itemId: uuid("item_id").notNull(),
    itemLevel: integer("item_level"),
    enchant: jsonb("enchant"),
    gems: jsonb("gems"),
    observedAt: tz("observed_at").notNull(),
    dataSource: dataSourceEnum("data_source").notNull(),
    sourceBuild: text("source_build"),
  },
  (t) => [
    mockPairCheck("character_items_mock_pair"),
    foreignKey({
      name: "character_items_character_fk",
      columns: [t.characterId, t.dataEnvironment],
      foreignColumns: [characters.id, characters.dataEnvironment],
    }).onDelete("cascade"),
    foreignKey({
      name: "character_items_item_fk",
      columns: [t.itemId, t.dataEnvironment],
      foreignColumns: [items.id, items.dataEnvironment],
    }),
    uniqueIndex("character_items_character_slot_uq").on(t.characterId, t.slotCode),
  ],
);

// ---------------------------------------------------------------------------
// character_snapshots (명세서 §14.11)
// ---------------------------------------------------------------------------
export const characterSnapshots = pgTable(
  "character_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id").notNull(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    observedAt: tz("observed_at").notNull(),
    level: integer("level").notNull(),
    averageItemLevel: numeric("average_item_level", { precision: 6, scale: 2, mode: "number" }),
    highestItemLevel: integer("highest_item_level"),
    gearCoverage: numeric("gear_coverage", { precision: 4, scale: 3, mode: "number" }),
    gearProfileId: text("gear_profile_id"),
    gearProfileVersion: integer("gear_profile_version"),
    guildId: uuid("guild_id"),
    normalizedData: jsonb("normalized_data").notNull(),
    contentHash: text("content_hash").notNull(),
    ingestionRecordId: uuid("ingestion_record_id"),
    dataSource: dataSourceEnum("data_source").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull(),
    sourceUpdatedAt: tz("source_updated_at"),
    sourceBuild: text("source_build"),
    createdAt: createdAt(),
  },
  (t) => [
    mockTripleCheck("character_snapshots_mock_triple"),
    unique("character_snapshots_id_env").on(t.id, t.dataEnvironment),
    foreignKey({
      name: "character_snapshots_character_fk",
      columns: [t.characterId, t.dataEnvironment],
      foreignColumns: [characters.id, characters.dataEnvironment],
    }).onDelete("cascade"),
    foreignKey({
      name: "character_snapshots_ingestion_fk",
      columns: [t.ingestionRecordId, t.dataEnvironment],
      foreignColumns: [ingestionRecords.id, ingestionRecords.dataEnvironment],
    }),
    index("character_snapshots_character_observed_idx").on(t.characterId, t.observedAt.desc()),
  ],
);

// ---------------------------------------------------------------------------
// level_milestones (명세서 §8.2, §14.12)
// ---------------------------------------------------------------------------
export const levelMilestones = pgTable(
  "level_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id").notNull(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    level: integer("level").notNull(),
    timingBasis: milestoneTimingBasisEnum("timing_basis").notNull(),
    reachedAt: tz("reached_at"),
    firstObservedAt: tz("first_observed_at").notNull(),
    previousObservedAt: tz("previous_observed_at"),
    effectiveReachedAt: tz("effective_reached_at")
      .notNull()
      .generatedAlwaysAs(
        sql`CASE WHEN timing_basis = 'SOURCE_REPORTED' THEN reached_at ELSE first_observed_at END`,
      ),
    dataSource: dataSourceEnum("data_source").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull(),
    sourceBuild: text("source_build"),
    snapshotId: uuid("snapshot_id"),
    ingestionRecordId: uuid("ingestion_record_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    mockTripleCheck("level_milestones_mock_triple"),
    check(
      "level_milestones_reached_at_basis",
      sql`(timing_basis = 'SOURCE_REPORTED') = (reached_at IS NOT NULL)`,
    ),
    foreignKey({
      name: "level_milestones_character_fk",
      columns: [t.characterId, t.dataEnvironment],
      foreignColumns: [characters.id, characters.dataEnvironment],
    }).onDelete("cascade"),
    foreignKey({
      name: "level_milestones_snapshot_fk",
      columns: [t.snapshotId, t.dataEnvironment],
      foreignColumns: [characterSnapshots.id, characterSnapshots.dataEnvironment],
    }),
    foreignKey({
      name: "level_milestones_ingestion_fk",
      columns: [t.ingestionRecordId, t.dataEnvironment],
      foreignColumns: [ingestionRecords.id, ingestionRecords.dataEnvironment],
    }),
    uniqueIndex("level_milestones_character_level_uq").on(t.characterId, t.level),
    index("level_milestones_env_level_idx").on(t.dataEnvironment, t.level, t.effectiveReachedAt),
  ],
);

/** data_environment 쓰기 트리거를 거는 게임 데이터 테이블 목록 (마이그레이션 0002와 일치해야 한다) */
export const GUARDED_TABLES = [
  "ingestion_records",
  "guilds",
  "guild_external_refs",
  "characters",
  "character_external_refs",
  "items",
  "character_items",
  "character_snapshots",
  "level_milestones",
] as const;
