import { z } from "zod/v4";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY cannot be empty"),
  MEGALLM_API_KEY: z.string().min(1, "MEGALLM_API_KEY cannot be empty"),
  AI_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
  AI_TIMEOUT_MS: z.coerce.number().default(60000),
  // CORS origins (comma-separated list, or "*" for all in dev)
  CORS_ORIGINS: z.string().default("*"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

// Helper to parse CORS origins
export function getCorsOrigins(): string[] | "*" {
  if (env.CORS_ORIGINS === "*") return "*";
  return env.CORS_ORIGINS.split(",").map((o) => o.trim());
}
