"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, GlassPanel, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { formatTime } from "@/lib/utils";

export default function QueuePage() {
  const router = useRouter();
  const user = useUser();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSearching, setIsSearching] = useState(true);

  // Timer effect
  useEffect(() => {
    if (!isSearching) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSearching]);

  const handleCancel = () => {
    setIsSearching(false);
    router.push("/arena");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      {/* Status Heading */}
      <div className="flex flex-col items-center mb-12 text-center gap-2">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2">
          Searching for Opponent
        </h1>
        <p className="text-text-muted text-sm md:text-base">
          Finding a worthy challenger for you...
        </p>
      </div>

      {/* VS Section */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-12 items-center mb-12">
        {/* Player Card (You) */}
        <div className="flex justify-center lg:justify-end">
          <GlassPanel
            showCornerAccents
            padding="p-6"
            className="w-full max-w-sm"
          >
            <div className="flex flex-col items-center gap-4">
              {/* Avatar */}
              <div className="size-24 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Icon name="person" size={48} className="text-primary" />
              </div>

              {/* Name & Rating */}
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-white uppercase">
                  {user?.username ?? "You"}
                </span>
                <span className="text-sm text-text-muted font-mono">
                  Rating: {user?.stats?.rating ?? 1200}
                </span>
              </div>

              {/* Stats */}
              <div className="w-full grid grid-cols-2 gap-3 mt-2">
                <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center">
                  <div className="text-lg font-bold text-white font-mono">
                    {user?.stats?.wins ?? 0}
                  </div>
                  <div className="text-[10px] text-text-muted uppercase tracking-widest">
                    Wins
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center">
                  <div className="text-lg font-bold text-white font-mono">
                    {user?.stats?.winStreak ?? 0}
                  </div>
                  <div className="text-[10px] text-text-muted uppercase tracking-widest">
                    Streak
                  </div>
                </div>
              </div>

              {/* Ready indicator */}
              <div className="flex items-center gap-2 text-green-400 text-sm mt-2">
                <span className="size-2 rounded-full bg-green-400 animate-pulse" />
                <span className="uppercase tracking-wide font-bold">Ready</span>
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* VS Divider */}
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 rounded-full border-2 border-primary/30 flex items-center justify-center bg-card-dark">
            <span className="text-2xl font-black text-primary">VS</span>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-white font-mono tabular-nums tracking-widest">
              {formatTime(elapsedTime)}
            </span>
            <span className="text-xs text-text-muted">Elapsed Time</span>
          </div>
        </div>

        {/* Opponent Card (Searching) */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm bg-card-dark/40 border border-dashed border-border-dark rounded-lg p-6 flex flex-col gap-4 items-center justify-center min-h-[320px] relative overflow-hidden">
            {/* Scan line animation */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-[50%] animate-scan pointer-events-none" />

            {/* Question mark avatar */}
            <div className="size-24 rounded-xl bg-bg-dark border border-border-dark flex items-center justify-center animate-pulse">
              <Icon name="question_mark" size={48} className="text-border-dark" />
            </div>

            {/* Placeholder text */}
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="h-6 w-32 bg-border-dark rounded animate-pulse" />
              <div className="h-4 w-20 bg-border-dark/50 rounded animate-pulse" />
            </div>

            {/* Placeholder stats */}
            <div className="w-full grid grid-cols-2 gap-3 mt-2 opacity-50">
              <div className="p-3 bg-bg-dark rounded-lg border border-border-dark flex items-center justify-center">
                <div className="h-4 w-8 bg-border-dark rounded" />
              </div>
              <div className="p-3 bg-bg-dark rounded-lg border border-border-dark flex items-center justify-center">
                <div className="h-4 w-8 bg-border-dark rounded" />
              </div>
            </div>

            {/* Waiting text */}
            <div className="text-text-muted text-sm font-mono animate-pulse mt-2">
              Waiting for match...
            </div>
          </div>
        </div>
      </div>

      {/* Queue Info */}
      <div className="flex items-center gap-6 mb-8 text-sm text-text-muted">
        <div className="flex items-center gap-2">
          <Icon name="people" size={18} className="text-primary" />
          <span>12 players in queue</span>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="schedule" size={18} className="text-primary" />
          <span>Est. wait: ~30s</span>
        </div>
      </div>

      {/* Cancel Button */}
      <Button
        variant="danger"
        size="lg"
        leftIcon="close"
        onClick={handleCancel}
        className="rounded-full"
      >
        Abort Mission
      </Button>

      {/* Japanese text */}
      <p className="text-xs font-japanese text-white/20 mt-8 tracking-widest">
        対戦相手を検索中
      </p>
    </div>
  );
}
