/**
 * API Types - Mirrors backend schema types
 */

// User stats from user_stats table
export interface UserStats {
  id: string;
  userId: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  maxStreak?: number;
  updatedAt: string;
}

// User from users table (without password)
export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  stats: UserStats | null;
}

// Public user profile (no email)
export interface UserProfile {
  id: string;
  username: string;
  createdAt: string;
  stats: UserStats;
}

// Auth response from login/register
export interface AuthResponse {
  user: User;
  token: string;
}

// Login request body
export interface LoginRequest {
  email: string;
  password: string;
}

// Register request body
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

// Match status enum
export type MatchStatus =
  | "WAITING"
  | "STARTING"
  | "ACTIVE"
  | "COMPLETED"
  | "ABORTED";

// Player result enum
export type PlayerResult = "PENDING" | "WON" | "LOST" | "DRAW";

// Verdict enum for submissions
export type Verdict =
  | "PENDING"
  | "JUDGING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "COMPILE_ERROR"
  | "RUNTIME_ERROR"
  | "TIME_LIMIT"
  | "MEMORY_LIMIT"
  | "JUDGE_TIMEOUT";

// Supported languages
export type Language = "cpp17" | "cpp20" | "python3" | "java17" | "pypy3";

// Problem from problems table
export interface Problem {
  id: string;
  title: string;
  difficulty: number;
  statement?: string;
  timeLimit?: number;
  memoryLimit?: number;
}

// Match player info
export interface MatchPlayer {
  user: {
    id: string;
    username: string;
  };
  result: PlayerResult;
  ratingBefore: number;
  ratingAfter?: number;
}

// Match from matches table
export interface Match {
  id: string;
  status: MatchStatus;
  duration: number; // seconds
  startedAt?: string;
  endedAt?: string;
  problem: Problem;
  players: MatchPlayer[];
}

// Active match response
export interface ActiveMatchResponse {
  active: boolean;
  match?: Match;
}

// Queue response
export interface QueueResponse {
  status: "queued" | "matched";
  matchId?: string;
  opponentId?: string;
  opponentName?: string;
}

// Queue status response
export interface QueueStatusResponse {
  queued: boolean;
}

// Submission request
export interface SubmissionRequest {
  matchId: string;
  code: string;
  language: Language;
}

// Submission response
export interface SubmissionResponse {
  status: "complete" | "busy";
  submissionId: string;
  verdict: string;
  feedback?: string;
  confidence?: number;
  matchEnded: boolean;
  winnerId?: string;
}

// Submission status response
export interface SubmissionStatusResponse {
  status: "queued" | "busy" | "judging" | "complete";
  submissionId?: string;
  verdict?: {
    verdict: string;
    feedback?: string;
    confidence?: number;
    isFinal: boolean;
  };
  error?: string;
}

// Submission record
export interface Submission {
  id: string;
  matchId: string;
  userId: string;
  language: string;
  verdict: Verdict;
  runtime?: number;
  memory?: number;
  submittedAt: string;
  judgedAt?: string;
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    username: string;
  };
  stats: UserStats;
}

// Socket.IO Events

// Queue matched event
export interface QueueMatchedEvent {
  matchId: string;
  opponent: {
    id: string;
    username: string;
  };
}

// Match countdown event
export interface MatchCountdownEvent {
  seconds: number;
}

// Match start event
export interface MatchStartEvent {
  problem: {
    id: string;
    title: string;
    statement: string;
    difficulty: number;
  };
  endsAt: string; // ISO timestamp
}

// Match submission event (opponent verdict)
export interface MatchSubmissionEvent {
  userId: string;
  verdict: string;
}

// Match end event
export interface MatchEndEvent {
  winnerId: string | null;
  reason: "solved" | "forfeit" | "disconnect" | "timeout" | "cancelled";
}

// Opponent disconnect event
export interface OpponentDisconnectedEvent {
  disconnectedUserId: string;
  timeout: number;
}
