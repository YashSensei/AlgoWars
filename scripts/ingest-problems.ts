/**
 * Ingests problems from codeforces_scraped_problems/ into the database
 * Run with: bun scripts/ingest-problems.ts
 */

import { Glob } from "bun";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { problems } from "../src/db/schema";

interface ScrapedProblem {
  contest_id: number;
  problem_index: string;
  name: string;
  type: string;
  rating: number;
  tags: string[];
  problem_statement_link: string;
  scraped_at: string;
  points: number;
  solved_count: number;
}

function getRatingBucket(rating: number): string {
  if (rating < 1200) return "0800-1199";
  if (rating < 1400) return "1200-1399";
  if (rating < 1600) return "1400-1599";
  if (rating < 1900) return "1600-1899";
  if (rating < 2100) return "1900-2099";
  if (rating < 2400) return "2100-2399";
  return "2400+";
}

async function ingestProblems() {
  console.log("🔄 Starting problem ingestion...\n");

  const glob = new Glob("codeforces_scraped_problems/**/*.json");
  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  for await (const filePath of glob.scan(".")) {
    try {
      const content = await Bun.file(filePath).text();
      const data: ScrapedProblem = JSON.parse(content);

      const externalId = `${data.contest_id}${data.problem_index}`;

      // Check if already exists
      const existing = await db.query.problems.findFirst({
        where: eq(problems.externalId, externalId),
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Insert new problem
      await db.insert(problems).values({
        oj: "codeforces",
        contestId: data.contest_id,
        problemIndex: data.problem_index,
        externalId,
        title: data.name,
        difficulty: data.rating,
        ratingBucket: getRatingBucket(data.rating),
        tags: data.tags,
        url: data.problem_statement_link,
        solvedCount: data.solved_count,
        // statement, timeLimit, memoryLimit will be lazy-fetched later
      });

      ingested++;

      if (ingested % 10 === 0) {
        console.log(`  ✓ Ingested ${ingested} problems...`);
      }
    } catch (err) {
      errors++;
      console.error(`  ✗ Error processing ${filePath}:`, err);
    }
  }

  console.log("\n📊 Ingestion Summary:");
  console.log(`  ✅ Ingested: ${ingested}`);
  console.log(`  ⏭️  Skipped (already exist): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);

  // Show count by rating bucket
  const bucketCounts = await db
    .select({ bucket: problems.ratingBucket })
    .from(problems);

  const buckets: Record<string, number> = {};
  for (const row of bucketCounts) {
    const bucket = row.bucket ?? "unknown";
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
  }

  console.log("\n📈 Problems by Rating Bucket:");
  for (const [bucket, count] of Object.entries(buckets).sort()) {
    console.log(`  ${bucket}: ${count}`);
  }

  process.exit(0);
}

ingestProblems().catch((e) => {
  console.error("❌ Ingestion failed:", e);
  process.exit(1);
});
