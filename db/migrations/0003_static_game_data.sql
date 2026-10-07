CREATE TYPE "public"."static_data_kind" AS ENUM('items', 'classes', 'races', 'factions', 'game_modes', 'dungeons', 'raids', 'bosses');--> statement-breakpoint
CREATE TYPE "public"."static_data_license_status" AS ENUM('PERMITTED', 'MOCK', 'UNKNOWN', 'PROHIBITED');--> statement-breakpoint
CREATE TABLE "static_data_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"kind" "static_data_kind" NOT NULL,
	"record_key" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "static_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_environment" "data_environment" NOT NULL,
	"kind" "static_data_kind" NOT NULL,
	"source" text NOT NULL,
	"source_version" text NOT NULL,
	"source_build" text,
	"interface_version" text,
	"dataset_version" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"license_status" "static_data_license_status" NOT NULL,
	"license_terms_url" text,
	"license_checked_at" text,
	"attribution" text,
	"checksum" text NOT NULL,
	"record_count" integer NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "static_datasets_id_env_kind" UNIQUE("id","data_environment","kind"),
	CONSTRAINT "static_datasets_mock_source" CHECK ((data_environment = 'mock') = (source = 'mock')),
	CONSTRAINT "static_datasets_mock_license" CHECK ((data_environment = 'mock') = (license_status = 'MOCK')),
	CONSTRAINT "static_datasets_license_confirmed" CHECK (data_environment = 'mock' OR (license_status = 'PERMITTED' AND license_terms_url IS NOT NULL AND license_checked_at IS NOT NULL)),
	CONSTRAINT "static_datasets_record_count" CHECK (record_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "static_data_records" ADD CONSTRAINT "static_data_records_dataset_fk" FOREIGN KEY ("dataset_id","data_environment","kind") REFERENCES "public"."static_datasets"("id","data_environment","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "static_data_records_dataset_key_uq" ON "static_data_records" USING btree ("dataset_id","record_key");--> statement-breakpoint
CREATE INDEX "static_data_records_env_kind_key_idx" ON "static_data_records" USING btree ("data_environment","kind","record_key");--> statement-breakpoint
CREATE UNIQUE INDEX "static_datasets_version_uq" ON "static_datasets" USING btree ("data_environment","kind","source","dataset_version");--> statement-breakpoint
CREATE INDEX "static_datasets_latest_idx" ON "static_datasets" USING btree ("data_environment","kind","observed_at");