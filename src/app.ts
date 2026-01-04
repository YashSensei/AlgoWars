import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { AppError } from "./lib/errors";
import { logger } from "./lib/logger";
import { routes } from "./routes";

export const app = new Hono();

// Middleware
app.use("*", honoLogger());
app.use("*", cors());

// Static files (test UI)
app.use("/test", serveStatic({ path: "./public/test.html" }));

// Routes
app.route("/", routes);

// Error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    logger.warn("HTTP", `${err.statusCode} ${err.code}: ${err.message}`, {
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: err.message, code: err.code }, err.statusCode as 400);
  }
  logger.error("HTTP", `Unhandled error: ${err.message}`, {
    path: c.req.path,
    method: c.req.method,
    stack: err.stack,
  });
  return c.json({ error: "Internal server error" }, 500);
});

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));
