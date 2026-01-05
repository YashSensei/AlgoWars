"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassPanel, Button, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { calculateWinRate, formatRatingChange } from "@/lib/utils";
import { usersApi, matchesApi, ApiClientError } from "@/lib/api";
import type { Match, MatchHistoryEntry } from "@/lib/api/types";

export default function ProfilePage() {
  const user = useUser();
  const stats = user?.stats;

  // Match history state
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load match history and check for active match
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load both in parallel
        const [historyRes, activeRes] = await Promise.allSettled([
          usersApi.getMatchHistory(10),
          matchesApi.getActiveMatch(),
        ]);

        if (historyRes.status === "fulfilled") {
          setMatchHistory(historyRes.value.matches);
        }

        if (activeRes.status === "fulfilled" && activeRes.value.active) {
          setActiveMatch(activeRes.value.match ?? null);
        }
      } catch (err) {
        console.debug(
          "Failed to load profile data:",
          err instanceof ApiClientError ? err.message : err
        );
      } finally {
        setLoadingHistory(false);
      }
    };

    loadData();
  }, []);

  const totalMatches = (stats?.wins ?? 0) + (stats?.losses ?? 0) + (stats?.draws ?? 0);
  const winRate = calculateWinRate(stats?.wins ?? 0, totalMatches);

  // Format relative time
  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

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

      {/* Active Match Banner */}
      {activeMatch && (
        <GlassPanel padding="p-4" className="mb-8 border border-primary/30 bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-lg flex items-center justify-center bg-primary/20 text-primary animate-pulse">
              <Icon name="play_circle" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">Active Match in Progress</div>
              <div className="text-xs text-text-muted">
                {activeMatch.problem.title} vs{" "}
                {activeMatch.players.find((p) => p.user.id !== user?.id)?.user.username ?? "Opponent"}
              </div>
            </div>
            <Link href={`/match/${activeMatch.id}`}>
              <Button variant="primary" size="sm" leftIcon="play_arrow">
                Resume
              </Button>
            </Link>
          </div>
        </GlassPanel>
      )}

      {/* Match History */}
      <GlassPanel padding="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">
            Match History
          </h2>
          <span className="text-xs font-japanese text-primary">対戦履歴</span>
        </div>

        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-text-muted text-sm">Loading...</p>
          </div>
        ) : matchHistory.length > 0 ? (
          <div className="space-y-3">
            {matchHistory.map((match) => (
              <div
                key={match.matchId}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors hover:bg-white/5 ${
                  match.result === "WON"
                    ? "border-green-400/20 bg-green-400/5"
                    : match.result === "DRAW"
                      ? "border-yellow-400/20 bg-yellow-400/5"
                      : "border-red-400/20 bg-red-400/5"
                }`}
              >
                {/* Result Icon */}
                <div
                  className={`size-10 rounded-lg flex items-center justify-center ${
                    match.result === "WON"
                      ? "bg-green-400/20 text-green-400"
                      : match.result === "DRAW"
                        ? "bg-yellow-400/20 text-yellow-400"
                        : "bg-red-400/20 text-red-400"
                  }`}
                >
                  <Icon
                    name={
                      match.result === "WON"
                        ? "emoji_events"
                        : match.result === "DRAW"
                          ? "handshake"
                          : "close"
                    }
                    size={20}
                  />
                </div>

                {/* Match Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold truncate">
                      vs {match.opponent?.username ?? "Unknown"}
                    </span>
                    {match.opponentRating && (
                      <span className="text-xs text-text-muted font-mono">
                        ({match.opponentRating})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {match.problem?.title ?? "Unknown Problem"}
                  </div>
                </div>

                {/* Rating Change */}
                <div className="text-right">
                  <div
                    className={`text-lg font-bold font-mono ${
                      match.ratingChange > 0
                        ? "text-green-400"
                        : match.ratingChange < 0
                          ? "text-red-400"
                          : "text-yellow-400"
                    }`}
                  >
                    {formatRatingChange(match.ratingChange)}
                  </div>
                  <div className="text-xs text-text-muted">
                    {formatRelativeTime(match.playedAt)}
                  </div>
                </div>
              </div>
            ))}
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
