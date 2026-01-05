"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassPanel, Button, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { formatRatingChange } from "@/lib/utils";

// Mock match result
const mockResult = {
  isWinner: true,
  ratingChange: 25,
  opponent: {
    username: "CodeNinja",
    rating: 1450,
    ratingChange: -25,
  },
  problem: {
    title: "Two Sum",
    difficulty: "easy" as const,
  },
  stats: {
    yourTime: "12:34",
    opponentTime: "15:21",
    yourSubmissions: 2,
    opponentSubmissions: 4,
  },
};

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const user = useUser();

  const surrendered = searchParams.get("surrendered") === "true";
  const [showAnimation, setShowAnimation] = useState(false);
  const [animatedRating, setAnimatedRating] = useState(0);

  // Determine result (in real app, fetch from API)
  const isWinner = surrendered ? false : mockResult.isWinner;
  const ratingChange = surrendered ? -30 : mockResult.ratingChange;
  const currentRating = user?.stats?.rating ?? 1200;
  const newRating = currentRating + (isWinner ? Math.abs(ratingChange) : -Math.abs(ratingChange));

  // Animate on mount
  useEffect(() => {
    setShowAnimation(true);

    // Animate rating change
    const duration = 1500;
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
    }, duration / steps);

    return () => clearInterval(interval);
  }, [ratingChange]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Victory/Defeat Background Effect */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          showAnimation ? "opacity-100" : "opacity-0"
        }`}
      >
        {isWinner ? (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
          </>
        ) : (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[100px]" />
          </>
        )}
      </div>

      {/* Result Content */}
      <div
        className={`relative z-10 flex flex-col items-center max-w-2xl w-full transition-all duration-700 ${
          showAnimation ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Result Icon */}
        <div
          className={`size-24 rounded-full flex items-center justify-center mb-6 ${
            isWinner
              ? "bg-gradient-to-br from-green-400/20 to-primary/20 border-2 border-green-400/50"
              : "bg-gradient-to-br from-red-400/20 to-red-500/20 border-2 border-red-400/50"
          }`}
        >
          <Icon
            name={isWinner ? "emoji_events" : "sentiment_dissatisfied"}
            size={48}
            className={isWinner ? "text-green-400" : "text-red-400"}
          />
        </div>

        {/* Result Title */}
        <h1
          className={`text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 ${
            isWinner ? "text-green-400" : "text-red-400"
          }`}
        >
          {surrendered ? "Surrendered" : isWinner ? "Victory" : "Defeat"}
        </h1>

        {/* Japanese subtitle */}
        <p className="text-lg font-japanese text-white/30 mb-8 tracking-widest">
          {isWinner ? "勝利" : "敗北"}
        </p>

        {/* Rating Change Card */}
        <GlassPanel
          showCornerAccents
          padding="p-8"
          className={`w-full max-w-md text-center mb-8 border ${
            isWinner ? "border-green-400/30" : "border-red-400/30"
          }`}
        >
          <div className="text-sm text-text-muted uppercase tracking-wider mb-2">
            Rating Change
          </div>
          <div
            className={`text-5xl font-black font-mono tabular-nums ${
              animatedRating > 0
                ? "text-green-400"
                : animatedRating < 0
                  ? "text-red-400"
                  : "text-white"
            }`}
          >
            {formatRatingChange(animatedRating)}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-xs text-text-muted uppercase tracking-wider">
                Previous
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {currentRating}
              </div>
            </div>
            <Icon name="arrow_forward" size={24} className="text-text-muted" />
            <div className="text-center">
              <div className="text-xs text-text-muted uppercase tracking-wider">
                New
              </div>
              <div
                className={`text-xl font-bold font-mono ${
                  isWinner ? "text-green-400" : "text-red-400"
                }`}
              >
                {newRating}
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* Match Summary */}
        <div className="w-full max-w-lg grid grid-cols-2 gap-4 mb-8">
          {/* Your Stats */}
          <GlassPanel padding="p-4" className="border border-green-400/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-lg bg-green-400/10 flex items-center justify-center">
                <Icon name="person" size={18} className="text-green-400" />
              </div>
              <span className="text-sm font-bold text-white">
                {user?.username ?? "You"}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Time</span>
                <span className="text-white font-mono">{mockResult.stats.yourTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Submissions</span>
                <span className="text-white font-mono">{mockResult.stats.yourSubmissions}</span>
              </div>
            </div>
          </GlassPanel>

          {/* Opponent Stats */}
          <GlassPanel padding="p-4" className="border border-red-400/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-lg bg-red-400/10 flex items-center justify-center">
                <Icon name="person" size={18} className="text-red-400" />
              </div>
              <span className="text-sm font-bold text-white">
                {mockResult.opponent.username}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Time</span>
                <span className="text-white font-mono">{mockResult.stats.opponentTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Submissions</span>
                <span className="text-white font-mono">{mockResult.stats.opponentSubmissions}</span>
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Problem Info */}
        <div className="flex items-center gap-3 mb-8 text-sm text-text-muted">
          <Icon name="description" size={18} className="text-primary" />
          <span>Problem:</span>
          <span className="text-white font-bold">{mockResult.problem.title}</span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
              mockResult.problem.difficulty === "easy"
                ? "bg-green-400/20 text-green-400"
                : mockResult.problem.difficulty === "medium"
                  ? "bg-yellow-400/20 text-yellow-400"
                  : "bg-red-400/20 text-red-400"
            }`}
          >
            {mockResult.problem.difficulty}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/queue">
            <Button variant="primary" size="lg" leftIcon="play_arrow">
              Play Again
            </Button>
          </Link>
          <Link href="/arena">
            <Button variant="secondary" size="lg" leftIcon="home">
              Return to Arena
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
