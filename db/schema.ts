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
  bigint,
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
  CLAIM_ASSESSMENT_KINDS,
  DATA_ENVIRONMENTS,
  DATA_SOURCES,
  EVIDENCE_ORIGINS,
  INGESTION_STATUSES,
  MILESTONE_TIMING_BASES,
  REACHED_AT_CLAIM_STATUSES,
  STATIC_DATA_KINDS,
  SUBMISSION_CHANNELS,
  SUBMISSION_REVIEW_STATUSES,
  STATIC_DATA_LICENSE_STATUSES,
  VERIFICATION_STATUSES,
} from "../lib/domain/enums";

export const dataEnvironmentEnum = pgEnum("data_environment", DATA_ENVIRONMENTS);
export const dataSourceEnum = pgEnum("data_source", DATA_SOURCES);
export const verificationStatusEnum = pgEnum("verification_status", VERIFICATION_STATUSES);
export const milestoneTimingBasisEnum = pgEnum("milestone_timing_basis", MILESTONE_TIMING_BASES);
export const ingestionStatusEnum = pgEnum("ingestion_status", INGESTION_STATUSES);
export const reachedAtClaimStatusEnum = pgEnum("reached_at_claim_status", REACHED_AT_CLAIM_STATUSES);
export const evidenceOriginEnum = pgEnum("evidence_origin", EVIDENCE_ORIGINS);
export const claimAssessmentKindEnum = pgEnum("claim_assessment_kind", CLAIM_ASSESSMENT_KINDS);
export const submissionReviewStatusEnum = pgEnum("submission_review_status", SUBMISSION_REVIEW_STATUSES);
export const submissionChannelEnum = pgEnum("submission_channel", SUBMISSION_CHANNELS);
export const staticDataKindEnum = pgEnum("static_data_kind", STATIC_DATA_KINDS);
export const staticDataLicenseStatusEnum = pgEnum("static_data_license_status", STATIC_DATA_LICENSE_STATUSES);

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
    }).onDelete("restrict"), // 역사 기록: 캐릭터 삭제로 연쇄 삭제하지 않는다 (migration 0008)
    foreignKey({
      name: "character_snapshots_ingestion_fk",
      columns: [t.ingestionRecordId, t.dataEnvironment],
      foreignColumns: [ingestionRecords.id, ingestionRecords.dataEnvironment],
    }),
    index("character_snapshots_character_observed_idx").on(t.characterId, t.observedAt.desc()),
  ],
);

