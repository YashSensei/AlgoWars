/**
 * API Integration Test
 * Tests all endpoints end-to-end
 * Run with: bun scripts/test-api.ts
 */

const BASE_URL = "http://localhost:3000";

async function request(method: string, path: string, body?: object, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

async function test() {
  console.log("🧪 API Integration Test\n");
  console.log("=".repeat(60));

  // Health check
  console.log("\n📍 GET /health");
  const health = await request("GET", "/health");
  console.log("Status:", health.status, health.status === 200 ? "✅" : "❌");

  // Generate unique test users
  const ts = Date.now();
  const user1 = { username: `test1_${ts}`, email: `test1_${ts}@test.com`, password: "password123" };
  const user2 = { username: `test2_${ts}`, email: `test2_${ts}@test.com`, password: "password123" };

  // Register user 1
  console.log("\n📍 POST /auth/register (user1)");
  const reg1 = await request("POST", "/auth/register", user1);
  console.log("Status:", reg1.status, reg1.status === 201 ? "✅" : "❌");
  const token1 = reg1.data.token;

  // Register user 2
  console.log("\n📍 POST /auth/register (user2)");
  const reg2 = await request("POST", "/auth/register", user2);
  console.log("Status:", reg2.status, reg2.status === 201 ? "✅" : "❌");
  const token2 = reg2.data.token;

  // Login user 1
  console.log("\n📍 POST /auth/login");
  const login = await request("POST", "/auth/login", { email: user1.email, password: user1.password });
  console.log("Status:", login.status, login.status === 200 ? "✅" : "❌");

  // Get current user
  console.log("\n📍 GET /users/me");
  const me = await request("GET", "/users/me", undefined, token1);
  console.log("Status:", me.status, me.status === 200 ? "✅" : "❌");
  console.log("User:", me.data.username);

  // User 1 joins queue
  console.log("\n📍 POST /matches/queue (user1)");
  const q1 = await request("POST", "/matches/queue", undefined, token1);
  console.log("Status:", q1.status, "Result:", q1.data.status);

  // Check queue status
  console.log("\n📍 GET /matches/queue/status (user1)");
  const qs = await request("GET", "/matches/queue/status", undefined, token1);
  console.log("Status:", qs.status, "Queued:", qs.data.queued);

  // User 2 joins queue (should match!)
  console.log("\n📍 POST /matches/queue (user2) - should match");
  const q2 = await request("POST", "/matches/queue", undefined, token2);
  console.log("Status:", q2.status, "Result:", q2.data.status);

  if (q2.data.status === "matched") {
    console.log("🎉 Match created! ID:", q2.data.matchId);

    // Get match details
    console.log("\n📍 GET /matches/:id");
    const match = await request("GET", `/matches/${q2.data.matchId}`, undefined, token1);
    console.log("Status:", match.status, match.status === 200 ? "✅" : "❌");
    console.log("Match status:", match.data.status);
    console.log("Players:", match.data.players?.length);
    console.log("Problem:", match.data.problem?.title ?? "(none - seed problems first)");

    // Start the match
    console.log("\n📍 POST /matches/:id/start");
    const start = await request("POST", `/matches/${q2.data.matchId}/start`, undefined, token1);
    console.log("Status:", start.status, start.status === 200 ? "✅" : "❌");
    console.log("Match started:", start.data.status);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ API test complete!");
}

test().catch((e) => {
  console.error("❌ Test error:", e.message);
  console.log("\n💡 Make sure the server is running: bun run dev");
  process.exit(1);
});
