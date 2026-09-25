CREATE TYPE "public"."assessment_status" AS ENUM('draft', 'released');--> statement-breakpoint
CREATE TYPE "public"."earnings_basis" AS ENUM('EBITDA', 'SDE');--> statement-breakpoint
CREATE TYPE "public"."scorecard_key" AS ENUM('business', 'personal');--> statement-breakpoint
CREATE TABLE "advisors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advisors_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"advisor_id" uuid NOT NULL,
	"title" text,
	"assessed_at" date DEFAULT CURRENT_DATE NOT NULL,
	"status" "assessment_status" DEFAULT 'draft' NOT NULL,
	"revenue_ttm" numeric(16, 2),
	"earnings" numeric(16, 2),
	"earnings_basis" "earnings_basis" DEFAULT 'EBITDA' NOT NULL,
	"owner_value_estimate" numeric(16, 2),
	"override_low_multiple" numeric(8, 3),
	"override_high_multiple" numeric(8, 3),
	"override_note" text,
	"snapshot_json" jsonb,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bands" (
	"band" smallint PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"min_pct" smallint NOT NULL,
	"max_pct" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scorecard_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"label" text NOT NULL,
	"hint" text,
	"weight" numeric(6, 3) DEFAULT '1.000' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"company_name" text NOT NULL,
	"sector_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_key" (
	"value" smallint PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"factor_id" uuid NOT NULL,
	"rating" smallint,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scorecards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "scorecard_key" NOT NULL,
	"name" text NOT NULL,
	"max_per_factor" smallint DEFAULT 6 NOT NULL,
	CONSTRAINT "scorecards_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"naics_prefix" text,
	"low_multiple" numeric(8, 3),
	"high_multiple" numeric(8, 3),
	"basis" "earnings_basis" DEFAULT 'EBITDA' NOT NULL,
	"source_note" text,
	"last_reviewed" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sectors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value_json" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factors" ADD CONSTRAINT "factors_scorecard_id_scorecards_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "public"."scorecards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_factor_id_factors_id_fk" FOREIGN KEY ("factor_id") REFERENCES "public"."factors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessments_owner_idx" ON "assessments" USING btree ("owner_id","assessed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "factors_scorecard_sort_idx" ON "factors" USING btree ("scorecard_id","sort_order");--> statement-breakpoint
CREATE INDEX "owners_advisor_idx" ON "owners" USING btree ("advisor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_assessment_factor_idx" ON "ratings" USING btree ("assessment_id","factor_id");