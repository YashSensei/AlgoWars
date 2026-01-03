/**
 * Match Routes
 * POST /matches/queue - Join matchmaking queue
 * DELETE /matches/queue - Leave queue
 * GET /matches/:id - Get match details
 */

import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { matches, matchPlayers } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { authMiddleware } from "../middleware/auth";
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
  const result = await matchmaking.join(user.id);
  return c.json(result, result.status === "matched" ? 201 : 200);
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

  // Verify user is in this match
  const player = await db.query.matchPlayers.findFirst({
    where: eq(matchPlayers.matchId, id),
    with: { match: true },
  });

  if (!player || player.userId !== user.id) {
    throw Errors.Forbidden("You are not in this match");
  }

  if (player.match.status !== "STARTING") {
    throw Errors.BadRequest("Match is not in STARTING state");
  }

  // Update to ACTIVE
  await db
    .update(matches)
    .set({ status: "ACTIVE", startedAt: new Date() })
    .where(eq(matches.id, id));

  return c.json({ status: "ACTIVE", startedAt: new Date() });
});
