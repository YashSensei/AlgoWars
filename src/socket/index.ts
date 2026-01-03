/**
 * Socket.IO Setup
 * Real-time communication for matches
 */

import type { Server as HTTPServer } from "node:http";
import type { Socket } from "socket.io";
import { Server } from "socket.io";
import { authService } from "../services/auth";

// Event names
export const SOCKET_EVENTS = {
  // Client -> Server
  MATCH_JOIN: "match:join",
  MATCH_LEAVE: "match:leave",

  // Server -> Client
  QUEUE_MATCHED: "queue:matched",
  MATCH_COUNTDOWN: "match:countdown",
  MATCH_START: "match:start",
  MATCH_SUBMISSION: "match:submission",
  MATCH_END: "match:end",
  ERROR: "error",
} as const;

// Socket data after authentication
interface SocketData {
  userId: string;
}

// Store io instance for emitting from other services
let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

// Safe emit helper - no-op if Socket.IO not initialized
function safeEmit(room: string, event: string, data: unknown): void {
  ioInstance?.to(room).emit(event, data);
}

// JWT authentication middleware
function createAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    next(new Error("Authentication required"));
    return;
  }

  try {
    const payload = authService.verifyToken(token);
    socket.data = { userId: payload.userId } as SocketData;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
}

// Handle socket connection events
function handleConnection(socket: Socket): void {
  const { userId } = socket.data as SocketData;
  socket.join(`user:${userId}`);

  socket.on(SOCKET_EVENTS.MATCH_JOIN, ({ matchId }: { matchId: string }) => {
    socket.join(`match:${matchId}`);
    socket.emit(SOCKET_EVENTS.MATCH_JOIN, { success: true, matchId });
  });

  socket.on(SOCKET_EVENTS.MATCH_LEAVE, ({ matchId }: { matchId: string }) => {
    socket.leave(`match:${matchId}`);
  });
}

export function setupSocketIO(httpServer: HTTPServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  ioInstance = io;
  io.use(createAuthMiddleware);
  io.on("connection", handleConnection);

  return io;
}

// Emit helpers for use in other services (gracefully handles uninitialized state)
export const socketEmit = {
  queueMatched(userId: string, data: { matchId: string; opponentName: string }) {
    safeEmit(`user:${userId}`, SOCKET_EVENTS.QUEUE_MATCHED, data);
  },

  matchCountdown(matchId: string, seconds: number) {
    safeEmit(`match:${matchId}`, SOCKET_EVENTS.MATCH_COUNTDOWN, { seconds });
  },

  matchStart(matchId: string, data: { problem: unknown; endsAt: string }) {
    safeEmit(`match:${matchId}`, SOCKET_EVENTS.MATCH_START, data);
  },

  matchSubmission(matchId: string, data: { userId: string; verdict: string }) {
    safeEmit(`match:${matchId}`, SOCKET_EVENTS.MATCH_SUBMISSION, data);
  },

  matchEnd(matchId: string, data: { winnerId: string | null; reason: string }) {
    safeEmit(`match:${matchId}`, SOCKET_EVENTS.MATCH_END, data);
  },
};
