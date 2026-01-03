/**
 * Matchmaking Service
 * In-memory queue with rating-based pairing
 */

import { eq, sql } from "drizzle-orm";
import { matches, matchPlayers, problems, userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { socketEmit } from "../socket";

const RATING_RANGE = 100; // Match players within ±100 rating

interface QueuedPlayer {
  userId: string;
  rating: number;
  joinedAt: number;
}

// In-memory queue
const queue: Map<string, QueuedPlayer> = new Map();

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

// Select random problem from rating bucket
async function selectProblem(avgRating: number): Promise<string | null> {
  const bucket = getRatingBucket(avgRating);
  const [problem] = await db
    .select({ id: problems.id })
    .from(problems)
    .where(eq(problems.ratingBucket, bucket))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return problem?.id ?? null;
}

// Create match with two players
async function createMatch(p1: QueuedPlayer, p2: QueuedPlayer): Promise<string> {
  const avgRating = Math.round((p1.rating + p2.rating) / 2);
  const problemId = await selectProblem(avgRating);

  // Ensure we have a problem before creating match
  if (!problemId) {
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

  // Fetch usernames for socket notifications
  const [user1, user2] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, p1.userId), columns: { username: true } }),
    db.query.users.findFirst({ where: eq(users.id, p2.userId), columns: { username: true } }),
  ]);

  // Notify both players via WebSocket
  socketEmit.queueMatched(p1.userId, { matchId, opponentName: user2?.username ?? "Opponent" });
  socketEmit.queueMatched(p2.userId, { matchId, opponentName: user1?.username ?? "Opponent" });

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
  // Join queue, returns matchId if paired immediately or already in match
  async join(
    userId: string,
  ): Promise<{ status: "queued" | "matched" | "already_in_match"; matchId?: string }> {
    // Check if already in an active match
    const existingMatchId = await hasActiveMatch(userId);
    if (existingMatchId) {
      return { status: "already_in_match", matchId: existingMatchId };
    }

    // Check if already in queue
    if (queue.has(userId)) {
      return { status: "queued" };
    }

    const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, userId),
    });
    if (!stats) throw new Error("User stats not found");

    const player: QueuedPlayer = { userId, rating: stats.rating, joinedAt: Date.now() };
    const opponent = findMatch(player);

    if (opponent) {
      queue.delete(opponent.userId);
      const matchId = await createMatch(player, opponent);
      return { status: "matched", matchId };
    }

    queue.set(userId, player);
    return { status: "queued" };
  },

  // Leave queue
  leave(userId: string): boolean {
    return queue.delete(userId);
  },

  // Check if user is in queue
  isQueued(userId: string): boolean {
    return queue.has(userId);
  },

  // Get queue size (for debugging)
  size(): number {
    return queue.size;
  },
};
