import api from "./client";
import type { AuthResponse, LoginRequest, RegisterRequest, User } from "./types";

/**
 * Auth API functions
 */
export const authApi = {
  /**
   * Login with email and password
   */
  login: (data: LoginRequest): Promise<AuthResponse> =>
    api.post<AuthResponse>("/auth/login", data),

  /**
   * Register a new user
   */
  register: (data: RegisterRequest): Promise<AuthResponse> =>
    api.post<AuthResponse>("/auth/register", data),

  /**
   * Get current user profile (requires auth token)
   */
  me: (): Promise<User> => api.get<User>("/users/me"),
};

export default authApi;
