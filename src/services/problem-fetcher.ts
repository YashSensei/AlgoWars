/**
 * Problem statement fetcher.
 * Fetches + parses Codeforces problem HTML and persists the result.
 * Used by matchmaking (lazy, on-demand) and scripts/fetch-statements.ts (batch warm-up).
 */

import { eq } from "drizzle-orm";
import { problems } from "../db/schema";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { MutexManager } from "../lib/mutex";

// One mutex per problem ID — prevents duplicate Codeforces fetches when two matches
// pick the same unfetched problem simultaneously. Second caller waits, then finds
// the statement already cached and returns without re-fetching.
const fetchMutexes = new MutexManager<string>();

export interface ParsedStatement {
  statement: string;
  timeLimit?: number;
  memoryLimit?: number;
}

// Clean HTML tags + entities into readable text
export function extractText(html: string): string {
  return html
    .replace(/<div class="section-title">[^<]*<\/div>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&le;/g, "≤")
    .replace(/&ge;/g, "≥")
    .replace(/&ne;/g, "≠")
    .replace(/\$\$\$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSamples(html: string): string {
  const inputMatches = html.matchAll(
    /<div class="input">\s*<div class="title">Input<\/div>\s*<pre>([\s\S]*?)<\/pre>/gi,
  );
  const outputMatches = html.matchAll(
    /<div class="output">\s*<div class="title">Output<\/div>\s*<pre>([\s\S]*?)<\/pre>/gi,
  );
  const inputs = Array.from(inputMatches).map((m) => extractText(m[1] ?? ""));
  const outputs = Array.from(outputMatches).map((m) => extractText(m[1] ?? ""));
  const samples: string[] = [];
  for (let i = 0; i < Math.max(inputs.length, outputs.length); i++) {
    samples.push(`Example ${i + 1}:`);
    if (inputs[i]) samples.push(`Input:\n${inputs[i]}`);
    if (outputs[i]) samples.push(`Output:\n${outputs[i]}`);
    samples.push("");
  }
  return samples.join("\n");
}

function parseLimits(html: string): { timeLimit?: number; memoryLimit?: number } {
  const t = html.match(/time limit per test<\/div>\s*<div[^>]*>(\d+)\s*second/i);
  const m = html.match(/memory limit per test<\/div>\s*<div[^>]*>(\d+)\s*megabyte/i);
  return {
    timeLimit: t?.[1] ? parseInt(t[1], 10) * 1000 : undefined,
    memoryLimit: m?.[1] ? parseInt(m[1], 10) * 1024 : undefined,
  };
}

interface SectionOffsets {
  main: number;
  input: number;
  output: number;
  samples: number;
  note: number;
}

function findOffsets(html: string): SectionOffsets {
  return {
    main: html.indexOf('<div class="problem-statement">'),
    input: html.indexOf('<div class="input-specification">'),
    output: html.indexOf('<div class="output-specification">'),
    samples: html.indexOf('<div class="sample-tests">'),
    note: html.indexOf('<div class="note">'),
  };
}

function sliceSection(html: string, start: number, endCandidates: number[]): string {
  if (start === -1) return "";
  const end = endCandidates.find((i) => i > start);
  if (!end || end === -1) return "";
  return html.substring(start, end);
}

function assembleSamplesBlock(html: string, o: SectionOffsets): string {
  if (o.samples === -1) return "";
  const end = o.note !== -1 ? o.note : html.indexOf("</div>", o.samples + 500);
  if (end === -1) return "";
  return `\n\n**Examples:**\n${extractSamples(html.substring(o.samples, end + 100))}`;
}

function assembleNoteBlock(html: string, o: SectionOffsets): string {
  if (o.note === -1) return "";
  const end = html.indexOf("</div>", o.note + 200);
  if (end === -1) return "";
  const body = extractText(html.substring(o.note, end));
  return body.length > 10 ? `\n\n**Note:**\n${body}` : "";
}

function buildStatement(html: string, o: SectionOffsets): string {
  const main = o.main !== -1 && o.input !== -1 ? extractText(html.substring(o.main, o.input)) : "";
  const input = sliceSection(html, o.input, [o.output, o.samples]);
  const output = sliceSection(html, o.output, [o.samples, o.note]);
  return [
    main,
    input && `\n\n**Input:**\n${extractText(input)}`,
    output && `\n\n**Output:**\n${extractText(output)}`,
    assembleSamplesBlock(html, o),
    assembleNoteBlock(html, o),
  ]
    .filter(Boolean)
    .join("");
}

export function parseStatement(html: string): ParsedStatement | null {
  try {
    const statement = buildStatement(html, findOffsets(html));
    if (statement.length < 50) return null;
    return { statement: statement.trim(), ...parseLimits(html) };
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function persistStatement(problemId: string, parsed: ParsedStatement): Promise<void> {
  await db
    .update(problems)
    .set({
      statement: parsed.statement,
      timeLimit: parsed.timeLimit,
      memoryLimit: parsed.memoryLimit,
      statementFetchedAt: new Date(),
    })
    .where(eq(problems.id, problemId));
}

async function fetchAndParse(problemId: string, url: string): Promise<ParsedStatement | null> {
  const html = await fetchHtml(url);
  if (!html) {
    logger.warn("ProblemFetcher", `Fetch failed`, { id: problemId });
    return null;
  }
  const parsed = parseStatement(html);
  if (!parsed) {
    logger.warn("ProblemFetcher", `Parse failed`, { id: problemId });
    return null;
  }
  return parsed;
}

/**
 * Fetch + parse + save the statement for a problem.
 * Idempotent — if the problem already has a statement, returns it without re-fetching.
 * Per-problem mutex prevents duplicate network fetches on concurrent calls.
 */
export async function fetchAndSaveStatement(problemId: string): Promise<ParsedStatement | null> {
  return fetchMutexes.withLock(problemId, async () => {
    const problem = await db.query.problems.findFirst({
      where: eq(problems.id, problemId),
      columns: { id: true, url: true, statement: true, timeLimit: true, memoryLimit: true },
    });
    if (!problem?.url) return null;
    if (problem.statement) {
      return {
        statement: problem.statement,
        timeLimit: problem.timeLimit ?? undefined,
        memoryLimit: problem.memoryLimit ?? undefined,
      };
    }
    const parsed = await fetchAndParse(problemId, problem.url);
    if (!parsed) return null;
    await persistStatement(problemId, parsed);
    return parsed;
  });
}
