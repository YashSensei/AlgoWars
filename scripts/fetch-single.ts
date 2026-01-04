/**
 * Fetch a single problem statement from Codeforces
 *
 * Usage:
 *   bun scripts/fetch-single.ts 1A          # by external ID
 *   bun scripts/fetch-single.ts 1/A         # by contest/index
 *   bun scripts/fetch-single.ts 4A
 */

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { problems } from "../src/db/schema";

// Parse problem statement from Codeforces HTML
function parseStatement(html: string): { statement: string; timeLimit?: number; memoryLimit?: number } | null {
  try {
    let statement = "";
    const statementStart = html.indexOf('<div class="problem-statement">');
    const inputSpecStart = html.indexOf('<div class="input-specification">');
    const outputSpecStart = html.indexOf('<div class="output-specification">');
    const sampleTestsStart = html.indexOf('<div class="sample-tests">');
    const noteStart = html.indexOf('<div class="note">');

    if (statementStart !== -1 && inputSpecStart !== -1) {
      statement += extractText(html.substring(statementStart, inputSpecStart));
    }

    if (inputSpecStart !== -1) {
      const endPos = outputSpecStart !== -1 ? outputSpecStart : sampleTestsStart;
      if (endPos !== -1) {
        statement += "\n\n**Input:**\n" + extractText(html.substring(inputSpecStart, endPos));
      }
    }

    if (outputSpecStart !== -1) {
      const endPos = sampleTestsStart !== -1 ? sampleTestsStart : noteStart;
      if (endPos !== -1) {
        statement += "\n\n**Output:**\n" + extractText(html.substring(outputSpecStart, endPos));
      }
    }

    if (sampleTestsStart !== -1) {
      const endPos = noteStart !== -1 ? noteStart : html.indexOf('</div>', sampleTestsStart + 500);
      if (endPos !== -1) {
        statement += "\n\n**Examples:**\n" + extractSamples(html.substring(sampleTestsStart, endPos + 100));
      }
    }

    if (noteStart !== -1) {
      const noteEnd = html.indexOf('</div>', noteStart + 200);
      if (noteEnd !== -1) {
        const noteContent = extractText(html.substring(noteStart, noteEnd));
        if (noteContent.length > 10) {
          statement += "\n\n**Note:**\n" + noteContent;
        }
      }
    }

    return statement.length > 50 ? { statement: statement.trim() } : null;
  } catch {
    return null;
  }
}

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
    .replace(/&apos;/g, "'")
    .replace(/&le;/g, "≤")
    .replace(/&ge;/g, "≥")
    .replace(/\$\$\$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSamples(html: string): string {
  const samples: string[] = [];
  const inputMatches = html.matchAll(/<div class="input">\s*<div class="title">Input<\/div>\s*<pre>([\s\S]*?)<\/pre>/gi);
  const outputMatches = html.matchAll(/<div class="output">\s*<div class="title">Output<\/div>\s*<pre>([\s\S]*?)<\/pre>/gi);
  const inputs = Array.from(inputMatches).map(m => extractText(m[1]));
  const outputs = Array.from(outputMatches).map(m => extractText(m[1]));

  for (let i = 0; i < Math.max(inputs.length, outputs.length); i++) {
    samples.push(`Example ${i + 1}:`);
    if (inputs[i]) samples.push(`Input:\n${inputs[i]}`);
    if (outputs[i]) samples.push(`Output:\n${outputs[i]}`);
  }
  return samples.join("\n");
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log("Usage: bun scripts/fetch-single.ts <problemId>");
    console.log("Examples:");
    console.log("  bun scripts/fetch-single.ts 1A");
    console.log("  bun scripts/fetch-single.ts 4A");
    console.log("  bun scripts/fetch-single.ts 71A");
    process.exit(1);
  }

  // Normalize input: "1/A" -> "1A", "1A" -> "1A"
  const externalId = arg.replace("/", "").toUpperCase();

  console.log(`\n🔍 Looking for problem: ${externalId}\n`);

  // Find problem in DB
  const problem = await db.query.problems.findFirst({
    where: eq(problems.externalId, externalId),
  });

  if (!problem) {
    console.log(`❌ Problem ${externalId} not found in database`);
    console.log("Make sure you've run: bun scripts/ingest-problems.ts");
    process.exit(1);
  }

  console.log(`📄 Found: ${problem.title}`);
  console.log(`🔗 URL: ${problem.url}`);

  if (problem.statement) {
    console.log(`\n⚠️  Already has statement (${problem.statement.length} chars)`);
    console.log("\n─".repeat(40));
    console.log(problem.statement.substring(0, 500) + "...");
    process.exit(0);
  }

  if (!problem.url) {
    console.log("❌ No URL for this problem");
    process.exit(1);
  }

  console.log("\n⏳ Fetching from Codeforces...");

  const response = await fetch(problem.url, {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
  });

  if (!response.ok) {
    console.log(`❌ HTTP ${response.status}`);
    process.exit(1);
  }

  const html = await response.text();
  const result = parseStatement(html);

  if (!result?.statement) {
    console.log("❌ Failed to parse statement");
    process.exit(1);
  }

  // Save to DB
  await db
    .update(problems)
    .set({ statement: result.statement, statementFetchedAt: new Date() })
    .where(eq(problems.id, problem.id));

  console.log(`\n✅ Saved to database! (${result.statement.length} chars)`);
  console.log("\n" + "─".repeat(60));
  console.log("STATEMENT:");
  console.log("─".repeat(60));
  console.log(result.statement);
  console.log("─".repeat(60));
}

main().catch(console.error);