// ---------------------------------------------------------------------------
// level_milestone_evidence (명세서 §8.5, docs/HISTORY-PRESERVATION.md)
//
// 레벨 달성 근거를 관측 단위로 쌓는다. 한 번 저장한 행은 수정할 수 없고, 실제 영역에서는 삭제할 수 없다
// (migration 0008 트리거). level_milestones는 이 근거 중 현재 채택한 하나를 가리키는 결과다.
// - observation_basis: 달성 시각 주장 없이 관측 자체가 뒷받침하는 근거(FIRST_OBSERVED / INFERRED).
//   주장이 인정되어 SOURCE_REPORTED가 되는지는 판정 기록(level_milestone_claim_assessments)이 정한다.
// - receipt_claim_*: 받은 시점의 판정. 이후 재판정은 판정 기록에 추가한다(이 행은 바꾸지 않음).
// - 맥락(직업·진영·길드 등)은 그 관측에 실제로 있던 값만 저장한다. 없으면 null.
// - origin = MIGRATED: 기존 level_milestones에서 이관한 행. legacy_timing_basis에 원래 값을 그대로 보존한다.
// ---------------------------------------------------------------------------
export const levelMilestoneEvidence = pgTable(
  "level_milestone_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id").notNull(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    level: integer("level").notNull(),
    /** 관측 자체가 뒷받침하는 근거: FIRST_OBSERVED(이 레벨을 직접 관측) / INFERRED(더 높은 레벨 관측에서 추론) */
    observationBasis: milestoneTimingBasisEnum("observation_basis").notNull(),
    /** 공급원이 보낸 달성 시각 주장 (판정과 관계없이 받은 값 그대로) */
    claimedReachedAt: tz("claimed_reached_at"),
    /** 받은 시점의 주장 판정 */
    receiptClaimStatus: reachedAtClaimStatusEnum("receipt_claim_status").notNull(),
    /** 받은 시점의 판정 이유 코드 목록 (예: CLAIM_AFTER_OBSERVATION) */
    receiptClaimReasons: jsonb("receipt_claim_reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** 이관 행의 원래 level_milestones.timing_basis (이관 행만) */
    legacyTimingBasis: milestoneTimingBasisEnum("legacy_timing_basis"),
    /** 이 레벨(INFERRED면 더 높은 레벨)을 관측한 시각 */
    observedAt: tz("observed_at").notNull(),
    /** 레벨 상승을 확인한 직전(더 낮은 레벨) 관측 시각 (있을 때만) */
    previousObservedAt: tz("previous_observed_at"),
    /** 서버가 원본을 받은 시각. 이관 행은 모를 수 있음 */
    receivedAt: tz("received_at"),
    dataSource: dataSourceEnum("data_source").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull(),
    sourceBuild: text("source_build"),
    snapshotId: uuid("snapshot_id"),
    ingestionRecordId: uuid("ingestion_record_id"),
    // --- 관측 당시 맥락 (최초 기록 계산용) ---
    characterName: text("character_name"),
    region: text("region").notNull(),
    gameMode: text("game_mode").notNull(),
    classCode: text("class_code"),
    raceCode: text("race_code"),
    factionCode: text("faction_code"),
    guildId: uuid("guild_id"),
    origin: evidenceOriginEnum("origin").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    mockTripleCheck("level_milestone_evidence_mock_triple"),
    check("level_milestone_evidence_level_positive", sql`level >= 1`),
    check("level_milestone_evidence_observation_basis", sql`observation_basis <> 'SOURCE_REPORTED'`),
    check(
      "level_milestone_evidence_claim_presence",
      sql`(receipt_claim_status = 'NONE') = (claimed_reached_at IS NULL)`,
    ),
    check(
      "level_milestone_evidence_inferred_no_claim",
      sql`observation_basis <> 'INFERRED' OR claimed_reached_at IS NULL OR origin = 'MIGRATED'`,
    ),
    check("level_milestone_evidence_legacy", sql`(origin = 'MIGRATED') = (legacy_timing_basis IS NOT NULL)`),
    check("level_milestone_evidence_received_at", sql`origin = 'MIGRATED' OR received_at IS NOT NULL`),
    unique("level_milestone_evidence_id_env").on(t.id, t.dataEnvironment),
    // 채택 기록·판정 기록이 같은 캐릭터·레벨·영역의 근거만 가리키도록 하는 복합 키
    unique("level_milestone_evidence_id_scope").on(t.id, t.characterId, t.level, t.dataEnvironment),
    foreignKey({
      name: "level_milestone_evidence_character_fk",
      columns: [t.characterId, t.dataEnvironment],
      foreignColumns: [characters.id, characters.dataEnvironment],
    }).onDelete("restrict"),
    foreignKey({
      name: "level_milestone_evidence_snapshot_fk",
      columns: [t.snapshotId, t.dataEnvironment],
      foreignColumns: [characterSnapshots.id, characterSnapshots.dataEnvironment],
    }),
    foreignKey({
      name: "level_milestone_evidence_ingestion_fk",
      columns: [t.ingestionRecordId, t.dataEnvironment],
      foreignColumns: [ingestionRecords.id, ingestionRecords.dataEnvironment],
    }),
    foreignKey({
      name: "level_milestone_evidence_guild_fk",
      columns: [t.guildId, t.dataEnvironment],
      foreignColumns: [guilds.id, guilds.dataEnvironment],
    }),
    // 한 캐릭터·레벨의 이관 근거는 하나뿐 (기존 milestone 1행 → 근거 1행)
    uniqueIndex("level_milestone_evidence_migrated_uq")
      .on(t.characterId, t.level)
      .where(sql`origin = 'MIGRATED'`),
    index("level_milestone_evidence_character_level_idx").on(t.characterId, t.level, t.observedAt),
    index("level_milestone_evidence_env_level_idx").on(t.dataEnvironment, t.level, t.observedAt),
  ],
);

