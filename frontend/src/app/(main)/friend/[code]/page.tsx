"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button, GlassPanel, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { friendApi, ApiClientError } from "@/lib/api";
import type { LobbyResponse } from "@/lib/api/friend";
import { getSocket } from "@/lib/socket";
import { getAvatarUrl } from "@/lib/avatars";

type LobbyState = "loading" | "lobby" | "countdown" | "expired" | "error" | "not_found";

export default function FriendLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const user = useUser();
  const code = (params.code as string).toUpperCase();

  const [state, setState] = useState<LobbyState>("loading");
  const [lobby, setLobby] = useState<LobbyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [copied, setCopied] = useState(false);

  const joinAttempted = useRef(false);
  const startAttempted = useRef(false);

  const isHost = lobby?.host.id === user?.id;
  const isGuest = lobby?.guest?.id === user?.id;

  const fetchRoom = useCallback(async () => {
    try {
      const data = await friendApi.getRoom(code);
      setLobby(data);
      if (data.room.status === "expired") {
        setState("expired");
      } else if (data.room.status === "active" && data.room.matchId) {
        router.push(`/match/${data.room.matchId}`);
      } else {
        setState("lobby");
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setState("not_found");
      } else {
        setError(err instanceof ApiClientError ? err.message : "Failed to load room");
        setState("error");
      }
    }
  }, [code, router]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // Auto-join: guest opens link → joins immediately
  useEffect(() => {
    if (state !== "lobby" || !lobby || !user) return;
    if (isHost || isGuest) return;
    if (lobby.room.status !== "waiting") return;
    if (joinAttempted.current) return;

    joinAttempted.current = true;
    friendApi.joinRoom(code).then((res) => {
      if (res.redirect) {
        router.push(res.redirect);
      } else {
        fetchRoom();
      }
    }).catch((err) => {
      setError(err instanceof ApiClientError ? err.message : "Failed to join");
      setState("error");
    });
  }, [state, lobby, user, isHost, isGuest, code, fetchRoom]);

  // Trigger countdown when both present (host only)
  useEffect(() => {
    if (state !== "lobby" || !lobby?.canStart || !isHost) return;
    if (startAttempted.current) return;
    startAttempted.current = true;
    setState("countdown");
  }, [state, lobby?.canStart, isHost]);

  // Run the countdown timer and start match at 0
  useEffect(() => {
    if (state !== "countdown") return;

    let seconds = 3;
    setCountdown(seconds);

    const interval = setInterval(() => {
      seconds--;
      setCountdown(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        friendApi.startMatch(code).then(({ matchId }) => {
          router.push(`/match/${matchId}`);
        }).catch((err) => {
          setError(err instanceof ApiClientError ? err.message : "Failed to start match");
          setState("error");
          startAttempted.current = false;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, code, router]);

  // Socket listeners
  useEffect(() => {
    if (state !== "lobby" && state !== "countdown") return;
    const socket = getSocket();

    const handleLobbyUpdate = (data: LobbyResponse) => {
      setLobby(data);
      if (data.room.status === "expired") setState("expired");
    };

    const handleMatchCreated = ({ matchId }: { matchId: string }) => {
      router.push(`/match/${matchId}`);
    };

    socket.on("friend:lobby-update", handleLobbyUpdate);
    socket.on("friend:match-created", handleMatchCreated);

    return () => {
      socket.off("friend:lobby-update", handleLobbyUpdate);
      socket.off("friend:match-created", handleMatchCreated);
    };
  }, [state, router]);

  const handleCopy = () => {
    const url = `${window.location.origin}/friend/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (state === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "not_found") {
    return <ErrorView title="Room Not Found" message="This invite link is invalid or has expired." />;
  }

  if (state === "expired") {
    return (
      <ErrorView title="Room Expired" message="This room has expired. Create a new duel instead.">
        <Button variant="primary" onClick={() => router.push("/friend")} leftIcon="add">
          New Duel
        </Button>
      </ErrorView>
    );
  }

  if (state === "error") {
    return <ErrorView title="Error" message={error ?? "Something went wrong"} />;
  }

  if (!lobby) return null;

  const showWaiting = isHost && lobby.room.status === "waiting";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 gap-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-1">
          Private Duel
        </h1>
        <p className="text-xs font-japanese text-primary tracking-widest">決闘</p>
      </div>

      {/* Players VS Layout */}
      <div className="w-full max-w-3xl grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-stretch">
        <PlayerCard label="Host" player={lobby.host} isYou={isHost} ready />

        <div className="flex flex-col items-center justify-center gap-2">
          <div className={`size-14 rounded-full border-2 flex items-center justify-center bg-card-dark transition-all ${
            state === "countdown" ? "border-green-400 scale-110" : "border-primary/30"
          }`}>
            {state === "countdown" ? (
              <span className="text-2xl font-black text-green-400">{countdown}</span>
            ) : (
              <span className="text-xl font-black text-primary">VS</span>
            )}
          </div>
          {state === "countdown" && (
            <p className="text-xs text-green-400 font-bold uppercase tracking-widest animate-pulse">
              Match starting...
            </p>
          )}
        </div>

        {lobby.guest ? (
          <PlayerCard label="Guest" player={lobby.guest} isYou={isGuest} ready />
        ) : (
          <GlassPanel
            padding="p-6"
            className="flex flex-col items-center justify-center gap-4 border-dashed border-border-dark h-full min-h-[200px]"
          >
            <div className="size-16 rounded-xl bg-bg-dark border border-border-dark flex items-center justify-center animate-pulse">
              <Icon name="person_add" size={32} className="text-border-dark" />
            </div>
            <p className="text-sm text-text-muted">Waiting for opponent...</p>
          </GlassPanel>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-4 mt-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm max-w-sm text-center">
            {error}
          </div>
        )}

        {showWaiting && (
          <GlassPanel padding="p-4" className="max-w-sm w-full">
            <p className="text-xs text-text-muted uppercase tracking-widest text-center mb-3">
              Share this link with your friend
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-bg-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white font-mono truncate">
                {typeof window !== "undefined" ? `${window.location.origin}/friend/${code}` : code}
              </div>
              <Button variant="secondary" size="sm" onClick={handleCopy} leftIcon="content_copy">
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </GlassPanel>
        )}

        {isGuest && lobby.room.status === "ready" && state !== "countdown" && (
          <p className="text-sm text-text-muted">Waiting for match to start...</p>
        )}
      </div>
    </div>
  );
}

function PlayerCard({
  label,
  player,
  isYou,
  ready,
}: {
  label: string;
  player: { username: string | null; avatar: string | null; rating: number; wins: number; losses: number; winStreak: number };
  isYou: boolean;
  ready: boolean;
}) {
  const totalMatches = player.wins + player.losses;
  const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0;

  return (
    <GlassPanel showCornerAccents padding="p-6" className="w-full">
      <div className="flex flex-col items-center gap-4">
        <span className="text-[10px] text-text-muted uppercase tracking-widest">{label}</span>

        <div className="size-24 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center overflow-hidden">
          {player.avatar ? (
            <Image src={getAvatarUrl(player.avatar)} alt="" width={96} height={96} className="w-full h-full object-cover" />
          ) : (
            <Icon name="person" size={48} className="text-primary" />
          )}
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xl font-bold text-white uppercase">
            {player.username ?? "Player"} {isYou && <span className="text-primary text-sm">(You)</span>}
          </span>
          <span className="text-sm text-text-muted font-mono">Rating: {player.rating}</span>
        </div>

        <div className="w-full grid grid-cols-3 gap-3 mt-2">
          <StatBox label="Win %" value={`${winRate}%`} />
          <StatBox label="Matches" value={String(totalMatches)} />
          <StatBox label="Streak" value={String(player.winStreak)} highlight />
        </div>

        {ready && (
          <div className="flex items-center gap-2 text-green-400 text-sm mt-2">
            <span className="size-2 rounded-full bg-green-400 animate-pulse" />
            <span className="uppercase tracking-wide font-bold">Ready</span>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center">
      <div className={`text-lg font-bold font-mono ${highlight ? "text-orange-400" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[10px] text-text-muted uppercase tracking-widest">{label}</div>
    </div>
  );
}

function ErrorView({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
      <GlassPanel showCornerAccents padding="p-8" className="max-w-sm text-center">
        <Icon name="error_outline" size={48} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-text-muted mb-4">{message}</p>
        {children}
      </GlassPanel>
    </div>
  );
}
