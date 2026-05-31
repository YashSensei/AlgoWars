"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassPanel, Button, Icon } from "@/components/ui";
import { useUser, useAuthStore } from "@/stores";
import { formatRatingChange } from "@/lib/utils";
import { getRankFromXP, getXPProgress } from "@/lib/xp";
import { matchesApi, ApiClientError } from "@/lib/api";
import type { Match } from "@/lib/api/types";

type MatchSubmission = {
  id: string;
  userId: string;
  language: string;
  verdict: string;
  code: string;
  submittedAt: string;
  judgedAt: string | null;
  user: { id: string; username: string | null };
};

export default function ResultsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const user = useUser();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const matchId = params.id as string;

  const winnerId = searchParams.get("winner");
  const reason = searchParams.get("reason");

  const [match, setMatch] = useState<Match | null>(null);
  const [submissions, setSubmissions] = useState<MatchSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animatedRating, setAnimatedRating] = useState(0);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [matchData, subs] = await Promise.all([
          matchesApi.getMatch(matchId),
          matchesApi.getSubmissions(matchId).catch(() => ({ submissions: [] })),
        ]);
        setMatch(matchData);
        setSubmissions(subs.submissions);
        await refreshUser();
      } catch (err) {
        console.error("Failed to load match:", err instanceof ApiClientError ? err.message : err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [matchId, refreshUser]);

  const myPlayer = match?.players.find((p) => p.user.id === user?.id);
  const opponentPlayer = match?.players.find((p) => p.user.id !== user?.id);

  const isWinner = winnerId === user?.id || myPlayer?.result === "WON";
  const isDraw = myPlayer?.result === "DRAW";
  const isSoloMode = match?.mode === "TIMED";
  const ratingChange = isSoloMode
    ? 0
    : myPlayer?.ratingAfter && myPlayer?.ratingBefore
      ? myPlayer.ratingAfter - myPlayer.ratingBefore
      : isWinner ? 5 : isDraw ? 0 : -5;

  const hasAccepted = submissions.some((s) => s.verdict === "ACCEPTED");
  const loserPlayer = match?.players.find((p) => p.result === "LOST");
  const wasForfeit = !!match?.players.find((p) => p.result === "WON") && !hasAccepted;
  const forfeiterName = wasForfeit ? loserPlayer?.user.username : null;

  useEffect(() => {
    if (loading) return;
    setShowAnimation(true);

    const steps = 30;
    const increment = ratingChange / steps;
    let current = 0;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current += increment;
      setAnimatedRating(Math.round(current));
      if (step >= steps) {
        setAnimatedRating(ratingChange);
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [loading, ratingChange]);

  const getReasonText = () => {
    switch (reason) {
      case "solved":
        return isWinner ? "You solved the problem first!" : "Your opponent solved it first.";
      case "forfeit":
        return isWinner ? "Your opponent surrendered." : "You surrendered.";
      case "disconnect":
        return isWinner ? "Your opponent disconnected." : "You disconnected.";
      case "timeout":
        return "Time ran out!";
      default:
        return isWinner ? "Congratulations on your victory!" : "Better luck next time!";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const winningSubmission = submissions.find((s) => s.verdict === "ACCEPTED");

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${showAnimation ? "opacity-100" : "opacity-0"}`}>
        {isWinner ? (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-[100px]" />
          </>
        ) : isDraw ? (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-[100px]" />
          </>
        ) : (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[100px]" />
          </>
        )}
      </div>

      {/* Content */}
      <div className={`relative z-10 w-full max-w-6xl transition-all duration-700 ${showAnimation ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        {/* Result Banner — compact */}
        <div className="flex flex-col items-center mb-6">
          <div className={`size-16 rounded-full flex items-center justify-center mb-3 border-2 ${
            isWinner
              ? "bg-gradient-to-br from-green-400/20 to-green-500/20 border-green-400/50"
              : isDraw
                ? "bg-gradient-to-br from-yellow-400/20 to-yellow-500/20 border-yellow-400/50"
                : "bg-gradient-to-br from-red-400/20 to-red-500/20 border-red-400/50"
          }`}>
            <Icon
              name={isWinner ? "emoji_events" : isDraw ? "handshake" : "sentiment_dissatisfied"}
              size={32}
              className={isWinner ? "text-green-400" : isDraw ? "text-yellow-400" : "text-red-400"}
            />
          </div>
          <h1 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter ${
            isWinner ? "text-green-400" : isDraw ? "text-yellow-400" : "text-red-400"
          }`}>
            {isWinner ? "Victory" : isDraw ? "Draw" : "Defeat"}
          </h1>
          <p className="text-sm font-japanese text-white/30 tracking-widest mt-1">
            {isWinner ? "勝利" : isDraw ? "引分" : "敗北"}
          </p>
          <p className="text-text-muted text-xs mt-2">{getReasonText()}</p>
          {forfeiterName && (
            <p className="text-yellow-400/80 text-[10px] italic mt-1">{forfeiterName} surrendered</p>
          )}
        </div>

        {/* Two-column layout: Stats (left) + Solution (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 max-w-5xl mx-auto">
          {/* Left Column: Rating + XP + Players */}
          <div className="flex flex-col gap-4">
            {/* Rating Change */}
            <RatingCard
              animatedRating={animatedRating}
              ratingChange={ratingChange}
              ratingBefore={myPlayer?.ratingBefore ?? user?.stats?.rating ?? 1200}
              ratingAfter={myPlayer?.ratingAfter ?? (user?.stats?.rating ?? 1200) + ratingChange}
              isSoloMode={isSoloMode}
              isWinner={isWinner}
              isDraw={isDraw}
              xpGain={isWinner ? 10 : isDraw ? 3 : 5}
            />

            {/* XP Progress */}
            {user?.stats && <XPCard xp={user.stats.xp} />}

            {/* Player Results */}
            {opponentPlayer && (
              <div className="grid grid-cols-2 gap-3">
                <PlayerResultCard
                  username={user?.username ?? "You"}
                  result={myPlayer?.result ?? "PENDING"}
                  isYou
                />
                <PlayerResultCard
                  username={opponentPlayer.user.username ?? "Opponent"}
                  result={opponentPlayer.result}
                  isYou={false}
                />
              </div>
            )}
          </div>

          {/* Right Column: Winning Solution */}
          <div className="flex flex-col min-h-0">
            {winningSubmission ? (
              <GlassPanel padding="p-4" className="border border-green-400/30 bg-green-400/5 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="code" size={18} className="text-primary" />
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    Winning Solution
                  </span>
                  <span className="text-xs font-japanese text-white/20 ml-auto">優勝解</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold text-white">
                    {winningSubmission.user.username ?? "Unknown"}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded border text-green-400 bg-green-400/10 border-green-400/30">
                    ACCEPTED
                  </span>
                  <span className="text-[10px] text-text-muted uppercase tracking-widest">
                    {winningSubmission.language}
                  </span>
                  <Icon name="emoji_events" size={14} className="text-green-400 ml-auto" />
                </div>
                <pre className="text-xs font-mono text-white/80 bg-black/40 p-3 rounded border border-white/5 overflow-x-auto overflow-y-auto flex-1 max-h-[400px]">
                  <code>{winningSubmission.code}</code>
                </pre>
              </GlassPanel>
            ) : (
              <GlassPanel padding="p-6" className="border border-white/10 flex-1 flex items-center justify-center">
                <div className="text-center text-text-muted">
                  <Icon name="code_off" size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No accepted solution this match</p>
                </div>
              </GlassPanel>
            )}
          </div>
        </div>

        {/* Bottom: Problem Info + Actions */}
        <div className="flex flex-col items-center gap-4">
          {match?.problem && (
            <div className="flex items-center gap-3 text-sm text-text-muted">
              <Icon name="description" size={16} className="text-primary" />
              <span>Problem:</span>
              <span className="text-white font-bold">{match.problem.title}</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${getDifficultyClass(match.problem.difficulty)}`}>
                {match.problem.difficulty}
              </span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Link href="/queue">
              <Button variant="primary" size="lg" leftIcon="play_arrow">Play Next</Button>
            </Link>
            <Link href="/arena">
              <Button variant="secondary" size="lg" leftIcon="home">Return to Arena</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RatingCard({
  animatedRating,
  ratingChange,
  ratingBefore,
  ratingAfter,
  isSoloMode,
  isWinner,
  isDraw,
  xpGain,
}: {
  animatedRating: number;
  ratingChange: number;
  ratingBefore: number;
  ratingAfter: number;
  isSoloMode: boolean;
  isWinner: boolean;
  isDraw: boolean;
  xpGain: number;
}) {
  const color = isWinner ? "text-green-400" : isDraw ? "text-yellow-400" : "text-red-400";
  const borderColor = isWinner ? "border-green-400/30" : isDraw ? "border-yellow-400/30" : "border-red-400/30";

  return (
    <GlassPanel showCornerAccents padding="p-5" className={`text-center border ${borderColor}`}>
      <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Rating Change</div>
      <div className={`text-4xl font-black font-mono tabular-nums ${animatedRating > 0 ? "text-green-400" : animatedRating < 0 ? "text-red-400" : "text-yellow-400"}`}>
        {isSoloMode ? "—" : formatRatingChange(animatedRating)}
      </div>
      <div className="text-[10px] text-primary font-bold mt-1">+{xpGain} XP</div>
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="text-[9px] text-text-muted uppercase">Previous</div>
          <div className="text-lg font-bold text-white font-mono">{ratingBefore}</div>
        </div>
        <Icon name="arrow_forward" size={16} className="text-text-muted" />
        <div className="text-center">
          <div className="text-[9px] text-text-muted uppercase">New</div>
          <div className={`text-lg font-bold font-mono ${color}`}>{ratingAfter}</div>
        </div>
      </div>
    </GlassPanel>
  );
}

function XPCard({ xp }: { xp: number }) {
  const rank = getRankFromXP(xp);
  const progress = getXPProgress(xp);

  return (
    <GlassPanel padding="p-3" className="border border-primary/20">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon name="military_tech" size={14} className="text-primary" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wide">{rank.name}</span>
        </div>
        <span className="text-[10px] text-text-muted font-mono">{xp} XP</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full transition-all"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      {rank.maxXp !== Infinity && (
        <p className="text-[9px] text-text-muted mt-1 text-center">
          {rank.maxXp + 1 - xp} XP to next rank
        </p>
      )}
    </GlassPanel>
  );
}

function PlayerResultCard({
  username,
  result,
  isYou,
}: {
  username: string;
  result: string;
  isYou: boolean;
}) {
  const resultColor = result === "WON" ? "text-green-400" : result === "DRAW" ? "text-yellow-400" : "text-red-400";
  const borderColor = isYou ? "border-green-400/20" : "border-red-400/20";

  return (
    <GlassPanel padding="p-3" className={`border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`size-6 rounded-lg ${isYou ? "bg-primary/10" : "bg-red-400/10"} flex items-center justify-center`}>
          <Icon name="person" size={14} className={isYou ? "text-primary" : "text-red-400"} />
        </div>
        <span className="text-xs font-bold text-white truncate">{username}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-text-muted">Result</span>
        <span className={`text-xs font-bold ${resultColor}`}>{result}</span>
      </div>
    </GlassPanel>
  );
}

function getDifficultyClass(difficulty: number | undefined | null): string {
  const d = difficulty ?? 0;
  if (d < 1200) return "bg-green-400/20 text-green-400";
  if (d < 1600) return "bg-yellow-400/20 text-yellow-400";
  return "bg-red-400/20 text-red-400";
}
