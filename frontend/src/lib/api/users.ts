/**
 * Users API functions
 */
import api from "./client";
import type { User, UserProfile } from "./types";

export const usersApi = {
  /**
   * Get current authenticated user
   */
  getMe: () => api.get<User>("/users/me"),

  /**
   * Get user profile by username (public)
   */
  getProfile: (username: string) => api.get<UserProfile>(`/users/${username}`),
};
