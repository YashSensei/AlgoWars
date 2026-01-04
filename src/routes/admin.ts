/**
 * Admin Routes
 * Protected routes requiring ADMIN role
 *
 * Problem Management:
 *   GET  /admin/problems          - List problems with stats
 *   GET  /admin/problems/stats    - Get problem database stats
 *   POST /admin/problems/:id/fetch - Fetch statement for a single problem
 *
 * Match Management:
 *   POST /admin/matches/:id/abort - Force-end a match
 *
 * User Management:
 *   POST /admin/users/:id/rating  - Adjust user rating
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { matches, problems, userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { logger } from "../lib/logger";
import { adminMiddleware, authMiddleware } from "../middleware/auth";
import { matchEngine } from "../services/match-engine";

export const adminRoutes = new Hono();

// All admin routes require auth + admin role
adminRoutes.use("*", authMiddleware);
adminRoutes.use("*", adminMiddleware);

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

// ============================================================================
// PROBLEM MANAGEMENT
// ============================================================================

/**
 * GET /admin/problems
 * List problems with pagination and filters
 */
adminRoutes.get("/problems", async (c) => {
  const { bucket, hasStatement, limit = "50", offset = "0" } = c.req.query();

  const conditions = [];
  if (bucket) conditions.push(eq(problems.ratingBucket, bucket));
  if (hasStatement === "true") conditions.push(sql`${problems.statement} IS NOT NULL`);
  if (hasStatement === "false") conditions.push(isNull(problems.statement));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [problemList, countResult] = await Promise.all([
    db.query.problems.findMany({
      where: whereClause,
      columns: {
        id: true,
        externalId: true,
        title: true,
        difficulty: true,
        ratingBucket: true,
        url: true,
        statementFetchedAt: true,
      },
      limit: Math.min(Number(limit), 100),
      offset: Number(offset),
      orderBy: (p, { desc }) => [desc(p.cachedAt)],
    }),
    db.select({ count: sql<number>`count(*)` }).from(problems).where(whereClause),
  ]);

  return c.json({
    problems: problemList.map((p) => ({
      ...p,
      hasStatement: !!p.statementFetchedAt,
    })),
    total: countResult[0]?.count ?? 0,
    limit: Number(limit),
    offset: Number(offset),
  });
});

/**
 * GET /admin/problems/stats
 * Get problem database statistics by rating bucket
 */
adminRoutes.get("/problems/stats", async (c) => {
  const stats = await db
    .select({
      bucket: problems.ratingBucket,
      total: sql<number>`count(*)`,
      withStatement: sql<number>`count(${problems.statement})`,
    })
    .from(problems)
    .groupBy(problems.ratingBucket);

  const totals = stats.reduce(
    (acc, row) => ({
      total: acc.total + Number(row.total),
      withStatement: acc.withStatement + Number(row.withStatement),
    }),
    { total: 0, withStatement: 0 },
  );

  return c.json({
    byBucket: stats.map((s) => ({
      bucket: s.bucket ?? "unknown",
      total: Number(s.total),
      withStatement: Number(s.withStatement),
      coverage:
        Number(s.total) > 0 ? Math.round((Number(s.withStatement) / Number(s.total)) * 100) : 0,
    })),
    totals: {
      ...totals,
      coverage: totals.total > 0 ? Math.round((totals.withStatement / totals.total) * 100) : 0,
    },
  });
});

/**
 * POST /admin/problems/:id/fetch
 * Fetch statement for a single problem from Codeforces
 */
adminRoutes.post("/problems/:id/fetch", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid problem ID");

  const problem = await db.query.problems.findFirst({
    where: eq(problems.id, id),
  });

  if (!problem) throw Errors.NotFound("Problem");
  if (!problem.url) throw Errors.BadRequest("Problem has no URL");

  logger.info("Admin", `Fetching statement for ${problem.externalId}`, {
    admin: c.get("user").username,
  });

  const result = await fetchProblemStatement(problem.url);
  if (!result) {
    throw Errors.BadRequest("Failed to fetch statement from Codeforces");
  }

  await db
    .update(problems)
    .set({
      statement: result.statement,
      timeLimit: result.timeLimit,
      memoryLimit: result.memoryLimit,
      statementFetchedAt: new Date(),
    })
    .where(eq(problems.id, id));

  return c.json({
    success: true,
    problemId: id,
    externalId: problem.externalId,
    statementLength: result.statement.length,
  });
});

// ============================================================================
// MATCH MANAGEMENT
// ============================================================================

/**
 * POST /admin/matches/:id/abort
 * Force-end a match (aborts it)
 */
adminRoutes.post("/matches/:id/abort", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid match ID");

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, id),
    columns: { id: true, status: true },
  });

  if (!match) throw Errors.NotFound("Match");

  logger.info("Admin", `Force-aborting match ${id.slice(0, 8)}`, { admin: c.get("user").username });

  const result = await matchEngine.abort(id, "cancelled");

  if (!result.success) {
    throw Errors.BadRequest(result.error ?? "Cannot abort match");
  }

  return c.json({ success: true, matchId: id, previousStatus: match.status });
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

const ratingAdjustSchema = z.object({
  delta: z.number().int().min(-500).max(500),
  reason: z.string().min(1).max(255),
});

/**
 * POST /admin/users/:id/rating
 * Adjust a user's rating
 */
