"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, GlassPanel, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { friendApi, ApiClientError } from "@/lib/api";
import type { LobbyResponse } from "@/lib/api/friend";
import { getSocket } from "@/lib/socket";

type LobbyState = "loading" | "lobby" | "expired" | "error" | "not_found";

export default function FriendLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const user = useUser();
  const code = (params.code as string).toUpperCase();

  const [state, setState] = useState<LobbyState>("loading");
  const [lobby, setLobby] = useState<LobbyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Socket listeners for real-time lobby updates
  useEffect(() => {
    if (state !== "lobby") return;
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

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      await friendApi.joinRoom(code);
      await fetchRoom();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const { matchId } = await friendApi.startMatch(code);
      router.push(`/match/${matchId}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to start match");
      setStarting(false);
    }
  };

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

  const showJoinButton = !isHost && !isGuest && lobby.room.status === "waiting";
  const showStartButton = isHost && lobby.canStart;
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
      <div className="w-full max-w-3xl grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
        <PlayerCard label="Host" player={lobby.host} isYou={isHost} ready />

        <div className="flex flex-col items-center gap-2">
          <div className="size-14 rounded-full border-2 border-primary/30 flex items-center justify-center bg-card-dark">
            <span className="text-xl font-black text-primary">VS</span>
          </div>
        </div>

        {lobby.guest ? (
          <PlayerCard label="Guest" player={lobby.guest} isYou={isGuest} ready />
        ) : (
          <GlassPanel
            padding="p-6"
            className="flex flex-col items-center gap-4 border-dashed border-border-dark"
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

        {showJoinButton && (
          <Button variant="primary" size="lg" onClick={handleJoin} disabled={joining} leftIcon="login">
            {joining ? "Joining..." : "Join Match"}
          </Button>
        )}

        {showStartButton && (
          <Button
            variant="primary"
            size="lg"
            onClick={handleStart}
            disabled={starting}
            leftIcon="play_arrow"
          >
            {starting ? "Starting..." : "Start Match"}
          </Button>
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

        {isGuest && lobby.room.status === "ready" && (
          <p className="text-sm text-text-muted">Waiting for host to start the match...</p>
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
  player: { username: string | null; rating: number; wins: number; losses: number; winStreak: number };
  isYou: boolean;
  ready: boolean;
}) {
  const totalMatches = player.wins + player.losses;
  const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0;

  return (
    <GlassPanel showCornerAccents padding="p-6" className="flex flex-col items-center gap-3">
      <span className="text-[10px] text-text-muted uppercase tracking-widest">{label}</span>
      <div className="size-16 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
        <Icon name="person" size={32} className="text-primary" />
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-white uppercase">
          {player.username ?? "Player"} {isYou && <span className="text-primary text-sm">(You)</span>}
        </p>
        <p className="text-xs text-text-muted font-mono">Rating: {player.rating}</p>
      </div>

      <div className="w-full grid grid-cols-3 gap-2 mt-1">
        <StatBox label="Win %" value={`${winRate}%`} />
        <StatBox label="Matches" value={String(totalMatches)} />
        <StatBox label="Streak" value={String(player.winStreak)} highlight />
      </div>

      {ready && (
        <div className="flex items-center gap-1.5 text-green-400 text-xs mt-1">
          <span className="size-2 rounded-full bg-green-400" />
          <span className="uppercase tracking-wide font-bold">Ready</span>
        </div>
      )}
    </GlassPanel>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-center">
      <div className={`text-sm font-bold font-mono ${highlight ? "text-orange-400" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[9px] text-text-muted uppercase tracking-widest">{label}</div>
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
