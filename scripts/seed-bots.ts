/**
 * Seeds bot accounts into the database.
 * Run once after migrations: bun scripts/seed-bots.ts
 * Idempotent — skips bots that already exist (by email).
 */

import { eq } from "drizzle-orm";
import { users, userStats } from "../src/db/schema";
import { db } from "../src/lib/db";

const BOTS = [
  { username: "CodeNinja", rating: 1050 },
  { username: "AlgoPhantom", rating: 980 },
  { username: "ByteStorm", rating: 1020 },
  { username: "SyntaxWraith", rating: 1100 },
  { username: "NullPointer", rating: 950 },
  { username: "RecursiveAce", rating: 1080 },
  { username: "StackOverflow", rating: 1000 },
  { username: "BinaryGhost", rating: 1040 },
];

async function seedBots() {
  console.log("🤖 Seeding bot accounts...\n");
  let created = 0;
  let skipped = 0;

  for (const bot of BOTS) {
    const email = `${bot.username.toLowerCase()}@algowars.bot`;
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      skipped++;
      continue;
    }

    const [user] = await db
      .insert(users)
      .values({ username: bot.username, email, isBot: true })
      .returning({ id: users.id });

    if (user) {
      await db.insert(userStats).values({ userId: user.id, rating: bot.rating });
      console.log(`  ✓ ${bot.username} (${bot.rating} ELO)`);
      created++;
    }
  }

  console.log(`\n✅ Created: ${created}, Skipped (exist): ${skipped}`);
  process.exit(0);
}

seedBots().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
