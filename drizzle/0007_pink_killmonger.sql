CREATE TYPE "public"."friend_room_status" AS ENUM('waiting', 'ready', 'active', 'completed', 'expired');--> statement-breakpoint
CREATE TABLE "friend_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"invite_code" varchar(8) NOT NULL,
	"host_user_id" text NOT NULL,
	"guest_user_id" text,
	"match_id" text,
	"status" "friend_room_status" DEFAULT 'waiting' NOT NULL,
	"duration" integer DEFAULT 900 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "friend_rooms_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "friend_rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "friend_rooms" ADD CONSTRAINT "friend_rooms_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_rooms" ADD CONSTRAINT "friend_rooms_guest_user_id_users_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_rooms" ADD CONSTRAINT "friend_rooms_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_code_idx" ON "friend_rooms" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "host_user_idx" ON "friend_rooms" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "room_status_idx" ON "friend_rooms" USING btree ("status");