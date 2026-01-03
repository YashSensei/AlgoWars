/**
 * Legacy seed script - DEPRECATED
 * Use `bun scripts/ingest-problems.ts` instead to import from codeforces_scraped_problems/
 */

async function seed() {
  console.log("⚠️  This seed script is deprecated.");
  console.log("Use: bun scripts/ingest-problems.ts");
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
