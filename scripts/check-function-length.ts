/**
 * Custom linter: Checks that no function exceeds MAX_LINES
 * Run with: bun scripts/check-function-length.ts
 */

import { Glob } from "bun";

const MAX_LINES = 30; // Safety net - catches truly bloated functions
const IGNORED_FILES = ["seed.ts"]; // Files with large data arrays

interface Violation {
  file: string;
  name: string;
  lines: number;
  startLine: number;
}

function countFunctionLines(content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split("\n");

  let inFunction = false;
  let braceCount = 0;
  let functionName = "";
  let functionStartLine = 0;
  let functionLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    // Detect function start patterns
    const funcMatch = line.match(
      /(?:async\s+)?(?:function\s+(\w+)|(\w+)\s*(?:=|:)\s*(?:async\s*)?\([^)]*\)\s*(?:=>|{)|(\w+)\s*\([^)]*\)\s*{)/
    );

    if (funcMatch && !inFunction) {
      inFunction = true;
      functionName = funcMatch[1] || funcMatch[2] || funcMatch[3] || "anonymous";
      functionStartLine = i + 1;
      functionLines = [];
      braceCount = 0;
    }

    if (inFunction) {
      // Count meaningful lines (not blank, not just comments)
      if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
        functionLines.push(trimmed);
      }

      // Track braces
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Function ended
      if (braceCount <= 0 && line.includes("}")) {
        const lineCount = functionLines.length;

        if (lineCount > MAX_LINES) {
          violations.push({
            file: "",
            name: functionName,
            lines: lineCount,
            startLine: functionStartLine,
          });
        }

        inFunction = false;
        functionName = "";
        functionLines = [];
      }
    }
  }

  return violations;
}

async function main() {
  const glob = new Glob("src/**/*.ts");
  const violations: Violation[] = [];

  for await (const filePath of glob.scan(".")) {
    // Skip ignored files
    if (IGNORED_FILES.some((ignored) => filePath.includes(ignored))) {
      continue;
    }

    // Skip test files
    if (filePath.includes(".test.") || filePath.includes(".spec.")) {
      continue;
    }

    const content = await Bun.file(filePath).text();
    const fileViolations = countFunctionLines(content);

    for (const v of fileViolations) {
      v.file = filePath;
      violations.push(v);
    }
  }

  if (violations.length > 0) {
    console.error("\n❌ Function length violations found:\n");

    for (const v of violations) {
      console.error(`  ${v.file}:${v.startLine}`);
      console.error(`    Function "${v.name}" has ${v.lines} lines (max: ${MAX_LINES})\n`);
    }

    console.error(`\nTotal violations: ${violations.length}`);
    console.error(`Tip: Break large functions into smaller, focused functions.\n`);
    process.exit(1);
  }

  console.log(`✅ All functions are within ${MAX_LINES} lines`);
  process.exit(0);
}

main();
