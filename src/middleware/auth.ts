import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { users } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import type { AuthPayload } from "../services/auth";
import { authService } from "../services/auth";

// User role type
type UserRole = "USER" | "ADMIN";

// Extend Hono's context to include user
declare module "hono" {
  interface ContextVariableMap {
    user: { id: string; username: string | null; email: string; role: UserRole };
    supabaseUser: { id: string; email: string };
  }
}

// Helper: extract and verify bearer token from Authorization header
async function verifyBearer(c: Context): Promise<AuthPayload> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw Errors.Unauthorized("Missing token");
  }
  return authService.verifyToken(header.slice(7));
}

export async function authMiddleware(c: Context, next: Next) {
  const { sub: userId } = await verifyBearer(c);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, username: true, email: true, role: true },
  });

  if (!user) throw Errors.Unauthorized("User not found");

  c.set("user", user);
  await next();
}

/**
 * Lighter-weight auth middleware for endpoints that run BEFORE a DB profile exists
 * (e.g. POST /auth/ensure-profile on first OAuth login). Verifies the Supabase JWT
 * and exposes id + email from the token claims — no DB lookup, so no chicken-and-egg.
 */
export async function supabaseAuthMiddleware(c: Context, next: Next) {
  const { sub, email } = await verifyBearer(c);
  c.set("supabaseUser", { id: sub, email });
  await next();
}

/**
 * Admin middleware - requires user to have ADMIN role
 * Must be used AFTER authMiddleware
 */
export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get("user");

  if (!user) {
    throw Errors.Unauthorized("Authentication required");
  }

  if (user.role !== "ADMIN") {
    throw Errors.Forbidden("Admin access required");
  }

  await next();
}
