-- 레벨 달성 근거 테이블 (역사 기록 보존 Phase 1, docs/HISTORY-PRESERVATION.md)
-- 1) level_milestone_evidence 추가, level_milestones.evidence_id(현재 채택한 근거) 추가
-- 2) 영역 쓰기 트리거 (0002와 같은 함수)
-- 3) 기존 level_milestones를 근거 행(origin = MIGRATED)으로 이관하고 evidence_id를 연결
--    - 시간 근거(timing_basis)와 달성 시각은 기존 값 그대로 옮긴다. 근거 수준을 올리지 않는다.
--    - 맥락(이름·직업·종족·진영·길드)은 연결된 스냅샷이 같은 관측 시각일 때만 옮기고, 아니면 null로 둔다.
--    - region / game_mode는 캐릭터 식별 값이므로 characters에서 가져온다.
--    - 서버 수신 시각은 연결된 수집 원본이 있을 때만 채운다.
--    - 기존 행은 삭제·변경하지 않는다(evidence_id 연결만 추가). updated_at도 바꾸지 않는다.
CREATE TYPE "public"."evidence_origin" AS ENUM('INGESTED', 'MIGRATED');--> statement-breakpoint
CREATE TYPE "public"."reached_at_claim_status" AS ENUM('NONE', 'ACCEPTED', 'NEEDS_REVIEW', 'CONFLICT', 'REJECTED');--> statement-breakpoint
CREATE TABLE "level_milestone_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"level" integer NOT NULL,
	"timing_basis" "milestone_timing_basis" NOT NULL,
	"claimed_reached_at" timestamp with time zone,
	"claim_status" "reached_at_claim_status" NOT NULL,
	"claim_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"previous_observed_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"data_source" "data_source" NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"source_build" text,
	"snapshot_id" uuid,
	"ingestion_record_id" uuid,
	"character_name" text,
	"region" text NOT NULL,
	"game_mode" text NOT NULL,
	"class_code" text,
	"race_code" text,
	"faction_code" text,
	"guild_id" uuid,
	"origin" "evidence_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_milestone_evidence_id_env" UNIQUE("id","data_environment"),
	CONSTRAINT "level_milestone_evidence_mock_triple" CHECK (((data_environment = 'mock') = (data_source = 'mock')) AND ((data_environment = 'mock') = (verification_status = 'MOCK'))),
	CONSTRAINT "level_milestone_evidence_level_positive" CHECK (level >= 1),
	CONSTRAINT "level_milestone_evidence_claim_presence" CHECK ((claim_status = 'NONE') = (claimed_reached_at IS NULL)),
	CONSTRAINT "level_milestone_evidence_source_reported" CHECK ((timing_basis = 'SOURCE_REPORTED') = (claim_status = 'ACCEPTED')),
	CONSTRAINT "level_milestone_evidence_received_at" CHECK (origin = 'MIGRATED' OR received_at IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "level_milestones" ADD COLUMN "evidence_id" uuid;--> statement-breakpoint
ALTER TABLE "level_milestone_evidence" ADD CONSTRAINT "level_milestone_evidence_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestone_evidence" ADD CONSTRAINT "level_milestone_evidence_snapshot_fk" FOREIGN KEY ("snapshot_id","data_environment") REFERENCES "public"."character_snapshots"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestone_evidence" ADD CONSTRAINT "level_milestone_evidence_ingestion_fk" FOREIGN KEY ("ingestion_record_id","data_environment") REFERENCES "public"."ingestion_records"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestone_evidence" ADD CONSTRAINT "level_milestone_evidence_guild_fk" FOREIGN KEY ("guild_id","data_environment") REFERENCES "public"."guilds"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "level_milestone_evidence_character_level_idx" ON "level_milestone_evidence" USING btree ("character_id","level","observed_at");--> statement-breakpoint
CREATE INDEX "level_milestone_evidence_env_level_idx" ON "level_milestone_evidence" USING btree ("data_environment","level","observed_at");--> statement-breakpoint
ALTER TABLE "level_milestones" ADD CONSTRAINT "level_milestones_evidence_fk" FOREIGN KEY ("evidence_id","data_environment") REFERENCES "public"."level_milestone_evidence"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER level_milestone_evidence_env_guard BEFORE INSERT OR UPDATE ON level_milestone_evidence
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
INSERT INTO "level_milestone_evidence" (
  "character_id", "data_environment", "level", "timing_basis", "claimed_reached_at", "claim_status", "claim_reasons",
  "observed_at", "previous_observed_at", "received_at", "data_source", "verification_status", "source_build",
  "snapshot_id", "ingestion_record_id", "character_name", "region", "game_mode", "class_code", "race_code",
  "faction_code", "guild_id", "origin", "created_at"
)
SELECT
  m."character_id", m."data_environment", m."level", m."timing_basis", m."reached_at",
  (CASE WHEN m."timing_basis" = 'SOURCE_REPORTED' THEN 'ACCEPTED' ELSE 'NONE' END)::"reached_at_claim_status",
  '["MIGRATED_FROM_LEVEL_MILESTONES"]'::jsonb,
  m."first_observed_at", m."previous_observed_at", r."received_at",
  m."data_source", m."verification_status", m."source_build", m."snapshot_id", m."ingestion_record_id",
  CASE WHEN s."observed_at" = m."first_observed_at" THEN s."normalized_data"->>'characterName' END,
  c."region", c."game_mode",
  CASE WHEN s."observed_at" = m."first_observed_at" THEN s."normalized_data"->>'classCode' END,
  CASE WHEN s."observed_at" = m."first_observed_at" THEN s."normalized_data"->>'raceCode' END,
  CASE WHEN s."observed_at" = m."first_observed_at" THEN s."normalized_data"->>'factionCode' END,
  CASE WHEN s."observed_at" = m."first_observed_at" THEN s."guild_id" END,
  'MIGRATED', m."created_at"
FROM "level_milestones" m
JOIN "characters" c ON c."id" = m."character_id" AND c."data_environment" = m."data_environment"
LEFT JOIN "character_snapshots" s ON s."id" = m."snapshot_id" AND s."data_environment" = m."data_environment"
LEFT JOIN "ingestion_records" r ON r."id" = m."ingestion_record_id" AND r."data_environment" = m."data_environment";
--> statement-breakpoint
UPDATE "level_milestones" m SET "evidence_id" = e."id"
FROM "level_milestone_evidence" e
WHERE e."origin" = 'MIGRATED' AND e."character_id" = m."character_id" AND e."level" = m."level"
  AND e."data_environment" = m."data_environment" AND m."evidence_id" IS NULL;
