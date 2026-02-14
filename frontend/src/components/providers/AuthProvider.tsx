"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";

/**
 * Initializes auth state from Supabase session and listens for changes.
 * Wrap app content with this component.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    // Initialize auth from existing session
    initialize();

    // Listen for auth state changes (login, logout, token refresh, OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_IN") {
          // Re-initialize to fetch user profile
          useAuthStore.setState({ initialized: false });
          await useAuthStore.getState().initialize();
        } else if (event === "SIGNED_OUT") {
          useAuthStore.setState({ user: null, initialized: true });
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [initialize]);

  return <>{children}</>;
}