adminRoutes.post("/users/:id/rating", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid user ID");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = ratingAdjustSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.BadRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { delta, reason } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, username: true },
  });

  if (!user) throw Errors.NotFound("User");

  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, id),
  });

  if (!stats) throw Errors.NotFound("User stats");

  const newRating = Math.max(0, stats.rating + delta);

  await db.update(userStats).set({ rating: newRating }).where(eq(userStats.userId, id));

  logger.info("Admin", `Rating adjusted: ${user.username} ${delta > 0 ? "+" : ""}${delta}`, {
    admin: c.get("user").username,
    reason,
    oldRating: stats.rating,
    newRating,
  });

  return c.json({
    success: true,
    userId: id,
    username: user.username,
    oldRating: stats.rating,
    newRating,
    delta,
    reason,
  });
});

// ============================================================================
// HELPERS
// ============================================================================

// Fetch problem statement from Codeforces
async function fetchProblemStatement(
  url: string,
): Promise<{ statement: string; timeLimit?: number; memoryLimit?: number } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    return parseStatement(html);
  } catch {
    return null;
  }
}

// Extract time and memory limits from HTML
function extractLimits(html: string): { timeLimit?: number; memoryLimit?: number } {
  const timeLimitMatch = html.match(/time limit per test<\/div>\s*<div[^>]*>(\d+)\s*second/i);
  const timeLimit = timeLimitMatch?.[1] ? Number.parseInt(timeLimitMatch[1], 10) * 1000 : undefined;

  const memoryLimitMatch = html.match(/memory limit per test<\/div>\s*<div[^>]*>(\d+)\s*megabyte/i);
  const memoryLimit = memoryLimitMatch?.[1]
    ? Number.parseInt(memoryLimitMatch[1], 10) * 1024
    : undefined;

  return { timeLimit, memoryLimit };
}

// Find section positions in HTML
function findSectionPositions(html: string) {
  return {
    statementStart: html.indexOf('<div class="problem-statement">'),
    inputSpecStart: html.indexOf('<div class="input-specification">'),
    outputSpecStart: html.indexOf('<div class="output-specification">'),
    sampleTestsStart: html.indexOf('<div class="sample-tests">'),
    noteStart: html.indexOf('<div class="note">'),
  };
}

// Build statement from sections
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: HTML section extraction requires conditional logic
function buildStatementFromSections(
  html: string,
  pos: ReturnType<typeof findSectionPositions>,
): string {
  let statement = "";

  if (pos.statementStart !== -1 && pos.inputSpecStart !== -1) {
    statement += extractText(html.substring(pos.statementStart, pos.inputSpecStart));
  }

  if (pos.inputSpecStart !== -1) {
    const endPos = pos.outputSpecStart !== -1 ? pos.outputSpecStart : pos.sampleTestsStart;
    if (endPos !== -1)
      statement += `\n\n**Input:**\n${extractText(html.substring(pos.inputSpecStart, endPos))}`;
  }

  if (pos.outputSpecStart !== -1) {
    const endPos = pos.sampleTestsStart !== -1 ? pos.sampleTestsStart : pos.noteStart;
    if (endPos !== -1)
      statement += `\n\n**Output:**\n${extractText(html.substring(pos.outputSpecStart, endPos))}`;
  }

  if (pos.sampleTestsStart !== -1) {
    const endPos =
      pos.noteStart !== -1 ? pos.noteStart : html.indexOf("</div>", pos.sampleTestsStart + 500);
    if (endPos !== -1)
      statement += `\n\n**Examples:**\n${extractSamples(html.substring(pos.sampleTestsStart, endPos))}`;
  }

  if (pos.noteStart !== -1) {
    const noteEnd = html.indexOf("</div>", pos.noteStart + 200);
    if (noteEnd !== -1) {
      const noteContent = extractText(html.substring(pos.noteStart, noteEnd));
      if (noteContent.length > 10) statement += `\n\n**Note:**\n${noteContent}`;
    }
  }

  return statement;
}

// Parse statement from Codeforces HTML
function parseStatement(
  html: string,
): { statement: string; timeLimit?: number; memoryLimit?: number } | null {
  try {
    const limits = extractLimits(html);
    const positions = findSectionPositions(html);
    const statement = buildStatementFromSections(html, positions);

    return statement.length > 50 ? { statement: statement.trim(), ...limits } : null;
  } catch {
    return null;
  }
}

// Extract text from HTML
function extractText(html: string): string {
  return html
    .replace(/<div class="section-title">[^<]*<\/div>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&le;/g, "≤")
    .replace(/&ge;/g, "≥")
    .replace(/\$\$\$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extract sample input/output
function extractSamples(html: string): string {
  const samples: string[] = [];
  const inputMatches = html.matchAll(
    /<div class="input">\s*<div class="title">Input<\/div>\s*<pre>([\s\S]*?)<\/pre>/gi,
  );
  const outputMatches = html.matchAll(
    /<div class="output">\s*<div class="title">Output<\/div>\s*<pre>([\s\S]*?)<\/pre>/gi,
  );

  const inputs = Array.from(inputMatches).map((m) => extractText(m[1] ?? ""));
  const outputs = Array.from(outputMatches).map((m) => extractText(m[1] ?? ""));

  for (let i = 0; i < Math.max(inputs.length, outputs.length); i++) {
    samples.push(`Example ${i + 1}:`);
    if (inputs[i]) samples.push(`Input:\n${inputs[i]}`);
    if (outputs[i]) samples.push(`Output:\n${outputs[i]}`);
  }
  return samples.join("\n");
}
