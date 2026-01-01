import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { AppError } from "./lib/errors";
import { routes } from "./routes";

export const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Routes
app.route("/", routes);

// Error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.statusCode as 400);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));
