/**
 * AI Judge Service
 * Uses Claude (via MegaLLM) to validate code solutions
 * This is a PoC approach - can be swapped for real judge later
 */

import OpenAI from "openai";
import { env } from "../lib/env";

const client = new OpenAI({
  baseURL: "https://ai.megallm.io/v1",
  apiKey: env.MEGALLM_API_KEY,
});

export type Verdict =
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "RUNTIME_ERROR"
  | "COMPILE_ERROR"
  | "TIME_LIMIT"
  | "MEMORY_LIMIT"
  | "INVALID_CODE";

export interface JudgeResult {
  verdict: Verdict;
  feedback?: string;
  confidence: number; // 0-100
}

const JUDGE_PROMPT = `You are an expert competitive programming judge. Analyze the code solution with the rigor of Codeforces/LeetCode judges.

PROBLEM:
{problem}

CODE ({language}):
{code}

EVALUATION CRITERIA (check ALL):

1. CORRECTNESS - Does it produce correct output for:
   - Basic/sample cases
   - Edge cases (empty input, single element, maximum values)
   - Boundary conditions (n=0, n=1, n=max)
   - Negative numbers (if applicable)
   - Duplicate values
   - Already sorted/reverse sorted input

2. TIME COMPLEXITY - Will it pass within time limits?
   - n ≤ 10: O(n!) acceptable
   - n ≤ 20: O(2^n) acceptable
   - n ≤ 500: O(n³) acceptable
   - n ≤ 5000: O(n²) acceptable
   - n ≤ 10^6: O(n log n) required
   - n ≤ 10^8: O(n) or O(log n) required
   - Nested loops over large inputs = TLE
   - Recursion without memoization on overlapping subproblems = TLE

3. MEMORY - Will it exceed memory limits (~256MB)?
   - Arrays larger than 10^8 elements = MLE
   - Unbounded recursion depth = stack overflow
   - Creating copies of large data structures unnecessarily

4. RUNTIME SAFETY:
   - Division by zero
   - Array index out of bounds
   - Null/undefined access
   - Integer overflow (use long long for large products/sums)
   - Infinite loops

5. SYNTAX & COMPILATION:
   - Missing includes/imports
   - Syntax errors
   - Type mismatches
   - Missing main function (for C++/Java)

VERDICTS:
- ACCEPTED: Correct for ALL cases, optimal complexity, no runtime issues
- WRONG_ANSWER: Logic error, fails on some test cases, incorrect algorithm
- TIME_LIMIT: Correct logic but O(n²) when O(n) needed, will timeout
- MEMORY_LIMIT: Excessive memory usage, will exceed 256MB
- RUNTIME_ERROR: Will crash (segfault, division by zero, stack overflow)
- COMPILE_ERROR: Syntax errors, missing imports, won't compile
- INVALID_CODE: Empty, placeholder, or doesn't attempt to solve the problem

Respond with ONLY this JSON (no markdown, no backticks):
{"verdict":"<VERDICT>","confidence":<0-100>,"feedback":"<specific explanation with example failing case if not ACCEPTED>"}`;

const VALID_VERDICTS: Verdict[] = [
  "ACCEPTED",
  "WRONG_ANSWER",
  "RUNTIME_ERROR",
  "COMPILE_ERROR",
  "TIME_LIMIT",
  "MEMORY_LIMIT",
  "INVALID_CODE",
];

// Build prompt with problem and code
function buildPrompt(problem: string, code: string, language: string): string {
  return JUDGE_PROMPT.replace("{problem}", problem)
    .replace("{code}", code)
    .replace("{language}", language);
}

// Parse and validate AI response
function parseResponse(content: string): JudgeResult {
  const jsonStr = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const result = JSON.parse(jsonStr) as JudgeResult;

  if (!VALID_VERDICTS.includes(result.verdict)) {
    return { verdict: "WRONG_ANSWER", confidence: 50, feedback: "Invalid judge response" };
  }
  return result;
}

// Main judge function
export async function judgeCode(
  problemStatement: string,
  code: string,
  language: string,
): Promise<JudgeResult> {
  try {
    const response = await client.chat.completions.create({
      model: "claude-sonnet-4-5-20250929",
      messages: [{ role: "user", content: buildPrompt(problemStatement, code, language) }],
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return { verdict: "WRONG_ANSWER", confidence: 0, feedback: "No response from judge" };
    }

    return parseResponse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { verdict: "WRONG_ANSWER", confidence: 0, feedback: `Judge error: ${message}` };
  }
}

// Quick validation without full judging (for syntax check)
export async function quickValidate(code: string, language: string): Promise<boolean> {
  if (!code.trim()) return false;
  if (code.length < 10) return false;

  // Basic language-specific checks
  if (language === "cpp17" || language === "cpp20") {
    return code.includes("main") && (code.includes("#include") || code.includes("int main"));
  }
  if (language === "python3" || language === "pypy3") {
    return code.length > 5; // Python is flexible
  }
  if (language === "java17") {
    return code.includes("class") && code.includes("main");
  }

  return true;
}
