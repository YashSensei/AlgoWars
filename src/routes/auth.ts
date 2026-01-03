import { Hono } from "hono";
import { z } from "zod/v4";
import { Errors } from "../lib/errors";
import { authService } from "../services/auth";

export const authRoutes = new Hono();

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

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
