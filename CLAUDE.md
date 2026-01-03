# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AlgoWars is a real-time 1v1 competitive programming platform where users compete head-to-head solving algorithmic problems. The platform uses an AI-powered judge (Claude via MegaLLM) to evaluate code submissions. Note: VJudge integration was initially planned but abandoned due to Codeforces captcha blocking bot accounts.

## Commands

```bash
# Development
bun run dev              # Start server with hot reload (watches src/index.ts)
bun run build            # Build for production with tsup
bun run start            # Run production build

# Code Quality (runs automatically on pre-commit via Husky)
bun run lint             # Check with Biome
bun run lint:fix         # Auto-fix lint issues
bun run format           # Format with Biome
bun run typecheck        # TypeScript type checking

# Database
docker compose up -d     # Start PostgreSQL container
bun run db:generate      # Generate Drizzle migrations from schema
bun run db:migrate       # Apply migrations
bun run db:seed          # Seed problems from Codeforces
bun run db:studio        # Open Drizzle Studio (visual DB browser)

# Testing
bun test                 # Run tests
bun test <file>          # Run single test file
```

## Architecture

### Tech Stack
- **Runtime**: Bun (native TypeScript)
- **Framework**: Hono (lightweight web framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: Socket.IO (pending implementation)
- **Auth**: JWT + Bun.password (bcrypt)
- **Linting**: Biome (replaces ESLint + Prettier)

### Path Aliases
Uses `@/*` → `src/*` mapping (configured in tsconfig.json)

### Entry Flow
`src/index.ts` → `src/app.ts` (Hono setup) → `src/routes/index.ts` (route aggregator)

### Key Directories
- `src/routes/` - HTTP route handlers (auth, users, matches pending)
- `src/services/` - Business logic (auth, ai-judge, submission-queue, matchmaking pending)
- `src/middleware/` - Hono middleware (auth JWT verification)
- `src/db/` - Drizzle schema and seed scripts
- `src/lib/` - Utilities (db client, env validation, error classes)
- `src/socket/` - WebSocket event handlers (pending)
- `drizzle/` - Generated migration files

### Database Schema (src/db/schema.ts)
Six tables with Drizzle relations:
- `users` / `user_stats` - User accounts and rating stats (1:1)
- `problems` - Cached competitive programming problems
- `matches` - Match instances with status and timing
- `match_players` - Junction table (users ↔ matches)
- `submissions` - Code submissions with AI judge verdicts

Enums: `GameMode`, `MatchStatus`, `PlayerResult`, `Verdict`

### Error Handling
Use `Errors` factory from `src/lib/errors.ts`:
```typescript
throw Errors.NotFound("User")      // 404
throw Errors.Unauthorized()        // 401
throw Errors.BadRequest("msg")     // 400
throw Errors.Conflict("msg")       // 409
```

### Environment Variables
Validated via Zod in `src/lib/env.ts`. Required vars:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Min 16 chars
- `MEGALLM_API_KEY` - MegaLLM API key for AI judge (Claude)

### Pre-commit Hook
Runs `bun run typecheck && bunx lint-staged` which applies Biome to staged `.ts`, `.tsx`, `.js`, `.json` files.

## Current Status

Phases 1-4 complete (project setup, database, auth, AI judge). VJudge integration was abandoned due to Codeforces captcha blocking bot accounts - using AI-powered judge (Claude via MegaLLM) instead. This is a PoC approach that can be swapped for a real judge later. See `PLAN.md` for detailed roadmap.
