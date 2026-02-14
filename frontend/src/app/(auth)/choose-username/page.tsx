"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, GlassPanel, Input } from "@/components/ui";
import { usersApi, ApiClientError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

/**
 * Username selection page for OAuth users.
 * Shown after OAuth callback when user has no username yet.
 */
export default function ChooseUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 32) {
      setError("Username must be between 3 and 32 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError("Only letters, numbers, underscores, and hyphens allowed");
      return;
    }

    setIsLoading(true);
    try {
      const updatedUser = await usersApi.setUsername(trimmed);
      useAuthStore.getState().setUser(updatedUser);
      router.push("/arena");
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Failed to set username. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] flex flex-col gap-6 relative">
      <GlassPanel showCornerAccents>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-baseline justify-between mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight uppercase">
              Choose Callsign
            </h1>
            <span className="text-xs font-japanese text-primary">名前</span>
          </div>
          <p className="text-text-muted text-xs tracking-wide">
            Select your identity for the arena. This is how opponents will see you.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Username Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Input
            label="Callsign"
            icon="person"
            type="text"
            placeholder="YourUsername"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={undefined}
          />

          <p className="text-text-muted text-[10px]">
            3-32 characters. Letters, numbers, underscores, and hyphens only.
          </p>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            rightIcon="arrow_forward"
            loading={isLoading}
          >
            Enter the Arena
          </Button>
        </form>
      </GlassPanel>
    </div>
  );
}
