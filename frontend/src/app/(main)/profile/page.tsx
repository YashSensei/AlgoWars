"use client";

import Link from "next/link";
import { GlassPanel, Button, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { calculateWinRate, formatRatingChange } from "@/lib/utils";

// Mock match history
const mockMatchHistory = [
  {
    id: "1",
    opponent: "CodeNinja",
    opponentRating: 1450,
    result: "win" as const,
    ratingChange: 25,
    problem: "Two Sum",
    date: "2 hours ago",
  },
  {
    id: "2",
    opponent: "BinaryRonin",
    opponentRating: 1380,
    result: "win" as const,
    ratingChange: 18,
    problem: "Valid Parentheses",
    date: "5 hours ago",
  },
  {
    id: "3",
    opponent: "AlgoSamurai",
    opponentRating: 1520,
    result: "loss" as const,
    ratingChange: -22,
    problem: "Merge Intervals",
    date: "1 day ago",
  },
  {
    id: "4",
    opponent: "RecursiveRex",
    opponentRating: 1290,
    result: "win" as const,
    ratingChange: 12,
    problem: "Reverse Linked List",
    date: "2 days ago",
  },
  {
    id: "5",
    opponent: "StackOverflow",
    opponentRating: 1410,
    result: "loss" as const,
    ratingChange: -20,
    problem: "LRU Cache",
    date: "3 days ago",
  },
];

export default function ProfilePage() {
  const user = useUser();
  const stats = user?.stats;

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
                  <Icon name="military_tech" size={16} className="text-accent-gold" />
                  <span className="text-sm font-bold text-white">Rank #142</span>
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

      {/* Match History */}
      <GlassPanel padding="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">
            Match History
          </h2>
          <span className="text-xs font-japanese text-primary">対戦履歴</span>
        </div>

        <div className="space-y-3">
          {mockMatchHistory.map((match) => (
            <div
              key={match.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-colors hover:bg-white/5 ${
                match.result === "win"
                  ? "border-green-400/20 bg-green-400/5"
                  : "border-red-400/20 bg-red-400/5"
              }`}
            >
              {/* Result Icon */}
              <div
                className={`size-10 rounded-lg flex items-center justify-center ${
                  match.result === "win"
                    ? "bg-green-400/20 text-green-400"
                    : "bg-red-400/20 text-red-400"
                }`}
              >
                <Icon
                  name={match.result === "win" ? "emoji_events" : "close"}
                  size={20}
                />
              </div>

              {/* Match Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-bold truncate">
                    vs {match.opponent}
                  </span>
                  <span className="text-xs text-text-muted font-mono">
                    ({match.opponentRating})
                  </span>
                </div>
                <div className="text-xs text-text-muted truncate">
                  {match.problem}
                </div>
              </div>

              {/* Rating Change */}
              <div className="text-right">
                <div
                  className={`text-lg font-bold font-mono ${
                    match.ratingChange > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatRatingChange(match.ratingChange)}
                </div>
                <div className="text-xs text-text-muted">{match.date}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" leftIcon="expand_more">
            Load More
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
