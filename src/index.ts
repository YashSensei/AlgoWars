import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { inArray } from "drizzle-orm";
import { app } from "./app";
import { matches } from "./db/schema";
import { db, startDbKeepAlive, verifyDbConnection } from "./lib/db";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { matchmaking } from "./services/matchmaking";
import { setupSocketIO } from "./socket";

/**
 * Any ACTIVE or STARTING match left over from a previous run has no in-memory timer
 * and will never auto-abort — a "zombie" that blocks its players from queuing again.
 * We flip them to ABORTED on startup. No rating penalty since a server restart is not
 * the players' fault; this is gentler than routing through matchEngine.abort.
 */
async function abortZombieMatches(): Promise<void> {
  const aborted = await db
    .update(matches)
    .set({ status: "ABORTED", endedAt: new Date() })
    .where(inArray(matches.status, ["ACTIVE", "STARTING"]))
    .returning({ id: matches.id });

  if (aborted.length > 0) {
    logger.warn("Server", `Aborted ${aborted.length} zombie matches from previous run`, {
      ids: aborted.map((m) => m.id.slice(0, 8)),
    });
  }
}

// Verify DB is reachable before we start accepting traffic.
// Supabase free tier pauses after 7 days of inactivity — fail loudly instead of serving a broken app.
try {
  await verifyDbConnection();
  await abortZombieMatches();
} catch (err) {
  logger.error("Server", "Startup failed", err);
  process.exit(1);
}

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
