/**
 * API Client for AlgoWars backend
 * Gets auth token from Supabase session
 */

import { supabase } from "@/lib/supabase/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface ApiError {
  message: string;
  status: number;
}

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

// Internal: get current access token from Supabase session
async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Internal: make a single fetch with the given token
async function doFetch(url: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers: HeadersInit = { "Content-Type": "application/json", ...options.headers };
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

/**
 * Fetch wrapper with error handling, JSON parsing, and automatic token refresh on 401.
 * On first 401: refreshes the Supabase session and retries once with the new token.
 * On second 401: treats as real session death → logout (unless on a protected page).
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let token = await getToken();
  let response = await doFetch(url, options, token);

  // On 401, try refreshing the session once before giving up
  if (response.status === 401 && typeof window !== "undefined") {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) {
      token = data.session.access_token;
      response = await doFetch(url, options, token);
    }
  }

  // Handle non-JSON responses
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    if (!response.ok) throw new ApiClientError("Request failed", response.status);
    return {} as T;
  }

  const responseData = await response.json();

  if (!response.ok) {
    // After retry still 401 → real session death → logout (skip protected pages)
    if (response.status === 401 && typeof window !== "undefined" && !endpoint.startsWith("/auth/")) {
      const path = window.location.pathname;
      // Don't auto-logout during: OAuth callback, active match, or initial page loads
      // (arena/queue/profile) where initialization might still be in progress.
      // Only logout on explicit user actions that 401 after retry.
      const isProtectedFlow =
        path.startsWith("/auth/callback") ||
        path.startsWith("/match/");
      if (!isProtectedFlow) {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }
    }
    throw new ApiClientError(
      responseData.error || responseData.message || "Request failed",
      response.status,
    );
  }

  return responseData as T;
}

// API client methods
export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: "GET" }),

  post: <T>(endpoint: string, body?: unknown) =>
    fetchApi<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    fetchApi<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    fetchApi<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: "DELETE" }),
};

export default api;
