/**
 * Friend Duel API functions
 */
import api from "./client";

export interface FriendRoom {
  id: string;
  inviteCode: string;
  status: "waiting" | "ready" | "active" | "completed" | "expired";
  duration: number;
  matchId: string | null;
  expiresAt: string;
}

export interface LobbyPlayer {
  id: string;
  username: string | null;
  rating: number;
  wins: number;
  losses: number;
  winStreak: number;
}

export interface LobbyResponse {
  room: FriendRoom;
  host: LobbyPlayer;
  guest: LobbyPlayer | null;
  canStart: boolean;
}

export interface CreateRoomResponse {
  roomId?: string;
  inviteCode?: string;
  redirect?: string;
  matchId?: string;
}

export interface JoinRoomResponse {
  success?: boolean;
  redirect?: string;
  matchId?: string;
}

export const friendApi = {
  createRoom: () => api.post<CreateRoomResponse>("/friend/create"),

  getRoom: (code: string) => api.get<LobbyResponse>(`/friend/${code}`),

  joinRoom: (code: string) => api.post<JoinRoomResponse>(`/friend/${code}/join`),

  startMatch: (code: string) => api.post<{ matchId: string }>(`/friend/${code}/start`),
};
