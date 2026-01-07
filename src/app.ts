import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { getCorsOrigins } from "./lib/env";
import { AppError } from "./lib/errors";
import { logger } from "./lib/logger";
import { routes } from "./routes";

export const app = new Hono();

// Middleware
app.use("*", honoLogger());

// CORS configuration - configurable via CORS_ORIGINS env var
const corsOrigins = getCorsOrigins();
app.use(
  "*",
  cors({
    origin: corsOrigins === "*" ? "*" : corsOrigins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

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
    return c.json({ error: err.message, code: err.code }, err.statusCode);
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
