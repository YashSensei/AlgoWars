import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, ApiClientError } from "@/lib/api";
import type { User } from "@/lib/api";

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isLoading: false,
      error: null,

      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login({ email, password });

          // Store token in localStorage for API client
          localStorage.setItem("auth_token", response.token);

          set({
            user: response.user,
            token: response.token,
            isLoading: false,
          });

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

      // Register action
      register: async (username: string, email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.register({ username, email, password });

          // Store token in localStorage for API client
          localStorage.setItem("auth_token", response.token);

          set({
            user: response.user,
            token: response.token,
            isLoading: false,
          });

          return true;
        } catch (err) {
          const message =
            err instanceof ApiClientError
              ? err.message
              : "Registration failed. Please try again.";

          set({ error: message, isLoading: false });
          return false;
        }
      },

      // Logout action
      logout: () => {
        localStorage.removeItem("auth_token");
        set({ user: null, token: null, error: null });
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Update user (for profile updates)
      setUser: (user: User) => set({ user }),
    }),
    {
      name: "algowars-auth",
      // Only persist user and token
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
);

// Selector hooks for specific state pieces
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => !!state.token);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
