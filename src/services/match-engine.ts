/**
 * Match Engine Service - SINGLE AUTHORITY for match state
 *
 * Architecture:
 * - ONE mutex per match (prevents all race conditions)
 * - State machine with validated transitions only
 * - All state changes MUST go through this service
 * - Clients send requests, server decides outcomes
 */

import { eq, sql } from "drizzle-orm";
import { matches, matchPlayers, userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { MutexManager } from "../lib/mutex";
import { socketEmit } from "../socket";
import { botEngine } from "./bot-engine";

// Elo rating calculation (K=32, standard formula).
// Beating a stronger player earns more; beating a weaker player earns less.
const ELO_K = 32;
const RATING_FLOOR = 100;

function calculateEloDelta(winnerRating: number, loserRating: number): number {
  const expected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  return Math.max(1, Math.round(ELO_K * (1 - expected)));
}

// Per-match mutexes - ensures atomic operations per match
const matchMutexes = new MutexManager<string>();

// Active match timers
const matchTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Valid state transitions (state machine)
// State flow: WAITING* → STARTING → ACTIVE → COMPLETED/ABORTED
// * WAITING is reserved for future lobby mode where players must "ready up"
//   Currently, matches are created directly in STARTING state by matchmaking
type MatchStatus = "WAITING" | "STARTING" | "ACTIVE" | "COMPLETED" | "ABORTED";

const VALID_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  WAITING: ["STARTING", "ABORTED"], // Reserved for future lobby mode
  STARTING: ["ACTIVE", "ABORTED"], // Countdown phase, waiting for players to start
  ACTIVE: ["COMPLETED", "ABORTED"], // Match in progress
  COMPLETED: [], // Terminal: match ended with a winner
  ABORTED: [], // Terminal: match cancelled (timeout, disconnect, etc.)
};

function isValidTransition(from: MatchStatus, to: MatchStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================================
// TIMER MANAGEMENT
// ============================================================================

function startTimer(matchId: string, durationMs: number): void {
  // Clear any existing timer
  clearTimer(matchId);

  logger.info("MatchEngine", `Timer started: ${matchId.slice(0, 8)}`, {
    durationMs,
    endsAt: new Date(Date.now() + durationMs).toISOString(),
  });

  const timer = setTimeout(() => {
    matchTimers.delete(matchId);
    // Timeout triggers abort - goes through proper state machine
    matchEngine.abort(matchId, "timeout");
  }, durationMs);

  matchTimers.set(matchId, timer);
}

function clearTimer(matchId: string): void {
  const timer = matchTimers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    matchTimers.delete(matchId);
  }
}

// ============================================================================
// RATING UPDATE (transactional)
// ============================================================================

// Build stats update object based on result
function buildStatsUpdate(result: "WON" | "LOST" | "DRAW", newRating: number) {
  const isWin = result === "WON";
  return {
    rating: newRating,
    wins: isWin ? sql`${userStats.wins} + 1` : userStats.wins,
    losses: result === "LOST" ? sql`${userStats.losses} + 1` : userStats.losses,
    draws: result === "DRAW" ? sql`${userStats.draws} + 1` : userStats.draws,
    winStreak: isWin ? sql`${userStats.winStreak} + 1` : 0,
    maxStreak: isWin
      ? sql`GREATEST(${userStats.maxStreak}, ${userStats.winStreak} + 1)`
      : userStats.maxStreak,
  };
}

async function isBot(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isBot: true },
  });
  return user?.isBot ?? false;
}

async function updatePlayerRating(
  userId: string,
  matchId: string,
  result: "WON" | "LOST" | "DRAW",
  ratingDelta: number,
): Promise<void> {
  if (await isBot(userId)) return;

  const stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, userId) });
  if (!stats) {
    logger.error("MatchEngine", `Stats not found for user ${userId.slice(0, 8)}`);
    return;
  }

  const newRating = Math.max(RATING_FLOOR, stats.rating + ratingDelta);

  await db.transaction(async (tx) => {
    await tx
      .update(userStats)
      .set(buildStatsUpdate(result, newRating))
      .where(eq(userStats.userId, userId));
    await tx
      .update(matchPlayers)
      .set({ result, ratingAfter: newRating })
      .where(sql`${matchPlayers.matchId} = ${matchId} AND ${matchPlayers.userId} = ${userId}`);
  });

  logger.debug(
    "MatchEngine",
    `Rating: ${userId.slice(0, 8)} ${result} (${ratingDelta > 0 ? "+" : ""}${ratingDelta})`,
  );
}

// ============================================================================
// MATCH ENGINE - PUBLIC API (Single Authority)
// ============================================================================

