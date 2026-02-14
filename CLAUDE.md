# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AlgoWars is a real-time 1v1 competitive programming platform where users compete head-to-head solving algorithmic problems. The platform uses an AI-powered judge (Claude via MegaLLM) to evaluate code submissions. See `PLAN.md` for the full roadmap (Phases 1-8 complete, Frontend and Admin next).

## Commands

```bash
# Development
bun run dev              # Start server with hot reload (watches src/index.ts)
bun run build            # Build for production with tsup (ESM, esnext)
bun run start            # Run production build (dist/index.js)

# Code Quality (all three run on pre-commit via Husky)
bun run lint             # Check with Biome
bun run lint:fix         # Auto-fix lint issues
bun run format           # Format with Biome
bun run typecheck        # TypeScript type checking (tsc --noEmit)
bun run check:functions  # Enforce max 30 lines per function
bun run quality          # Run all checks: typecheck + lint + check:functions + tests

# Database
docker compose up -d     # Start PostgreSQL container
bun run db:generate      # Generate Drizzle migrations from schema
bun run db:migrate       # Apply migrations
bun run db:ingest        # Ingest problem metadata from codeforces_scraped_problems/ JSON
bun run db:studio        # Open Drizzle Studio (visual DB browser)

# Problem Management (direct script execution)
bun scripts/fetch-statements.ts   # Bulk fetch problem statements from Codeforces (~4 min)
bun scripts/fetch-single.ts 1A    # Fetch single problem statement by ID

# Testing
bun test                 # Run Bun test runner (unit tests)
bun test <file>          # Run single test file
bun scripts/test-api.ts          # Integration: test all API endpoints
bun scripts/test-matchmaking.ts  # Integration: test matchmaking flow
```

## Architecture

### Tech Stack
- **Runtime**: Bun (native TypeScript)
- **Framework**: Hono (lightweight web framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: Socket.IO (integrated with Hono via `getRequestListener`)
- **Auth**: JWT + Bun.password (bcrypt), 7-day token expiry
- **AI Judge**: Claude via MegaLLM (OpenAI-compatible API)
- **Linting**: Biome (line width 100, complexity limit 10, strict rules)

### Path Aliases
Uses `@/*` → `src/*` mapping (configured in tsconfig.json)

### Entry Flow
`src/index.ts` → `src/app.ts` (Hono setup + middleware + error handler) → `src/routes/index.ts` (route aggregator)

Middleware order in app.ts: logger → CORS → static files → routes → error handler → 404 handler

### Key Directories
- `src/routes/` - HTTP route handlers (auth, users, matches, submissions, admin)
- `src/services/` - Business logic (auth, ai-judge, submission-queue, matchmaking, match-engine)
- `src/middleware/` - Hono middleware (auth JWT, admin role check)
- `src/db/` - Drizzle schema
- `src/lib/` - Utilities (db client, env validation, error classes, logger, mutex)
- `src/socket/` - Socket.IO handlers and emit helpers
- `scripts/` - Problem ingestion, statement fetching, integration test scripts
- `drizzle/` - Generated migration files

### Service Pattern
All services export singleton objects (not classes):
```typescript
export const matchmaking = { join, leave, isQueued, size, cleanupStale };
export const matchEngine = { start, processVerdict, forfeit, abort };
```

### Route Handler Pattern
Routes use Zod for body validation with `safeParse`, and a shared `isValidUUID()` helper for ID params:
```typescript
const body = await c.req.json();
const parsed = schema.safeParse(body);
if (!parsed.success) throw Errors.BadRequest(parsed.error.issues[0]?.message ?? "Invalid input");
```

### Concurrency: Mutex and MutexManager
- `Mutex` (src/lib/mutex.ts) — FIFO wait queue, `withLock(fn)` helper. Used for the global matchmaking queue.
- `MutexManager` — per-entity mutex map (lazy creation). Used for per-match state locking in match-engine.
- Submission queue uses per-user Map for concurrent submissions from different users.

### Auth & Middleware
Two-level protection via Hono context:
```typescript
authMiddleware   // JWT verification → sets c.var.user
adminMiddleware  // Checks user.role === "ADMIN"
```
User type is declared on Hono's `ContextVariableMap` for type-safe access.

### Socket.IO Integration
- Shares the same HTTP server as Hono (no separate port)
- JWT auth in socket handshake (`socket.handshake.auth.token`)
- Room strategy: `user:{userId}` for personal events, `match:{matchId}` for match events
- 10-second reconnection window before auto-forfeit
- Multi-tab support (tracks socket count per user)
- `socketEmit` singleton used by services for real-time updates

### AI Judge (src/services/ai-judge.ts)
- OpenAI SDK pointing to MegaLLM (`https://ai.megallm.io/v1`)
- Fast language mismatch pre-check before AI call (returns COMPILE_ERROR)
- JSON response with markdown stripping and fallback regex extraction
- Verdicts: ACCEPTED, WRONG_ANSWER, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR, COMPILE_ERROR, INVALID_CODE
- Supported languages: `cpp17`, `cpp20`, `python3`, `java17`, `pypy3`

### Database Schema (src/db/schema.ts)
Six tables with Drizzle relations:
- `users` / `user_stats` - Accounts and rating stats (1:1, cascade delete)
- `problems` - Competitive programming problems with lazy-loaded statements
- `matches` - Match instances (600s default duration, state machine)
- `match_players` - Junction table with ratingBefore/After tracking
- `submissions` - Code submissions with AI judge verdicts

Enums: `UserRole`, `GameMode`, `MatchStatus`, `PlayerResult`, `Verdict`

### Error Handling
Use `Errors` factory from `src/lib/errors.ts`:
```typescript
throw Errors.NotFound("User")      // 404
throw Errors.Unauthorized()        // 401
throw Errors.BadRequest("msg")     // 400
throw Errors.Conflict("msg")       // 409
throw Errors.Forbidden()           // 403
```

### Environment Variables
Validated via Zod in `src/lib/env.ts` (fails fast on startup):
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - Min 16 chars (required)
- `MEGALLM_API_KEY` - MegaLLM API key for AI judge (required)
- `AI_MODEL` - Model ID (default: `claude-sonnet-4-5-20250929`)
- `AI_TIMEOUT_MS` - Judge timeout in ms (default: 30000)
- `CORS_ORIGINS` - Comma-separated origins or `"*"` (default: `"*"`)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - development | production | test

### Code Constraints
- **Max 30 lines per function** — enforced by `check:functions` script and pre-commit hook (excludes blanks/comments; `seed.ts` and `admin.ts` are exempted)
- **Biome rules**: noExplicitAny, noUnusedImports, noDoubleEquals, useConst, cognitive complexity ≤ 10

### Pre-commit Hook
Runs `bun run typecheck && bun run check:functions && bunx lint-staged` which applies Biome to staged `.ts`, `.tsx`, `.js`, `.json` files.
