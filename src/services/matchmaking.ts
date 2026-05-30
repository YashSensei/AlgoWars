/**
 * Matchmaking Service
 * In-memory queue with rating-based pairing
 * Uses mutex for atomic queue operations
 * Falls back to bot opponent after 15s with no real match.
 */

import { eq, isNotNull, sql } from "drizzle-orm";
import { matches, matchPlayers, problems, userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { Mutex } from "../lib/mutex";
import { socketEmit } from "../socket";
import { botEngine } from "./bot-engine";
import { fetchAndSaveStatement } from "./problem-fetcher";

const RATING_RANGE = 100;
const BOT_FALLBACK_MS = 15_000;
const SOLO_TIMED_DURATION = 480; // "Against Time" mode — solo, 8 minutes

interface QueuedPlayer {
  userId: string;
  rating: number;
  joinedAt: number;
  duration: number;
}

// In-memory queue
const queue: Map<string, QueuedPlayer> = new Map();

// Bot fallback timers (userId → timeout handle). Cleared when matched or leave.
const botTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Single mutex for all queue operations (prevents double-matching)
const queueMutex = new Mutex();

// Get player's rating bucket for problem selection
function getRatingBucket(rating: number): string {
  if (rating < 1200) return "0800-1199";
  if (rating < 1400) return "1200-1399";
  return "1400-1599";
}

// Find a matching opponent within rating range AND same game mode (duration)
function findMatch(player: QueuedPlayer): QueuedPlayer | null {
  for (const [userId, opponent] of queue) {
    if (userId === player.userId) continue;
    if (opponent.duration !== player.duration) continue;
    if (Math.abs(opponent.rating - player.rating) <= RATING_RANGE) {
      return opponent;
    }
  }
  return null;
}

// Pick a random problem in bucket; lazy-fetch its statement from Codeforces if not yet cached.
async function selectProblem(avgRating: number): Promise<string | null> {
  const bucket = getRatingBucket(avgRating);
  const rows = await db
    .select({ id: problems.id, statement: problems.statement })
    .from(problems)
    .where(eq(problems.ratingBucket, bucket))
    .orderBy(sql`RANDOM()`)
    .limit(5);

  for (const row of rows) {
    if (row.statement) return row.id;
    const fetched = await fetchAndSaveStatement(row.id);
    if (fetched) return row.id;
  }

  return selectFallbackProblem();
}

async function selectFallbackProblem(): Promise<string | null> {
  const [row] = await db
    .select({ id: problems.id })
    .from(problems)
    .where(isNotNull(problems.statement))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return row?.id ?? null;
}

function buildMatchedPayload(
  matchId: string,
  opponentId: string,
  username: string | undefined,
  stats: { rating: number; wins: number; losses: number; winStreak: number } | undefined,
  fallbackRating: number,
) {
  return {
    matchId,
    opponentId,
    opponentName: username ?? "Opponent",
    opponentRating: stats?.rating ?? fallbackRating,
    opponentWins: stats?.wins ?? 0,
    opponentLosses: stats?.losses ?? 0,
    opponentWinStreak: stats?.winStreak ?? 0,
  };
}

async function notifyMatchedPlayers(
  matchId: string,
  p1: QueuedPlayer,
  p2: QueuedPlayer,
): Promise<void> {
  const [user1, user2, stats1, stats2] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, p1.userId), columns: { username: true } }),
    db.query.users.findFirst({ where: eq(users.id, p2.userId), columns: { username: true } }),
    db.query.userStats.findFirst({ where: eq(userStats.userId, p1.userId) }),
    db.query.userStats.findFirst({ where: eq(userStats.userId, p2.userId) }),
  ]);

  logger.info("Matchmaking", `Match created: ${matchId.slice(0, 8)}`, {
    player1: `${user1?.username} (${p1.rating})`,
    player2: `${user2?.username} (${p2.rating})`,
  });

  socketEmit.queueMatched(
    p1.userId,
    buildMatchedPayload(matchId, p2.userId, user2?.username ?? undefined, stats2, p2.rating),
  );
  socketEmit.queueMatched(
    p2.userId,
    buildMatchedPayload(matchId, p1.userId, user1?.username ?? undefined, stats1, p1.rating),
  );
}

