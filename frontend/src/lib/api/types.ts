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
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled";

// Player result enum
export type PlayerResult = "win" | "loss" | "draw" | "pending";

// Verdict enum for submissions
export type Verdict =
  | "pending"
  | "accepted"
  | "wrong_answer"
  | "time_limit"
  | "runtime_error"
  | "compile_error";

// Problem difficulty
export type Difficulty = "easy" | "medium" | "hard";

// Problem from problems table
export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  timeLimit: number;
  memoryLimit: number;
  createdAt: string;
}

// Match player info
export interface MatchPlayer {
  id: string;
  matchId: string;
  userId: string;
  result: PlayerResult;
  ratingChange: number | null;
  finishTime: string | null;
  user?: User;
}

// Match from matches table
export interface Match {
  id: string;
  status: MatchStatus;
  problemId: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  problem?: Problem;
  players?: MatchPlayer[];
}

// Submission from submissions table
export interface Submission {
  id: string;
  matchId: string;
  playerId: string;
  code: string;
  language: string;
  verdict: Verdict;
  executionTime: number | null;
  memoryUsed: number | null;
  feedback: string | null;
  submittedAt: string;
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  user: User;
  stats: UserStats;
}
