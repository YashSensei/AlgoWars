# Multi-stage build: compile with Bun, run with Bun (small image).
# Frontend is deployed separately on Vercel, so we don't include it here.

FROM oven/bun:1.3-slim AS builder

WORKDIR /app

# Install deps first for better layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY tsconfig.json tsup.config.ts drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
COPY scripts ./scripts
RUN bun run build

# ---

FROM oven/bun:1.3-slim

WORKDIR /app

# Runtime-only dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Render sets PORT env var dynamically; our server reads env.PORT.
# EXPOSE is informational here — Render routes based on the running PORT.
EXPOSE 3000

CMD ["bun", "dist/index.js"]