// ---------------------------------------------------------------------------
// level_milestone_claim_assessments (명세서 §8.5, docs/HISTORY-PRESERVATION.md §3)
//
// 달성 시각 주장의 판정 이력. 추가만 한다(수정 금지, 실제 영역 삭제 금지 — migration 0008).
// 근거를 받을 때(RECEIPT), 새 사실로 판정이 바뀔 때(REASSESSMENT), 이관할 때(MIGRATED) 한 행씩 쌓인다.
// 같은 근거의 가장 최근 행(seq가 가장 큰 행)이 현재 판정이다.
// ---------------------------------------------------------------------------
export const levelMilestoneClaimAssessments = pgTable(
  "level_milestone_claim_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 같은 근거 안의 순서 (가장 큰 값이 현재 판정) */
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity().notNull(),
    evidenceId: uuid("evidence_id").notNull(),
    characterId: uuid("character_id").notNull(),
    level: integer("level").notNull(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    status: reachedAtClaimStatusEnum("status").notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    kind: claimAssessmentKindEnum("kind").notNull(),
    assessedAt: tz("assessed_at").notNull(),
    /** 판정을 일으킨 수집 원본 (이관 판정은 null) */
    ingestionRecordId: uuid("ingestion_record_id"),
    createdAt: createdAt(),
  },
  (t) => [
    check("level_milestone_claim_assessments_status", sql`status <> 'NONE'`),
    unique("level_milestone_claim_assessments_ref").on(t.id, t.evidenceId, t.status),
    foreignKey({
      name: "level_milestone_claim_assessments_evidence_fk",
      columns: [t.evidenceId, t.characterId, t.level, t.dataEnvironment],
      foreignColumns: [
        levelMilestoneEvidence.id,
        levelMilestoneEvidence.characterId,
        levelMilestoneEvidence.level,
        levelMilestoneEvidence.dataEnvironment,
      ],
    }),
    foreignKey({
      name: "level_milestone_claim_assessments_ingestion_fk",
      columns: [t.ingestionRecordId, t.dataEnvironment],
      foreignColumns: [ingestionRecords.id, ingestionRecords.dataEnvironment],
    }),
    index("level_milestone_claim_assessments_evidence_idx").on(t.evidenceId, t.seq),
  ],
);

// ---------------------------------------------------------------------------
// level_milestones (명세서 §8.2, §14.12)
// 현재 채택한 달성 기록.
// - evidence_id: 채택한 근거. 같은 캐릭터·레벨·영역의 근거만 가리킬 수 있다(복합 FK).
// - claim_assessment_id / claim_assessment_status: SOURCE_REPORTED일 때 근거로 삼은 판정(ACCEPTED).
//   같은 근거의 ACCEPTED 판정만 가리킬 수 있다(복합 FK + CHECK).
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
    /** 현재 채택한 근거 (level_milestone_evidence) */
    evidenceId: uuid("evidence_id"),
    /** SOURCE_REPORTED일 때 근거로 삼은 주장 판정 */
    claimAssessmentId: uuid("claim_assessment_id"),
    claimAssessmentStatus: reachedAtClaimStatusEnum("claim_assessment_status"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    mockTripleCheck("level_milestones_mock_triple"),
    check(
      "level_milestones_reached_at_basis",
      sql`(timing_basis = 'SOURCE_REPORTED') = (reached_at IS NOT NULL)`,
    ),
    // 0007 이관 이후에 추가한다 (migration 안에서 이관 다음으로 옮김)
    check(
      "level_milestones_claim_assessment",
      sql`((claim_assessment_id IS NULL) = (claim_assessment_status IS NULL)) AND ((timing_basis = 'SOURCE_REPORTED') = (claim_assessment_id IS NOT NULL)) AND (claim_assessment_status IS NULL OR claim_assessment_status = 'ACCEPTED') AND (claim_assessment_id IS NULL OR evidence_id IS NOT NULL)`,
    ),
    foreignKey({
      name: "level_milestones_character_fk",
      columns: [t.characterId, t.dataEnvironment],
      foreignColumns: [characters.id, characters.dataEnvironment],
    }).onDelete("restrict"), // 역사 기록: 캐릭터 삭제로 연쇄 삭제하지 않는다 (migration 0008)
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
    foreignKey({
      name: "level_milestones_evidence_fk",
      columns: [t.evidenceId, t.characterId, t.level, t.dataEnvironment],
      foreignColumns: [
        levelMilestoneEvidence.id,
        levelMilestoneEvidence.characterId,
        levelMilestoneEvidence.level,
        levelMilestoneEvidence.dataEnvironment,
      ],
    }),
    foreignKey({
      name: "level_milestones_claim_assessment_fk",
      columns: [t.claimAssessmentId, t.evidenceId, t.claimAssessmentStatus],
      foreignColumns: [
        levelMilestoneClaimAssessments.id,
        levelMilestoneClaimAssessments.evidenceId,
        levelMilestoneClaimAssessments.status,
      ],
    }),
    uniqueIndex("level_milestones_character_level_uq").on(t.characterId, t.level),
    index("level_milestones_env_level_idx").on(t.dataEnvironment, t.level, t.effectiveReachedAt),
  ],
);