type GameMode = "BLITZ" | "CLASSICAL" | "TIMED";

const DURATION_TO_MODE: Record<number, GameMode> = {
  900: "BLITZ",
  1200: "CLASSICAL",
  480: "TIMED",
};

// Create match with two players — atomic: if either INSERT fails, both roll back.
async function createMatch(p1: QueuedPlayer, p2: QueuedPlayer, duration = 900): Promise<string> {
  const avgRating = Math.round((p1.rating + p2.rating) / 2);
  const problemId = await selectProblem(avgRating);

  if (!problemId) {
    logger.error("Matchmaking", `No problems available (avg rating: ${avgRating})`);
    throw new Error("No problems available for this rating bracket");
  }

  const mode = DURATION_TO_MODE[duration] ?? "BLITZ";

  const matchId = await db.transaction(async (tx) => {
    const result = await tx
      .insert(matches)
      .values({ problemId, status: "STARTING", duration, mode })
      .returning({ id: matches.id });
    const id = result[0]?.id;
    if (!id) throw new Error("Failed to create match");

    await tx.insert(matchPlayers).values([
      { matchId: id, userId: p1.userId, ratingBefore: p1.rating },
      { matchId: id, userId: p2.userId, ratingBefore: p2.rating },
    ]);
    return id;
  });

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

// Select a random bot account near the given rating
async function selectRandomBot(rating: number): Promise<QueuedPlayer | null> {
  const bot = await db.query.users.findFirst({
    where: eq(users.isBot, true),
    columns: { id: true },
    orderBy: sql`RANDOM()`,
  });
  if (!bot) return null;
  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, bot.id),
  });
  return { userId: bot.id, rating: stats?.rating ?? rating, joinedAt: Date.now(), duration: 900 };
}

// Pair a queued player with a bot, create the match, start bot engine.
// The entire operation (queue removal + match creation) runs inside the mutex to prevent
// a second tab from slipping through hasActiveMatch between removal and DB commit.
async function matchWithBot(player: QueuedPlayer): Promise<void> {
  const bot = await selectRandomBot(player.rating);
  if (!bot) {
    logger.warn("Matchmaking", "No bot accounts available");
    return;
  }

  const matchId = await queueMutex.withLock(async () => {
    if (!queue.has(player.userId)) return null;
    queue.delete(player.userId);
    socketEmit.trackQueueLeave(player.userId);

    logger.info(
      "Matchmaking",
      `Bot match for ${player.userId.slice(0, 8)} vs bot ${bot.userId.slice(0, 8)}`,
    );
    return createMatch(player, bot, player.duration);
  });

  if (!matchId) return;

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    columns: { problemId: true },
  });
  if (match?.problemId) {
    botEngine.start(matchId, bot.userId, match.problemId);
  }
}

// Create a solo match ("Against Time") — bot is a placeholder, never submits or solves.
async function createSoloMatch(player: QueuedPlayer): Promise<string | null> {
  const bot = await selectRandomBot(player.rating);
  if (!bot) return null;
  logger.info("Matchmaking", `Solo timed match for ${player.userId.slice(0, 8)}`);
  return createMatch(player, bot, player.duration);
}

