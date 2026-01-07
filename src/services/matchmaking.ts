/**
 * Matchmaking Service
 * In-memory queue with rating-based pairing
 * Uses mutex for atomic queue operations
 */

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { matches, matchPlayers, problems, userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { Mutex } from "../lib/mutex";
import { socketEmit } from "../socket";

const RATING_RANGE = 100; // Match players within ±100 rating

interface QueuedPlayer {
  userId: string;
  rating: number;
  joinedAt: number;
}

// In-memory queue
const queue: Map<string, QueuedPlayer> = new Map();

// Single mutex for all queue operations (prevents double-matching)
const queueMutex = new Mutex();

// Get player's rating bucket for problem selection
function getRatingBucket(rating: number): string {
  if (rating < 1200) return "0800-1199";
  if (rating < 1400) return "1200-1399";
  return "1400-1599";
}

// Find a matching opponent within rating range
function findMatch(player: QueuedPlayer): QueuedPlayer | null {
  for (const [userId, opponent] of queue) {
    if (userId === player.userId) continue;
    if (Math.abs(opponent.rating - player.rating) <= RATING_RANGE) {
      return opponent;
    }
  }
  return null;
}

// Select random problem from rating bucket (only problems with statements)
async function selectProblem(avgRating: number): Promise<string | null> {
  const bucket = getRatingBucket(avgRating);
  const [problem] = await db
    .select({ id: problems.id })
    .from(problems)
    .where(and(eq(problems.ratingBucket, bucket), isNotNull(problems.statement)))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return problem?.id ?? null;
}

// Notify both players about the match
async function notifyMatchedPlayers(
  matchId: string,
  p1: QueuedPlayer,
  p2: QueuedPlayer,
): Promise<void> {
  const [user1, user2] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, p1.userId), columns: { username: true } }),
    db.query.users.findFirst({ where: eq(users.id, p2.userId), columns: { username: true } }),
  ]);

  logger.info("Matchmaking", `Match created: ${matchId.slice(0, 8)}`, {
    player1: `${user1?.username} (${p1.rating})`,
    player2: `${user2?.username} (${p2.rating})`,
  });

  socketEmit.queueMatched(p1.userId, {
    matchId,
    opponentId: p2.userId,
    opponentName: user2?.username ?? "Opponent",
  });
  socketEmit.queueMatched(p2.userId, {
    matchId,
    opponentId: p1.userId,
    opponentName: user1?.username ?? "Opponent",
  });
}

// Create match with two players
async function createMatch(p1: QueuedPlayer, p2: QueuedPlayer): Promise<string> {
  const avgRating = Math.round((p1.rating + p2.rating) / 2);
  const problemId = await selectProblem(avgRating);

  if (!problemId) {
    logger.error("Matchmaking", `No problems available (avg rating: ${avgRating})`);
    throw new Error("No problems available for this rating bracket");
  }

  const result = await db
    .insert(matches)
    .values({ problemId, status: "STARTING" })
    .returning({ id: matches.id });
  const matchId = result[0]?.id;
  if (!matchId) throw new Error("Failed to create match");

  await db.insert(matchPlayers).values([
    { matchId, userId: p1.userId, ratingBefore: p1.rating },
    { matchId, userId: p2.userId, ratingBefore: p2.rating },
  ]);

  await notifyMatchedPlayers(matchId, p1, p2);
  return matchId;
}

// Check if user has an active match
async function hasActiveMatch(userId: string): Promise<string | null> {
  const activePlayer = await db.query.matchPlayers.findFirst({
    where: eq(matchPlayers.userId, userId),
    with: { match: true },
    orderBy: (mp, { desc }) => [desc(mp.joinedAt)],
  });

  if (activePlayer && ["WAITING", "STARTING", "ACTIVE"].includes(activePlayer.match.status)) {
    return activePlayer.matchId;
  }
  return null;
}

