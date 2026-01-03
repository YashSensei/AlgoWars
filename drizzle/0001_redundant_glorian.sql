ALTER TYPE "public"."verdict" ADD VALUE 'JUDGE_TIMEOUT';--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "contest_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "problem_index" varchar(8) NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "rating_bucket" varchar(16);--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "statement" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "time_limit" integer;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "memory_limit" integer;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "solved_count" integer;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "statement_fetched_at" timestamp;--> statement-breakpoint
CREATE INDEX "rating_bucket_idx" ON "problems" USING btree ("rating_bucket");