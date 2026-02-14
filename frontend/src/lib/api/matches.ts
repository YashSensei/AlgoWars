/**
 * Matches API functions
 */
import api from "./client";
import type {
  QueueResponse,
  QueueStatusResponse,
  ActiveMatchResponse,
  Match,
} from "./types";

export const matchesApi = {
  /**
   * Join the matchmaking queue
   * Returns status: "queued" or "matched"
   */
  joinQueue: () => api.post<QueueResponse>("/matches/queue"),

  /**
   * Leave the matchmaking queue
   */
  leaveQueue: () => api.delete<{ removed: boolean }>("/matches/queue"),

  /**
   * Check if user is in queue
   */
  getQueueStatus: () => api.get<QueueStatusResponse>("/matches/queue/status"),

  /**
   * Get active match for current user
   */
  getActiveMatch: () => api.get<ActiveMatchResponse>("/matches/active"),

  /**
   * Get match details by ID
   */
  getMatch: (matchId: string) => api.get<Match>(`/matches/${matchId}`),

  /**
   * Start a match (called after both players join)
   */
  startMatch: (matchId: string) =>
    api.post<{ status: string; alreadyStarted: boolean }>(
      `/matches/${matchId}/start`
    ),

  /**
   * Forfeit/surrender a match
   */
  forfeitMatch: (matchId: string) =>
    api.post<{ status: string; winnerId: string }>(`/matches/${matchId}/forfeit`),

  /**
   * Get submissions for a match (grouped by my/opponent)
   */
  getSubmissions: (matchId: string) =>
    api.get<{
      my: { id: string; verdict: string }[];
      opponent: number;
    }>(`/matches/${matchId}/submissions`),
};
