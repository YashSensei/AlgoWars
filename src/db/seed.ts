import { db } from "../lib/db";
import { problems } from "./schema";

// Beginner-friendly Codeforces problems (800-1200 rating)
const SEED_PROBLEMS = [
  { oj: "codeforces", externalId: "1A", title: "Theatre Square", difficulty: 1000, tags: ["math"] },
  {
    oj: "codeforces",
    externalId: "4A",
    title: "Watermelon",
    difficulty: 800,
    tags: ["math", "brute force"],
  },
  {
    oj: "codeforces",
    externalId: "71A",
    title: "Way Too Long Words",
    difficulty: 800,
    tags: ["strings"],
  },
  {
    oj: "codeforces",
    externalId: "158A",
    title: "Next Round",
    difficulty: 800,
    tags: ["implementation"],
  },
  {
    oj: "codeforces",
    externalId: "231A",
    title: "Team",
    difficulty: 800,
    tags: ["brute force", "greedy"],
  },
  {
    oj: "codeforces",
    externalId: "282A",
    title: "Bit++",
    difficulty: 800,
    tags: ["implementation"],
  },
  {
    oj: "codeforces",
    externalId: "263A",
    title: "Beautiful Matrix",
    difficulty: 800,
    tags: ["implementation"],
  },
  {
    oj: "codeforces",
    externalId: "339A",
    title: "Helpful Maths",
    difficulty: 800,
    tags: ["greedy", "strings", "sorting"],
  },
  {
    oj: "codeforces",
    externalId: "96A",
    title: "Football",
    difficulty: 900,
    tags: ["implementation", "strings"],
  },
  {
    oj: "codeforces",
    externalId: "50A",
    title: "Domino piling",
    difficulty: 800,
    tags: ["math", "greedy"],
  },
  {
    oj: "codeforces",
    externalId: "118A",
    title: "String Task",
    difficulty: 1000,
    tags: ["implementation", "strings"],
  },
  {
    oj: "codeforces",
    externalId: "69A",
    title: "Young Physicist",
    difficulty: 1000,
    tags: ["implementation", "math"],
  },
  {
    oj: "codeforces",
    externalId: "112A",
    title: "Petya and Strings",
    difficulty: 800,
    tags: ["implementation", "strings"],
  },
  {
    oj: "codeforces",
    externalId: "236A",
    title: "Boy or Girl",
    difficulty: 800,
    tags: ["brute force", "implementation", "strings"],
  },
  {
    oj: "codeforces",
    externalId: "133A",
    title: "HQ9+",
    difficulty: 900,
    tags: ["implementation"],
  },
  {
    oj: "codeforces",
    externalId: "443A",
    title: "Anton and Letters",
    difficulty: 800,
    tags: ["implementation", "strings"],
  },
  {
    oj: "codeforces",
    externalId: "546A",
    title: "Soldier and Bananas",
    difficulty: 800,
    tags: ["brute force", "implementation", "math"],
  },
  { oj: "codeforces", externalId: "617A", title: "Elephant", difficulty: 800, tags: ["math"] },
  {
    oj: "codeforces",
    externalId: "785A",
    title: "Anton and Polyhedrons",
    difficulty: 800,
    tags: ["implementation", "strings"],
  },
  {
    oj: "codeforces",
    externalId: "977A",
    title: "Wrong Subtraction",
    difficulty: 800,
    tags: ["implementation"],
  },
].map((p) => ({
  ...p,
  url: `https://codeforces.com/problemset/problem/${p.externalId.replace(/([A-Z]+)/, "/$1")}`,
}));

async function seed() {
  console.log("🌱 Seeding problems...");

  await db.insert(problems).values(SEED_PROBLEMS).onConflictDoNothing();

  console.log(`✅ Seeded ${SEED_PROBLEMS.length} problems`);
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
