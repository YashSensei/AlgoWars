"use client";

import Link from "next/link";
import { GlassPanel, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { calculateWinRate } from "@/lib/utils";
import { getRankFromXP, getXPProgress } from "@/lib/xp";

interface GameMode {
  title: string;
  description: string;
  icon: string;
  route: string;
  live: boolean;
}

const GAME_MODES: GameMode[] = [
  {
    title: "Blitz",
    description: "1 problem, 15 minutes",
    icon: "bolt",
    route: "/queue?mode=blitz",
    live: true,
  },
  {
    title: "Classical",
    description: "1 problem, 20 minutes",
    icon: "schedule",
    route: "/queue?mode=classical",
    live: true,
  },
  {
    title: "Against Time",
    description: "Solo, 8 minutes",
    icon: "timer",
    route: "/solo",
    live: true,
  },
  {
    title: "Private Duel",
    description: "Challenge a friend",
    icon: "swords",
    route: "/friend",
    live: true,
  },
  {
    title: "Daily Challenge",
    description: "New problem every day",
    icon: "calendar_today",
    route: "#",
    live: false,
  },
  {
    title: "Code Quest",
    description: "5 MCQs, 5 minutes",
    icon: "quiz",
    route: "#",
    live: false,
  },
  {
    title: "Puzzle",
    description: "Brain teasers & logic",
    icon: "extension",
    route: "#",
    live: false,
  },
  {
    title: "Group Play",
    description: "Collaborative coding",
    icon: "groups",
    route: "#",
    live: false,
  },
];

const NAV_ITEMS = [
  { path: "/arena", icon: "home", label: "Home", active: true },
  { path: "/leaderboard", icon: "leaderboard", label: "Leaderboard", active: false },
  { path: "/profile", icon: "person", label: "Profile", active: false },
];

export default function ArenaPage() {
  const user = useUser();
  const stats = user?.stats;
  const totalMatches = (stats?.wins ?? 0) + (stats?.losses ?? 0) + (stats?.draws ?? 0);
  const winRate = calculateWinRate(stats?.wins ?? 0, totalMatches);
  const xp = stats?.xp ?? 0;
  const rank = getRankFromXP(xp);
  const xpProgress = getXPProgress(xp);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Main 3-column layout — items-stretch so center matches sidebar height */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_240px] gap-6 items-stretch">
        {/* Left Sidebar — Player Stats */}
        <aside className="hidden lg:flex flex-col gap-3">
          <GlassPanel showCornerAccents padding="p-6" className="text-center">
            <div className="size-20 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
              <Icon name="person" size={40} className="text-primary" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              {user?.username ?? "Warrior"}
            </h2>
            <p className="text-xs text-primary uppercase tracking-widest mt-1 font-bold">
              {rank.name}
            </p>
            <p className="text-[10px] text-text-muted font-mono mt-0.5">
              {xp} XP • Rating {stats?.rating ?? 1000}
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] text-text-muted uppercase tracking-widest mb-1.5">
                <span>XP Progress</span>
                <span>{xpProgress.percentage}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full transition-all"
                  style={{ width: `${xpProgress.percentage}%` }}
                />
              </div>
              {rank.maxXp !== Infinity && (
                <p className="text-[9px] text-text-muted mt-1 text-center">
                  {rank.maxXp + 1 - xp} XP to next rank
                </p>
              )}
            </div>
          </GlassPanel>

          <GlassPanel showCornerAccents padding="p-4">
            <StatRow icon="emoji_events" label="Win Rate" value={`${winRate}%`} />
          </GlassPanel>
          <GlassPanel showCornerAccents padding="p-4">
            <StatRow icon="swords" label="Matches Played" value={String(totalMatches)} />
          </GlassPanel>
          <GlassPanel showCornerAccents padding="p-4">
            <StatRow icon="local_fire_department" label="Win Streak" value={String(stats?.winStreak ?? 0)} />
          </GlassPanel>
          <GlassPanel showCornerAccents padding="p-4">
            <StatRow icon="military_tech" label="Best Streak" value={String(stats?.maxStreak ?? 0)} />
          </GlassPanel>
        </aside>

        {/* Center — Game Modes (stretches to full sidebar height) */}
        <main className="flex flex-col h-full">
          <div className="text-center mb-6 pt-2">
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-1">
              Choose Your Battle
            </h1>
            <p className="text-xs font-japanese text-primary tracking-widest">戦闘を選べ</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 flex-1 auto-rows-fr">
            {GAME_MODES.map((mode) => (
              <GameModeCard key={mode.title} mode={mode} />
            ))}
          </div>
        </main>

        {/* Right Sidebar — Navigation + Quick Stats */}
        <aside className="hidden lg:flex flex-col gap-3">
          <GlassPanel showCornerAccents padding="p-4">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    item.active
                      ? "bg-primary/10 text-white border border-primary/20"
                      : "text-text-muted hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    className={item.active ? "text-primary" : "text-text-muted"}
                  />
                  <span className="text-xs font-bold uppercase tracking-wide">{item.label}</span>
                </Link>
              ))}
            </nav>
          </GlassPanel>

          <GlassPanel showCornerAccents padding="p-4">
            <div className="flex flex-col gap-3">
              <QuickStat label="Wins" value={String(stats?.wins ?? 0)} />
              <QuickStat label="Losses" value={String(stats?.losses ?? 0)} />
              <QuickStat label="Draws" value={String(stats?.draws ?? 0)} />
            </div>
          </GlassPanel>
        </aside>
      </div>

      {/* Bottom Section — 3-column footer panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <GlassPanel showCornerAccents padding="p-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {totalMatches > 0 ? (
              <>
                <ActivityRow
                  color="bg-green-500"
                  text={`Won ${stats?.wins ?? 0} matches`}
                  time="Recent"
                />
                <ActivityRow
                  color="bg-primary"
                  text={`Current streak: ${stats?.winStreak ?? 0}`}
                  time="Active"
                />
                <ActivityRow
                  color="bg-blue-400"
                  text={`Rating: ${stats?.rating ?? 1000}`}
                  time="Now"
                />
              </>
            ) : (
              <p className="text-sm text-text-muted">No activity yet. Start a match!</p>
            )}
          </div>
        </GlassPanel>

        {/* Upcoming Features */}
        <GlassPanel showCornerAccents padding="p-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-4">
            Coming Soon
          </h3>
          <div className="space-y-3">
            <UpcomingItem icon="calendar_today" title="Daily Challenges" subtitle="New problem every day" />
            <UpcomingItem icon="groups" title="Group Play" subtitle="Team-based competitive coding" />
            <UpcomingItem icon="quiz" title="Code Quest" subtitle="Quick-fire MCQ battles" />
          </div>
        </GlassPanel>

        {/* Tips & Tricks */}
        <GlassPanel showCornerAccents padding="p-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-4">
            Tips & Tricks
          </h3>
          <div className="space-y-2 text-sm text-text-muted">
            <p>• Play Blitz daily to improve speed under pressure</p>
            <p>• Surrendering costs full Elo — fight until the end</p>
            <p>• Read the examples carefully before coding</p>
            <p>• Try different languages to find your strength</p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function GameModeCard({ mode }: { mode: GameMode }) {
  const content = (
    <GlassPanel
      showCornerAccents
      padding="p-6"
      className={`h-full flex items-center transition-all ${
        mode.live
          ? "hover:border-primary/40 hover:bg-white/[0.03] cursor-pointer"
          : "opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start gap-4 w-full">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon name={mode.icon} size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {!mode.live && (
            <span className="text-[9px] text-primary/80 uppercase tracking-widest font-bold block mb-0.5">
              Coming Soon
            </span>
          )}
          <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight">
            {mode.title}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{mode.description}</p>
        </div>
      </div>
    </GlassPanel>
  );

  if (!mode.live) return <div>{content}</div>;
  return <Link href={mode.route}>{content}</Link>;
}

function StatRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={16} className="text-text-muted" />
        <span className="text-[10px] text-text-muted uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-sm font-bold text-white font-mono">{value}</span>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] text-text-muted uppercase tracking-widest">{label}</span>
      <span className="text-sm font-bold text-white font-mono">{value}</span>
    </div>
  );
}

function ActivityRow({ color, text, time }: { color: string; text: string; time: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-white/70">{text}</span>
      </div>
      <span className="text-[10px] text-text-muted">{time}</span>
    </div>
  );
}

function UpcomingItem({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon name={icon} size={16} className="text-primary" />
      </div>
      <div>
        <p className="text-xs font-bold text-white">{title}</p>
        <p className="text-[10px] text-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