// Try to match with a real opponent from the queue. Returns null if no valid opponent found.
async function tryMatchWithRealOpponent(
  player: QueuedPlayer,
  rating: number,
): Promise<{ status: "matched"; matchId: string } | { status: "queued" } | null> {
  const opponent = findMatch(player);
  if (!opponent) return null;

  if (!socketEmit.isUserConnected(opponent.userId)) {
    queue.delete(opponent.userId);
    socketEmit.trackQueueLeave(opponent.userId);
    logger.warn("Matchmaking", `Skipping disconnected opponent ${opponent.userId.slice(0, 8)}`);
    queue.set(player.userId, player);
    socketEmit.trackQueueJoin(player.userId);
    return { status: "queued" };
  }

  queue.delete(opponent.userId);
  cancelBotTimer(opponent.userId);
  socketEmit.trackQueueLeave(opponent.userId);
  logger.info(
    "Matchmaking",
    `Matched ${player.userId.slice(0, 8)} (${rating}) with ${opponent.userId.slice(0, 8)} (${opponent.rating})`,
  );
  const matchId = await createMatch(player, opponent, player.duration);
  return { status: "matched", matchId };
}

// Handle solo mode — returns a result if it's a solo match, null otherwise.
async function handleSoloMode(
  player: QueuedPlayer,
): Promise<{ status: "matched"; matchId: string } | null> {
  if (player.duration !== SOLO_TIMED_DURATION) return null;
  const matchId = await createSoloMatch(player);
  if (!matchId) throw new Error("No problems available for this rating bracket");
  return { status: "matched", matchId };
}

// Returns true if user is already in queue for the same mode (no action needed).
// Returns false if user is not in queue or was in a different mode (re-queue needed).
function handleExistingQueueEntry(userId: string, duration: number): boolean {
  const existing = queue.get(userId);
  if (!existing) return false;
  if (existing.duration === duration) return true;
  cancelBotTimer(userId);
  queue.delete(userId);
  logger.info("Matchmaking", `User ${userId.slice(0, 8)} switched mode`, {
    from: existing.duration,
    to: duration,
  });
  return false;
}

function startBotTimer(player: QueuedPlayer): void {
  const timer = setTimeout(() => {
    botTimers.delete(player.userId);
    matchWithBot(player);
  }, BOT_FALLBACK_MS);
  botTimers.set(player.userId, timer);
}

function cancelBotTimer(userId: string): void {
  const timer = botTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    botTimers.delete(userId);
  }
}

// Exported for reuse by friend duel routes (same match creation logic)
export { createMatch, selectProblem };
export type { QueuedPlayer };

// Public API
export const matchmaking = {
  /**
   * Join queue - atomic operation using mutex
   * Returns matchId if paired immediately or already in match
   */
  async join(
    userId: string,
    duration = 900,
  ): Promise<{ status: "queued" | "matched" | "already_in_match"; matchId?: string }> {
    // Get user stats (outside lock - read-only)
    const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, userId),
    });
    if (!stats) {
      logger.error("Matchmaking", `User stats not found for ${userId.slice(0, 8)}`);
      throw new Error("User stats not found");
    }

    // All checks and mutations happen inside mutex to prevent TOCTOU races
    return queueMutex.withLock(async () => {
      // Check if already in an active match (inside lock to prevent double-matching)
      const existingMatchId = await hasActiveMatch(userId);
      if (existingMatchId) {
        logger.info(
          "Matchmaking",
          `User ${userId.slice(0, 8)} already in match ${existingMatchId.slice(0, 8)}`,
        );
        return { status: "already_in_match", matchId: existingMatchId };
      }

      // Check if already in queue — if same mode, no-op; if different mode, switch.
      if (handleExistingQueueEntry(userId, duration)) {
        return { status: "queued" };
      }

      const player: QueuedPlayer = { userId, rating: stats.rating, joinedAt: Date.now(), duration };

      // Solo mode ("Against Time") — instant bot match, no queue, bot never solves
      const soloResult = await handleSoloMode(player);
      if (soloResult) return soloResult;

      const matchResult = await tryMatchWithRealOpponent(player, stats.rating);
      if (matchResult) return matchResult;

      // No opponent found, add to queue and start bot fallback timer
      queue.set(userId, player);
      socketEmit.trackQueueJoin(userId);
      startBotTimer(player);
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
        cancelBotTimer(userId);
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
          cancelBotTimer(userId);
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
