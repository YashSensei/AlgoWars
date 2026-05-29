import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";
import { authApi, usersApi, ApiClientError } from "@/lib/api";
import type { User } from "@/lib/api";
import type { Provider } from "@supabase/supabase-js";

async function fetchProfileWithRetry(): Promise<User> {
  try {
    return await usersApi.getMe();
  } catch (err) {
    // On 401, try ensureProfile (first OAuth login where DB row doesn't exist yet)
    if (err instanceof ApiClientError && err.status === 401) {
      const { user } = await authApi.ensureProfile();
      return user;
    }
    // On network error or timeout, wait 3s and retry once (Render cold start)
    await new Promise((r) => setTimeout(r, 3000));
    try {
      return await usersApi.getMe();
    } catch (retryErr) {
      if (retryErr instanceof ApiClientError && retryErr.status === 401) {
        const { user } = await authApi.ensureProfile();
        return user;
      }
      throw retryErr;
    }
  }
}

interface AuthState {
  // State
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<string | null>;
  loginWithOAuth: (provider: Provider) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  // Initial state
  user: null,
  isLoading: false,
  error: null,
  initialized: false,

  // Initialize from Supabase session (called once on app load).
  // Has a hard 15s timeout — if the backend is truly unreachable, we give up
  // and sign out rather than showing a spinner forever.
  initialize: async () => {
    if (get().initialized) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ initialized: true });
        return;
      }

      const user = await Promise.race([
        fetchProfileWithRetry(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Init timeout")), 15000),
        ),
      ]);
      set({ user, initialized: true });
    } catch {
      await supabase.auth.signOut();
      set({ initialized: true });
    }
  },

  // Login with email/password via Supabase client.
  // On success, does a hard navigate to /arena so the fresh page load
  // triggers initialize() cleanly (avoids auth state race conditions).
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ error: error.message, isLoading: false });
        return false;
      }

      // Hard navigate — guarantees clean auth state on the next page.
      // Avoids the race between onAuthStateChange, initialize(), and router.push.
      window.location.href = "/arena";
      return true;
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Login failed. Please try again.";
      set({ error: message, isLoading: false });
      return false;
    }
  },

  // Register via our backend (creates Supabase user + DB profile)
  // Returns null on success (message shown to user), or error string
  register: async (username: string, email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await authApi.register({ username, email, password });
      set({ isLoading: false });
      return result.message; // "Check your email to verify your account"
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Registration failed. Please try again.";
      set({ error: message, isLoading: false });
      return null;
    }
  },

  // OAuth login (Google — add other providers by enabling them in Supabase dashboard)
  loginWithOAuth: async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      set({ error: error.message });
    }
  },

  // Logout
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, error: null });
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Update user (for profile updates)
  setUser: (user: User) => set({ user }),

  // Refresh user data from server (updates stats after match)
  refreshUser: async () => {
    try {
      const user = await usersApi.getMe();
      set({ user });
    } catch (err) {
      console.debug("Failed to refresh user:", err instanceof ApiClientError ? err.message : err);
    }
  },
}));

// Selector hooks for specific state pieces
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => !!state.user);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useNeedsUsername = () => useAuthStore((state) => state.user && !state.user.username);
