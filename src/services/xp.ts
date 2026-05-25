/**
 * Experience (XP) System
 * Separate from Elo — tracks engagement and progression.
 * Awards XP for match participation across all modes.
 */

import { eq, sql } from "drizzle-orm";
import { userStats } from "../db/schema";
import { db } from "../lib/db";
import { logger } from "../lib/logger";

// XP rewards per outcome
const XP_WIN = 10;
const XP_LOSS = 5;
const XP_DRAW = 3;

// Rank thresholds (cumulative XP required)
export interface Rank {
  name: string;
  minXp: number;
  maxXp: number; // Infinity for the top rank
}

export const RANKS: Rank[] = [
  { name: "Ashigaru", minXp: 0, maxXp: 99 },
  { name: "Shinobi", minXp: 100, maxXp: 249 },
  { name: "Rōnin", minXp: 250, maxXp: 499 },
  { name: "Hatamoto", minXp: 500, maxXp: 999 },
  { name: "Shōgun", minXp: 1000, maxXp: Number.POSITIVE_INFINITY },
];

export function getRankFromXP(xp: number): Rank {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    const rank = RANKS[i];
    if (rank && xp >= rank.minXp) return rank;
  }
  return RANKS[0] as Rank;
}

export function getXPProgressToNextRank(xp: number): {
  current: number;
  required: number;
  percentage: number;
} {
  const rank = getRankFromXP(xp);
  if (rank.maxXp === Number.POSITIVE_INFINITY) {
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

function xpForResult(result: "WON" | "LOST" | "DRAW"): number {
  if (result === "WON") return XP_WIN;
  if (result === "LOST") return XP_LOSS;
  return XP_DRAW;
}

export async function awardXP(
  userId: string,
  result: "WON" | "LOST" | "DRAW",
): Promise<{ xpGained: number; newXp: number; newRank: string; leveledUp: boolean }> {
  const xpGained = xpForResult(result);

  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, userId),
    columns: { xp: true },
  });

  const oldXp = stats?.xp ?? 0;
  const newXp = oldXp + xpGained;
  const oldRank = getRankFromXP(oldXp);
  const newRank = getRankFromXP(newXp);
  const leveledUp = newRank.name !== oldRank.name;

  await db
    .update(userStats)
    .set({ xp: sql`${userStats.xp} + ${xpGained}` })
    .where(eq(userStats.userId, userId));

  if (leveledUp) {
    logger.info("XP", `${userId.slice(0, 8)} ranked up to ${newRank.name}!`, { oldXp, newXp });
  }

  return { xpGained, newXp, newRank: newRank.name, leveledUp };
}

export const xpService = { awardXP, getRankFromXP, getXPProgressToNextRank, RANKS };
