CREATE TYPE "public"."submission_channel" AS ENUM('public', 'admin_api');--> statement-breakpoint
CREATE TYPE "public"."submission_review_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CONFLICT');--> statement-breakpoint
CREATE TABLE "character_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"data_source" "data_source" NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"review_status" "submission_review_status" NOT NULL,
	"channel" "submission_channel" NOT NULL,
	"blocked_reason" text,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"content_hash" text,
	"identity_key" text,
	"summary" jsonb NOT NULL,
	"character_name" text NOT NULL,
	"level" integer,
	"observed_at" timestamp with time zone,
	"source_build" text,
	"gear_coverage" numeric(4, 3),
	"average_item_level" numeric(6, 2),
	"highest_item_level" integer,
	"observation" jsonb,
	"comparison" jsonb,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"last_duplicate_at" timestamp with time zone,
	"character_id" uuid,
	"ingestion_record_id" uuid,
	"consent_version" text,
	"policy_version" text,
	"consented_at" timestamp with time zone,
	"submitted_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	CONSTRAINT "character_submissions_real_only" CHECK (data_environment <> 'mock'),
	CONSTRAINT "character_submissions_source" CHECK (data_source = 'addon'),
	CONSTRAINT "character_submissions_community" CHECK (verification_status = 'COMMUNITY_SUBMITTED'),
	CONSTRAINT "character_submissions_public_consent" CHECK (channel <> 'public' OR (consent_version IS NOT NULL AND policy_version IS NOT NULL AND consented_at IS NOT NULL)),
	CONSTRAINT "character_submissions_duplicate_count" CHECK (duplicate_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "character_submissions" ADD CONSTRAINT "character_submissions_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_submissions" ADD CONSTRAINT "character_submissions_ingestion_fk" FOREIGN KEY ("ingestion_record_id","data_environment") REFERENCES "public"."ingestion_records"("id","data_environment") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "character_submissions_payload_uq" ON "character_submissions" USING btree ("data_environment","payload_hash");--> statement-breakpoint
CREATE INDEX "character_submissions_identity_idx" ON "character_submissions" USING btree ("data_environment","identity_key","submitted_at");--> statement-breakpoint
CREATE INDEX "character_submissions_review_idx" ON "character_submissions" USING btree ("data_environment","review_status","submitted_at");