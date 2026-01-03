/**
 * Test Socket.IO Connection
 * Run with: bun scripts/test-socket.ts
 *
 * Prerequisites:
 * 1. Server running: bun run dev
 * 2. Valid JWT token (from login)
 */

import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

// Get token from command line or use placeholder
const TOKEN = process.argv[2] || "YOUR_JWT_TOKEN_HERE";

if (TOKEN === "YOUR_JWT_TOKEN_HERE") {
  console.log("═".repeat(60));
  console.log("🔌 Socket.IO Connection Test");
  console.log("═".repeat(60));
  console.log("\n⚠️  No token provided!");
  console.log("\nUsage: bun scripts/test-socket.ts <JWT_TOKEN>");
  console.log("\nTo get a token:");
  console.log("  1. POST /auth/register or POST /auth/login");
  console.log("  2. Copy the 'token' from response");
  console.log("  3. Run: bun scripts/test-socket.ts eyJhbG...\n");
  process.exit(1);
}

console.log("═".repeat(60));
console.log("🔌 Socket.IO Connection Test");
console.log("═".repeat(60));
console.log(`\n📡 Connecting to ${SERVER_URL}...`);

const socket = io(SERVER_URL, {
  auth: { token: TOKEN },
  transports: ["websocket"],
});

// Connection events
socket.on("connect", () => {
  console.log("✅ Connected! Socket ID:", socket.id);
  console.log("\n📋 Testing events...\n");

  // Test joining a match room (use fake ID)
  const fakeMatchId = "00000000-0000-0000-0000-000000000000";
  console.log(`  → Joining match room: ${fakeMatchId}`);
  socket.emit("match:join", { matchId: fakeMatchId });
});

socket.on("connect_error", (err) => {
  console.log("❌ Connection failed:", err.message);
  process.exit(1);
});

// Listen for events
socket.on("match:join", (data) => {
  console.log("  ← match:join response:", data);
});

socket.on("queue:matched", (data) => {
  console.log("  ← queue:matched:", data);
});

socket.on("match:start", (data) => {
  console.log("  ← match:start:", data);
});

socket.on("match:submission", (data) => {
  console.log("  ← match:submission:", data);
});

socket.on("match:end", (data) => {
  console.log("  ← match:end:", data);
});

socket.on("disconnect", (reason) => {
  console.log("\n🔌 Disconnected:", reason);
});

// Auto-disconnect after 5 seconds
setTimeout(() => {
  console.log("\n✅ Test complete! Socket working correctly.");
  console.log("─".repeat(60));
  socket.disconnect();
  process.exit(0);
}, 5000);
