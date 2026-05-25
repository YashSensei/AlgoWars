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

const SOLVER_PROMPT = `Write a Python 3 solution. Output ONLY code. No text, no explanation, no markdown.

{problem}

Python 3 solution (sys.stdin for input, print for output):`;

function buildPrompt(problemStatement: string): string {
  return SOLVER_PROMPT.replace("{problem}", problemStatement);
}

function cleanResponse(content: string): string {
  let code = content
    .replace(/```(?:python)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  // If the model output reasoning before code, find where actual code starts.
  // Python code starts with: import, from, def, for, while, if, t=, n=, sys, input, #
  const codeStart = code.search(/^(import |from |def |for |while |if |[a-z_]+ ?=|sys\.|input|#)/m);
  if (codeStart > 0) {
    code = code.slice(codeStart);
  }

  return code.trim();
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
