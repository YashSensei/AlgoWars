import { Hono } from "hono";
import { authRoutes } from "./auth";
import { userRoutes } from "./users";

export const routes = new Hono();

// Health check
routes.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// API routes
routes.route("/auth", authRoutes);
routes.route("/users", userRoutes);
