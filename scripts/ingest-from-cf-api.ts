/**
 * Ingests problems directly from the Codeforces public API.
 * Use this when you don't have a local codeforces_scraped_problems/ directory.
 * Run with: bun scripts/ingest-from-cf-api.ts
 *
 * Does NOT fetch statements — statements are lazy-fetched at match time,
 * or you can pre-warm with scripts/fetch-statements.ts.
 */

import { problems } from "../src/db/schema";
import { db } from "../src/lib/db";

interface CfProblem {
  contestId: number;
  index: string;
  name: string;
  type: string;
  rating?: number;
  tags: string[];
}

interface CfProblemStatistic {
  contestId: number;
  index: string;
  solvedCount: number;
}

interface CfApiResponse {
  status: string;
  result: {
    problems: CfProblem[];
    problemStatistics: CfProblemStatistic[];
  };
}

const BATCH_SIZE = 500;

function getRatingBucket(rating: number): string {
  if (rating < 1200) return "0800-1199";
  if (rating < 1400) return "1200-1399";
  if (rating < 1600) return "1400-1599";
  if (rating < 1900) return "1600-1899";
  if (rating < 2100) return "1900-2099";
  if (rating < 2400) return "2100-2399";
  return "2400+";
}

async function fetchFromApi(): Promise<CfApiResponse> {
  console.log("🌐 Fetching problemset from Codeforces API...");
  const res = await fetch("https://codeforces.com/api/problemset.problems");
  if (!res.ok) throw new Error(`CF API returned ${res.status}`);
  const data = (await res.json()) as CfApiResponse;
  if (data.status !== "OK") throw new Error(`CF API status: ${data.status}`);
  return data;
}

function buildSolvedCountMap(stats: CfProblemStatistic[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of stats) map.set(`${s.contestId}${s.index}`, s.solvedCount);
  return map;
}

function toRow(p: CfProblem, solvedCount: number | undefined) {
  const externalId = `${p.contestId}${p.index}`;
  return {
    oj: "codeforces" as const,
    contestId: p.contestId,
    problemIndex: p.index,
    externalId,
    title: p.name,
    // biome-ignore lint/style/noNonNullAssertion: caller filters on typeof rating === "number"
    difficulty: p.rating!,
    // biome-ignore lint/style/noNonNullAssertion: caller filters on typeof rating === "number"
    ratingBucket: getRatingBucket(p.rating!),
    tags: p.tags,
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
    solvedCount,
  };
}

async function ingest() {
  const data = await fetchFromApi();
  const solvedMap = buildSolvedCountMap(data.result.problemStatistics);
  const rated = data.result.problems.filter((p) => typeof p.rating === "number");
  const skippedNoRating = data.result.problems.length - rated.length;
  const rows = rated.map((p) => toRow(p, solvedMap.get(`${p.contestId}${p.index}`)));
  console.log(`📥 ${rows.length} rated problems to insert (${skippedNoRating} unrated skipped).\n`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(problems).values(batch).onConflictDoNothing();
    console.log(`  ✓ Batched ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }

  console.log("\n✅ Done. Statements are lazy-fetched at match time (or run fetch-statements.ts).");
  process.exit(0);
}

ingest().catch((e) => {
  console.error("❌ Ingest failed:", e);
  process.exit(1);
});
