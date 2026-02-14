import { Hono } from "hono";
import { z } from "zod/v4";
import { Errors } from "../lib/errors";
import { authMiddleware } from "../middleware/auth";
import { authService } from "../services/auth";

export const authRoutes = new Hono();

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    ),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

/**
 * POST /auth/register
 * Creates Supabase user + DB profile. Returns message to verify email.
 */
authRoutes.post("/register", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.BadRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { username, email, password } = parsed.data;
  const result = await authService.register(username, email, password);

  return c.json(result, 201);
});

/**
 * POST /auth/login
 * Signs in via Supabase. Returns user + session tokens.
 */
authRoutes.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.BadRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { email, password } = parsed.data;
  const result = await authService.login(email, password);

  return c.json(result);
});

/**
 * POST /auth/refresh
 * Refresh session tokens using a Supabase refresh token.
 */
authRoutes.post("/refresh", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.BadRequest("Missing refresh_token");
  }

  const session = await authService.refreshSession(parsed.data.refresh_token);
  return c.json(session);
});

/**
 * POST /auth/ensure-profile
 * For OAuth users: ensures a DB profile exists after Supabase auth.
 * Returns the user profile (with or without username).
 */
authRoutes.post("/ensure-profile", authMiddleware, async (c) => {
  const { id, email } = c.get("user");
  const user = await authService.ensureProfile(id, email);
  return c.json({ user });
});
