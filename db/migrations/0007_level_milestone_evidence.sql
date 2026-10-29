-- 레벨 달성 근거와 주장 판정 이력 (역사 기록 보존 Phase 1, docs/HISTORY-PRESERVATION.md)
-- 1) level_milestone_evidence(근거), level_milestone_claim_assessments(주장 판정 이력) 추가
--    level_milestones에 evidence_id, claim_assessment_id, claim_assessment_status 추가
--    - 채택 기록은 같은 캐릭터·레벨·영역의 근거만 가리킨다 (복합 FK)
--    - SOURCE_REPORTED 채택 기록은 같은 근거의 ACCEPTED 판정을 가리킨다 (복합 FK + CHECK)
--    - 한 캐릭터·레벨의 이관 근거는 하나뿐 (부분 고유 인덱스)
-- 2) 영역 쓰기 트리거 (0002와 같은 함수)
-- 3) 기존 level_milestones 이관 (근거 1행, SOURCE_REPORTED였으면 이관 판정 1행)
--    - 원래 timing_basis는 legacy_timing_basis에 그대로 보존한다.
--    - 관측 근거(observation_basis): FIRST_OBSERVED / INFERRED는 그대로.
--      SOURCE_REPORTED였던 행은 first_observed_at의 출처(직접 관측인지 추론인지)를 알 수 없어 낮은 쪽인 INFERRED로 둔다.
--      달성 시각 주장은 이관 판정(ACCEPTED, kind = MIGRATED)으로 유지되므로 채택 결과는 바뀌지 않는다.
--    - 맥락(이름·직업·종족·진영·길드)은 연결된 스냅샷이 같은 관측 시각일 때만 옮기고, 아니면 null.
--    - region / game_mode는 캐릭터 식별 값이므로 characters에서 가져온다. 서버 수신 시각은 원본이 연결된 경우만.
--    - 기존 행은 삭제·변경하지 않는다(연결 컬럼만 채운다). updated_at도 바꾸지 않는다.
-- 4) 이관 뒤에 채택 기록의 판정 CHECK를 추가한다 (이관 전에는 기존 SOURCE_REPORTED 행이 판정 연결을 갖지 않으므로).
-- 5) 구버전 앱 호환 (migration 적용 뒤 이전 배포가 계속 실행되거나 이전 배포로 되돌린 기간)
--    구버전 앱은 근거·판정을 모른 채 level_milestones에 직접 쓴다. 근거 기반 기록기(새 앱)는 트랜잭션마다
--    forever_rank.level_milestone_writer = 'evidence'를 선언하고, 선언하지 않은 쓰기를 구버전 쓰기로 본다.
--    - 새 레벨 INSERT: 쓰려던 관측을 근거 행(origin INGESTED, 이유 RECORDED_BY_LEGACY_WRITER)으로 남기고 그 근거를 채택한다.
--      달성 시각 주장은 판정하지 않았으므로 근거에 NEEDS_REVIEW로 보관하고 SOURCE_REPORTED로 채택하지 않는다
--      (판정 기록은 만들지 않는다. 새 앱이 다음 관측 때 모든 주장을 다시 판정해 판정 기록을 추가한다).
--    - 기존 채택 기록 UPDATE: 채택 결과는 근거 기반 기록기만 바꾼다. 구버전 쓰기는 적용하지 않는다
--      (관측 자체는 스냅샷과 수집 원본에 남는다).
--    - mock 채택 기록 DELETE(구버전 mock 초기화): 같은 캐릭터·레벨의 mock 판정 기록과 근거도 지운다. 실제 영역 삭제는 0008이 막는다.
CREATE TYPE "public"."claim_assessment_kind" AS ENUM('RECEIPT', 'REASSESSMENT', 'MIGRATED');--> statement-breakpoint
CREATE TYPE "public"."evidence_origin" AS ENUM('INGESTED', 'MIGRATED');--> statement-breakpoint
CREATE TYPE "public"."reached_at_claim_status" AS ENUM('NONE', 'ACCEPTED', 'NEEDS_REVIEW', 'CONFLICT', 'REJECTED');--> statement-breakpoint
CREATE TABLE "level_milestone_claim_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "level_milestone_claim_assessments_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"evidence_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"status" "reached_at_claim_status" NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kind" "claim_assessment_kind" NOT NULL,
	"assessed_at" timestamp with time zone NOT NULL,
	"ingestion_record_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_milestone_claim_assessments_ref" UNIQUE("id","evidence_id","status"),
	CONSTRAINT "level_milestone_claim_assessments_status" CHECK (status <> 'NONE')
);
--> statement-breakpoint
CREATE TABLE "level_milestone_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"level" integer NOT NULL,
	"observation_basis" "milestone_timing_basis" NOT NULL,
	"claimed_reached_at" timestamp with time zone,
	"receipt_claim_status" "reached_at_claim_status" NOT NULL,
	"receipt_claim_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"legacy_timing_basis" "milestone_timing_basis",
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
	CONSTRAINT "level_milestone_evidence_id_scope" UNIQUE("id","character_id","level","data_environment"),
	CONSTRAINT "level_milestone_evidence_mock_triple" CHECK (((data_environment = 'mock') = (data_source = 'mock')) AND ((data_environment = 'mock') = (verification_status = 'MOCK'))),
	CONSTRAINT "level_milestone_evidence_level_positive" CHECK (level >= 1),
	CONSTRAINT "level_milestone_evidence_observation_basis" CHECK (observation_basis <> 'SOURCE_REPORTED'),
	CONSTRAINT "level_milestone_evidence_claim_presence" CHECK ((receipt_claim_status = 'NONE') = (claimed_reached_at IS NULL)),
	CONSTRAINT "level_milestone_evidence_inferred_no_claim" CHECK (observation_basis <> 'INFERRED' OR claimed_reached_at IS NULL OR origin = 'MIGRATED'),
	CONSTRAINT "level_milestone_evidence_legacy" CHECK ((origin = 'MIGRATED') = (legacy_timing_basis IS NOT NULL)),
	CONSTRAINT "level_milestone_evidence_received_at" CHECK (origin = 'MIGRATED' OR received_at IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "level_milestones" ADD COLUMN "evidence_id" uuid;--> statement-breakpoint
ALTER TABLE "level_milestones" ADD COLUMN "claim_assessment_id" uuid;--> statement-breakpoint
ALTER TABLE "level_milestones" ADD COLUMN "claim_assessment_status" "reached_at_claim_status";--> statement-breakpoint
ALTER TABLE "level_milestone_claim_assessments" ADD CONSTRAINT "level_milestone_claim_assessments_evidence_fk" FOREIGN KEY ("evidence_id","character_id","level","data_environment") REFERENCES "public"."level_milestone_evidence"("id","character_id","level","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestone_claim_assessments" ADD CONSTRAINT "level_milestone_claim_assessments_ingestion_fk" FOREIGN KEY ("ingestion_record_id","data_environment") REFERENCES "public"."ingestion_records"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestone_evidence" ADD CONSTRAINT "level_milestone_evidence_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestone_evidence" ADD CONSTRAINT "level_milestone_evidence_snapshot_fk" FOREIGN KEY ("snapshot_id","data_environment") REFERENCES "public"."character_snapshots"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestone_evidence" ADD CONSTRAINT "level_milestone_evidence_ingestion_fk" FOREIGN KEY ("ingestion_record_id","data_environment") REFERENCES "public"."ingestion_records"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestone_evidence" ADD CONSTRAINT "level_milestone_evidence_guild_fk" FOREIGN KEY ("guild_id","data_environment") REFERENCES "public"."guilds"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "level_milestone_claim_assessments_evidence_idx" ON "level_milestone_claim_assessments" USING btree ("evidence_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "level_milestone_evidence_migrated_uq" ON "level_milestone_evidence" USING btree ("character_id","level") WHERE origin = 'MIGRATED';--> statement-breakpoint
CREATE INDEX "level_milestone_evidence_character_level_idx" ON "level_milestone_evidence" USING btree ("character_id","level","observed_at");--> statement-breakpoint
CREATE INDEX "level_milestone_evidence_env_level_idx" ON "level_milestone_evidence" USING btree ("data_environment","level","observed_at");--> statement-breakpoint
ALTER TABLE "level_milestones" ADD CONSTRAINT "level_milestones_evidence_fk" FOREIGN KEY ("evidence_id","character_id","level","data_environment") REFERENCES "public"."level_milestone_evidence"("id","character_id","level","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestones" ADD CONSTRAINT "level_milestones_claim_assessment_fk" FOREIGN KEY ("claim_assessment_id","evidence_id","claim_assessment_status") REFERENCES "public"."level_milestone_claim_assessments"("id","evidence_id","status") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER level_milestone_evidence_env_guard BEFORE INSERT OR UPDATE ON level_milestone_evidence
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER level_milestone_claim_assessments_env_guard BEFORE INSERT OR UPDATE ON level_milestone_claim_assessments
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
INSERT INTO "level_milestone_evidence" (
  "character_id", "data_environment", "level", "observation_basis", "claimed_reached_at", "receipt_claim_status",
  "receipt_claim_reasons", "legacy_timing_basis", "observed_at", "previous_observed_at", "received_at", "data_source",
  "verification_status", "source_build", "snapshot_id", "ingestion_record_id", "character_name", "region", "game_mode",
  "class_code", "race_code", "faction_code", "guild_id", "origin", "created_at"
)
SELECT
  m."character_id", m."data_environment", m."level",
  (CASE WHEN m."timing_basis" = 'SOURCE_REPORTED' THEN 'INFERRED' ELSE m."timing_basis"::text END)::"milestone_timing_basis",
  m."reached_at",
  (CASE WHEN m."timing_basis" = 'SOURCE_REPORTED' THEN 'ACCEPTED' ELSE 'NONE' END)::"reached_at_claim_status",
  '["MIGRATED_FROM_LEVEL_MILESTONES"]'::jsonb,
  m."timing_basis",
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
INSERT INTO "level_milestone_claim_assessments" (
  "evidence_id", "character_id", "level", "data_environment", "status", "reasons", "kind", "assessed_at"
)
SELECT e."id", e."character_id", e."level", e."data_environment", 'ACCEPTED', '["MIGRATED_FROM_LEVEL_MILESTONES"]'::jsonb, 'MIGRATED', m."updated_at"
FROM "level_milestone_evidence" e
JOIN "level_milestones" m ON m."character_id" = e."character_id" AND m."level" = e."level" AND m."data_environment" = e."data_environment"
WHERE e."origin" = 'MIGRATED' AND e."legacy_timing_basis" = 'SOURCE_REPORTED';
--> statement-breakpoint
UPDATE "level_milestones" m SET "evidence_id" = e."id"
FROM "level_milestone_evidence" e
WHERE e."origin" = 'MIGRATED' AND e."character_id" = m."character_id" AND e."level" = m."level"
  AND e."data_environment" = m."data_environment" AND m."evidence_id" IS NULL;
--> statement-breakpoint
UPDATE "level_milestones" m SET "claim_assessment_id" = a."id", "claim_assessment_status" = a."status"
FROM "level_milestone_claim_assessments" a
WHERE a."evidence_id" = m."evidence_id" AND a."kind" = 'MIGRATED' AND m."timing_basis" = 'SOURCE_REPORTED'
  AND m."claim_assessment_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "level_milestones" ADD CONSTRAINT "level_milestones_claim_assessment" CHECK (((claim_assessment_id IS NULL) = (claim_assessment_status IS NULL)) AND ((timing_basis = 'SOURCE_REPORTED') = (claim_assessment_id IS NOT NULL)) AND (claim_assessment_status IS NULL OR claim_assessment_status = 'ACCEPTED') AND (claim_assessment_id IS NULL OR evidence_id IS NOT NULL));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION level_milestones_legacy_write() RETURNS trigger AS $$
DECLARE
  claim timestamptz;
  basis milestone_timing_basis;
  adopted uuid;
BEGIN
  IF coalesce(current_setting('forever_rank.level_milestone_writer', true), '') = 'evidence' THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND (NEW.evidence_id IS NOT NULL OR NEW.claim_assessment_id IS NOT NULL
      OR NEW.claim_assessment_status IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (NEW.evidence_id IS DISTINCT FROM OLD.evidence_id
      OR NEW.claim_assessment_id IS DISTINCT FROM OLD.claim_assessment_id
      OR NEW.claim_assessment_status IS DISTINCT FROM OLD.claim_assessment_status)) THEN
    RAISE EXCEPTION '레벨 달성 기록의 근거·판정 연결은 근거 기반 기록기만 바꿀 수 있습니다.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RETURN NULL;
  END IF;
  claim := CASE WHEN NEW.timing_basis = 'SOURCE_REPORTED' THEN NEW.reached_at END;
  basis := CASE WHEN NEW.timing_basis = 'SOURCE_REPORTED' THEN 'FIRST_OBSERVED' ELSE NEW.timing_basis END;
  INSERT INTO level_milestone_evidence (
    character_id, data_environment, level, observation_basis, claimed_reached_at, receipt_claim_status,
    receipt_claim_reasons, observed_at, previous_observed_at, received_at, data_source, verification_status,
    source_build, snapshot_id, ingestion_record_id, character_name, region, game_mode, class_code, race_code,
    faction_code, guild_id, origin, created_at
  )
  SELECT
    NEW.character_id, NEW.data_environment, NEW.level, basis, claim,
    (CASE WHEN claim IS NULL THEN 'NONE' ELSE 'NEEDS_REVIEW' END)::reached_at_claim_status,
    '["RECORDED_BY_LEGACY_WRITER"]'::jsonb,
    NEW.first_observed_at, NEW.previous_observed_at, coalesce(r.received_at, NEW.created_at),
    NEW.data_source, NEW.verification_status, NEW.source_build, NEW.snapshot_id, NEW.ingestion_record_id,
    CASE WHEN s.observed_at = NEW.first_observed_at THEN s.normalized_data->>'characterName' END,
    c.region, c.game_mode,
    CASE WHEN s.observed_at = NEW.first_observed_at THEN s.normalized_data->>'classCode' END,
    CASE WHEN s.observed_at = NEW.first_observed_at THEN s.normalized_data->>'raceCode' END,
    CASE WHEN s.observed_at = NEW.first_observed_at THEN s.normalized_data->>'factionCode' END,
    CASE WHEN s.observed_at = NEW.first_observed_at THEN s.guild_id END,
    'INGESTED', NEW.created_at
  FROM characters c
  LEFT JOIN character_snapshots s ON s.id = NEW.snapshot_id AND s.data_environment = NEW.data_environment
  LEFT JOIN ingestion_records r ON r.id = NEW.ingestion_record_id AND r.data_environment = NEW.data_environment
  WHERE c.id = NEW.character_id AND c.data_environment = NEW.data_environment
  RETURNING id INTO adopted;
  NEW.evidence_id := adopted;
  NEW.timing_basis := basis;
  NEW.reached_at := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION level_milestones_legacy_mock_delete() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('forever_rank.level_milestone_writer', true), '') = 'evidence'
    OR OLD.data_environment <> 'mock' THEN
    RETURN OLD;
  END IF;
  DELETE FROM level_milestone_claim_assessments
    WHERE character_id = OLD.character_id AND level = OLD.level AND data_environment = 'mock';
  DELETE FROM level_milestone_evidence
    WHERE character_id = OLD.character_id AND level = OLD.level AND data_environment = 'mock';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER level_milestones_legacy_write BEFORE INSERT OR UPDATE ON level_milestones
  FOR EACH ROW EXECUTE FUNCTION level_milestones_legacy_write();
--> statement-breakpoint
CREATE TRIGGER level_milestones_legacy_mock_delete AFTER DELETE ON level_milestones
  FOR EACH ROW EXECUTE FUNCTION level_milestones_legacy_mock_delete();
