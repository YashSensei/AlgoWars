"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassPanel, Button, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { calculateWinRate } from "@/lib/utils";
import { matchesApi, ApiClientError } from "@/lib/api";
import type { Match } from "@/lib/api/types";

// NOTE: Match history requires a backend endpoint that doesn't exist yet.
// For now, we show recent matches if there's an active match, otherwise show empty state.

export default function ProfilePage() {
  const user = useUser();
  const stats = user?.stats;

  // Match history state (limited to checking for active match)
  const [recentMatch, setRecentMatch] = useState<Match | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Check for any active/recent match
  useEffect(() => {
    const loadRecentMatch = async () => {
      try {
        const response = await matchesApi.getActiveMatch();
        if (response.active && response.match) {
          setRecentMatch(response.match);
        }
      } catch (err) {
        // Silently ignore - user may not have any matches
        console.debug(
          "No active match:",
          err instanceof ApiClientError ? err.message : err
        );
      } finally {
        setLoadingHistory(false);
      }
    };

    loadRecentMatch();
  }, []);

  const totalMatches = (stats?.wins ?? 0) + (stats?.losses ?? 0) + (stats?.draws ?? 0);
  const winRate = calculateWinRate(stats?.wins ?? 0, totalMatches);

  return (
    <div className="w-full max-w-[1000px] mx-auto px-4 py-8 md:px-10">
      {/* Profile Header */}
      <div className="mb-8">
        <GlassPanel showCornerAccents padding="p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="size-24 md:size-32 rounded-xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
              <Icon name="person" size={64} className="text-primary" />
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-1">
                {user?.username ?? "Warrior"}
              </h1>
              <p className="text-text-muted text-sm mb-4">
                {user?.email ?? "warrior@algowars.io"}
              </p>

              {/* Quick Stats */}
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <Icon name="bolt" size={16} className="text-primary" />
                  <span className="text-sm font-bold text-white font-mono">
                    {stats?.rating ?? 1200}
                  </span>
                  <span className="text-xs text-text-muted">ELO</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <Icon name="local_fire_department" size={16} className="text-orange-400" />
                  <span className="text-sm font-bold text-white font-mono">
                    {stats?.winStreak ?? 0}
                  </span>
                  <span className="text-xs text-text-muted">streak</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Link href="/queue">
                <Button variant="primary" size="md" leftIcon="play_arrow" className="w-full">
                  Find Match
                </Button>
              </Link>
              <Button variant="ghost" size="sm" leftIcon="settings">
                Settings
              </Button>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <GlassPanel padding="p-4" className="text-center">
          <div className="text-3xl font-black text-white font-mono mb-1">
            {stats?.rating ?? 1200}
          </div>
          <div className="text-[10px] text-text-muted uppercase tracking-widest">
            Rating
          </div>
        </GlassPanel>

        <GlassPanel padding="p-4" className="text-center">
          <div className="text-3xl font-black text-primary font-mono mb-1">
            {winRate}%
          </div>
          <div className="text-[10px] text-text-muted uppercase tracking-widest">
            Win Rate
          </div>
        </GlassPanel>

        <GlassPanel padding="p-4" className="text-center">
          <div className="text-3xl font-black text-white font-mono mb-1">
            {totalMatches}
          </div>
          <div className="text-[10px] text-text-muted uppercase tracking-widest">
            Matches
          </div>
        </GlassPanel>

        <GlassPanel padding="p-4" className="text-center">
          <div className="text-3xl font-black text-green-400 font-mono mb-1">
            {stats?.wins ?? 0}
          </div>
          <div className="text-[10px] text-text-muted uppercase tracking-widest">
            Victories
          </div>
        </GlassPanel>
      </div>

      {/* W/L/D Breakdown */}
      <GlassPanel padding="p-6" className="mb-8">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">
          Battle Record
        </h2>
        <div className="flex items-center gap-2 mb-4">
          {/* Win bar */}
          <div
            className="h-3 bg-green-500 rounded-l transition-all"
            style={{ width: `${totalMatches > 0 ? ((stats?.wins ?? 0) / totalMatches) * 100 : 33}%` }}
          />
          {/* Loss bar */}
          <div
            className="h-3 bg-red-500 transition-all"
            style={{ width: `${totalMatches > 0 ? ((stats?.losses ?? 0) / totalMatches) * 100 : 33}%` }}
          />
          {/* Draw bar */}
          <div
            className="h-3 bg-gray-500 rounded-r transition-all"
            style={{ width: `${totalMatches > 0 ? ((stats?.draws ?? 0) / totalMatches) * 100 : 34}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-sm" />
            <span className="text-text-muted">
              Wins: <span className="text-white font-bold">{stats?.wins ?? 0}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-sm" />
            <span className="text-text-muted">
              Losses: <span className="text-white font-bold">{stats?.losses ?? 0}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-sm" />
            <span className="text-text-muted">
              Draws: <span className="text-white font-bold">{stats?.draws ?? 0}</span>
            </span>
          </div>
        </div>
      </GlassPanel>

      {/* Match History / Active Match */}
      <GlassPanel padding="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">
            {recentMatch ? "Active Match" : "Match History"}
          </h2>
          <span className="text-xs font-japanese text-primary">対戦履歴</span>
        </div>

        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-text-muted text-sm">Loading...</p>
          </div>
        ) : recentMatch ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
              {/* Active Icon */}
              <div className="size-10 rounded-lg flex items-center justify-center bg-primary/20 text-primary">
                <Icon name="play_circle" size={20} />
              </div>

              {/* Match Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-bold truncate">
                    {recentMatch.problem.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                      (recentMatch.problem.difficulty ?? 0) < 1200
                        ? "bg-green-400/20 text-green-400"
                        : (recentMatch.problem.difficulty ?? 0) < 1600
                          ? "bg-yellow-400/20 text-yellow-400"
                          : "bg-red-400/20 text-red-400"
                    }`}
                  >
                    {recentMatch.problem.difficulty}
                  </span>
                </div>
                <div className="text-xs text-text-muted">
                  vs{" "}
                  {recentMatch.players.find((p) => p.user.id !== user?.id)?.user
                    .username ?? "Opponent"}
                </div>
              </div>

              {/* Resume Button */}
              <Link href={`/match/${recentMatch.id}`}>
                <Button variant="primary" size="sm" leftIcon="play_arrow">
                  Resume
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="history" size={48} className="text-white/10 mb-4" />
            <p className="text-text-muted text-sm mb-4">No match history yet</p>
            <p className="text-text-muted/60 text-xs mb-6 max-w-xs">
              Start competing to build your match history and climb the rankings!
            </p>
            <Link href="/queue">
              <Button variant="primary" size="md" leftIcon="play_arrow">
                Find Your First Match
              </Button>
            </Link>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
