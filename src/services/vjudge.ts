// VJudge service - Phase 4
// Will handle: login, problem fetching, submission, verdict polling

export const LANGUAGES = {
  cpp17: 54,
  cpp20: 73,
  python3: 31,
  java17: 87,
  pypy3: 70,
} as const;

export type Language = keyof typeof LANGUAGES;