export const matchEngine = {
  /**
   * Start a match (STARTING → ACTIVE)
   * Returns success:true only for the player that actually triggered the transition
   */
  async start(
    matchId: string,
    requestingUserId: string,
  ): Promise<{ success: boolean; alreadyActive?: boolean; error?: string }> {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: State machine requires multiple checks
    return matchMutexes.withLock(matchId, async () => {
      const match = await db.query.matches.findFirst({
        where: eq(matches.id, matchId),
        with: { players: true },
      });

      if (!match) {
        return { success: false, error: "Match not found" };
      }

      // Verify user is in this match
      const isPlayer = match.players.some((p) => p.userId === requestingUserId);
      if (!isPlayer) {
        return { success: false, error: "You are not in this match" };
      }

      // Already active? Not an error, just signal to caller
      if (match.status === "ACTIVE") {
        return { success: true, alreadyActive: true };
      }

      // Validate state transition
      if (!isValidTransition(match.status as MatchStatus, "ACTIVE")) {
        return { success: false, error: `Cannot start match in ${match.status} state` };
      }

      // Perform transition
      const now = new Date();
      await db
        .update(matches)
        .set({ status: "ACTIVE", startedAt: now })
        .where(eq(matches.id, matchId));

      // Start timer
      const durationMs = (match.duration ?? 600) * 1000;
      startTimer(matchId, durationMs);

      // Register players for disconnect tracking
      for (const p of match.players) {
        const opponent = match.players.find((op) => op.userId !== p.userId);
        if (opponent) {
          socketEmit.registerUserMatch(p.userId, matchId, opponent.userId);
        }
      }

      // Fetch problem and emit start event
      const matchWithProblem = await db.query.matches.findFirst({
        where: eq(matches.id, matchId),
        with: {
          problem: { columns: { id: true, title: true, statement: true, difficulty: true } },
        },
      });

      const endsAt = new Date(now.getTime() + durationMs).toISOString();
      socketEmit.matchStart(matchId, { problem: matchWithProblem?.problem, endsAt });

      logger.info("MatchEngine", `Match STARTED: ${matchId.slice(0, 8)}`);
      return { success: true };
    });
  },

  /**
   * Process a submission verdict
   * If ACCEPTED, ends match with submitter as winner
   */
  async processVerdict(
    matchId: string,
    userId: string,
    verdict: string,
  ): Promise<{ ended: boolean; winnerId?: string }> {
    // All verdict processing inside mutex to prevent phantom broadcasts
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: State machine requires multiple checks
    return matchMutexes.withLock(matchId, async () => {
      const match = await db.query.matches.findFirst({
        where: eq(matches.id, matchId),
        with: { players: true },
      });

      if (!match) {
        return { ended: true }; // Match gone, treat as ended
      }

      // Only broadcast verdict if match is still active
      if (match.status !== "ACTIVE") {
        logger.debug(
          "MatchEngine",
          `Verdict ignored - match ${matchId.slice(0, 8)} not active (${match.status})`,
        );
        return { ended: true }; // Already ended by someone else
      }

      // Broadcast verdict to all players (inside lock, after state check)
      socketEmit.matchSubmission(matchId, { userId, verdict });

      if (verdict !== "ACCEPTED") {
        logger.info("MatchEngine", `Verdict: ${verdict}`, {
          match: matchId.slice(0, 8),
          user: userId.slice(0, 8),
        });
        return { ended: false };
      }

      // ACCEPTED - end match with this user as winner
      clearTimer(matchId);

      await db
        .update(matches)
        .set({ status: "COMPLETED", winnerId: userId, endedAt: new Date() })
        .where(eq(matches.id, matchId));

      // Update ratings — skip entirely for solo TIMED mode
      const winner = match.players.find((p) => p.userId === userId);
      const loser = match.players.find((p) => p.userId !== userId);
      if (winner && loser && match.mode !== "TIMED") {
        const delta = calculateEloDelta(winner.ratingBefore, loser.ratingBefore);
        await updatePlayerRating(winner.userId, matchId, "WON", delta);
        await updatePlayerRating(loser.userId, matchId, "LOST", -delta);
      }
      for (const p of match.players) socketEmit.clearUserMatch(p.userId);

      botEngine.cancel(matchId);
      socketEmit.matchEnd(matchId, { winnerId: userId, reason: "solved" });
      logger.info("MatchEngine", `Match COMPLETED: ${matchId.slice(0, 8)}`, {
        winner: userId.slice(0, 8),
      });

      // Clean up mutex after a delay
      setTimeout(() => matchMutexes.delete(matchId), 5000);

      return { ended: true, winnerId: userId };
    });
  },

  /**
   * Forfeit a match - forfeiting user loses, opponent wins
   * @param reason - "forfeit" for manual forfeit, "disconnect" for auto-forfeit on disconnect
   */
  async forfeit(
    matchId: string,
    forfeitingUserId: string,
    reason: "forfeit" | "disconnect" = "forfeit",
  ): Promise<{ success: boolean; winnerId?: string; error?: string }> {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: State machine requires multiple checks
    return matchMutexes.withLock(matchId, async () => {
      const match = await db.query.matches.findFirst({
        where: eq(matches.id, matchId),
        with: { players: true },
      });

      if (!match) return { success: false, error: "Match not found" };

      // Verify forfeiting user is in this match (security)
      const forfeitingPlayer = match.players.find((p) => p.userId === forfeitingUserId);
      if (!forfeitingPlayer) {
        logger.warn(
          "MatchEngine",
          `Forfeit denied - user ${forfeitingUserId.slice(0, 8)} not in match`,
        );
        return { success: false, error: "You are not in this match" };
      }

      // Can only forfeit from ACTIVE state
      if (match.status !== "ACTIVE") {
        return { success: false, error: `Cannot forfeit match in ${match.status} state` };
      }

      // Find opponent (the winner)
      const opponent = match.players.find((p) => p.userId !== forfeitingUserId);
      if (!opponent) {
        return { success: false, error: "Opponent not found" };
      }

      // Perform transition to COMPLETED
      clearTimer(matchId);

      await db
        .update(matches)
        .set({ status: "COMPLETED", winnerId: opponent.userId, endedAt: new Date() })
        .where(eq(matches.id, matchId));

      // Update ratings — skip entirely for solo TIMED mode
      if (match.mode !== "TIMED") {
        const winnerPlayer = match.players.find((p) => p.userId === opponent.userId);
        const loserPlayer = match.players.find((p) => p.userId === forfeitingUserId);
        if (winnerPlayer && loserPlayer) {
          const delta = calculateEloDelta(winnerPlayer.ratingBefore, loserPlayer.ratingBefore);
          await updatePlayerRating(winnerPlayer.userId, matchId, "WON", delta);
          await updatePlayerRating(loserPlayer.userId, matchId, "LOST", -delta);
        }
      }
      for (const p of match.players) socketEmit.clearUserMatch(p.userId);

      botEngine.cancel(matchId);
      socketEmit.matchEnd(matchId, { winnerId: opponent.userId, reason });
      logger.info("MatchEngine", `Match FORFEITED: ${matchId.slice(0, 8)}`, {
        forfeit: forfeitingUserId.slice(0, 8),
        winner: opponent.userId.slice(0, 8),
        reason,
      });

      setTimeout(() => matchMutexes.delete(matchId), 5000);

      return { success: true, winnerId: opponent.userId };
    });
  },

  /**
   * Abort a match - both players lose rating
   */
  async abort(
    matchId: string,
    reason: "timeout" | "disconnect" | "cancelled" = "timeout",
  ): Promise<{ success: boolean; error?: string }> {
    return matchMutexes.withLock(matchId, async () => {
      const match = await db.query.matches.findFirst({
        where: eq(matches.id, matchId),
        with: { players: true },
      });

      if (!match) return { success: false, error: "Match not found" };

      // Can abort from STARTING or ACTIVE
      if (!isValidTransition(match.status as MatchStatus, "ABORTED")) {
        return { success: false, error: `Cannot abort match in ${match.status} state` };
      }

      // Perform transition to ABORTED
      clearTimer(matchId);

      await db
        .update(matches)
        .set({ status: "ABORTED", endedAt: new Date() })
        .where(eq(matches.id, matchId));

      // Abort/timeout: record draw for competitive modes, skip entirely for TIMED (solo).
      for (const player of match.players) {
        if (match.status === "ACTIVE" && match.mode !== "TIMED") {
          await updatePlayerRating(player.userId, matchId, "DRAW", 0);
        }
        socketEmit.clearUserMatch(player.userId);
      }

      botEngine.cancel(matchId);
      socketEmit.matchEnd(matchId, { winnerId: null, reason });
      logger.info("MatchEngine", `Match ABORTED: ${matchId.slice(0, 8)}`, { reason });

      setTimeout(() => matchMutexes.delete(matchId), 5000);

      return { success: true };
    });
  },

  // Utility methods
  clearTimer,
  startTimer,
  activeTimerCount: () => matchTimers.size,
  activeMutexCount: () => matchMutexes.size(),
};
