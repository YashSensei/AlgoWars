"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, GlassPanel, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { formatTime } from "@/lib/utils";
import { matchesApi, ApiClientError } from "@/lib/api";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { QueueMatchedEvent, MatchCountdownEvent } from "@/lib/api/types";

type QueueState = "joining" | "searching" | "matched" | "countdown" | "error";

export default function QueuePage() {
  const router = useRouter();
  const user = useUser();

  // Queue state
  const [queueState, setQueueState] = useState<QueueState>("joining");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Match found state
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);
  const [countdown, setCountdown] = useState<number>(5);

  // Ref to track current matchId for socket callbacks
  const matchIdRef = useRef<string | null>(null);

  // Sync ref with state (must be in useEffect, not during render)
  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  // Join queue on mount - connect socket FIRST, then join queue
  useEffect(() => {
    let mounted = true;

    const joinQueue = async () => {
      try {
        // Connect socket BEFORE joining queue so we don't miss the match event
        const socket = getSocket();

        // Wait for socket to connect before joining queue
        if (!socket.connected) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Socket connection timeout")), 5000);
            socket.once("connect", () => {
              clearTimeout(timeout);
              resolve();
            });
            socket.once("connect_error", (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });
        }

        if (!mounted) return;

        // Now join queue via REST API
        const response = await matchesApi.joinQueue();

        if (!mounted) return;

        if (response.status === "matched") {
          // Immediately matched!
          setMatchId(response.matchId!);
          setOpponent({
            id: response.opponentId!,
            username: response.opponentName!,
          });
          setQueueState("matched");
        } else if (response.status === "already_in_match") {
          // Already in an active match - redirect to it
          router.push(`/match/${response.matchId}`);
        } else {
          // In queue, waiting for match
          setQueueState("searching");
        }
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof ApiClientError ? err.message : "Failed to join queue";
        setError(message);
        setQueueState("error");
      }
    };

    joinQueue();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Setup socket listeners for queue:matched - listen as soon as we start joining
  useEffect(() => {
    if (queueState === "error" || queueState === "matched" || queueState === "countdown") return;

    const socket = getSocket();

    // Listen for match found
    const handleMatched = (data: QueueMatchedEvent) => {
      console.log("[Queue] Match found via socket:", data);
      setMatchId(data.matchId);
      setOpponent(data.opponent);
      setQueueState("matched");
    };

    socket.on("queue:matched", handleMatched);

    return () => {
      socket.off("queue:matched", handleMatched);
    };
  }, [queueState]);

  // Setup socket listeners when matched and auto-redirect after brief delay
  useEffect(() => {
    if (queueState !== "matched" || !matchId) return;

    const socket = getSocket();

    // Join match room
    socket.emit("match:join", { matchId, opponentId: opponent?.id });

    // Listen for countdown
    const handleCountdown = (data: MatchCountdownEvent) => {
      setCountdown(data.seconds);
      setQueueState("countdown");
    };

    // Listen for match start
    const handleStart = () => {
      router.push(`/match/${matchIdRef.current}`);
    };

    socket.on("match:countdown", handleCountdown);
    socket.on("match:start", handleStart);

    // Auto-redirect to match page after 2 seconds if no countdown/start event
    // This handles the case where both players matched but no countdown is sent
    const autoRedirectTimer = setTimeout(() => {
      console.log("[Queue] Auto-redirecting to match page");
      router.push(`/match/${matchIdRef.current}`);
    }, 2000);

    return () => {
      socket.off("match:countdown", handleCountdown);
      socket.off("match:start", handleStart);
      clearTimeout(autoRedirectTimer);
    };
  }, [queueState, matchId, opponent?.id, router]);

  // Timer effect for elapsed time
  useEffect(() => {
    if (queueState !== "searching") return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [queueState]);

  // Cancel and leave queue
  const handleCancel = async () => {
    try {
      await matchesApi.leaveQueue();
      disconnectSocket();
      router.push("/arena");
    } catch {
      // Even if API fails, navigate away
      router.push("/arena");
    }
  };

  // Retry joining queue
  const handleRetry = () => {
    setError(null);
    setQueueState("joining");
    setElapsedTime(0);
    // Re-trigger the join effect by remounting
    window.location.reload();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      {/* Status Heading */}
      <div className="flex flex-col items-center mb-12 text-center gap-2">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2">
          {queueState === "joining" && "Joining Queue..."}
          {queueState === "searching" && "Searching for Opponent"}
          {queueState === "matched" && "Opponent Found!"}
          {queueState === "countdown" && "Match Starting!"}
          {queueState === "error" && "Queue Error"}
        </h1>
        <p className="text-text-muted text-sm md:text-base">
          {queueState === "joining" && "Connecting to matchmaking server..."}
          {queueState === "searching" && "Finding a worthy challenger for you..."}
          {queueState === "matched" && "Get ready for battle!"}
          {queueState === "countdown" && `Starting in ${countdown} seconds...`}
          {queueState === "error" && error}
        </p>
      </div>

      {/* Error State */}
      {queueState === "error" && (
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm max-w-md text-center">
            {error}
          </div>
          <div className="flex gap-4">
            <Button variant="primary" onClick={handleRetry} leftIcon="refresh">
              Retry
            </Button>
            <Button variant="secondary" onClick={() => router.push("/arena")}>
              Back to Arena
            </Button>
          </div>
        </div>
      )}

      {/* VS Section */}
      {queueState !== "error" && (
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-12 items-center mb-12">
          {/* Player Card (You) */}
          <div className="flex justify-center lg:justify-end">
            <GlassPanel showCornerAccents padding="p-6" className="w-full max-w-sm">
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
            <div
              className={`size-16 rounded-full border-2 flex items-center justify-center bg-card-dark transition-all ${
                queueState === "matched" || queueState === "countdown"
                  ? "border-green-400 scale-110"
                  : "border-primary/30"
              }`}
            >
              {queueState === "countdown" ? (
                <span className="text-3xl font-black text-green-400">{countdown}</span>
              ) : (
                <span className="text-2xl font-black text-primary">VS</span>
              )}
            </div>

            {/* Timer */}
            {queueState === "searching" && (
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-white font-mono tabular-nums tracking-widest">
                  {formatTime(elapsedTime)}
                </span>
                <span className="text-xs text-text-muted">Elapsed Time</span>
              </div>
            )}
          </div>

          {/* Opponent Card */}
          <div className="flex justify-center lg:justify-start">
            {opponent ? (
              // Opponent found
              <GlassPanel
                showCornerAccents
                padding="p-6"
                className="w-full max-w-sm border-green-400/30"
              >
                <div className="flex flex-col items-center gap-4">
                  {/* Avatar */}
                  <div className="size-24 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <Icon name="person" size={48} className="text-red-400" />
                  </div>

                  {/* Name */}
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-bold text-white uppercase">
                      {opponent.username}
                    </span>
                    <span className="text-sm text-text-muted font-mono">Opponent</span>
                  </div>

                  {/* Matched indicator */}
                  <div className="flex items-center gap-2 text-green-400 text-sm mt-2">
                    <Icon name="check_circle" size={16} />
                    <span className="uppercase tracking-wide font-bold">Matched!</span>
                  </div>
                </div>
              </GlassPanel>
            ) : (
              // Searching placeholder
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

                {/* Waiting text */}
                <div className="text-text-muted text-sm font-mono animate-pulse mt-2">
                  {queueState === "joining" ? "Connecting..." : "Waiting for match..."}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Button */}
      {(queueState === "searching" || queueState === "joining") && (
        <Button
          variant="danger"
          size="lg"
          leftIcon="close"
          onClick={handleCancel}
          className="rounded-full"
        >
          Abort Mission
        </Button>
      )}

      {/* Japanese text */}
      <p className="text-xs font-japanese text-white/20 mt-8 tracking-widest">
        {queueState === "matched" || queueState === "countdown"
          ? "対戦開始"
          : "対戦相手を検索中"}
      </p>
    </div>
  );
}
