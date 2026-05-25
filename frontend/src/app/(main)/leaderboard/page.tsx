"use client";

import { useState, useEffect } from "react";
import { GlassPanel, Button, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { usersApi, ApiClientError } from "@/lib/api";
import { getRankFromXP } from "@/lib/xp";
import type { LeaderboardEntry } from "@/lib/api/types";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const user = useUser();
  const pageSize = 50;

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await usersApi.getLeaderboard(pageSize, page * pageSize);
        setLeaderboard(response.users);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };
    loadLeaderboard();
  }, [page]);

  const getWinRate = (wins: number, losses: number, draws: number) => {
    const total = wins + losses + draws;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  const topThree = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 py-8 md:px-10">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase mb-2">
          Leaderboard
        </h1>
        <p className="text-xs font-japanese text-primary tracking-widest">将軍の殿堂</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-text-muted text-sm">Loading rankings...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Icon name="error" size={40} className="text-red-400 mb-3" />
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <Button variant="primary" size="sm" onClick={() => setPage(0)}>Retry</Button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && leaderboard.length > 0 && (
        <>
          {/* Top 3 Podium */}
          {page === 0 && topThree.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-10 max-w-2xl mx-auto items-end">
              <PodiumCard player={topThree[1]} place={2} getWinRate={getWinRate} />
              <PodiumCard player={topThree[0]} place={1} getWinRate={getWinRate} />
              <PodiumCard player={topThree[2]} place={3} getWinRate={getWinRate} />
            </div>
          )}

          {/* Table */}
          <GlassPanel showCornerAccents padding="p-0" className="overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-text-muted uppercase tracking-widest border-b border-border-dark">
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 text-right">Rating</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">W/L</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Win %</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark/50">
                {(page === 0 ? restOfLeaderboard : leaderboard).map((player) => (
                  <LeaderboardRow
                    key={player.userId}
                    player={player}
                    isCurrentUser={player.userId === user?.id}
                    getWinRate={getWinRate}
                  />
                ))}
              </tbody>
            </table>
          </GlassPanel>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded bg-white/5 border border-border-dark text-text-muted text-xs hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-text-muted font-mono">Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={leaderboard.length < pageSize}
              className="px-3 py-1.5 rounded bg-white/5 border border-border-dark text-text-muted text-xs hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Empty */}
      {!loading && !error && leaderboard.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="military_tech" size={48} className="text-white/10 mb-4" />
          <p className="text-text-muted">No warriors yet. Be the first!</p>
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  player,
  place,
  getWinRate,
}: {
  player: LeaderboardEntry | undefined;
  place: 1 | 2 | 3;
  getWinRate: (w: number, l: number, d: number) => number;
}) {
  if (!player) return null;
  const colors = { 1: "text-primary border-primary/40", 2: "text-blue-400 border-blue-400/30", 3: "text-orange-400 border-orange-400/30" };
  const color = colors[place];
  const isFirst = place === 1;

  return (
    <GlassPanel
      showCornerAccents={isFirst}
      padding={isFirst ? "p-5" : "p-4"}
      className={`text-center border ${color.split(" ")[1]} ${isFirst ? "scale-105 z-10" : ""}`}
    >
      {isFirst && (
        <Icon name="workspace_premium" size={24} className="text-primary mx-auto mb-1" />
      )}
      <div className={`text-2xl font-black ${color.split(" ")[0]} mb-1`}>#{place}</div>
      <div className="size-12 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
        <Icon name="person" size={24} className="text-text-muted" />
      </div>
      <h3 className="text-sm font-bold text-white truncate">{player.username}</h3>
      <div className={`text-lg font-black font-mono ${color.split(" ")[0]}`}>{player.rating}</div>
      <div className="text-[9px] text-text-muted mt-1">
        {getWinRate(player.wins, player.losses, player.draws)}% win rate
      </div>
    </GlassPanel>
  );
}

function LeaderboardRow({
  player,
  isCurrentUser,
  getWinRate,
}: {
  player: LeaderboardEntry;
  isCurrentUser: boolean;
  getWinRate: (w: number, l: number, d: number) => number;
}) {
  const winRate = getWinRate(player.wins, player.losses, player.draws);
  const total = player.wins + player.losses + player.draws;

  return (
    <tr className={`transition-colors ${isCurrentUser ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-white/[0.02]"}`}>
      <td className="px-4 py-3">
        <span className="text-xs font-bold text-text-muted">{player.rank}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Icon name="person" size={16} className="text-text-muted" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold truncate ${isCurrentUser ? "text-primary" : "text-white"}`}>
                {player.username}
                {isCurrentUser && <span className="text-[9px] text-primary/60 ml-1">(you)</span>}
              </span>
            </div>
            <span className="text-[9px] text-text-muted uppercase tracking-wider">
              {total} matches
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-bold text-white font-mono">{player.rating}</span>
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell">
        <span className="text-xs text-text-muted font-mono">
          <span className="text-green-400">{player.wins}</span>
          /
          <span className="text-red-400">{player.losses}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <div className="flex items-center justify-end gap-2">
          <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${winRate}%` }} />
          </div>
          <span className="text-[10px] text-text-muted w-8 text-right">{winRate}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center hidden md:table-cell">
        {player.winStreak > 0 ? (
          <span className="text-xs font-bold text-orange-400 flex items-center justify-center gap-0.5">
            <Icon name="local_fire_department" size={14} />
            {player.winStreak}
          </span>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}
      </td>
    </tr>
  );
}
