"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, GlassPanel, Icon, Input } from "@/components/ui";
import { useAuthStore, useUser } from "@/stores";
import { api, ApiClientError } from "@/lib/api";
import { getSocket } from "@/lib/socket";

interface WaitlistStatus {
  status: string;
  waitlistNumber: number | null;
  totalWaitlisted: number;
  currentWave: number;
  joinedAt: string;
}

export default function WaitlistPage() {
  const router = useRouter();
  const user = useUser();
  const logout = useAuthStore((s) => s.logout);
  const [waitlistData, setWaitlistData] = useState<WaitlistStatus | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // If user is already approved, redirect to arena
  useEffect(() => {
    if (user?.status === "APPROVED") router.push("/arena");
  }, [user?.status, router]);

  // Fetch waitlist status
  useEffect(() => {
    api.get<WaitlistStatus>("/users/me/waitlist-status").then(setWaitlistData).catch(() => {});
  }, []);

  // Listen for realtime approval
  useEffect(() => {
    const socket = getSocket();
    const handleApproved = () => {
      useAuthStore.getState().refreshUser().then(() => router.push("/arena"));
    };
    socket.on("user:approved", handleApproved);
    return () => { socket.off("user:approved", handleApproved); };
  }, [router]);

  const handleRedeemCode = async () => {
    if (!inviteCode.trim()) return;
    setCodeLoading(true);
    setCodeError(null);
    try {
      await api.post("/auth/redeem-invite", { code: inviteCode });
      await useAuthStore.getState().refreshUser();
      router.push("/arena");
    } catch (err) {
      setCodeError(err instanceof ApiClientError ? err.message : "Invalid code");
    } finally {
      setCodeLoading(false);
    }
  };

  const position = waitlistData?.waitlistNumber ?? user?.waitlistNumber ?? 0;
  const total = waitlistData?.totalWaitlisted ?? 0;
  const currentWave = waitlistData?.currentWave ?? 0;
  const waveProgress = position > 0 && currentWave > 0
    ? Math.min(100, Math.round((currentWave / position) * 100))
    : 0;

  return (
    <div className="w-full max-w-[480px] flex flex-col gap-6 relative">
      <GlassPanel showCornerAccents padding="p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="size-16 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
            <Icon name="hourglass_top" size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
            Welcome, Warrior
          </h1>
          <p className="text-text-muted text-sm">
            You are officially on the waitlist.
          </p>
          <p className="text-xs font-japanese text-primary mt-1 tracking-widest">待機中</p>
        </div>

        {/* Position */}
        <div className="bg-black/40 rounded-lg border border-white/5 p-5 mb-6 text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Your Position</p>
          <p className="text-4xl font-black text-white font-mono">#{position}</p>
          <p className="text-xs text-text-muted mt-2">
            {total} warriors waiting • Wave progress below
          </p>
        </div>

        {/* Wave Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-[10px] text-text-muted uppercase tracking-widest mb-2">
            <span>Wave Progress</span>
            <span>Current: #1–#{currentWave}</span>
          </div>
          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full transition-all"
              style={{ width: `${waveProgress}%` }}
            />
          </div>
          <p className="text-[9px] text-text-muted mt-1.5 text-center">
            Warriors are being accepted in waves
          </p>
        </div>

        {/* Invite Code */}
        <div className="border-t border-white/5 pt-6 mb-4">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-3 text-center">
            Have an invite code?
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="ENTER CODE"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="flex-1"
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleRedeemCode}
              loading={codeLoading}
              disabled={!inviteCode.trim()}
            >
              Redeem
            </Button>
          </div>
          {codeError && (
            <p className="text-red-400 text-xs mt-2 text-center">{codeError}</p>
          )}
        </div>

        {/* Info */}
        <div className="text-center mt-4">
          <p className="text-[10px] text-text-muted">
            Joined: {waitlistData?.joinedAt ? new Date(waitlistData.joinedAt).toLocaleDateString() : "—"}
          </p>
        </div>

        {/* Logout */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => { logout(); router.push("/login"); }}
            className="text-xs text-text-muted hover:text-white transition-colors underline"
          >
            Logout
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
