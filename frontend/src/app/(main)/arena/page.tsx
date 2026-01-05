"use client";

import Link from "next/link";
import { Button, GlassPanel, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { calculateWinRate } from "@/lib/utils";

export default function ArenaPage() {
  const user = useUser();
  const stats = user?.stats;

  // Calculate derived stats
  const totalMatches = (stats?.wins ?? 0) + (stats?.losses ?? 0) + (stats?.draws ?? 0);
  const winRate = calculateWinRate(stats?.wins ?? 0, totalMatches);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 py-12">
      {/* Welcome Header */}
      <div className="mb-12">
        <div className="flex items-baseline gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-tight">
            Welcome back,
          </h1>
          <span className="text-3xl md:text-4xl font-bold text-primary uppercase tracking-tight">
            {user?.username ?? "Warrior"}
          </span>
        </div>
        <p className="text-text-muted text-sm">
          Ready for your next battle? Your rank awaits.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Stats & Quick Match */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Stats Overview */}
          <GlassPanel showCornerAccents padding="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white uppercase tracking-wide">
                Combat Statistics
              </h2>
              <span className="text-xs font-japanese text-primary">戦績</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Rating */}
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted uppercase tracking-widest mb-1">
                  Rating
                </span>
                <span className="text-3xl font-bold text-white font-mono">
                  {stats?.rating ?? 1200}
                </span>
              </div>

              {/* Win Rate */}
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted uppercase tracking-widest mb-1">
                  Win Rate
                </span>
                <span className="text-3xl font-bold text-primary font-mono">
                  {winRate}%
                </span>
              </div>

              {/* Total Matches */}
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted uppercase tracking-widest mb-1">
                  Matches
                </span>
                <span className="text-3xl font-bold text-white font-mono">
                  {totalMatches}
                </span>
              </div>

              {/* Win Streak */}
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted uppercase tracking-widest mb-1">
                  Win Streak
                </span>
                <span className="text-3xl font-bold text-accent-gold font-mono">
                  {stats?.winStreak ?? 0}
                </span>
              </div>
            </div>

            {/* W/L/D Breakdown */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-sm" />
                  <span className="text-sm text-text-muted">
                    Wins: <span className="text-white font-bold">{stats?.wins ?? 0}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-sm" />
                  <span className="text-sm text-text-muted">
                    Losses: <span className="text-white font-bold">{stats?.losses ?? 0}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500 rounded-sm" />
                  <span className="text-sm text-text-muted">
                    Draws: <span className="text-white font-bold">{stats?.draws ?? 0}</span>
                  </span>
                </div>
              </div>
            </div>
          </GlassPanel>

          {/* Quick Match CTA */}
          <GlassPanel showCornerAccents padding="p-8" className="text-center">
            <div className="size-16 mx-auto mb-6 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/5">
              <Icon name="swords" size={32} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight mb-3">
              Ready for Battle?
            </h2>
            <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
              Enter the queue to find an opponent of similar skill. First to solve the problem wins!
            </p>
            <Link href="/queue">
              <Button
                variant="primary"
                size="lg"
                leftIcon="play_arrow"
                className="min-w-[200px]"
              >
                Find Match
              </Button>
            </Link>
          </GlassPanel>
        </div>

        {/* Right Column - Recent Matches & Quick Links */}
        <div className="flex flex-col gap-6">
          {/* Recent Matches */}
          <GlassPanel showCornerAccents={false} padding="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                Recent Matches
              </h2>
              <Link
                href="/history"
                className="text-[10px] text-primary hover:underline uppercase tracking-wide"
              >
                View All
              </Link>
            </div>

            {/* Placeholder for no matches */}
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Icon name="history" size={32} className="text-white/10 mb-3" />
              <p className="text-text-muted text-sm">No recent matches</p>
              <p className="text-text-muted text-xs">
                Start a battle to see your history
              </p>
            </div>
          </GlassPanel>

          {/* Quick Links */}
          <GlassPanel showCornerAccents={false} padding="p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">
              Quick Links
            </h2>
            <div className="flex flex-col gap-2">
              <Link
                href="/leaderboard"
                className="flex items-center gap-3 p-3 rounded bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <Icon
                  name="leaderboard"
                  size={20}
                  className="text-text-muted group-hover:text-primary transition-colors"
                />
                <span className="text-sm text-white">Leaderboard</span>
                <Icon
                  name="chevron_right"
                  size={18}
                  className="text-text-muted ml-auto"
                />
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-3 p-3 rounded bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <Icon
                  name="person"
                  size={20}
                  className="text-text-muted group-hover:text-primary transition-colors"
                />
                <span className="text-sm text-white">My Profile</span>
                <Icon
                  name="chevron_right"
                  size={18}
                  className="text-text-muted ml-auto"
                />
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-3 p-3 rounded bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <Icon
                  name="settings"
                  size={20}
                  className="text-text-muted group-hover:text-primary transition-colors"
                />
                <span className="text-sm text-white">Settings</span>
                <Icon
                  name="chevron_right"
                  size={18}
                  className="text-text-muted ml-auto"
                />
              </Link>
            </div>
          </GlassPanel>

          {/* Rank Progress (placeholder) */}
          <GlassPanel showCornerAccents={false} padding="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                Rank Progress
              </h2>
              <span className="text-xs font-japanese text-text-muted">段位</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Icon name="military_tech" size={24} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-white uppercase">
                  Novice
                </div>
                <div className="text-xs text-text-muted">
                  {200 - (stats?.rating ?? 1200 - 1000)} points to Apprentice
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all"
                style={{ width: `${Math.min(100, ((stats?.rating ?? 1200) - 1000) / 2)}%` }}
              />
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
