import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ============================================
// ENUMS
// ============================================

export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const gameModeEnum = pgEnum("game_mode", ["BLITZ"]);
export const matchStatusEnum = pgEnum("match_status", [
  "WAITING",
  "STARTING",
  "ACTIVE",
  "COMPLETED",
  "ABORTED",
]);
export const playerResultEnum = pgEnum("player_result", ["PENDING", "WON", "LOST", "DRAW"]);
export const verdictEnum = pgEnum("verdict", [
  "PENDING",
  "JUDGING",
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT",
  "MEMORY_LIMIT",
  "RUNTIME_ERROR",
  "COMPILE_ERROR",
  "JUDGE_TIMEOUT",
]);

// ============================================
// USERS
// ============================================

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: varchar("username", { length: 32 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("USER").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userStats = pgTable("user_stats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").default(1000).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),
  winStreak: integer("win_streak").default(0).notNull(),
  maxStreak: integer("max_streak").default(0).notNull(),
});

// ============================================
// PROBLEMS
// ============================================

export const problems = pgTable(
  "problems",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    oj: varchar("oj", { length: 32 }).notNull(), // "codeforces"
    contestId: integer("contest_id").notNull(), // 2133
    problemIndex: varchar("problem_index", { length: 8 }).notNull(), // "A", "B", "C1"
    externalId: varchar("external_id", { length: 32 }).notNull(), // "2133A" (derived)
    title: varchar("title", { length: 255 }).notNull(),
    difficulty: integer("difficulty"), // rating: 800, 900, etc.
    ratingBucket: varchar("rating_bucket", { length: 16 }), // "0800-1199"
    tags: text("tags").array(),
    url: text("url"),
    statement: text("statement"), // HTML (lazy-fetched)
    timeLimit: integer("time_limit"), // milliseconds
    memoryLimit: integer("memory_limit"), // KB
    solvedCount: integer("solved_count"),
    cachedAt: timestamp("cached_at").defaultNow().notNull(),
    statementFetchedAt: timestamp("statement_fetched_at"), // null = not fetched yet
  },
  (t) => [
    uniqueIndex("oj_external_idx").on(t.oj, t.externalId),
    index("difficulty_idx").on(t.difficulty),
    index("rating_bucket_idx").on(t.ratingBucket),
  ],
);

// ============================================
// MATCHES
// ============================================

export const matches = pgTable(
  "matches",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mode: gameModeEnum("mode").default("BLITZ").notNull(),
    status: matchStatusEnum("status").default("WAITING").notNull(),
    duration: integer("duration").default(600).notNull(), // seconds
    problemId: text("problem_id").references(() => problems.id),
    winnerId: text("winner_id"),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("status_idx").on(t.status), index("created_idx").on(t.createdAt)],
);

// ============================================
// MATCH PLAYERS (Junction)
// ============================================

export const matchPlayers = pgTable(
  "match_players",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    result: playerResultEnum("result").default("PENDING").notNull(),
    ratingBefore: integer("rating_before").notNull(),
    ratingAfter: integer("rating_after"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("match_user_idx").on(t.matchId, t.userId),
    index("user_matches_idx").on(t.userId), // For finding user's matches
  ],
);

// ============================================
// SUBMISSIONS
// ============================================

export const submissions = pgTable(
  "submissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    code: text("code").notNull(),
    language: varchar("language", { length: 32 }).notNull(),
    vjudgeRunId: text("vjudge_run_id"),
    verdict: verdictEnum("verdict").default("PENDING").notNull(),
    runtime: integer("runtime"), // ms
    memory: integer("memory"), // KB
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    judgedAt: timestamp("judged_at"),
  },
  (t) => [index("match_verdict_idx").on(t.matchId, t.verdict)],
);

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ one, many }) => ({
  stats: one(userStats, { fields: [users.id], references: [userStats.userId] }),
  matchPlayers: many(matchPlayers),
  submissions: many(submissions),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, { fields: [userStats.userId], references: [users.id] }),
}));

export const problemsRelations = relations(problems, ({ many }) => ({
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  problem: one(problems, { fields: [matches.problemId], references: [problems.id] }),
  players: many(matchPlayers),
  submissions: many(submissions),
}));

export const matchPlayersRelations = relations(matchPlayers, ({ one }) => ({
  match: one(matches, { fields: [matchPlayers.matchId], references: [matches.id] }),
  user: one(users, { fields: [matchPlayers.userId], references: [users.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  match: one(matches, { fields: [submissions.matchId], references: [matches.id] }),
  user: one(users, { fields: [submissions.userId], references: [users.id] }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserStats = typeof userStats.$inferSelect;
export type Problem = typeof problems.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
