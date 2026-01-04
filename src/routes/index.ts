import { Hono } from "hono";
import { adminRoutes } from "./admin";
import { authRoutes } from "./auth";
import { matchRoutes } from "./matches";
import { submissionRoutes } from "./submissions";
import { userRoutes } from "./users";

export const routes = new Hono();

// Health check
routes.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// API routes
routes.route("/auth", authRoutes);
routes.route("/users", userRoutes);
routes.route("/matches", matchRoutes);
routes.route("/submissions", submissionRoutes);
routes.route("/admin", adminRoutes);
