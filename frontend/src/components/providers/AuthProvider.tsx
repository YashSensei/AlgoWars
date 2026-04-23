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

    // Listen for auth state changes. In supabase-js v2, SIGNED_IN fires on every
    // token refresh — not just on real sign-in. If we already have a user in
    // the store, this is a refresh: keep the UI and let the next API call pick
    // up the new token automatically (the client reads it dynamically).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        const alreadyAuthed = !!useAuthStore.getState().user;
        if (!alreadyAuthed) {
          useAuthStore.setState({ initialized: false });
          await useAuthStore.getState().initialize();
        }
      } else if (event === "SIGNED_OUT") {
        useAuthStore.setState({ user: null, initialized: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize]);

  return <>{children}</>;
}
