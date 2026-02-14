/**
 * Auth Service — Supabase-backed
 * Uses Supabase Admin SDK for user management
 * Verifies Supabase JWTs via JWKS (public key discovery)
 */

import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { Errors } from "../lib/errors";
import { supabaseAdmin } from "../lib/supabase";

// JWKS endpoint — fetches public keys for JWT verification (cached by jose)
const JWKS = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

export type AuthPayload = { sub: string };

// Helper: Map DB unique constraint errors to user-friendly messages
function handleDuplicateError(err: unknown): never {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("email")) throw Errors.Conflict("Email already registered");
  if (msg.includes("username")) throw Errors.Conflict("Username already taken");
  throw Errors.Conflict("Email or username already taken");
}

// Helper: Create DB profile + stats, rollback Supabase user on failure
async function createDbProfile(userId: string, email: string, username?: string) {
  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id: userId, username, email });
      await tx.insert(userStats).values({ userId });
    });
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) handleDuplicateError(err);
    throw err;
  }
}

// Helper: Fetch user profile with stats
function fetchUserProfile(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, username: true, email: true, createdAt: true, role: true },
    with: { stats: true },
  });
}

export const authService = {
  /**
   * Register a new user via Supabase Auth + create DB profile.
   * User must verify email before they can log in.
   */
  async register(username: string, email: string, password: string) {
    // Check username availability first (fast DB check)
    const existingUsername = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (existingUsername) throw Errors.Conflict("Username already taken");

    // Create Supabase auth user (email_confirm: false = must verify)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { username },
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        throw Errors.Conflict("Email already registered");
      }
      throw Errors.BadRequest(authError.message);
    }

    await createDbProfile(authData.user.id, email, username);
    const user = await fetchUserProfile(authData.user.id);

    return { user, message: "Check your email to verify your account" };
  },

  /**
   * Login via Supabase Auth — returns session tokens.
   * Only works if the user has verified their email.
   */
  async login(email: string, password: string) {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw Errors.Unauthorized("Invalid credentials");
    }

    const user = await fetchUserProfile(data.user.id);
    if (!user) {
      throw Errors.Unauthorized("Account setup incomplete. Please contact support.");
    }

    return {
      user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    };
  },

  /**
   * Create or fetch DB profile for an OAuth user.
   * Called after OAuth callback when we confirm the Supabase user exists.
   */
  async ensureProfile(supabaseUserId: string, email: string) {
    const existing = await fetchUserProfile(supabaseUserId);
    if (existing) return existing;

    // First-time OAuth user — create profile without username
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id: supabaseUserId, email });
      await tx.insert(userStats).values({ userId: supabaseUserId });
    });

    return fetchUserProfile(supabaseUserId);
  },

  /**
   * Verify a Supabase JWT via JWKS (public key discovery).
   * jose caches the JWKS keys automatically.
   */
  async verifyToken(token: string): Promise<AuthPayload> {
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${env.SUPABASE_URL}/auth/v1`,
      });
      if (!payload.sub) throw new Error("Missing sub claim");
      return { sub: payload.sub };
    } catch {
      throw Errors.Unauthorized("Invalid token");
    }
  },

  /**
   * Refresh a session using Supabase refresh token.
   */
  async refreshSession(refreshToken: string) {
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw Errors.Unauthorized("Session expired. Please log in again.");
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    };
  },
};
