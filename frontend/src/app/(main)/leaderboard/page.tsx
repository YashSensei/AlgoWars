"use client";

import { GlassPanel, Icon } from "@/components/ui";

// Mock leaderboard data
const topThree = [
  {
    rank: 2,
    username: "BinaryRonin",
    rating: 2840,
    winRate: 85,
    color: "text-blue-400",
    borderColor: "border-blue-400/30",
  },
  {
    rank: 1,
    username: "CodeShogun",
    rating: 3124,
    winRate: 92,
    color: "text-primary",
    borderColor: "border-primary",
    isFirst: true,
  },
  {
    rank: 3,
    username: "AlgoSamurai",
    rating: 2756,
    winRate: 78,
    color: "text-orange-400",
    borderColor: "border-orange-400/30",
  },
];

const leaderboardData = [
  { rank: 4, username: "VoidRunner", rating: 2650, winRate: 72, wins: 156, streak: 5 },
  { rank: 5, username: "NullPointer", rating: 2580, winRate: 68, wins: 142, streak: 3 },
  { rank: 6, username: "AlgoRhythm", rating: 2510, winRate: 75, wins: 134, streak: 0 },
  { rank: 7, username: "ByteNinja", rating: 2485, winRate: 65, wins: 128, streak: -2 },
  { rank: 8, username: "RecursiveRex", rating: 2420, winRate: 70, wins: 115, streak: 4 },
  { rank: 9, username: "StackOverflow", rating: 2380, winRate: 62, wins: 108, streak: 1 },
  { rank: 10, username: "LinkedLegend", rating: 2350, winRate: 69, wins: 102, streak: 0 },
];

export default function LeaderboardPage() {
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

      {/* Top 3 Podium */}
      <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-6 mb-16">
        {topThree.map((player) => (
          <div
            key={player.rank}
            className={`flex-1 max-w-[240px] flex flex-col items-center ${
              player.isFirst ? "order-1 md:order-2 md:-mb-8 z-10" : player.rank === 2 ? "order-2 md:order-1" : "order-3"
            }`}
          >
            <div className="relative group cursor-pointer w-full">
              {/* Crown for rank 1 */}
              {player.isFirst && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-accent-gold drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] z-20 animate-float">
                  <Icon name="workspace_premium" size={40} />
                </div>
              )}

              {/* Glow effect */}
              <div className={`absolute inset-0 bg-gradient-to-b ${player.isFirst ? "from-primary/30" : "from-white/10"} to-transparent blur-xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity`} />

              {/* Card */}
              <GlassPanel
                showCornerAccents={player.isFirst}
                padding={player.isFirst ? "p-8" : "p-6"}
                className={`relative border ${player.borderColor} ${
                  player.isFirst ? "card-glow-winner" : ""
                }`}
              >
                {/* Rank badge */}
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 bg-card-dark border ${player.borderColor} ${player.color} text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider`}>
                  {player.isFirst ? "Grand Shogun" : `Rank ${player.rank}`}
                </div>

                {/* Avatar */}
                <div className={`mx-auto ${player.isFirst ? "size-24" : "size-20"} rounded-full bg-gradient-to-b ${player.color.replace("text-", "from-")} to-transparent p-1 mb-3`}>
                  <div className="w-full h-full rounded-full bg-card-dark flex items-center justify-center">
                    <Icon name="person" size={player.isFirst ? 40 : 32} className={player.color} />
                  </div>
                </div>

                {/* Name & Rating */}
                <h3 className="text-white font-bold text-lg text-center truncate w-full">
                  {player.username}
                </h3>
                <div className={`flex items-center justify-center gap-1 ${player.color} text-sm font-bold mt-1`}>
                  <Icon name="bolt" size={16} />
                  {player.rating} ELO
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${player.color.replace("text-", "from-")} to-transparent`}
                    style={{ width: `${player.winRate}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-text-muted text-center">
                  Win Rate: {player.winRate}%
                </div>
              </GlassPanel>
            </div>
          </div>
        ))}
      </div>

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
            {leaderboardData.map((player) => (
              <tr
                key={player.rank}
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
                        style={{ width: `${player.winRate}%` }}
                      />
                    </div>
                    <span className="text-sm text-text-muted">{player.winRate}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right hidden md:table-cell">
                  <span className="text-white font-mono">{player.wins}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className={`flex items-center justify-center gap-1 font-bold ${
                    player.streak > 0 ? "text-green-400" : player.streak < 0 ? "text-red-400" : "text-text-muted"
                  }`}>
                    <Icon
                      name={player.streak > 0 ? "local_fire_department" : player.streak < 0 ? "trending_down" : "remove"}
                      size={16}
                    />
                    {Math.abs(player.streak)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination placeholder */}
      <div className="flex justify-center items-center gap-2 mt-8">
        <button className="p-2 rounded-lg bg-white/5 border border-border-dark text-text-muted hover:text-white hover:border-white/30 transition-colors">
          <Icon name="chevron_left" size={18} />
        </button>
        <button className="px-4 py-2 rounded-lg bg-primary text-white font-bold text-sm">1</button>
        <button className="px-4 py-2 rounded-lg bg-white/5 border border-border-dark text-text-muted hover:text-white hover:border-white/30 font-medium text-sm transition-colors">2</button>
        <button className="px-4 py-2 rounded-lg bg-white/5 border border-border-dark text-text-muted hover:text-white hover:border-white/30 font-medium text-sm transition-colors">3</button>
        <span className="text-text-muted px-2">...</span>
        <button className="px-4 py-2 rounded-lg bg-white/5 border border-border-dark text-text-muted hover:text-white hover:border-white/30 font-medium text-sm transition-colors">56</button>
        <button className="p-2 rounded-lg bg-white/5 border border-border-dark text-text-muted hover:text-white hover:border-white/30 transition-colors">
          <Icon name="chevron_right" size={18} />
        </button>
      </div>
    </div>
  );
}
