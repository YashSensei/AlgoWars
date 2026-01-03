/**
 * Test the Codeforces scraper on a single problem
 * Run with: bun scripts/test-scraper.ts
 */

const TEST_URL = "https://codeforces.com/problemset/problem/1/A";

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

async function test() {
  console.log("═".repeat(60));
  console.log("🧪 Testing Codeforces Scraper");
  console.log("═".repeat(60));
  console.log(`\nFetching: ${TEST_URL}\n`);

  try {
    const response = await fetch(TEST_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`);
      process.exit(1);
    }

    const html = await response.text();
    console.log(`✅ Fetched HTML (${html.length} bytes)\n`);

    const result = parseStatement(html);

    if (!result) {
      console.log("❌ Failed to parse statement");
      console.log("\n--- Raw HTML snippet (first 2000 chars) ---");
      console.log(html.substring(0, 2000));
      process.exit(1);
    }

    console.log("═".repeat(60));
    console.log("📄 PARSED RESULT");
    console.log("═".repeat(60));
    console.log(`\nTime Limit: ${result.timeLimit ? result.timeLimit + "ms" : "Not found"}`);
    console.log(`Memory Limit: ${result.memoryLimit ? result.memoryLimit + "KB" : "Not found"}`);
    console.log(`Statement Length: ${result.statement.length} chars`);
    console.log("\n" + "─".repeat(60));
    console.log("STATEMENT:");
    console.log("─".repeat(60));
    console.log(result.statement);
    console.log("─".repeat(60));

    console.log("\n✅ Scraper test PASSED!");

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

test();
