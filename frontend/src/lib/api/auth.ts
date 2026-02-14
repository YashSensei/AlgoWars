import api from "./client";
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, User } from "./types";

/**
 * Auth API functions
 */
export const authApi = {
  login: (data: LoginRequest): Promise<LoginResponse> =>
    api.post<LoginResponse>("/auth/login", data),

  register: (data: RegisterRequest): Promise<RegisterResponse> =>
    api.post<RegisterResponse>("/auth/register", data),

  refresh: (refresh_token: string) =>
    api.post<{ access_token: string; refresh_token: string; expires_at?: number }>(
      "/auth/refresh",
      { refresh_token },
    ),

  ensureProfile: () => api.post<{ user: User }>("/auth/ensure-profile"),

  me: (): Promise<User> => api.get<User>("/users/me"),
};

export default authApi;
