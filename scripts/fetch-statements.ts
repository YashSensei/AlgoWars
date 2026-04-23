/**
 * Batch warm-up of problem statements.
 * Matchmaking lazy-fetches on demand, but pre-warming avoids the ~3s latency
 * on the first match that uses each problem.
 *
 * Run with: bun scripts/fetch-statements.ts
 * Rate limit: 1 request per 2.5s (Codeforces limit). Takes ~4 minutes for defaults.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { problems } from "../src/db/schema";
import { db } from "../src/lib/db";
import { fetchAndSaveStatement } from "../src/services/problem-fetcher";

const DELAY_MS = 2500;
const BUCKETS = ["0800-1199", "1200-1399"];
const LIMIT_PER_BUCKET = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function warmBucket(bucket: string, limit: number) {
  const toFetch = await db
    .select({ id: problems.id, externalId: problems.externalId, title: problems.title })
    .from(problems)
    .where(and(eq(problems.ratingBucket, bucket), isNull(problems.statement)))
    .limit(limit);

  console.log(`\n📥 Bucket ${bucket}: ${toFetch.length} problems to warm up.`);

  let success = 0;
  let failed = 0;
  for (let i = 0; i < toFetch.length; i++) {
    const p = toFetch[i];
    if (!p) continue;
    process.stdout.write(`  [${i + 1}/${toFetch.length}] ${p.externalId} ${p.title.slice(0, 40)}... `);
    const result = await fetchAndSaveStatement(p.id);
    if (result) {
      console.log(`✅ (${result.statement.length} chars)`);
      success++;
    } else {
      console.log("❌");
      failed++;
    }
    if (i < toFetch.length - 1) await sleep(DELAY_MS);
  }
  return { success, failed };
}

async function main() {
  console.log("═".repeat(60));
  console.log("🚀 Codeforces Problem Statement Pre-Warmer");
  console.log(`   Rate: 1 req/${DELAY_MS / 1000}s. Buckets: ${BUCKETS.join(", ")}. Limit: ${LIMIT_PER_BUCKET}/bucket.`);
  console.log("═".repeat(60));

  const startTime = Date.now();
  let totalSuccess = 0;
  let totalFailed = 0;
  for (const bucket of BUCKETS) {
    const r = await warmBucket(bucket, LIMIT_PER_BUCKET);
    totalSuccess += r.success;
    totalFailed += r.failed;
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n✅ ${totalSuccess} succeeded, ❌ ${totalFailed} failed, ⏱  ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);

  const stats = await db
    .select({
      bucket: problems.ratingBucket,
      total: sql<number>`count(*)`,
      withStatement: sql<number>`count(${problems.statement})`,
    })
    .from(problems)
    .groupBy(problems.ratingBucket);

  console.log("\n📈 Current state:");
  for (const row of stats) console.log(`  ${row.bucket}: ${row.withStatement}/${row.total}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
