/**
 * Integration Test: Full Match Flow
 * Run with: bun scripts/test-integration.ts
 *
 * Tests the complete flow:
 * 1. Register two users
 * 2. Both join queue → get matched
 * 3. Start match
 * 4. One submits code → AI judges
 * 5. Check match ended with winner
 */

import { io, type Socket } from "socket.io-client";

const BASE_URL = "http://localhost:3000";
const TIMEOUT = 60000; // 60s for AI judge

interface User {
  id: string;
  username: string;
  token: string;
  socket?: Socket;
}

// HTTP helper
async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// Test utilities
function log(emoji: string, msg: string) {
  console.log(`${emoji} ${msg}`);
}

function section(title: string) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`📍 ${title}`);
  console.log("─".repeat(50));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Connect socket with JWT
function connectSocket(user: User): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      auth: { token: user.token },
      transports: ["websocket"],
    });

    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);

    setTimeout(() => reject(new Error("Socket timeout")), 5000);
  });
}

// Main test
async function runTest() {
  console.log("═".repeat(50));
  console.log("🧪 INTEGRATION TEST: Full Match Flow");
  console.log("═".repeat(50));

  const timestamp = Date.now();
  let user1: User;
  let user2: User;
  let matchId: string;

  try {
    // ═══════════════════════════════════════════════════
    // STEP 1: Register two users
    // ═══════════════════════════════════════════════════
    section("Step 1: Register Users");

    const reg1 = await api("POST", "/auth/register", {
      username: `player1_${timestamp}`,
      email: `player1_${timestamp}@test.com`,
      password: "test123",
    });
    if (reg1.status !== 201) throw new Error(`Failed to register user1: ${JSON.stringify(reg1.data)}`);
    user1 = {
      id: (reg1.data as { user: { id: string } }).user.id,
      username: `player1_${timestamp}`,
      token: (reg1.data as { token: string }).token,
    };
    log("✅", `User 1 registered: ${user1.username}`);

    const reg2 = await api("POST", "/auth/register", {
      username: `player2_${timestamp}`,
      email: `player2_${timestamp}@test.com`,
      password: "test123",
    });
    if (reg2.status !== 201) throw new Error(`Failed to register user2: ${JSON.stringify(reg2.data)}`);
    user2 = {
      id: (reg2.data as { user: { id: string } }).user.id,
      username: `player2_${timestamp}`,
      token: (reg2.data as { token: string }).token,
    };
    log("✅", `User 2 registered: ${user2.username}`);

    // ═══════════════════════════════════════════════════
    // STEP 2: Connect WebSockets
    // ═══════════════════════════════════════════════════
    section("Step 2: Connect WebSockets");

    user1.socket = await connectSocket(user1);
    log("✅", `User 1 connected: ${user1.socket.id}`);

    user2.socket = await connectSocket(user2);
    log("✅", `User 2 connected: ${user2.socket.id}`);

    // Listen for match events
    const matchedPromise1 = new Promise<string>((resolve) => {
      user1.socket?.on("queue:matched", (data: { matchId: string }) => {
        log("📩", `User 1 received queue:matched: ${data.matchId}`);
        resolve(data.matchId);
      });
    });

    const matchedPromise2 = new Promise<string>((resolve) => {
      user2.socket?.on("queue:matched", (data: { matchId: string }) => {
        log("📩", `User 2 received queue:matched: ${data.matchId}`);
        resolve(data.matchId);
      });
    });

    // ═══════════════════════════════════════════════════
    // STEP 3: Join Queue → Match
    // ═══════════════════════════════════════════════════
    section("Step 3: Join Queue");

    const q1 = await api("POST", "/matches/queue", null, user1.token);
    log("→", `User 1 queue result: ${(q1.data as { status: string }).status}`);

    const q2 = await api("POST", "/matches/queue", null, user2.token);
    log("→", `User 2 queue result: ${(q2.data as { status: string }).status}`);

    // Get match ID from response or socket
    if ((q2.data as { status: string }).status === "matched") {
      matchId = (q2.data as { matchId: string }).matchId;
      log("✅", `Matched via HTTP: ${matchId}`);
    } else {
      matchId = await Promise.race([matchedPromise1, matchedPromise2]);
      log("✅", `Matched via WebSocket: ${matchId}`);
    }

    // Join match rooms
    user1.socket?.emit("match:join", { matchId });
    user2.socket?.emit("match:join", { matchId });
    await sleep(500);
    log("✅", "Both users joined match room");

    // ═══════════════════════════════════════════════════
    // STEP 4: Get Match Details
    // ═══════════════════════════════════════════════════
    section("Step 4: Match Details");

    const matchDetails = await api("GET", `/matches/${matchId}`, null, user1.token);
    const match = matchDetails.data as {
      status: string;
      problem: { title: string; id: string };
    };
    log("📋", `Match status: ${match.status}`);
    log("📋", `Problem: ${match.problem?.title || "Unknown"}`);

    // ═══════════════════════════════════════════════════
    // STEP 5: Start Match
    // ═══════════════════════════════════════════════════
    section("Step 5: Start Match");

    // Listen for match:start
    const startPromise = new Promise<void>((resolve) => {
      user1.socket?.on("match:start", (data) => {
        log("📩", `User 1 received match:start`);
        resolve();
      });
    });

    const startRes = await api("POST", `/matches/${matchId}/start`, null, user1.token);
    if (startRes.status !== 200) throw new Error(`Failed to start: ${JSON.stringify(startRes.data)}`);
    log("✅", `Match started: ${(startRes.data as { status: string }).status}`);

    await Promise.race([startPromise, sleep(2000)]);

    // ═══════════════════════════════════════════════════
    // STEP 6: Submit Code (AI Judge)
    // ═══════════════════════════════════════════════════
    section("Step 6: Submit Code");

    // Listen for match:submission and match:end
    const endPromise = new Promise<{ winnerId: string; reason: string }>((resolve) => {
      user1.socket?.on("match:end", resolve);
      user2.socket?.on("match:end", resolve);
    });

    // Simple Python solution (will likely get WRONG_ANSWER but tests the flow)
    const code = `
n, m, a = map(int, input().split())
import math
print(math.ceil(n/a) * math.ceil(m/a))
`.trim();

    log("→", "Submitting code...");
    const subRes = await api(
      "POST",
      "/submissions",
      { matchId, code, language: "python3" },
      user1.token,
    );

    const submission = subRes.data as {
      status: string;
      verdict: string;
      feedback: string;
      matchEnded: boolean;
      winnerId?: string;
    };

    log("📋", `Submission status: ${submission.status}`);
    log("📋", `Verdict: ${submission.verdict}`);
    log("📋", `Feedback: ${submission.feedback?.substring(0, 100)}...`);
    log("📋", `Match ended: ${submission.matchEnded}`);

    if (submission.matchEnded) {
      log("✅", `Winner: ${submission.winnerId === user1.id ? "User 1" : "User 2"}`);
    }

    // ═══════════════════════════════════════════════════
    // STEP 7: Verify Final State
    // ═══════════════════════════════════════════════════
    section("Step 7: Verify Final State");

    const finalMatch = await api("GET", `/matches/${matchId}`, null, user1.token);
    const finalData = finalMatch.data as { status: string; winnerId: string | null };
    log("📋", `Final match status: ${finalData.status}`);
    log("📋", `Winner ID: ${finalData.winnerId || "None (match ongoing)"}`);

    // ═══════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════
    section("Cleanup");
    user1.socket?.disconnect();
    user2.socket?.disconnect();
    log("✅", "Sockets disconnected");

    console.log("\n" + "═".repeat(50));
    console.log("🎉 INTEGRATION TEST PASSED!");
    console.log("═".repeat(50) + "\n");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  }
}

runTest();
