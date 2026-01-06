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

const JUDGE_SYSTEM = `You are a competitive programming judge API. Output ONLY JSON. No explanations. No hints. No analysis.`;

const JUDGE_PROMPT = `Judge this code submission. Do NOT reveal why it failed or give hints.

PROBLEM:
{problem}

CODE ({language}):
{code}

VERDICTS: ACCEPTED, WRONG_ANSWER, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR, COMPILE_ERROR, INVALID_CODE

Output ONLY this JSON (no other text):
{"verdict":"VERDICT_HERE","confidence":85}`;

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

// Main judge function
export async function judgeCode(
  problemStatement: string,
  code: string,
  language: string,
): Promise<JudgeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  logger.debug("AI-Judge", "Starting judgment", { language, codeLength: code.length });

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
