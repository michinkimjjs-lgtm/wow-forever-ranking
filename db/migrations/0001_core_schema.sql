CREATE TYPE "public"."data_environment" AS ENUM('mock', 'beta', 'live');--> statement-breakpoint
CREATE TYPE "public"."data_source" AS ENUM('mock', 'blizzard', 'addon', 'user_submission');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('ACCEPTED', 'REJECTED', 'IDENTITY_CONFLICT');--> statement-breakpoint
CREATE TYPE "public"."milestone_timing_basis" AS ENUM('SOURCE_REPORTED', 'FIRST_OBSERVED', 'INFERRED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('VERIFIED', 'LOG_VERIFIED', 'COMMUNITY_SUBMITTED', 'UNVERIFIED', 'MOCK');--> statement-breakpoint
CREATE TABLE "character_external_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"data_source" "data_source" NOT NULL,
	"external_id" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "character_external_refs_mock_pair" CHECK ((data_environment = 'mock') = (data_source = 'mock'))
);
--> statement-breakpoint
CREATE TABLE "character_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"slot_code" text NOT NULL,
	"item_id" uuid NOT NULL,
	"item_level" integer,
	"enchant" jsonb,
	"gems" jsonb,
	"observed_at" timestamp with time zone NOT NULL,
	"data_source" "data_source" NOT NULL,
	"source_build" text,
	CONSTRAINT "character_items_mock_pair" CHECK ((data_environment = 'mock') = (data_source = 'mock'))
);
--> statement-breakpoint
CREATE TABLE "character_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"level" integer NOT NULL,
	"average_item_level" numeric(6, 2),
	"highest_item_level" integer,
	"gear_coverage" numeric(4, 3),
	"gear_profile_id" text,
	"gear_profile_version" integer,
	"guild_id" uuid,
	"normalized_data" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"ingestion_record_id" uuid,
	"data_source" "data_source" NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"source_updated_at" timestamp with time zone,
	"source_build" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_snapshots_id_env" UNIQUE("id","data_environment"),
	CONSTRAINT "character_snapshots_mock_triple" CHECK (((data_environment = 'mock') = (data_source = 'mock')) AND ((data_environment = 'mock') = (verification_status = 'MOCK')))
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"region" text NOT NULL,
	"game_mode" text NOT NULL,
	"character_name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"slug" text NOT NULL,
	"faction_code" text,
	"race_code" text,
	"class_code" text,
	"level" integer NOT NULL,
	"current_level_reached_at" timestamp with time zone,
	"current_level_timing_basis" "milestone_timing_basis",
	"average_item_level" numeric(6, 2),
	"highest_item_level" integer,
	"gear_coverage" numeric(4, 3),
	"gear_profile_id" text,
	"gear_profile_version" integer,
	"gear_observed_at" timestamp with time zone,
	"guild_id" uuid,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"data_source" "data_source" NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"source_updated_at" timestamp with time zone,
	"source_build" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_id_env" UNIQUE("id","data_environment"),
	CONSTRAINT "characters_mock_triple" CHECK (((data_environment = 'mock') = (data_source = 'mock')) AND ((data_environment = 'mock') = (verification_status = 'MOCK'))),
	CONSTRAINT "characters_level_positive" CHECK ("characters"."level" >= 1)
);
--> statement-breakpoint
CREATE TABLE "database_identity" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"allowed_data_environments" "data_environment"[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "database_identity_singleton" CHECK ("database_identity"."id" = 1),
	CONSTRAINT "database_identity_not_empty" CHECK (cardinality("database_identity"."allowed_data_environments") > 0),
	CONSTRAINT "database_identity_mock_isolated" CHECK (NOT ('mock' = ANY("database_identity"."allowed_data_environments") AND cardinality("database_identity"."allowed_data_environments") > 1))
);
--> statement-breakpoint
CREATE TABLE "guild_external_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"data_source" "data_source" NOT NULL,
	"external_id" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "guild_external_refs_mock_pair" CHECK ((data_environment = 'mock') = (data_source = 'mock'))
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"region" text NOT NULL,
	"game_mode" text NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"slug" text NOT NULL,
	"faction_code" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"data_source" "data_source" NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"source_updated_at" timestamp with time zone,
	"source_build" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guilds_id_env" UNIQUE("id","data_environment"),
	CONSTRAINT "guilds_mock_triple" CHECK (((data_environment = 'mock') = (data_source = 'mock')) AND ((data_environment = 'mock') = (verification_status = 'MOCK')))
);
--> statement-breakpoint
CREATE TABLE "ingestion_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"data_source" "data_source" NOT NULL,
	"source_build" text,
	"parser_version" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"status" "ingestion_status" NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rejection_reason" text,
	CONSTRAINT "ingestion_records_id_env" UNIQUE("id","data_environment"),
	CONSTRAINT "ingestion_records_mock_pair" CHECK ((data_environment = 'mock') = (data_source = 'mock'))
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"external_item_id" text NOT NULL,
	"name" text NOT NULL,
	"name_locale" text,
	"slot_code" text,
	"quality_code" text,
	"base_item_level" integer,
	"icon_url" text,
	"description" text,
	"data_source" "data_source" NOT NULL,
	"source_updated_at" timestamp with time zone,
	"source_build" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_id_env" UNIQUE("id","data_environment"),
	CONSTRAINT "items_mock_pair" CHECK ((data_environment = 'mock') = (data_source = 'mock'))
);
--> statement-breakpoint
CREATE TABLE "level_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"level" integer NOT NULL,
	"timing_basis" "milestone_timing_basis" NOT NULL,
	"reached_at" timestamp with time zone,
	"first_observed_at" timestamp with time zone NOT NULL,
	"previous_observed_at" timestamp with time zone,
	"effective_reached_at" timestamp with time zone GENERATED ALWAYS AS (CASE WHEN timing_basis = 'SOURCE_REPORTED' THEN reached_at ELSE first_observed_at END) STORED NOT NULL,
	"data_source" "data_source" NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"source_build" text,
	"snapshot_id" uuid,
	"ingestion_record_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_milestones_mock_triple" CHECK (((data_environment = 'mock') = (data_source = 'mock')) AND ((data_environment = 'mock') = (verification_status = 'MOCK'))),
	CONSTRAINT "level_milestones_reached_at_basis" CHECK ((timing_basis = 'SOURCE_REPORTED') = (reached_at IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "character_external_refs" ADD CONSTRAINT "character_external_refs_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_items" ADD CONSTRAINT "character_items_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_items" ADD CONSTRAINT "character_items_item_fk" FOREIGN KEY ("item_id","data_environment") REFERENCES "public"."items"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD CONSTRAINT "character_snapshots_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD CONSTRAINT "character_snapshots_ingestion_fk" FOREIGN KEY ("ingestion_record_id","data_environment") REFERENCES "public"."ingestion_records"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_guild_fk" FOREIGN KEY ("guild_id","data_environment") REFERENCES "public"."guilds"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_external_refs" ADD CONSTRAINT "guild_external_refs_guild_fk" FOREIGN KEY ("guild_id","data_environment") REFERENCES "public"."guilds"("id","data_environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestones" ADD CONSTRAINT "level_milestones_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestones" ADD CONSTRAINT "level_milestones_snapshot_fk" FOREIGN KEY ("snapshot_id","data_environment") REFERENCES "public"."character_snapshots"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestones" ADD CONSTRAINT "level_milestones_ingestion_fk" FOREIGN KEY ("ingestion_record_id","data_environment") REFERENCES "public"."ingestion_records"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "character_external_refs_uq" ON "character_external_refs" USING btree ("data_environment","data_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_items_character_slot_uq" ON "character_items" USING btree ("character_id","slot_code");--> statement-breakpoint
CREATE INDEX "character_snapshots_character_observed_idx" ON "character_snapshots" USING btree ("character_id","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "characters_scope_slug_uq" ON "characters" USING btree ("data_environment","region","game_mode","slug");--> statement-breakpoint
CREATE INDEX "characters_scope_name_idx" ON "characters" USING btree ("data_environment","game_mode","name_normalized");--> statement-breakpoint
CREATE INDEX "characters_name_trgm_idx" ON "characters" USING gin ("name_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "characters_level_rank_idx" ON "characters" USING btree ("data_environment","game_mode","level" DESC NULLS LAST,"current_level_reached_at","first_seen_at");--> statement-breakpoint
CREATE INDEX "characters_gear_rank_idx" ON "characters" USING btree ("data_environment","game_mode","average_item_level" DESC NULLS LAST,"highest_item_level" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "characters_highest_rank_idx" ON "characters" USING btree ("data_environment","game_mode","highest_item_level" DESC NULLS LAST,"average_item_level" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "characters_env_last_seen_idx" ON "characters" USING btree ("data_environment","last_seen_at");--> statement-breakpoint
CREATE INDEX "characters_guild_idx" ON "characters" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guild_external_refs_uq" ON "guild_external_refs" USING btree ("data_environment","data_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guilds_scope_slug_uq" ON "guilds" USING btree ("data_environment","region","game_mode","slug");--> statement-breakpoint
CREATE INDEX "guilds_scope_name_idx" ON "guilds" USING btree ("data_environment","region","game_mode","name_normalized");--> statement-breakpoint
CREATE INDEX "ingestion_records_env_received_idx" ON "ingestion_records" USING btree ("data_environment","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "items_env_external_uq" ON "items" USING btree ("data_environment","external_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "level_milestones_character_level_uq" ON "level_milestones" USING btree ("character_id","level");--> statement-breakpoint
CREATE INDEX "level_milestones_env_level_idx" ON "level_milestones" USING btree ("data_environment","level","effective_reached_at");