// ---------------------------------------------------------------------------
// static_datasets — 정적 게임 데이터셋 (Phase 2C, docs/STATIC-GAME-DATA.md)
//
// 데이터셋은 버전별로 쌓는다. 같은 (영역, 종류, 공급원, datasetVersion)을 다른 내용으로 덮어쓰지 않는다.
// 행 수정은 트리거(마이그레이션 0004)가 막는다.
// ---------------------------------------------------------------------------
export const staticDatasets = pgTable(
  "static_datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    kind: staticDataKindEnum("kind").notNull(),
    /** 데이터셋 공급원 코드 (예: mock). 캐릭터 dataSource와는 별개 */
    source: text("source").notNull(),
    sourceVersion: text("source_version").notNull(),
    sourceBuild: text("source_build"),
    interfaceVersion: text("interface_version"),
    datasetVersion: text("dataset_version").notNull(),
    observedAt: tz("observed_at").notNull(),
    licenseStatus: staticDataLicenseStatusEnum("license_status").notNull(),
    licenseTermsUrl: text("license_terms_url"),
    licenseCheckedAt: text("license_checked_at"),
    attribution: text("attribution"),
    checksum: text("checksum").notNull(),
    recordCount: integer("record_count").notNull(),
    importedAt: tz("imported_at").notNull().defaultNow(),
  },
  (t) => [
    check("static_datasets_mock_source", sql`(data_environment = 'mock') = (source = 'mock')`),
    check("static_datasets_mock_license", sql`(data_environment = 'mock') = (license_status = 'MOCK')`),
    // 실제 영역에는 이용 조건을 확인한 데이터셋만 넣는다.
    check(
      "static_datasets_license_confirmed",
      sql`data_environment = 'mock' OR (license_status = 'PERMITTED' AND license_terms_url IS NOT NULL AND license_checked_at IS NOT NULL)`,
    ),
    check("static_datasets_record_count", sql`record_count >= 0`),
    unique("static_datasets_id_env_kind").on(t.id, t.dataEnvironment, t.kind),
    uniqueIndex("static_datasets_version_uq").on(t.dataEnvironment, t.kind, t.source, t.datasetVersion),
    index("static_datasets_latest_idx").on(t.dataEnvironment, t.kind, t.observedAt),
  ],
);

export const staticDataRecords = pgTable(
  "static_data_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id").notNull(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    kind: staticDataKindEnum("kind").notNull(),
    /** 데이터셋 안의 고유 키 (아이템: itemId, 그 밖: code) */
    recordKey: text("record_key").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => [
    foreignKey({
      name: "static_data_records_dataset_fk",
      columns: [t.datasetId, t.dataEnvironment, t.kind],
      foreignColumns: [staticDatasets.id, staticDatasets.dataEnvironment, staticDatasets.kind],
    }).onDelete("cascade"),
    uniqueIndex("static_data_records_dataset_key_uq").on(t.datasetId, t.recordKey),
    index("static_data_records_env_kind_key_idx").on(t.dataEnvironment, t.kind, t.recordKey),
  ],
);

