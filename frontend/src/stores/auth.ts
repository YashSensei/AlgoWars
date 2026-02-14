import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";
import { authApi, usersApi, ApiClientError } from "@/lib/api";
import type { User } from "@/lib/api";
import type { Provider } from "@supabase/supabase-js";

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

  // Initialize from Supabase session (called once on app load)
  initialize: async () => {
    if (get().initialized) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ initialized: true });
        return;
      }

      // Fetch our DB profile
      const user = await usersApi.getMe();
      set({ user, initialized: true });
    } catch {
      set({ initialized: true });
    }
  },

  // Login with email/password via our backend (which calls Supabase)
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      // Sign in directly with Supabase client (handles session persistence)
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ error: error.message, isLoading: false });
        return false;
      }

      // Fetch our DB profile with stats
      const user = await usersApi.getMe();
      set({ user, isLoading: false });
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

  // OAuth login (GitHub, Google)
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
