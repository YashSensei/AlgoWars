/**
 * Socket.IO Setup
 * Real-time communication for matches
 * Includes disconnect detection with 10s reconnection window
 */

import type { Server as HTTPServer } from "node:http";
import type { Socket } from "socket.io";
import { Server } from "socket.io";
import { logger } from "../lib/logger";
import { authService } from "../services/auth";
import { matchEngine } from "../services/match-engine";

// Disconnect timeout in milliseconds
const DISCONNECT_TIMEOUT_MS = 10000;

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
  OPPONENT_DISCONNECTED: "opponent:disconnected",
  OPPONENT_RECONNECTED: "opponent:reconnected",
  ERROR: "error",
} as const;

// Socket data after authentication
interface SocketData {
  userId: string;
}

// Track user's active match and disconnect timers
interface UserMatchState {
  matchId: string;
  opponentId: string;
}

interface DisconnectTimer {
  timer: NodeJS.Timeout;
  cancelled: boolean;
}

// Store io instance for emitting from other services
let ioInstance: Server | null = null;

// Track user -> match mappings and disconnect timers
const userMatchMap = new Map<string, UserMatchState>();
const disconnectTimers = new Map<string, DisconnectTimer>();

// Track socket count per user (for multi-tab handling)
const userSocketCount = new Map<string, number>();

// Safe emit helper - no-op if Socket.IO not initialized
function safeEmit(room: string, event: string, data: unknown): void {
  ioInstance?.to(room).emit(event, data);
}

// JWT authentication middleware
function createAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    logger.warn("Socket", `Connection rejected - no token provided`);
    next(new Error("Authentication required"));
    return;
  }

  try {
    const payload = authService.verifyToken(token);
    socket.data = { userId: payload.userId } as SocketData;
    logger.info("Socket", `User ${payload.userId.slice(0, 8)} authenticated`);
    next();
  } catch {
    logger.warn("Socket", `Connection rejected - invalid token`);
    next(new Error("Invalid token"));
  }
}

// Handle user reconnection - cancel any pending disconnect timer
function handleReconnection(userId: string): void {
  const timerData = disconnectTimers.get(userId);
  if (timerData) {
    logger.info("Socket", `User ${userId.slice(0, 8)} reconnected - cancelling disconnect timer`);
    // Mark as cancelled AND clear the timeout
    timerData.cancelled = true;
    clearTimeout(timerData.timer);
    disconnectTimers.delete(userId);

    // Notify opponent that user reconnected
    const matchState = userMatchMap.get(userId);
    if (matchState) {
      safeEmit(`user:${matchState.opponentId}`, SOCKET_EVENTS.OPPONENT_RECONNECTED, {});
    }
  }
}

// Execute auto-forfeit when disconnect timer expires
async function executeAutoForfeit(userId: string, timerData: DisconnectTimer): Promise<void> {
  if (timerData.cancelled) return;

  disconnectTimers.delete(userId);
  const matchState = userMatchMap.get(userId);
  if (!matchState) return;

  logger.info(
    "Socket",
    `Disconnect timeout expired for user ${userId.slice(0, 8)} - auto-forfeiting`,
  );

  try {
    await matchEngine.forfeit(matchState.matchId, userId, "disconnect");
  } catch (err) {
    logger.error("Socket", `Auto-forfeit failed for user ${userId.slice(0, 8)}`, err);
  }

  userMatchMap.delete(userId);
}

// Handle user disconnection - start timeout for auto-forfeit
function handleDisconnection(userId: string): void {
  const matchState = userMatchMap.get(userId);
  if (!matchState) {
    logger.debug("Socket", `User ${userId.slice(0, 8)} disconnected (not in match)`);
    return;
  }

  if (disconnectTimers.has(userId)) return;

  logger.warn(
    "Socket",
    `User ${userId.slice(0, 8)} disconnected - starting ${DISCONNECT_TIMEOUT_MS / 1000}s timer`,
  );

  safeEmit(`user:${matchState.opponentId}`, SOCKET_EVENTS.OPPONENT_DISCONNECTED, {
    disconnectedUserId: userId,
    timeout: DISCONNECT_TIMEOUT_MS / 1000,
  });

  const timerData: DisconnectTimer = { timer: null as unknown as NodeJS.Timeout, cancelled: false };
  timerData.timer = setTimeout(() => executeAutoForfeit(userId, timerData), DISCONNECT_TIMEOUT_MS);
  disconnectTimers.set(userId, timerData);
}

// Handle socket disconnect event
function handleSocketDisconnect(userId: string): void {
  const count = userSocketCount.get(userId) ?? 1;
  const newCount = count - 1;

  if (newCount <= 0) {
    userSocketCount.delete(userId);
    logger.debug("Socket", `User ${userId.slice(0, 8)} fully disconnected`);
    handleDisconnection(userId);
  } else {
    userSocketCount.set(userId, newCount);
    logger.debug("Socket", `User ${userId.slice(0, 8)} tab closed (remaining: ${newCount})`);
  }
}

// Register socket event handlers
function registerSocketHandlers(socket: Socket, userId: string): void {
  socket.on(
    SOCKET_EVENTS.MATCH_JOIN,
    ({ matchId, opponentId }: { matchId: string; opponentId?: string }) => {
      socket.join(`match:${matchId}`);
      if (opponentId) userMatchMap.set(userId, { matchId, opponentId });
      socket.emit(SOCKET_EVENTS.MATCH_JOIN, { success: true, matchId });
    },
  );

  socket.on(SOCKET_EVENTS.MATCH_LEAVE, ({ matchId }: { matchId: string }) => {
    socket.leave(`match:${matchId}`);
    userMatchMap.delete(userId);
  });

  socket.on("disconnect", () => handleSocketDisconnect(userId));
}

// Handle socket connection events
function handleConnection(socket: Socket): void {
  const { userId } = socket.data as SocketData;
  socket.join(`user:${userId}`);

  const currentCount = userSocketCount.get(userId) ?? 0;
  userSocketCount.set(userId, currentCount + 1);
  logger.debug("Socket", `User ${userId.slice(0, 8)} connected (tabs: ${currentCount + 1})`);

  handleReconnection(userId);
  registerSocketHandlers(socket, userId);
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
  queueMatched(
    userId: string,
    data: { matchId: string; opponentId: string; opponentName: string },
  ) {
    safeEmit(`user:${userId}`, SOCKET_EVENTS.QUEUE_MATCHED, {
      matchId: data.matchId,
      opponent: { id: data.opponentId, username: data.opponentName },
    });
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

  // Register user's match (called when match starts)
  registerUserMatch(userId: string, matchId: string, opponentId: string) {
    userMatchMap.set(userId, { matchId, opponentId });
  },

  // Clean up user's match (called when match ends)
  clearUserMatch(userId: string) {
    userMatchMap.delete(userId);
    const timerData = disconnectTimers.get(userId);
    if (timerData) {
      timerData.cancelled = true;
      clearTimeout(timerData.timer);
      disconnectTimers.delete(userId);
    }
  },
};
