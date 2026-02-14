import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { users } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { authService } from "../services/auth";

// User role type
type UserRole = "USER" | "ADMIN";

// Extend Hono's context to include user
declare module "hono" {
  interface ContextVariableMap {
    user: { id: string; username: string | null; email: string; role: UserRole };
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    throw Errors.Unauthorized("Missing token");
  }

  const token = header.slice(7);
  const { sub: userId } = await authService.verifyToken(token);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, username: true, email: true, role: true },
  });

  if (!user) throw Errors.Unauthorized("User not found");

  c.set("user", user);
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
