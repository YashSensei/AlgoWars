import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { users } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { authMiddleware } from "../middleware/auth";

export const userRoutes = new Hono();

// Get current user (protected)
userRoutes.get("/me", authMiddleware, async (c) => {
  const { id } = c.get("user");

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, username: true, email: true, createdAt: true },
    with: { stats: true },
  });

  if (!user) throw Errors.NotFound("User");

  return c.json(user);
});

// Get user by username (public profile)
userRoutes.get("/:username", async (c) => {
  const { username } = c.req.param();

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true, username: true, createdAt: true },
    with: {
      stats: {
        columns: {
          rating: true,
          wins: true,
          losses: true,
          draws: true,
          winStreak: true,
          maxStreak: true,
        },
      },
    },
  });

  if (!user) throw Errors.NotFound("User");

  return c.json(user);
});
