import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { env } from "./env";
import { logger } from "./logger";

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });

/**
 * Supabase free tier pauses DB after 7 days of inactivity.
 * Ping every 5 days with a lightweight query to keep it alive.
 */
const DB_PING_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export async function verifyDbConnection(): Promise<void> {
  await db.execute(sql`SELECT 1`);
  logger.info("DB", "Connection verified");
}

export function startDbKeepAlive(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      await db.execute(sql`SELECT 1`);
      logger.info("DB", "Keep-alive ping successful");
    } catch (err) {
      logger.error("DB", "Keep-alive ping failed", err);
    }
  }, DB_PING_INTERVAL_MS);
}
