/**
 * Users API functions
 */
import api from "./client";
import type {
  User,
  UserProfile,
  LeaderboardResponse,
  MatchHistoryResponse,
} from "./types";

export const usersApi = {
  /**
   * Get current authenticated user
   */
  getMe: () => api.get<User>("/users/me"),

  /**
   * Get user profile by username (public)
   */
  getProfile: (username: string) => api.get<UserProfile>(`/users/${username}`),

  /**
   * Get leaderboard (public)
   */
  getLeaderboard: (limit = 50, offset = 0) =>
    api.get<LeaderboardResponse>(`/users/leaderboard?limit=${limit}&offset=${offset}`),

  /**
   * Get current user's match history
   */
  getMatchHistory: (limit = 20, offset = 0) =>
    api.get<MatchHistoryResponse>(`/users/me/matches?limit=${limit}&offset=${offset}`),

  /**
   * Set username (for OAuth users who don't have one yet)
   */
  setUsername: (username: string) => api.patch<User>("/users/me/username", { username }),
};
