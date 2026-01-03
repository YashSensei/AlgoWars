/**
 * Submission Routes
 * POST /submissions - Submit code for a match
 * GET /submissions/status - Check current submission status
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { matches, matchPlayers, submissions } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { authMiddleware } from "../middleware/auth";
import { matchEngine } from "../services/match-engine";
import { type Language, submissionQueue } from "../services/submission-queue";

export const submissionRoutes = new Hono();

// All routes require auth
submissionRoutes.use("*", authMiddleware);

const submitSchema = z.object({
  matchId: z.string().uuid(),
  code: z.string().min(1).max(65536),
  language: z.enum(["cpp17", "cpp20", "python3", "java17", "pypy3"] as const),
});

/**
 * POST /submissions
 * Submit code for judging in a match (uses AI judge)
 */
submissionRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = submitSchema.safeParse(body);

  if (!parsed.success) {
    throw Errors.BadRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { matchId, code, language } = parsed.data;

  // Verify match exists and is active
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: { problem: true },
  });

  if (!match) throw Errors.NotFound("Match");
  if (match.status !== "ACTIVE") {
    throw Errors.BadRequest("Match is not active");
  }
  if (!match.problem) {
    throw Errors.BadRequest("Match has no assigned problem");
  }

  // Verify user is a player in this match
  const player = await db.query.matchPlayers.findFirst({
    where: and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, user.id)),
  });

  if (!player) {
    throw Errors.Forbidden("You are not a player in this match");
  }

  // Build problem statement for AI judge
  const problemStatement = buildProblemStatement(match.problem);

  // Submit to AI judge queue
  const queueResult = await submissionQueue.submit({
    userId: user.id,
    problemId: match.problem.id,
    problemStatement,
    code,
    language: language as Language,
  });

  if (queueResult.status === "busy") {
    return c.json({ status: "busy", message: "Judge is processing another submission" }, 429);
  }

  if (queueResult.error) {
    throw Errors.BadRequest(queueResult.error);
  }

  // Determine verdict for DB (AI judge returns immediately)
  const verdictStr = queueResult.verdict?.verdict ?? "PENDING";
  const dbVerdict = mapVerdictToEnum(verdictStr);

  // Store submission in database
  const [submission] = await db
    .insert(submissions)
    .values({
      matchId,
      userId: user.id,
      code,
      language,
      vjudgeRunId: queueResult.submissionId,
      verdict: dbVerdict,
      judgedAt: queueResult.verdict?.isFinal ? new Date() : undefined,
    })
    .returning({ id: submissions.id });

  // Check if ACCEPTED → end match with winner
  const matchResult = await matchEngine.processVerdict(matchId, user.id, verdictStr);

  return c.json(
    {
      status: "complete",
      submissionId: submission?.id,
      verdict: queueResult.verdict?.verdict,
      feedback: queueResult.verdict?.feedback,
      confidence: queueResult.verdict?.confidence,
      matchEnded: matchResult.ended,
      winnerId: matchResult.winnerId,
    },
    201,
  );
});

/**
 * GET /submissions/status
 * Get current submission status
 */
submissionRoutes.get("/status", async (c) => {
  const result = await submissionQueue.pollResult();
  return c.json(result);
});

/**
 * GET /submissions/:id
 * Get a specific submission by ID
 */
submissionRoutes.get("/:id", async (c) => {
  const { id } = c.req.param();

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, id),
    columns: {
      id: true,
      matchId: true,
      userId: true,
      language: true,
      verdict: true,
      runtime: true,
      memory: true,
      submittedAt: true,
      judgedAt: true,
    },
  });

  if (!submission) throw Errors.NotFound("Submission");

  return c.json(submission);
});

// Helper: Build problem statement for AI judge
function buildProblemStatement(problem: {
  title: string;
  statement?: string | null;
  url?: string | null;
  difficulty?: number | null;
  tags?: string[] | null;
}): string {
  let statement = `# ${problem.title}\n\n`;

  if (problem.difficulty) {
    statement += `Difficulty: ${problem.difficulty}\n\n`;
  }

  if (problem.statement) {
    statement += problem.statement;
  } else if (problem.url) {
    statement += `Problem URL: ${problem.url}\n`;
    statement += `(Full statement not available - judge based on standard competitive programming expectations)`;
  }

  if (problem.tags?.length) {
    statement += `\n\nTags: ${problem.tags.join(", ")}`;
  }

  return statement;
}

// Helper: Map verdict string to DB enum
function mapVerdictToEnum(verdict: string): (typeof submissions.verdict.enumValues)[number] {
  const mapping: Record<string, (typeof submissions.verdict.enumValues)[number]> = {
    ACCEPTED: "ACCEPTED",
    WRONG_ANSWER: "WRONG_ANSWER",
    RUNTIME_ERROR: "RUNTIME_ERROR",
    COMPILE_ERROR: "COMPILE_ERROR",
    TIME_LIMIT: "TIME_LIMIT",
    MEMORY_LIMIT: "MEMORY_LIMIT",
    INVALID_CODE: "WRONG_ANSWER",
  };
  return mapping[verdict] ?? "PENDING";
}
