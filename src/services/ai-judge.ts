/**
 * AI Judge Service
 * Uses Claude (via MegaLLM) to validate code solutions
 * This is a PoC approach - can be swapped for real judge later
 */

import OpenAI from "openai";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

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
  | "JUDGE_TIMEOUT";

export interface JudgeResult {
  verdict: Verdict;
  feedback?: string;
  confidence: number; // 0-100
}

const JUDGE_SYSTEM = `You are an expert competitive programming judge. You evaluate code submissions against problem statements by reasoning through correctness.

JUDGING PROCESS (follow this order):
1. READ the problem carefully — understand input format, output format, constraints, and edge cases.
2. IDENTIFY the algorithm the code uses. What approach is it taking?
3. TRACE the code logic against the problem's sample inputs mentally. Does it produce the correct outputs?
4. CHECK constraint handling — does the code handle the full range of inputs (e.g., N up to 10^5, values up to 10^9)?
5. CHECK edge cases — minimum values (N=1), maximum values, empty inputs, all-same values, etc.
6. DECIDE verdict based on whether the algorithm is correct for ALL valid inputs within constraints.

VERDICT RULES:
- ACCEPTED: The algorithm correctly solves the problem for all inputs within the stated constraints.
- WRONG_ANSWER: You can identify a SPECIFIC case (within constraints) where the code produces incorrect output. State what input fails and why.
- COMPILE_ERROR: Code has syntax errors that prevent compilation/execution, or is written in the wrong language.
- RUNTIME_ERROR: Code will crash on valid input (division by zero, array out of bounds, stack overflow, integer overflow causing UB in C++).

IMPORTANT GUIDELINES:
- Competitive programming code uses tricks (bit manipulation, macros, short names) — these are fine.
- If the algorithm matches a known correct approach for this problem type, lean ACCEPTED.
- Only return WRONG_ANSWER if you can construct or describe a specific failing test case.
- If uncertain, default to ACCEPTED with lower confidence.
- Judge based on the PROBLEM CONSTRAINTS, not arbitrary inputs outside the stated bounds.

Output ONLY valid JSON. No markdown, no code blocks, no explanation outside the JSON.`;

const JUDGE_PROMPT = `PROBLEM STATEMENT:
{problem}

SUBMITTED CODE (language: {language}):
{code}

JUDGE THIS SUBMISSION. Follow the judging process:
1. What does the problem ask? What are the constraints?
2. What algorithm does this code implement?
3. Does it handle the sample cases correctly?
4. Does it work for all inputs within the stated constraints (including edge cases)?

Respond with ONLY this JSON (no other text):
{"verdict":"ACCEPTED","confidence":85,"feedback":"brief explanation of why"}

Verdict must be one of: ACCEPTED, WRONG_ANSWER, COMPILE_ERROR, RUNTIME_ERROR.
If verdict is WRONG_ANSWER, feedback MUST describe a specific failing case.`;

const VALID_VERDICTS: Verdict[] = [
  "ACCEPTED",
  "WRONG_ANSWER",
  "RUNTIME_ERROR",
  "COMPILE_ERROR",
  "TIME_LIMIT",
  "MEMORY_LIMIT",
];

// Build prompt with problem and code
function buildPrompt(problem: string, code: string, language: string): string {
  return JUDGE_PROMPT.replace("{problem}", problem)
    .replace("{code}", code)
    .replace("{language}", language);
}

