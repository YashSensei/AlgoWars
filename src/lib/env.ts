import { z } from "zod/v4";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  MEGALLM_API_KEY: z.string(),
  AI_MODEL: z.string().default("claude-sonnet-4-5-20250929"),
  AI_TIMEOUT_MS: z.coerce.number().default(30000),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
