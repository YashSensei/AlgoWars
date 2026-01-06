import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { matchPlayers, userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { authMiddleware } from "../middleware/auth";

export const userRoutes = new Hono();

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

  // Filter to only completed matches and transform
  const matches = history
    .filter((mp) => mp.match.status === "COMPLETED")
    .map((mp) => {
      const opponent = mp.match.players.find((p) => p.user.id !== id);
      const me = mp.match.players.find((p) => p.user.id === id);
      return {
        matchId: mp.match.id,
        problem: mp.match.problem,
        opponent: opponent?.user ?? null,
        opponentRating: opponent?.ratingBefore ?? null,
        result: me?.result ?? "PENDING",
        ratingChange: me?.ratingAfter && me?.ratingBefore ? me.ratingAfter - me.ratingBefore : 0,
        playedAt: mp.match.endedAt ?? mp.match.startedAt,
      };
    });

  return c.json({ matches, limit, offset });
});

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
