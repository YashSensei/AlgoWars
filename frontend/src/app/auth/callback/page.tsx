"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

/**
 * OAuth callback page.
 * Supabase redirects here after GitHub/Google auth.
 * Ensures DB profile exists, then routes based on username state.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      // Supabase SDK auto-reads the tokens from the URL hash
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError("Authentication failed. Please try again.");
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      try {
        // Ensure DB profile exists for this OAuth user
        const { user } = await authApi.ensureProfile();

        // Update auth store
        if (user) {
          useAuthStore.getState().setUser(user);
          useAuthStore.setState({ initialized: true });
        }

        // Route based on whether user has a username
        if (user?.username) {
          router.push("/arena");
        } else {
          router.push("/choose-username");
        }
      } catch {
        setError("Failed to set up your account. Please try again.");
        setTimeout(() => router.push("/login"), 2000);
      }
    }

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <p className="text-text-muted text-xs">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-dark">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-muted text-xs uppercase tracking-wider">
          Establishing secure connection...
        </p>
      </div>
    </div>
  );
}
