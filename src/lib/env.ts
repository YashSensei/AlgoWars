import { z } from "zod/v4";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  MEGALLM_API_KEY: z.string(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
