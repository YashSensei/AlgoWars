/**
 * XP / Rank system utilities — mirrors backend src/services/xp.ts
 * Used client-side for display without extra API calls.
 */

export interface Rank {
  name: string;
  minXp: number;
  maxXp: number;
}

export const RANKS: Rank[] = [
  { name: "Ashigaru", minXp: 0, maxXp: 99 },
  { name: "Shinobi", minXp: 100, maxXp: 249 },
  { name: "Rōnin", minXp: 250, maxXp: 499 },
  { name: "Hatamoto", minXp: 500, maxXp: 999 },
  { name: "Shōgun", minXp: 1000, maxXp: Infinity },
];

export function getRankFromXP(xp: number): Rank {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    const rank = RANKS[i];
    if (rank && xp >= rank.minXp) return rank;
  }
  return RANKS[0] as Rank;
}

export function getXPProgress(xp: number): { current: number; required: number; percentage: number } {
  const rank = getRankFromXP(xp);
  if (rank.maxXp === Infinity) {
    return { current: xp - rank.minXp, required: 0, percentage: 100 };
  }
  const rangeSize = rank.maxXp - rank.minXp + 1;
  const progress = xp - rank.minXp;
  return {
    current: progress,
    required: rangeSize,
    percentage: Math.round((progress / rangeSize) * 100),
  };
}

export function getXPForResult(result: "WON" | "LOST" | "DRAW"): number {
  if (result === "WON") return 10;
  if (result === "LOST") return 5;
  return 3;
}
