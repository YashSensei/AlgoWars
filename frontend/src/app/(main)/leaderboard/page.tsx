"use client";

import { useState, useEffect } from "react";
import { GlassPanel, Button, Icon } from "@/components/ui";
import { usersApi, ApiClientError } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/api/types";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await usersApi.getLeaderboard(pageSize, page * pageSize);
        setLeaderboard(response.users);
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "Failed to load leaderboard";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [page]);

  // Calculate win rate
  const getWinRate = (wins: number, losses: number, draws: number) => {
    const total = wins + losses + draws;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  // Get top 3 for podium display
  const topThree = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);

  return (
    <div className="w-full max-w-[1000px] mx-auto px-4 py-8 md:px-10">
      {/* Hero / Title Section */}
      <div className="w-full mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-4">
          <Icon name="military_tech" size={16} className="text-primary" />
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            Season 1 Rankings
          </span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase mb-2">
          Hall of <span className="text-primary">Shoguns</span>
        </h1>
        <p className="text-text-muted text-sm md:text-base max-w-xl mx-auto">
          The elite warriors who have proven their algorithmic prowess in battle.
        </p>
        <p className="text-xs font-japanese text-white/30 mt-2 tracking-widest">
          将軍の殿堂
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-text-muted">Loading rankings...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Icon name="error" size={48} className="text-red-400 mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <Button variant="primary" onClick={() => setPage(0)}>
            Retry
          </Button>
        </div>
      )}

      {/* Leaderboard Content */}
      {!loading && !error && leaderboard.length > 0 && (
        <>
          {/* Top 3 Podium */}
          {page === 0 && podiumOrder.length > 0 && (
            <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-6 mb-16">
              {podiumOrder.map((player) => {
                if (!player) return null;
                const isFirst = player.rank === 1;
                const isSecond = player.rank === 2;
                const color = isFirst
                  ? "text-primary"
                  : isSecond
                    ? "text-blue-400"
                    : "text-orange-400";
                const borderColor = isFirst
                  ? "border-primary"
                  : isSecond
                    ? "border-blue-400/30"
                    : "border-orange-400/30";
                const winRate = getWinRate(player.wins, player.losses, player.draws);

                return (
                  <div
                    key={player.userId}
                    className={`flex-1 max-w-[240px] flex flex-col items-center ${
                      isFirst ? "order-1 md:order-2 md:-mb-8 z-10" : isSecond ? "order-2 md:order-1" : "order-3"
                    }`}
                  >
                    <div className="relative group cursor-pointer w-full">
                      {/* Crown for rank 1 */}
                      {isFirst && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-accent-gold drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] z-20 animate-float">
                          <Icon name="workspace_premium" size={40} />
                        </div>
                      )}

                      {/* Glow effect */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-b ${isFirst ? "from-primary/30" : "from-white/10"} to-transparent blur-xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity`}
                      />

                      {/* Card */}
                      <GlassPanel
                        showCornerAccents={isFirst}
                        padding={isFirst ? "p-8" : "p-6"}
                        className={`relative border ${borderColor} ${isFirst ? "card-glow-winner" : ""}`}
                      >
                        {/* Rank badge */}
                        <div
                          className={`absolute -top-4 left-1/2 -translate-x-1/2 bg-card-dark border ${borderColor} ${color} text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider`}
                        >
                          {isFirst ? "Grand Shogun" : `Rank ${player.rank}`}
                        </div>

                        {/* Avatar */}
                        <div
                          className={`mx-auto ${isFirst ? "size-24" : "size-20"} rounded-full bg-gradient-to-b ${color.replace("text-", "from-")} to-transparent p-1 mb-3`}
                        >
                          <div className="w-full h-full rounded-full bg-card-dark flex items-center justify-center">
                            <Icon name="person" size={isFirst ? 40 : 32} className={color} />
                          </div>
                        </div>

                        {/* Name & Rating */}
                        <h3 className="text-white font-bold text-lg text-center truncate w-full">
                          {player.username}
                        </h3>
                        <div className={`flex items-center justify-center gap-1 ${color} text-sm font-bold mt-1`}>
                          <Icon name="bolt" size={16} />
                          {player.rating} ELO
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${color.replace("text-", "from-")} to-transparent`}
                            style={{ width: `${winRate}%` }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-text-muted text-center">
                          Win Rate: {winRate}%
                        </div>
                      </GlassPanel>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Leaderboard Table */}
          <div className="overflow-x-auto rounded-xl border border-border-dark bg-card-dark/50 backdrop-blur-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-text-muted text-xs uppercase tracking-wider border-b border-border-dark">
                  <th className="px-6 py-4 font-bold">Rank</th>
                  <th className="px-6 py-4 font-bold">Warrior</th>
                  <th className="px-6 py-4 font-bold text-right">Rating</th>
                  <th className="px-6 py-4 font-bold text-right hidden md:table-cell">Win %</th>
                  <th className="px-6 py-4 font-bold text-right hidden md:table-cell">Wins</th>
                  <th className="px-6 py-4 font-bold text-center">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark">
                {(page === 0 ? restOfLeaderboard : leaderboard).map((player) => {
                  const winRate = getWinRate(player.wins, player.losses, player.draws);
                  return (
                    <tr
                      key={player.userId}
                      className="group hover:bg-white/5 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-text-muted font-bold text-sm">
                          {player.rank}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <Icon name="person" size={20} className="text-text-muted" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white font-bold group-hover:text-primary transition-colors">
                              {player.username}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-white font-bold font-mono">{player.rating}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right hidden md:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${winRate}%` }}
                            />
                          </div>
                          <span className="text-sm text-text-muted">{winRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right hidden md:table-cell">
                        <span className="text-white font-mono">{player.wins}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div
                          className={`flex items-center justify-center gap-1 font-bold ${
                            player.winStreak > 0
                              ? "text-green-400"
                              : player.winStreak < 0
                                ? "text-red-400"
                                : "text-text-muted"
                          }`}
                        >
                          <Icon
                            name={
                              player.winStreak > 0
                                ? "local_fire_department"
                                : player.winStreak < 0
                                  ? "trending_down"
                                  : "remove"
                            }
                            size={16}
                          />
                          {Math.abs(player.winStreak)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg bg-white/5 border border-border-dark text-text-muted hover:text-white hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="chevron_left" size={18} />
            </button>
            <span className="px-4 py-2 text-sm text-text-muted">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={leaderboard.length < pageSize}
              className="p-2 rounded-lg bg-white/5 border border-border-dark text-text-muted hover:text-white hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="chevron_right" size={18} />
            </button>
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !error && leaderboard.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="military_tech" size={64} className="text-white/10 mb-4" />
          <p className="text-text-muted text-lg mb-2">No warriors yet</p>
          <p className="text-text-muted/60 text-sm">Be the first to climb the ranks!</p>
        </div>
      )}
    </div>
  );
}