// Public API
export const matchmaking = {
  /**
   * Join queue - atomic operation using mutex
   * Returns matchId if paired immediately or already in match
   */
  async join(
    userId: string,
  ): Promise<{ status: "queued" | "matched" | "already_in_match"; matchId?: string }> {
    // Check if already in an active match (outside lock - read-only)
    const existingMatchId = await hasActiveMatch(userId);
    if (existingMatchId) {
      logger.info(
        "Matchmaking",
        `User ${userId.slice(0, 8)} already in match ${existingMatchId.slice(0, 8)}`,
      );
      return { status: "already_in_match", matchId: existingMatchId };
    }

    // Get user stats (outside lock - read-only)
    const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, userId),
    });
    if (!stats) {
      logger.error("Matchmaking", `User stats not found for ${userId.slice(0, 8)}`);
      throw new Error("User stats not found");
    }

    // All queue mutations happen inside mutex
    return queueMutex.withLock(async () => {
      // Check if already in queue (re-check inside lock)
      if (queue.has(userId)) {
        logger.debug("Matchmaking", `User ${userId.slice(0, 8)} already in queue`);
        return { status: "queued" };
      }

      const player: QueuedPlayer = { userId, rating: stats.rating, joinedAt: Date.now() };
      const opponent = findMatch(player);

      if (opponent) {
        // Verify opponent is still connected before matching
        if (!socketEmit.isUserConnected(opponent.userId)) {
          // Opponent disconnected, remove from queue and continue searching
          queue.delete(opponent.userId);
          socketEmit.trackQueueLeave(opponent.userId);
          logger.warn(
            "Matchmaking",
            `Skipping disconnected opponent ${opponent.userId.slice(0, 8)}, adding ${userId.slice(0, 8)} to queue`,
          );
          queue.set(userId, player);
          socketEmit.trackQueueJoin(userId);
          return { status: "queued" };
        }

        // Atomic: remove opponent from queue and create match
        queue.delete(opponent.userId);
        socketEmit.trackQueueLeave(opponent.userId);
        logger.info(
          "Matchmaking",
          `Matched ${userId.slice(0, 8)} (${stats.rating}) with ${opponent.userId.slice(0, 8)} (${opponent.rating})`,
        );
        const matchId = await createMatch(player, opponent);
        return { status: "matched", matchId };
      }

      // No opponent found, add to queue
      queue.set(userId, player);
      socketEmit.trackQueueJoin(userId);
      logger.info("Matchmaking", `User ${userId.slice(0, 8)} (${stats.rating}) joined queue`, {
        queueSize: queue.size,
      });
      return { status: "queued" };
    });
  },

  /**
   * Leave queue - atomic operation using mutex
   */
  async leave(userId: string): Promise<boolean> {
    return queueMutex.withLock(async () => {
      const removed = queue.delete(userId);
      if (removed) {
        socketEmit.trackQueueLeave(userId);
        logger.info("Matchmaking", `User ${userId.slice(0, 8)} left queue`, {
          queueSize: queue.size,
        });
      }
      return removed;
    });
  },

  // Check if user is in queue
  isQueued(userId: string): boolean {
    return queue.has(userId);
  },

  // Get queue size (for debugging)
  size(): number {
    return queue.size;
  },

  /**
   * Clean up stale queue entries (users who disconnected)
   * Called periodically to ensure queue hygiene
   */
  async cleanupStale(): Promise<number> {
    return queueMutex.withLock(async () => {
      let removed = 0;
      for (const [userId] of queue) {
        if (!socketEmit.isUserConnected(userId)) {
          queue.delete(userId);
          socketEmit.trackQueueLeave(userId);
          removed++;
          logger.info("Matchmaking", `Removed stale user ${userId.slice(0, 8)} from queue`);
        }
      }
      if (removed > 0) {
        logger.info("Matchmaking", `Cleanup removed ${removed} stale entries`, {
          queueSize: queue.size,
        });
      }
      return removed;
    });
  },
};
