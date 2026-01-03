/**
 * Match Engine Service
 * Handles match lifecycle: timers, win detection, rating updates
 */

import { eq, sql } from "drizzle-orm";
import { matches, matchPlayers, userStats } from "../db/schema";
import { db } from "../lib/db";

const RATING_CHANGE = 5; // Win: +5, Loss: -5

// Active match timers (cleared on match end or server restart)
const matchTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Start match timer (call when match transitions to ACTIVE)
export function startMatchTimer(matchId: string, durationMs: number): void {
  // Clear any existing timer
  clearMatchTimer(matchId);

  const timer = setTimeout(() => handleMatchTimeout(matchId), durationMs);
  matchTimers.set(matchId, timer);
}

// Clear match timer
export function clearMatchTimer(matchId: string): void {
  const timer = matchTimers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    matchTimers.delete(matchId);
  }
}

// Handle match timeout (abort match, both lose rating)
async function handleMatchTimeout(matchId: string): Promise<void> {
  matchTimers.delete(matchId);
  await abortMatch(matchId);
}

// Abort match (timeout or mutual abandon)
async function abortMatch(matchId: string): Promise<void> {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: { players: true },
  });

  if (!match || match.status !== "ACTIVE") return;

  // Update match status
  await db
    .update(matches)
    .set({ status: "ABORTED", endedAt: new Date() })
    .where(eq(matches.id, matchId));

  // Both players lose rating (DRAW result but -5 each)
  for (const player of match.players) {
    await updatePlayerRating(player.userId, matchId, "DRAW", -RATING_CHANGE);
  }
}

// End match with winner
async function endMatchWithWinner(matchId: string, winnerId: string): Promise<void> {
  clearMatchTimer(matchId);

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: { players: true },
  });

  if (!match || match.status !== "ACTIVE") return;

  // Update match status
  await db
    .update(matches)
    .set({ status: "COMPLETED", winnerId, endedAt: new Date() })
    .where(eq(matches.id, matchId));

  // Update player results and ratings
  for (const player of match.players) {
    const isWinner = player.userId === winnerId;
    const result = isWinner ? "WON" : "LOST";
    const ratingDelta = isWinner ? RATING_CHANGE : -RATING_CHANGE;
    await updatePlayerRating(player.userId, matchId, result, ratingDelta);
  }
}

// Update player rating and match result
async function updatePlayerRating(
  userId: string,
  matchId: string,
  result: "WON" | "LOST" | "DRAW",
  ratingDelta: number,
): Promise<void> {
  // Get current stats
  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, userId),
  });
  if (!stats) return;

  const newRating = Math.max(0, stats.rating + ratingDelta);
  const isWin = result === "WON";

  // Update user_stats
  await db
    .update(userStats)
    .set({
      rating: newRating,
      wins: isWin ? sql`${userStats.wins} + 1` : userStats.wins,
      losses: result === "LOST" ? sql`${userStats.losses} + 1` : userStats.losses,
      draws: result === "DRAW" ? sql`${userStats.draws} + 1` : userStats.draws,
      winStreak: isWin ? sql`${userStats.winStreak} + 1` : 0,
      maxStreak: isWin
        ? sql`GREATEST(${userStats.maxStreak}, ${userStats.winStreak} + 1)`
        : userStats.maxStreak,
    })
    .where(eq(userStats.userId, userId));

  // Update match_players
  await db
    .update(matchPlayers)
    .set({ result, ratingAfter: newRating })
    .where(sql`${matchPlayers.matchId} = ${matchId} AND ${matchPlayers.userId} = ${userId}`);
}

// Process submission verdict - check if match should end
export async function processSubmissionVerdict(
  matchId: string,
  userId: string,
  verdict: string,
): Promise<{ ended: boolean; winnerId?: string }> {
  if (verdict === "ACCEPTED") {
    await endMatchWithWinner(matchId, userId);
    return { ended: true, winnerId: userId };
  }
  return { ended: false };
}

// Forfeit match - forfeiting user loses, opponent wins
export async function forfeitMatch(
  matchId: string,
  forfeitingUserId: string,
): Promise<{ success: boolean; winnerId?: string; error?: string }> {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: { players: true },
  });

  if (!match) return { success: false, error: "Match not found" };
  if (match.status !== "ACTIVE") return { success: false, error: "Match is not active" };

  // Find the opponent (the one who wins)
  const opponent = match.players.find((p) => p.userId !== forfeitingUserId);
  if (!opponent) return { success: false, error: "Opponent not found" };

  await endMatchWithWinner(matchId, opponent.userId);
  return { success: true, winnerId: opponent.userId };
}

// Public API
export const matchEngine = {
  startTimer: startMatchTimer,
  clearTimer: clearMatchTimer,
  processVerdict: processSubmissionVerdict,
  forfeit: forfeitMatch,

  // Get active timers count (for debugging)
  activeTimerCount: () => matchTimers.size,
};
