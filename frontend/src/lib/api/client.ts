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

/**
 * Fetch wrapper with error handling and JSON parsing
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get token from Supabase session
  let token: string | null = null;
  if (typeof window !== "undefined") {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token ?? null;
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle non-JSON responses
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    if (!response.ok) {
      throw new ApiClientError("Request failed", response.status);
    }
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    // Auto-logout on expired/invalid token (skip for auth endpoints)
    if (response.status === 401 && typeof window !== "undefined" && !endpoint.startsWith("/auth/")) {
      await supabase.auth.signOut();
      window.location.href = "/login";
    }
    throw new ApiClientError(
      data.error || data.message || "Request failed",
      response.status,
    );
  }

  return data as T;
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
