CREATE TYPE "public"."game_mode" AS ENUM('BLITZ');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('WAITING', 'STARTING', 'ACTIVE', 'COMPLETED', 'ABORTED');--> statement-breakpoint
CREATE TYPE "public"."player_result" AS ENUM('PENDING', 'WON', 'LOST', 'DRAW');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('PENDING', 'JUDGING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT', 'MEMORY_LIMIT', 'RUNTIME_ERROR', 'COMPILE_ERROR');--> statement-breakpoint
CREATE TABLE "match_players" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"user_id" text NOT NULL,
	"result" "player_result" DEFAULT 'PENDING' NOT NULL,
	"rating_before" integer NOT NULL,
	"rating_after" integer,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"mode" "game_mode" DEFAULT 'BLITZ' NOT NULL,
	"status" "match_status" DEFAULT 'WAITING' NOT NULL,
	"duration" integer DEFAULT 600 NOT NULL,
	"problem_id" text,
	"winner_id" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" text PRIMARY KEY NOT NULL,
	"oj" varchar(32) NOT NULL,
	"external_id" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"difficulty" integer,
	"tags" text[],
	"url" text,
	"cached_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"language" varchar(32) NOT NULL,
	"vjudge_run_id" text,
	"verdict" "verdict" DEFAULT 'PENDING' NOT NULL,
	"runtime" integer,
	"memory" integer,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"judged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer DEFAULT 1000 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"win_streak" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_stats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" varchar(32) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_user_idx" ON "match_players" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE INDEX "status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "created_idx" ON "matches" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oj_external_idx" ON "problems" USING btree ("oj","external_id");--> statement-breakpoint
CREATE INDEX "difficulty_idx" ON "problems" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "match_verdict_idx" ON "submissions" USING btree ("match_id","verdict");