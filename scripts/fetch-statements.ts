/**
 * Fetch problem statements from Codeforces (background task)
 * Run with: bun scripts/fetch-statements.ts
 *
 * Rate limit: 1 request per 2 seconds (Codeforces limit)
 * This script runs continuously until all problems are fetched.
 */

import { eq, isNull, and, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { problems } from "../src/db/schema";

const DELAY_MS = 2500; // 2.5 seconds between requests (safe margin)
const BUCKETS = ["0800-1199", "1200-1399"];
const LIMIT_PER_BUCKET = 50;

// Parse problem statement from Codeforces HTML
function parseStatement(html: string): { statement: string; timeLimit?: number; memoryLimit?: number } | null {
  try {
    // Extract time limit (e.g., "2 seconds")
    const timeLimitMatch = html.match(/time limit per test<\/div>\s*<div[^>]*>(\d+)\s*second/i);
    const timeLimit = timeLimitMatch ? parseInt(timeLimitMatch[1]) * 1000 : undefined;

    // Extract memory limit (e.g., "256 megabytes")
    const memoryLimitMatch = html.match(/memory limit per test<\/div>\s*<div[^>]*>(\d+)\s*megabyte/i);
    const memoryLimit = memoryLimitMatch ? parseInt(memoryLimitMatch[1]) * 1024 : undefined;

    // Extract problem statement sections
    let statement = "";

    // Main statement
    const headerMatch = html.match(/<div class="header">[\s\S]*?<\/div>\s*<div>/);
    const statementStart = html.indexOf('<div class="problem-statement">');
    const inputSpecStart = html.indexOf('<div class="input-specification">');
    const outputSpecStart = html.indexOf('<div class="output-specification">');
    const sampleTestsStart = html.indexOf('<div class="sample-tests">');
    const noteStart = html.indexOf('<div class="note">');

    // Get main problem text (between header and input-specification)
    if (statementStart !== -1 && inputSpecStart !== -1) {
      const mainText = html.substring(statementStart, inputSpecStart);
      statement += extractText(mainText);
    }

    // Input specification
    if (inputSpecStart !== -1) {
      const endPos = outputSpecStart !== -1 ? outputSpecStart : sampleTestsStart;
      if (endPos !== -1) {
        const inputText = html.substring(inputSpecStart, endPos);
        statement += "\n\n**Input:**\n" + extractText(inputText);
      }
    }

    // Output specification
    if (outputSpecStart !== -1) {
      const endPos = sampleTestsStart !== -1 ? sampleTestsStart : noteStart;
      if (endPos !== -1) {
        const outputText = html.substring(outputSpecStart, endPos);
        statement += "\n\n**Output:**\n" + extractText(outputText);
      }
    }

    // Sample tests
    if (sampleTestsStart !== -1) {
      const endPos = noteStart !== -1 ? noteStart : html.indexOf('</div>', sampleTestsStart + 500);
      if (endPos !== -1) {
        const sampleText = html.substring(sampleTestsStart, endPos + 100);
        statement += "\n\n**Examples:**\n" + extractSamples(sampleText);
      }
    }

    // Note section
    if (noteStart !== -1) {
      const noteEnd = html.indexOf('</div>', noteStart + 200);
      if (noteEnd !== -1) {
        const noteText = html.substring(noteStart, noteEnd);
        const noteContent = extractText(noteText);
        if (noteContent.length > 10) {
          statement += "\n\n**Note:**\n" + noteContent;
        }
      }
    }

    if (!statement || statement.length < 50) {
      return null;
    }

    return { statement: statement.trim(), timeLimit, memoryLimit };
  } catch {
    return null;
  }
}

// Extract text from HTML, cleaning tags
function extractText(html: string): string {
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

// Extract sample input/output
function extractSamples(html: string): string {
  const samples: string[] = [];

  // Find all input-output pairs
  const inputMatches = html.matchAll(/<div class="input">\s*<div class="title">Input<\/div>\s*<pre>([\s\S]*?)<\/pre>/gi);
  const outputMatches = html.matchAll(/<div class="output">\s*<div class="title">Output<\/div>\s*<pre>([\s\S]*?)<\/pre>/gi);

  const inputs = Array.from(inputMatches).map(m => extractText(m[1]));
  const outputs = Array.from(outputMatches).map(m => extractText(m[1]));

  for (let i = 0; i < Math.max(inputs.length, outputs.length); i++) {
    samples.push(`Example ${i + 1}:`);
    if (inputs[i]) samples.push(`Input:\n${inputs[i]}`);
    if (outputs[i]) samples.push(`Output:\n${outputs[i]}`);
    samples.push("");
  }

  return samples.join("\n");
}

// Fetch a single problem
async function fetchProblem(url: string): Promise<{ statement: string; timeLimit?: number; memoryLimit?: number } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return parseStatement(html);
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchStatements(bucket: string, limit: number) {
  console.log(`\n📥 Bucket ${bucket}: Fetching up to ${limit} problems...\n`);

  const toFetch = await db
    .select({ id: problems.id, url: problems.url, title: problems.title, externalId: problems.externalId })
    .from(problems)
    .where(and(eq(problems.ratingBucket, bucket), isNull(problems.statement)))
    .limit(limit);

  if (toFetch.length === 0) {
    console.log(`  ✅ All problems in this bucket already have statements!`);
    return { success: 0, failed: 0 };
  }

  console.log(`  Found ${toFetch.length} problems without statements\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const problem = toFetch[i];
    if (!problem.url) {
      failed++;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${toFetch.length}] ${problem.externalId} ${problem.title.substring(0, 40)}... `);

    const result = await fetchProblem(problem.url);

    if (result?.statement) {
      await db
        .update(problems)
        .set({
          statement: result.statement,
          timeLimit: result.timeLimit,
          memoryLimit: result.memoryLimit,
          statementFetchedAt: new Date(),
        })
        .where(eq(problems.id, problem.id));
      console.log(`✅ (${result.statement.length} chars)`);
      success++;
    } else {
      console.log(`❌ Failed`);
      failed++;
    }

    // Rate limit - wait before next request
    if (i < toFetch.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  return { success, failed };
}

async function main() {
  console.log("═".repeat(60));
  console.log("🚀 Codeforces Problem Statement Fetcher");
  console.log("═".repeat(60));
  console.log(`Rate limit: 1 request per ${DELAY_MS / 1000}s`);
  console.log(`Target: ${LIMIT_PER_BUCKET} problems per bucket`);
  console.log(`Buckets: ${BUCKETS.join(", ")}`);
  console.log("═".repeat(60));

  const startTime = Date.now();
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const bucket of BUCKETS) {
    const result = await fetchStatements(bucket, LIMIT_PER_BUCKET);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log("\n" + "═".repeat(60));
  console.log("📊 SUMMARY");
  console.log("═".repeat(60));
  console.log(`  ✅ Successfully fetched: ${totalSuccess}`);
  console.log(`  ❌ Failed: ${totalFailed}`);
  console.log(`  ⏱️  Time elapsed: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log("═".repeat(60));

  // Show current DB stats
  const stats = await db
    .select({
      bucket: problems.ratingBucket,
      total: sql<number>`count(*)`,
      withStatement: sql<number>`count(${problems.statement})`,
    })
    .from(problems)
    .groupBy(problems.ratingBucket);

  console.log("\n📈 Database Stats:");
  for (const row of stats) {
    console.log(`  ${row.bucket}: ${row.withStatement}/${row.total} have statements`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
