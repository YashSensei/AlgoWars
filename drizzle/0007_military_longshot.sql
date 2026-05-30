CREATE TYPE "public"."user_status" AS ENUM('WAITLISTED', 'APPROVED', 'REJECTED', 'BANNED');--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"max_uses" integer DEFAULT 0 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "invite_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'WAITLISTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "waitlist_number" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_wave" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_source" varchar(32) DEFAULT 'waitlist' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_notes" text;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Migrate existing users to APPROVED (prevents lockout on deploy)
UPDATE "users" SET "status" = 'APPROVED', "approved_at" = "created_at", "waitlist_number" = 0, "access_source" = 'founder' WHERE "status" = 'WAITLISTED';