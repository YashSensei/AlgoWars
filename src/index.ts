import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { app } from "./app";
import { startDbKeepAlive } from "./lib/db";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { matchmaking } from "./services/matchmaking";
import { setupSocketIO } from "./socket";

// Create HTTP server with Hono request listener
const server = createServer(getRequestListener(app.fetch));

// Setup Socket.IO on the same server
const io = setupSocketIO(server);

// Periodic cleanup of stale queue entries (every 30 seconds)
const QUEUE_CLEANUP_INTERVAL_MS = 30000;
const cleanupInterval = setInterval(() => {
  matchmaking.cleanupStale();
}, QUEUE_CLEANUP_INTERVAL_MS);

// Supabase DB keep-alive pinger (every 5 days)
const dbPingInterval = startDbKeepAlive();

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
  logger.info("Server", `${signal} received, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info("Server", "HTTP server closed");
  });

  // Clear intervals
  clearInterval(cleanupInterval);
  clearInterval(dbPingInterval);

  // Close all socket connections
  io.close(() => {
    logger.info("Server", "Socket.IO server closed");
  });

  // Give connections time to close, then force exit
  setTimeout(() => {
    logger.warn("Server", "Forcing shutdown after timeout");
    process.exit(0);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
server.listen(env.PORT, () => {
  logger.info("Server", `🚀 Running at http://localhost:${env.PORT}`);
  logger.info("Server", "🔌 WebSocket ready");
});
