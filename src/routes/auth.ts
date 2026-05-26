import { Hono } from "hono";
import { z } from "zod/v4";
import { Errors } from "../lib/errors";
import { supabaseAuthMiddleware } from "../middleware/auth";
import { authService } from "../services/auth";
import { otpService } from "../services/otp";

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
 * Step 1: Validates input (checks username/email availability), generates OTP.
 * Returns the code to the frontend which sends the verification email via EmailJS.
 * NO user/DB writes happen here — only stored in-memory pending verification.
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

  // Early availability checks — fail fast before generating OTP
  await authService.checkAvailability(username, email);

  const code = otpService.create(username, email, password);
  return c.json({ code, message: "Verification code generated" }, 200);
});

const verifyOtpSchema = z.object({
  email: z.email(),
  code: z.string().length(6),
});

/**
 * POST /auth/verify-otp
 * Step 2: Verifies OTP code, creates Supabase user + DB profile, then auto-signs in.
 * Returns user + session so the frontend can proceed directly without a separate login.
 */
authRoutes.post("/verify-otp", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.BadRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const pending = otpService.verify(parsed.data.email, parsed.data.code);
  if (!pending) {
    throw Errors.BadRequest("Invalid or expired verification code");
  }

  await authService.register(pending.username, pending.email, pending.password);
  const loginResult = await authService.login(pending.email, pending.password);
  return c.json(loginResult, 201);
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
 * Uses the token-only middleware because the DB row may not exist yet (first OAuth login).
 * Returns the user profile (with or without username).
 */
authRoutes.post("/ensure-profile", supabaseAuthMiddleware, async (c) => {
  const { id, email } = c.get("supabaseUser");
  const user = await authService.ensureProfile(id, email);
  return c.json({ user });
});
