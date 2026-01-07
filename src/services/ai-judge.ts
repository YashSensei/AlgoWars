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
  | "INVALID_CODE";

export interface JudgeResult {
  verdict: Verdict;
  feedback?: string;
  confidence: number; // 0-100
}

const JUDGE_SYSTEM = `You are an expert competitive programming judge. You must carefully analyze code submissions and determine if they correctly solve the given problem.

IMPORTANT JUDGING RULES:
1. FIRST check if the code matches the declared language. If user says "cpp17" but submits Python code (or vice versa), return COMPILE_ERROR
2. Read the problem statement carefully - understand the input/output format and constraints
3. Trace through the code logic mentally with sample inputs
4. Check for edge cases as appropriate per question
5. Only return ACCEPTED if the code correctly handles ALL cases described in the problem
6. Return WRONG_ANSWER if there's any logical error or the algorithm is incorrect
7. Return COMPILE_ERROR for syntax errors OR language mismatch
8. Return RUNTIME_ERROR for issues like division by zero, array out of bounds
9. When in doubt about correctness, lean toward ACCEPTED if the core algorithm is sound

LANGUAGE DETECTION:
- C++: #include, using namespace, int main(), cout, cin, vector<>, ::
- Python: def, import, print(), indentation-based blocks, no semicolons, no braces
- Java: public class, public static void main, System.out, import java
- PyPy: Same as Python

Output ONLY valid JSON. No explanations.`;

const JUDGE_PROMPT = `Analyze this code submission for the given competitive programming problem.

PROBLEM STATEMENT:
{problem}

SUBMITTED CODE ({language}):
\`\`\`
{code}
\`\`\`

Think step by step:
1. What does the problem ask for?
2. What algorithm does the code use?
3. Does the code handle the input/output format correctly?
4. Are there any logical errors?

Then output ONLY this JSON (nothing else):
{"verdict":"ACCEPTED or WRONG_ANSWER or COMPILE_ERROR or RUNTIME_ERROR","confidence":85}`;

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
      max_tokens: 300,
      temperature: 0.1, // Low temperature for consistent JSON output
    },
    { signal },
  );
  return response.choices[0]?.message?.content?.trim() ?? null;
}

// Handle errors and return appropriate result
function handleError(err: unknown): JudgeResult {
  if (err instanceof Error && err.name === "AbortError") {
    logger.error("AI-Judge", "Request timed out");
    return { verdict: "WRONG_ANSWER", confidence: 0, feedback: "Judge timeout" };
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error("AI-Judge", "API error", { error: message });
  return { verdict: "WRONG_ANSWER", confidence: 0, feedback: `Judge error: ${message}` };
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
