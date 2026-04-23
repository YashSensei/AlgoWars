import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { matchPlayers, submissions, userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { authMiddleware } from "../middleware/auth";

export const userRoutes = new Hono();

const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    ),
});

// Get current user (protected)
userRoutes.get("/me", authMiddleware, async (c) => {
  const { id } = c.get("user");

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, username: true, email: true, createdAt: true },
    with: { stats: true },
  });

  if (!user) throw Errors.NotFound("User");

  return c.json(user);
});

/**
 * PATCH /users/me/username
 * Set username for OAuth users who don't have one yet.
 */
userRoutes.patch("/me/username", authMiddleware, async (c) => {
  const { id } = c.get("user");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = usernameSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.BadRequest(parsed.error.issues[0]?.message ?? "Invalid username");
  }

  // Check if username is taken
  const existing = await db.query.users.findFirst({
    where: eq(users.username, parsed.data.username),
  });
  if (existing && existing.id !== id) throw Errors.Conflict("Username already taken");

  await db.update(users).set({ username: parsed.data.username }).where(eq(users.id, id));

  const updated = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, username: true, email: true, createdAt: true },
    with: { stats: true },
  });

  return c.json(updated);
});

/**
 * GET /users/leaderboard
 * Get top users by rating (public)
 */
userRoutes.get("/leaderboard", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;

  const leaderboard = await db.query.userStats.findMany({
    orderBy: [desc(userStats.rating)],
    limit,
    offset,
    with: {
      user: {
        columns: { id: true, username: true },
      },
    },
  });

  // Transform to cleaner format with rank
  const ranked = leaderboard.map((entry, index) => ({
    rank: offset + index + 1,
    userId: entry.user.id,
    username: entry.user.username,
    rating: entry.rating,
    wins: entry.wins,
    losses: entry.losses,
    draws: entry.draws,
    winStreak: entry.winStreak,
    maxStreak: entry.maxStreak,
  }));

  return c.json({ users: ranked, limit, offset });
});

/**
 * GET /users/me/matches
 * Get current user's match history (protected)
 */
userRoutes.get("/me/matches", authMiddleware, async (c) => {
  const { id } = c.get("user");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const offset = Number(c.req.query("offset")) || 0;

  const history = await db.query.matchPlayers.findMany({
    where: eq(matchPlayers.userId, id),
    orderBy: [desc(matchPlayers.joinedAt)],
    limit,
    offset,
    with: {
      match: {
        columns: { id: true, status: true, startedAt: true, endedAt: true },
        with: {
          problem: { columns: { id: true, title: true, difficulty: true } },
          players: {
            with: { user: { columns: { id: true, username: true } } },
            columns: { result: true, ratingBefore: true, ratingAfter: true },
          },
        },
      },
    },
  });

  // Filter to only completed matches
  const completed = history.filter((mp) => mp.match.status === "COMPLETED");

  // Batch-fetch which of these matches had at least one ACCEPTED submission.
  // Absence of ACCEPTED in a COMPLETED match means someone forfeited.
  const matchIds = completed.map((mp) => mp.match.id);
  const acceptedRows =
    matchIds.length === 0
      ? []
      : await db.query.submissions.findMany({
          where: and(inArray(submissions.matchId, matchIds), eq(submissions.verdict, "ACCEPTED")),
          columns: { matchId: true },
        });
  const acceptedMatchIds = new Set(acceptedRows.map((r) => r.matchId));

  const matches = completed.map((mp) => buildHistoryEntry(mp, id, acceptedMatchIds));

  return c.json({ matches, limit, offset });
});

// Helper: shape a match_players row into the match-history entry the frontend expects.
// Extracted from the route handler so the complexity budget fits within per-function limits.
function buildHistoryEntry(mp: MatchPlayerWithMatch, myId: string, acceptedMatchIds: Set<string>) {
  const opponent = mp.match.players.find((p) => p.user.id !== myId);
  const me = mp.match.players.find((p) => p.user.id === myId);
  const endReason: "solved" | "forfeit" = acceptedMatchIds.has(mp.match.id) ? "solved" : "forfeit";
  // In a forfeit, the player with result=LOST is the one who surrendered.
  const loser = mp.match.players.find((p) => p.result === "LOST");
  const forfeiter = endReason === "forfeit" && loser ? loser.user : null;

  return {
    matchId: mp.match.id,
    problem: mp.match.problem,
    opponent: opponent?.user ?? null,
    opponentRating: opponent?.ratingBefore ?? null,
    result: me?.result ?? "PENDING",
    ratingChange: me?.ratingAfter && me?.ratingBefore ? me.ratingAfter - me.ratingBefore : 0,
    playedAt: mp.match.endedAt ?? mp.match.startedAt,
    endReason,
    forfeiter,
  };
}

type MatchPlayerWithMatch = {
  match: {
    id: string;
    status: string;
    startedAt: Date | null;
    endedAt: Date | null;
    problem: { id: string; title: string; difficulty: number | null } | null;
    players: Array<{
      result: string;
      ratingBefore: number;
      ratingAfter: number | null;
      user: { id: string; username: string | null };
    }>;
  };
};

// Get user by username (public profile)
// NOTE: This must be LAST because /:username is a catch-all pattern
userRoutes.get("/:username", async (c) => {
  const { username } = c.req.param();

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true, username: true, createdAt: true },
    with: {
      stats: {
        columns: {
          rating: true,
          wins: true,
          losses: true,
          draws: true,
          winStreak: true,
          maxStreak: true,
        },
      },
    },
  });

  if (!user) throw Errors.NotFound("User");

  return c.json(user);
});
