/**
 * Test Matchmaking Service
 * Run with: bun scripts/test-matchmaking.ts
 */

import { eq } from "drizzle-orm";
import { userStats, users } from "../src/db/schema";
import { db } from "../src/lib/db";
import { matchmaking } from "../src/services/matchmaking";

async function test() {
  console.log("🧪 Matchmaking Test\n");
  console.log("=".repeat(50));

  // Get two test users
  const testUsers = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .limit(2);

  if (testUsers.length < 2) {
    console.log("❌ Need at least 2 users in database to test");
    console.log("Run: bun scripts/ingest-problems.ts first, then create users via API");
    process.exit(1);
  }

  const [user1, user2] = testUsers;
  console.log(`\nTest users: ${user1.username}, ${user2.username}`);

  // Test 1: First user joins queue
  console.log("\n📝 Test 1: First user joins queue");
  console.log("-".repeat(50));
  const result1 = await matchmaking.join(user1.id);
  console.log("Result:", result1);
  console.log("Queue size:", matchmaking.size());
  console.log("Expected: status=queued, size=1");

  // Test 2: Second user joins and gets matched
  console.log("\n📝 Test 2: Second user joins (should match)");
  console.log("-".repeat(50));
  const result2 = await matchmaking.join(user2.id);
  console.log("Result:", result2);
  console.log("Queue size:", matchmaking.size());
  console.log("Expected: status=matched, matchId exists, size=0");

  if (result2.status === "matched" && result2.matchId) {
    console.log("\n✅ Match created successfully!");
    console.log("Match ID:", result2.matchId);

    // Fetch match details
    const match = await db.query.matches.findFirst({
      where: eq(require("../src/db/schema").matches.id, result2.matchId),
      with: { players: true, problem: true },
    });
    console.log("\nMatch details:");
    console.log("- Status:", match?.status);
    console.log("- Problem:", match?.problem?.title ?? "(no problem - need to seed)");
    console.log("- Players:", match?.players.length);
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Matchmaking test complete!");
}

test().catch((e) => {
  console.error("❌ Test error:", e);
  process.exit(1);
});
