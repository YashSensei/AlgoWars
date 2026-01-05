import { io, Socket } from "socket.io-client";

// Socket.IO client singleton
let socket: Socket | null = null;

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/**
 * Get or create Socket.IO connection
 * Authenticates using JWT token from localStorage
 */
export function getSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  const token = localStorage.getItem("auth_token");

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Connection event handlers
  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("[Socket] Connection error:", error.message);
  });

  socket.on("error", (error: { message: string }) => {
    console.error("[Socket] Error:", error.message);
  });

  return socket;
}

/**
 * Disconnect socket and cleanup
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Check if socket is connected
 */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

// Re-export socket type for consumers
export type { Socket };