// Extract JSON from potentially mixed text response
function extractJSON(content: string): string | null {
  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  const cleaned = content.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();

  // Try direct parse if it looks like JSON
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    return cleaned;
  }

  // Try to find a complete JSON object with verdict
  const jsonMatch = cleaned.match(/\{[^{}]*"verdict"\s*:\s*"[A-Z_]+[^{}]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // Fallback: find any {...} containing verdict (less strict)
  const looseMatch = cleaned.match(/\{[\s\S]*?"verdict"[\s\S]*?\}/);
  if (looseMatch) {
    try {
      JSON.parse(looseMatch[0]);
      return looseMatch[0];
    } catch {
      // Not valid JSON, continue
    }
  }

  return null;
}

// Handle case when no JSON could be extracted
function handleNoJSON(content: string): JudgeResult {
  logger.warn("AI-Judge", "Failed to extract JSON", { preview: content.slice(0, 200) });

  const lower = content.toLowerCase();
  if (lower.includes("cannot") || lower.includes("refuse") || lower.includes("sorry")) {
    return { verdict: "WRONG_ANSWER", confidence: 30, feedback: "Judge was unable to evaluate" };
  }
  return { verdict: "WRONG_ANSWER", confidence: 0, feedback: "Invalid judge response format" };
}

// Validate and normalize confidence value
function normalizeConfidence(confidence: unknown): number {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return 50;
  return Math.max(0, Math.min(100, confidence));
}

// Parse and validate AI response
function parseResponse(content: string): JudgeResult {
  const jsonStr = extractJSON(content);
  if (!jsonStr) return handleNoJSON(content);

  let result: JudgeResult;
  try {
    result = JSON.parse(jsonStr) as JudgeResult;
  } catch {
    return { verdict: "WRONG_ANSWER", confidence: 0, feedback: "Failed to parse judge response" };
  }

  if (!VALID_VERDICTS.includes(result.verdict)) {
    return { verdict: "WRONG_ANSWER", confidence: 50, feedback: "Invalid verdict" };
  }

  result.confidence = normalizeConfidence(result.confidence);

  return result;
}

// Call AI API with timeout
async function callAI(prompt: string, signal: AbortSignal): Promise<string | null> {
  const response = await client.chat.completions.create(
    {
      model: env.AI_MODEL,
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
    },
    { signal },
  );
  return response.choices[0]?.message?.content?.trim() ?? null;
}

// Handle errors and return appropriate result
function handleError(err: unknown): JudgeResult {
  if (err instanceof Error && err.name === "AbortError") {
    logger.error("AI-Judge", "Request timed out");
    return { verdict: "JUDGE_TIMEOUT", confidence: 0, feedback: "Judge timed out" };
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error("AI-Judge", "API error", { error: message });
  return {
    verdict: "JUDGE_TIMEOUT",
    confidence: 0,
    feedback: `Judge error: ${message}`,
  };
}

// Quick language mismatch detection (before AI call)
function detectLanguageMismatch(code: string, declaredLang: string): boolean {
  const trimmed = code.trim();
  const isCppCode = /^#include|using\s+namespace|int\s+main\s*\(|std::|cout|cin|vector</.test(
    trimmed,
  );
  const isPythonCode =
    /^(def |import |from |print\()|^\s{4}/.test(trimmed) && !trimmed.includes(";");
  const isJavaCode = /public\s+class|public\s+static\s+void\s+main|System\.out/.test(trimmed);

  const isCppLang = declaredLang.startsWith("cpp");
  const isPythonLang = declaredLang === "python3" || declaredLang === "pypy3";
  const isJavaLang = declaredLang === "java17";

  // Mismatch if code looks like one language but declared as another
  if (isCppCode && !isCppLang) return true;
  if (isPythonCode && !isPythonLang) return true;
  if (isJavaCode && !isJavaLang) return true;

  return false;
}

// Main judge function
export async function judgeCode(
  problemStatement: string,
  code: string,
  language: string,
): Promise<JudgeResult> {
  logger.debug("AI-Judge", "Starting judgment", { language, codeLength: code.length });

  // Fast pre-check for obvious language mismatch
  if (detectLanguageMismatch(code, language)) {
    logger.info("AI-Judge", "Language mismatch detected", { declared: language });
    return {
      verdict: "COMPILE_ERROR",
      confidence: 100,
      feedback: `Code doesn't match declared language (${language})`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const content = await callAI(buildPrompt(problemStatement, code, language), controller.signal);
    if (!content) {
      logger.error("AI-Judge", "Empty response from AI");
      return { verdict: "WRONG_ANSWER", confidence: 0, feedback: "No response from judge" };
    }
    logger.debug("AI-Judge", "Got AI response", { preview: content.slice(0, 100) });
    return parseResponse(content);
  } catch (err) {
    return handleError(err);
  } finally {
    clearTimeout(timeout);
  }
}
