/**
 * Bot Engine — creates the illusion of a real opponent when no match is found.
 *
 * After matchmaking pairs a real player with a bot account:
 * 1. Emits 1-2 fake WRONG_ANSWER submissions at random intervals (sells the illusion)
 * 2. Submits ACCEPTED at a random time between 5-10 minutes
 * 3. Sources real code for the ACCEPTED submission (reuses prior solution or generates via Claude)
 * 4. If the real player wins first, all bot timers are cancelled cleanly
 */

import { eq } from "drizzle-orm";
import { matches, problems, submissions } from "../db/schema";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { socketEmit } from "../socket";
import { FALLBACK_MARKER, generateSolution } from "./bot-solver";
import { matchEngine } from "./match-engine";

interface BotMatchState {
  matchId: string;
  botUserId: string;
  problemId: string;
  timers: ReturnType<typeof setTimeout>[];
  cancelled: boolean;
}

const activeBots = new Map<string, BotMatchState>();

function randomBetween(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

function scheduleWrongSubmissions(state: BotMatchState): void {
  const count = Math.random() > 0.5 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const delay = randomBetween(60_000, 240_000);
    const timer = setTimeout(() => {
      if (state.cancelled) return;
      socketEmit.matchSubmission(state.matchId, {
        userId: state.botUserId,
        verdict: "WRONG_ANSWER",
      });
      logger.debug("BotEngine", `Fake WRONG_ANSWER emitted`, {
        match: state.matchId.slice(0, 8),
      });
    }, delay);
    state.timers.push(timer);
  }
}

async function findExistingSolution(problemId: string): Promise<string | null> {
  // Find any ACCEPTED submission from a previous match that used this problem.
  // Skip fallback solutions (marker comment) — those are garbage placeholder code.
  const matchWithSolution = await db.query.matches.findFirst({
    where: eq(matches.problemId, problemId),
    with: {
      submissions: {
        where: eq(submissions.verdict, "ACCEPTED"),
        columns: { code: true },
        limit: 1,
      },
    },
  });
  const code = matchWithSolution?.submissions[0]?.code;
  if (!code || code.startsWith(FALLBACK_MARKER)) return null;
  return code;
}

async function getOrGenerateSolution(problemId: string, problemStatement: string): Promise<string> {
  const existing = await findExistingSolution(problemId);
  if (existing) {
    logger.debug("BotEngine", "Reusing prior solution");
    return existing;
  }
  return generateSolution(problemStatement);
}

async function executeBotSolve(state: BotMatchState): Promise<void> {
  if (state.cancelled) return;

  const problem = await db.query.problems.findFirst({
    where: eq(problems.id, state.problemId),
    columns: { id: true, statement: true, title: true },
  });

  if (!problem?.statement) {
    logger.warn("BotEngine", "No statement for bot solve", { match: state.matchId.slice(0, 8) });
    return;
  }

  const code = await getOrGenerateSolution(state.problemId, problem.statement);
  if (state.cancelled) return;

  // Insert a real submission row so it shows on the results page
  await db.insert(submissions).values({
    matchId: state.matchId,
    userId: state.botUserId,
    code,
    language: "python3",
    verdict: "ACCEPTED",
    judgedAt: new Date(),
  });

  // Process verdict through the match engine (handles state transition + rating)
  await matchEngine.processVerdict(state.matchId, state.botUserId, "ACCEPTED");
  logger.info("BotEngine", `Bot solved`, { match: state.matchId.slice(0, 8) });
  cleanup(state.matchId);
}

function cleanup(matchId: string): void {
  const state = activeBots.get(matchId);
  if (!state) return;
  state.cancelled = true;
  for (const t of state.timers) clearTimeout(t);
  activeBots.delete(matchId);
}

export const botEngine = {
  /**
   * Start bot behavior for a match. Call after match is created with a bot player.
   */
  start(matchId: string, botUserId: string, problemId: string): void {
    const state: BotMatchState = {
      matchId,
      botUserId,
      problemId,
      timers: [],
      cancelled: false,
    };
    activeBots.set(matchId, state);

    // Schedule 1-2 fake wrong submissions (1-4 min mark)
    scheduleWrongSubmissions(state);

    // Schedule the ACCEPTED solve at random 5-10 min mark
    const solveDelay = randomBetween(5 * 60_000, 10 * 60_000);
    const solveTimer = setTimeout(() => executeBotSolve(state), solveDelay);
    state.timers.push(solveTimer);

    logger.info("BotEngine", `Bot activated for match ${matchId.slice(0, 8)}`, {
      solveAt: `${Math.round(solveDelay / 1000)}s`,
    });
  },

  /**
   * Cancel bot for a match (real player won, or match aborted).
   */
  cancel(matchId: string): void {
    cleanup(matchId);
  },

  /** Check if a match has an active bot */
  isActive(matchId: string): boolean {
    return activeBots.has(matchId);
  },
};