// ---------------------------------------------------------------------------
// character_submissions — 캐릭터 제출과 관리자 검토 (Phase 3A, docs/SUBMISSION-SYSTEM.md)
//
// - 실제 영역(beta / live)에만 저장한다. mock 배포는 제출을 저장하지 않는다.
// - 검증 상태는 항상 COMMUNITY_SUBMITTED. 검토 상태(review_status)와 분리한다.
// - IP 주소, 계정 정보, 파일 경로는 저장하지 않는다.
// ---------------------------------------------------------------------------
export const characterSubmissions = pgTable(
  "character_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataEnvironment: dataEnvironmentEnum("data_environment").notNull(),
    dataSource: dataSourceEnum("data_source").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull(),
    reviewStatus: submissionReviewStatusEnum("review_status").notNull(),
    channel: submissionChannelEnum("channel").notNull(),
    /** 검토를 막는 이유 (예: MAPPING_PENDING = 게임 값 매핑이 아직 확인되지 않음) */
    blockedReason: text("blocked_reason"),
    /** 검증을 통과한 export (알 수 없는 필드는 제거됨) */
    payload: jsonb("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    /** 정규화한 관측 데이터의 해시. 매핑이 없으면 null */
    contentHash: text("content_hash"),
    /** 캐릭터 식별 키의 해시 (GUID 등 원문을 따로 두지 않음) */
    identityKey: text("identity_key"),
    /** 화면 표시용 요약 (미리보기와 같은 항목) */
    summary: jsonb("summary").notNull(),
    characterName: text("character_name").notNull(),
    level: integer("level"),
    observedAt: tz("observed_at"),
    sourceBuild: text("source_build"),
    gearCoverage: numeric("gear_coverage", { precision: 4, scale: 3, mode: "number" }),
    averageItemLevel: numeric("average_item_level", { precision: 6, scale: 2, mode: "number" }),
    highestItemLevel: integer("highest_item_level"),
    /** 정규화한 관측 데이터 (매핑이 없으면 null) */
    observation: jsonb("observation"),
    /** 같은 캐릭터의 이전 제출과 비교 결과 */
    comparison: jsonb("comparison"),
    issues: jsonb("issues").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    lastDuplicateAt: tz("last_duplicate_at"),
    characterId: uuid("character_id"),
    ingestionRecordId: uuid("ingestion_record_id"),
    consentVersion: text("consent_version"),
    policyVersion: text("policy_version"),
    consentedAt: tz("consented_at"),
    submittedAt: tz("submitted_at").notNull(),
    reviewedAt: tz("reviewed_at"),
    reviewNote: text("review_note"),
  },
  (t) => [
    check("character_submissions_real_only", sql`data_environment <> 'mock'`),
    check("character_submissions_source", sql`data_source = 'addon'`),
    check("character_submissions_community", sql`verification_status = 'COMMUNITY_SUBMITTED'`),
    check(
      "character_submissions_public_consent",
      sql`channel <> 'public' OR (consent_version IS NOT NULL AND policy_version IS NOT NULL AND consented_at IS NOT NULL)`,
    ),
    check("character_submissions_duplicate_count", sql`duplicate_count >= 0`),
    foreignKey({
      name: "character_submissions_character_fk",
      columns: [t.characterId, t.dataEnvironment],
      foreignColumns: [characters.id, characters.dataEnvironment],
    }),
    foreignKey({
      name: "character_submissions_ingestion_fk",
      columns: [t.ingestionRecordId, t.dataEnvironment],
      foreignColumns: [ingestionRecords.id, ingestionRecords.dataEnvironment],
    }),
    uniqueIndex("character_submissions_payload_uq").on(t.dataEnvironment, t.payloadHash),
    index("character_submissions_identity_idx").on(t.dataEnvironment, t.identityKey, t.submittedAt),
    index("character_submissions_review_idx").on(t.dataEnvironment, t.reviewStatus, t.submittedAt),
  ],
);

/** data_environment 쓰기 트리거를 거는 게임 데이터 테이블 목록 (마이그레이션 0002, 0004와 일치해야 한다) */
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
  "static_datasets",
  "static_data_records",
  "character_submissions",
] as const;
