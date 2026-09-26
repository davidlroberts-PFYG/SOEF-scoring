CREATE TYPE "public"."range_kind" AS ENUM('median_range', 'quartile_range');--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "owner_comp_addback" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "override_basis" "earnings_basis";--> statement-breakpoint
ALTER TABLE "sectors" ADD COLUMN "median_multiple" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "sectors" ADD COLUMN "range_kind" "range_kind" DEFAULT 'median_range' NOT NULL;--> statement-breakpoint
ALTER TABLE "sectors" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "sectors" ADD COLUMN "method_note" text;