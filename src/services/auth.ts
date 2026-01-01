import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { Errors } from "../lib/errors";

const JWT_EXPIRES_IN = "7d";

export type AuthPayload = { userId: string };

export const authService = {
  async register(username: string, email: string, password: string) {
    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) throw Errors.Conflict("Email already registered");

    const existingUsername = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (existingUsername) throw Errors.Conflict("Username already taken");

    // Hash password using Bun's native API
    const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt" });

    // Create user + stats in transaction
    const user = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({ username, email, passwordHash })
        .returning({ id: users.id, username: users.username, email: users.email });

      if (!newUser) throw new Error("Failed to create user");

      await tx.insert(userStats).values({ userId: newUser.id });

      return newUser;
    });

    const token = this.signToken(user.id);
    return { user, token };
  },

  async login(email: string, password: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      with: { stats: true },
    });

    if (!user) throw Errors.Unauthorized("Invalid credentials");

    const valid = await Bun.password.verify(password, user.passwordHash);
    if (!valid) throw Errors.Unauthorized("Invalid credentials");

    const token = this.signToken(user.id);
    const { passwordHash: _, ...safeUser } = user;

    return { user: safeUser, token };
  },

  signToken(userId: string): string {
    return jwt.sign({ userId } satisfies AuthPayload, env.JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  },

  verifyToken(token: string): AuthPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    } catch {
      throw Errors.Unauthorized("Invalid token");
    }
  },
};
