/**
 * Bot Solver — generates a real solution via Claude (MegaLLM) for the bot's ACCEPTED submission.
 * Called only when no prior solution exists for a problem. The result is stored in the
 * submissions table so the results page shows real code.
 */

import OpenAI from "openai";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

const client = new OpenAI({
  baseURL: "https://ai.megallm.io/v1",
  apiKey: env.MEGALLM_API_KEY,
});

const SOLVER_PROMPT = `You are an expert competitive programmer. Write a correct Python 3 solution for the following problem.

RULES:
- Use standard input/output (sys.stdin / print)
- Handle all edge cases described in the problem
- Be concise — no comments, no explanations, just working code
- Output ONLY the Python code, nothing else (no markdown, no backticks)

PROBLEM:
{problem}`;

function buildPrompt(problemStatement: string): string {
  return SOLVER_PROMPT.replace("{problem}", problemStatement);
}

function cleanResponse(content: string): string {
  return content
    .replace(/```(?:python)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();
}

export async function generateSolution(problemStatement: string): Promise<string> {
  logger.debug("BotSolver", "Generating solution via Claude");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: env.AI_MODEL,
        messages: [{ role: "user", content: buildPrompt(problemStatement) }],
        max_tokens: 2000,
        temperature: 0.2,
      },
      { signal: controller.signal },
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      logger.warn("BotSolver", "Empty response from Claude");
      return fallbackSolution();
    }
    return cleanResponse(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("BotSolver", "Generation failed", { error: msg });
    return fallbackSolution();
  } finally {
    clearTimeout(timeout);
  }
}

// Marker prefix so findExistingSolution can filter out fallback code from reuse.
// If the bot previously failed to generate, we don't want to reuse that garbage.
export const FALLBACK_MARKER = "# ALGOWARS_FALLBACK_SOLUTION";

function fallbackSolution(): string {
  return `${FALLBACK_MARKER}
import sys
for line in sys.stdin:
    print(line.strip())`;
}
