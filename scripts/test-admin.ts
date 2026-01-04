/**
 * Test Admin Panel Endpoints
 * Run with: bun scripts/test-admin.ts
 *
 * Make sure server is running: bun run dev
 */

const BASE_URL = "http://localhost:3000";

// Test user credentials (must be ADMIN role in DB)
const ADMIN_USER = {
  email: "test@example.com",
  password: "password123",
};

async function request(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function log(label: string, result: { status: number; data: unknown }) {
  const icon = result.status < 400 ? "✅" : "❌";
  console.log(`${icon} ${label} (${result.status})`);
  console.log("   ", JSON.stringify(result.data, null, 2).split("\n").slice(0, 5).join("\n   "));
  console.log();
}

async function main() {
  console.log("═".repeat(60));
  console.log("🔐 Admin Panel Test");
  console.log("═".repeat(60));

  // 1. Login as admin
  console.log("\n📝 Logging in as admin...\n");
  const loginRes = await request("POST", "/auth/login", undefined, ADMIN_USER);

  if (loginRes.status !== 200) {
    console.error("❌ Login failed:", loginRes.data);
    console.log("\nMake sure:");
    console.log("  1. Server is running (bun run dev)");
    console.log("  2. User exists with email:", ADMIN_USER.email);
    console.log("  3. User has ADMIN role in database");
    process.exit(1);
  }

  const token = (loginRes.data as { token: string }).token;
  const user = (loginRes.data as { user: { username: string; role: string } }).user;
  console.log(`✅ Logged in as ${user.username} (role: ${user.role})\n`);

  // 2. Test admin endpoints
  console.log("─".repeat(60));
  console.log("📊 Testing Admin Endpoints");
  console.log("─".repeat(60));

  // Problems stats
  const statsRes = await request("GET", "/admin/problems/stats", token);
  log("GET /admin/problems/stats", statsRes);

  // List problems
  const listRes = await request("GET", "/admin/problems?limit=3", token);
  log("GET /admin/problems?limit=3", listRes);

  // Try without auth (should fail)
  console.log("─".repeat(60));
  console.log("🔒 Testing Auth Protection");
  console.log("─".repeat(60));

  const noAuthRes = await request("GET", "/admin/problems/stats");
  log("GET /admin/problems/stats (no auth)", noAuthRes);

  // Try as regular user (would fail if we had one logged in)
  console.log("─".repeat(60));
  console.log("📋 Summary");
  console.log("─".repeat(60));
  console.log(`
Available Admin Endpoints:
  GET  /admin/problems          - List problems (query: bucket, hasStatement, limit, offset)
  GET  /admin/problems/stats    - Problem database statistics
  POST /admin/problems/:id/fetch - Fetch statement from Codeforces
  POST /admin/matches/:id/abort - Force-end a match
  POST /admin/users/:id/rating  - Adjust user rating (body: {delta, reason})
`);

  console.log("═".repeat(60));
  console.log("✅ Admin panel test complete!");
  console.log("═".repeat(60));
}

main().catch(console.error);
