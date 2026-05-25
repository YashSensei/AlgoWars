"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { matchesApi, ApiClientError } from "@/lib/api";

export default function SoloPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startSolo() {
      try {
        const result = await matchesApi.joinQueue("timed");
        if (!mounted) return;

        if (result.status === "matched" && result.matchId) {
          router.replace(`/match/${result.matchId}`);
        } else if (result.status === "already_in_match" && result.matchId) {
          router.replace(`/match/${result.matchId}`);
        } else {
          setError("Failed to create solo match. Try again.");
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : "Something went wrong");
      }
    }

    startSolo();
    return () => { mounted = false; };
  }, [router]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Icon name="error" size={48} className="text-red-400" />
        <p className="text-red-400 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/arena")}
          className="text-xs text-text-muted hover:text-white underline"
        >
          Back to Arena
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-white text-lg font-bold uppercase tracking-wide">Preparing Arena...</p>
      <p className="text-text-muted text-xs">Setting up your solo challenge</p>
    </div>
  );
}
