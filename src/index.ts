import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { app } from "./app";
import { env } from "./lib/env";
import { setupSocketIO } from "./socket";

// Create HTTP server with Hono request listener
const server = createServer(getRequestListener(app.fetch));

// Setup Socket.IO on the same server
setupSocketIO(server);

// Start server
server.listen(env.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${env.PORT}`);
  console.log(`🔌 WebSocket ready`);
});
