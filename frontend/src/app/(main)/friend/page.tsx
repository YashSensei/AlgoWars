"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, GlassPanel, Icon } from "@/components/ui";
import { friendApi, ApiClientError } from "@/lib/api";

export default function FriendLandingPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await friendApi.createRoom();
      if (res.redirect) {
        router.push(res.redirect);
        return;
      }
      router.push(`/friend/${res.inviteCode}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create room");
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      <GlassPanel showCornerAccents padding="p-10" className="max-w-md w-full text-center">
        <div className="size-16 mx-auto rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-6">
          <Icon name="swords" size={32} className="text-primary" />
        </div>

        <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
          Private Duel
        </h1>
        <p className="text-sm text-text-muted mb-8">
          Challenge a friend to a ranked match. Share the link. First to solve wins.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          leftIcon="add"
          onClick={handleCreate}
          disabled={creating}
          className="w-full"
        >
          {creating ? "Creating..." : "Create Duel"}
        </Button>

        <p className="text-xs font-japanese text-white/20 mt-6 tracking-widest">決闘を始める</p>
      </GlassPanel>
    </div>
  );
}
