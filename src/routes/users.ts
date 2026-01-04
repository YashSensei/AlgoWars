import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { matchPlayers, users } from "../db/schema";
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
 * GET /users/me/history
 * Get current user's match history (paginated)
 */
userRoutes.get("/me/history", authMiddleware, async (c) => {
  const { id: userId } = c.get("user");
  const { limit = "10", offset = "0" } = c.req.query();

  const limitNum = Math.min(Number(limit), 50);
  const offsetNum = Number(offset);

  // Get user's match history with opponent info
  const history = await db.query.matchPlayers.findMany({
    where: eq(matchPlayers.userId, userId),
    with: {
      match: {
        columns: { id: true, status: true, winnerId: true, startedAt: true, endedAt: true },
        with: {
          problem: { columns: { id: true, title: true, difficulty: true } },
          players: {
            columns: { userId: true, result: true, ratingBefore: true, ratingAfter: true },
            with: { user: { columns: { id: true, username: true } } },
          },
        },
      },
    },
    orderBy: [desc(matchPlayers.joinedAt)],
    limit: limitNum,
    offset: offsetNum,
  });

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(matchPlayers)
    .where(eq(matchPlayers.userId, userId));

  // Transform to cleaner format
  const matchHistory = history
    .filter((h) => ["COMPLETED", "ABORTED"].includes(h.match.status))
    .map((h) => {
      const opponent = h.match.players.find((p) => p.userId !== userId);
      const self = h.match.players.find((p) => p.userId === userId);
      const duration =
        h.match.startedAt && h.match.endedAt
          ? Math.round(
              (new Date(h.match.endedAt).getTime() - new Date(h.match.startedAt).getTime()) / 1000,
            )
          : null;

      return {
        matchId: h.match.id,
        result: self?.result ?? "PENDING",
        ratingChange:
          self?.ratingAfter && self?.ratingBefore ? self.ratingAfter - self.ratingBefore : 0,
        opponent: opponent ? { id: opponent.user.id, username: opponent.user.username } : null,
        problem: h.match.problem,
        duration,
        playedAt: h.match.endedAt ?? h.match.startedAt,
      };
    });

  return c.json({
    matches: matchHistory,
    total: countResult?.count ?? 0,
    limit: limitNum,
    offset: offsetNum,
  });
});

// Get user by username (public profile)
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
