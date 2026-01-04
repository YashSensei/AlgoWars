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

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

export const matchRoutes = new Hono();

// All routes require auth
matchRoutes.use("*", authMiddleware);

// Map matchmaking errors to user-friendly messages
function handleMatchmakingError(err: unknown): never {
  if (err instanceof Error) {
    const errorMap: Record<string, string> = {
      "User stats not found": "User profile incomplete",
      "No problems available for this rating bracket":
        "No problems available. Please try again later.",
    };
    const message = errorMap[err.message];
    if (message) throw Errors.BadRequest(message);
  }
  throw err;
}

/**
 * POST /matches/queue
 * Join the matchmaking queue
 */
matchRoutes.post("/queue", async (c) => {
  const user = c.get("user");

  try {
    const result = await matchmaking.join(user.id);
    const status = result.status === "matched" ? 201 : 200;
    return c.json(result, status);
  } catch (err) {
    handleMatchmakingError(err);
  }
});

/**
 * DELETE /matches/queue
 * Leave the matchmaking queue
 */
matchRoutes.delete("/queue", async (c) => {
  const user = c.get("user");
  const removed = await matchmaking.leave(user.id);
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
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid match ID");

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
 * Delegates to matchEngine which handles locking and state machine validation
 */
matchRoutes.post("/:id/start", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid match ID");
  const user = c.get("user");

  // Delegate to match engine - handles mutex, state validation, timers, socket events
  const result = await matchEngine.start(id, user.id);

  if (!result.success) {
    if (result.error === "You are not in this match") {
      throw Errors.Forbidden(result.error);
    }
    throw Errors.BadRequest(result.error ?? "Cannot start match");
  }

  // Return success (alreadyActive means other player started first - still success)
  return c.json({ status: "ACTIVE", alreadyStarted: result.alreadyActive ?? false });
});

/**
 * POST /matches/:id/forfeit
 * Forfeit the match (opponent wins automatically)
 */
matchRoutes.post("/:id/forfeit", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid match ID");
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
