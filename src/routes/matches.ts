/**
 * Match Routes
 * POST /matches/queue - Join matchmaking queue
 * DELETE /matches/queue - Leave queue
 * GET /matches/:id - Get match details
 * POST /matches/:id/start - Start match
 * POST /matches/:id/forfeit - Forfeit match (opponent wins)
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { matches, matchPlayers } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { authMiddleware } from "../middleware/auth";
import { matchEngine } from "../services/match-engine";
import { matchmaking } from "../services/matchmaking";

export const matchRoutes = new Hono();

// All routes require auth
matchRoutes.use("*", authMiddleware);

/**
 * POST /matches/queue
 * Join the matchmaking queue
 */
matchRoutes.post("/queue", async (c) => {
  const user = c.get("user");

  try {
    const result = await matchmaking.join(user.id);

    if (result.status === "already_in_match") {
      return c.json(result, 200);
    }
    return c.json(result, result.status === "matched" ? 201 : 200);
  } catch (err) {
    if (err instanceof Error && err.message === "User stats not found") {
      throw Errors.BadRequest("User profile incomplete");
    }
    throw err;
  }
});

/**
 * DELETE /matches/queue
 * Leave the matchmaking queue
 */
matchRoutes.delete("/queue", async (c) => {
  const user = c.get("user");
  const removed = matchmaking.leave(user.id);
  return c.json({ removed });
});

/**
 * GET /matches/queue/status
 * Check if user is in queue
 */
matchRoutes.get("/queue/status", async (c) => {
  const user = c.get("user");
  return c.json({ queued: matchmaking.isQueued(user.id) });
});

/**
 * GET /matches/active
 * Get user's current active match (if any)
 */
matchRoutes.get("/active", async (c) => {
  const user = c.get("user");

  const player = await db.query.matchPlayers.findFirst({
    where: eq(matchPlayers.userId, user.id),
    with: {
      match: {
        with: {
          problem: { columns: { id: true, title: true, difficulty: true } },
          players: { with: { user: { columns: { id: true, username: true } } } },
        },
      },
    },
    orderBy: (mp, { desc }) => [desc(mp.joinedAt)],
  });

  if (!player || !["WAITING", "STARTING", "ACTIVE"].includes(player.match.status)) {
    return c.json({ active: false });
  }

  return c.json({ active: true, match: player.match });
});

/**
 * GET /matches/:id
 * Get match details with players and problem
 */
matchRoutes.get("/:id", async (c) => {
  const { id } = c.req.param();

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, id),
    with: {
      problem: { columns: { id: true, title: true, difficulty: true, statement: true } },
      players: {
        with: { user: { columns: { id: true, username: true } } },
        columns: { result: true, ratingBefore: true, ratingAfter: true },
      },
    },
  });

  if (!match) throw Errors.NotFound("Match");
  return c.json(match);
});

/**
 * POST /matches/:id/start
 * Start an active match (changes STARTING → ACTIVE)
 */
matchRoutes.post("/:id/start", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");

  // Verify user is in this match (query by BOTH matchId AND userId)
  const player = await db.query.matchPlayers.findFirst({
    where: and(eq(matchPlayers.matchId, id), eq(matchPlayers.userId, user.id)),
    with: { match: true },
  });

  if (!player) {
    throw Errors.Forbidden("You are not in this match");
  }

  if (player.match.status !== "STARTING") {
    throw Errors.BadRequest("Match is not in STARTING state");
  }

  // Update to ACTIVE and start timer
  const now = new Date();
  await db.update(matches).set({ status: "ACTIVE", startedAt: now }).where(eq(matches.id, id));

  // Start 10-minute match timer (duration is in seconds, timer needs ms)
  const durationMs = (player.match.duration ?? 600) * 1000;
  matchEngine.startTimer(id, durationMs);

  return c.json({ status: "ACTIVE", startedAt: now, endsAt: new Date(now.getTime() + durationMs) });
});

/**
 * POST /matches/:id/forfeit
 * Forfeit the match (opponent wins automatically)
 */
matchRoutes.post("/:id/forfeit", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");

  // Verify user is in this match
  const player = await db.query.matchPlayers.findFirst({
    where: and(eq(matchPlayers.matchId, id), eq(matchPlayers.userId, user.id)),
  });

  if (!player) {
    throw Errors.Forbidden("You are not in this match");
  }

  const result = await matchEngine.forfeit(id, user.id);

  if (!result.success) {
    throw Errors.BadRequest(result.error ?? "Cannot forfeit match");
  }

  return c.json({ status: "forfeited", winnerId: result.winnerId });
});
