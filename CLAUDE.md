# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AlgoWars is a real-time 1v1 competitive programming platform where users compete head-to-head solving algorithmic problems. The platform uses an AI-powered judge (Claude via MegaLLM) to evaluate code submissions. Backend (Bun + Hono), Next.js frontend in `frontend/`, and admin routes are all implemented. See `PLAN.md` for the original roadmap — trust the code over the roadmap for current state.

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

# Database (Supabase Postgres — DATABASE_URL points at the Supabase project)
bun run db:generate      # Generate Drizzle migrations from schema
bun run db:migrate       # Apply migrations
bun run db:ingest        # Ingest problem metadata from codeforces_scraped_problems/ JSON
bun run db:studio        # Open Drizzle Studio (visual DB browser)
# Note: docker-compose.yml exists for local Postgres fallback but isn't the primary path

# Problem Management (direct script execution)
bun scripts/fetch-statements.ts   # Bulk fetch problem statements from Codeforces (~4 min)
bun scripts/fetch-single.ts 1A    # Fetch single problem statement by ID

# Testing
bun test                 # Run Bun test runner (unit tests)
bun test <file>          # Run single test file
bun scripts/test-api.ts          # Integration: test all API endpoints
bun scripts/test-matchmaking.ts  # Integration: test matchmaking flow
bun scripts/test-ai-judge.ts     # Integration: test AI judge verdicts
bun scripts/test-socket.ts       # Integration: test Socket.IO handlers
bun scripts/test-integration.ts  # Integration: end-to-end flow
bun scripts/test-admin.ts        # Integration: admin routes

# Frontend (run from frontend/)
cd frontend && npm run dev       # Next.js dev server on port 3001
cd frontend && npm run build     # Production build
cd frontend && npm run typecheck # tsc --noEmit for frontend
```

## Architecture

### Tech Stack
- **Runtime**: Bun (native TypeScript)
- **Framework**: Hono (lightweight web framework)
- **Database**: Supabase Postgres with Drizzle ORM (keep-alive pinger every 5 days)
- **Real-time**: Socket.IO (integrated with Hono via `getRequestListener`)
- **Auth**: Supabase Auth — this backend only *verifies* JWTs via JWKS (no shared secret)
- **AI Judge**: Claude via MegaLLM (OpenAI-compatible API)
- **Frontend**: Next.js 16 (App Router) in `frontend/` — separate port 3001
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
Supabase issues JWTs; this backend verifies them via JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) using `jose`. There is no shared secret — verification is by public key only. Two-level protection via Hono context:
```typescript
authMiddleware   // verifyToken() via JWKS → loads user from DB → sets c.var.user
adminMiddleware  // Checks user.role === "ADMIN"
```
`authService.ensureProfile(supabaseUserId, email)` mirrors a Supabase auth user into the local `users`/`user_stats` tables — called after the OAuth callback via `POST /auth/ensure-profile`. OAuth users can be created without a `username`; the frontend `(auth)/choose-username` page fills that in later. User type is declared on Hono's `ContextVariableMap` for type-safe access.

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
- Prompt asks for `{verdict, confidence, feedback}` — AI only emits one of the first four verdicts below
- DB enum (`verdictEnum`): PENDING, JUDGING, ACCEPTED, WRONG_ANSWER, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR, COMPILE_ERROR, JUDGE_TIMEOUT
- TS `Verdict` union in ai-judge.ts intentionally mirrors the enum values the judge can return (no `PENDING`/`JUDGING` — those are DB-only lifecycle states)
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
Validated via Zod in `src/lib/env.ts` (fails fast on startup; secret keys rejected if empty):
- `DATABASE_URL` - Supabase Postgres connection string (required)
- `SUPABASE_URL` - Supabase project URL, e.g. `https://xxx.supabase.co` (required)
- `SUPABASE_SECRET_KEY` - Server-side secret key, `sb_secret_...` (required, non-empty)
- `MEGALLM_API_KEY` - MegaLLM API key for AI judge (required, non-empty)
- `AI_MODEL` - Model ID (default: `claude-sonnet-4-6`)
- `AI_TIMEOUT_MS` - Judge timeout in ms (default: 30000)
- `CORS_ORIGINS` - Comma-separated origins or `"*"` (default: `"*"`)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - development | production | test

The backend also verifies DB connectivity on startup (`verifyDbConnection()` in `src/lib/db.ts`) — if Supabase is paused, the process exits with code 1 rather than serving a broken app.

### Code Constraints
- **Max 30 lines per function** — enforced by `check:functions` script and pre-commit hook (excludes blanks/comments; `seed.ts` and `admin.ts` are exempted)
- **Biome rules**: noExplicitAny, noUnusedImports, noDoubleEquals, useConst, cognitive complexity ≤ 10

### Pre-commit Hook
Runs `bun run typecheck && bun run check:functions && bunx lint-staged` which applies Biome to staged `.ts`, `.tsx`, `.js`, `.json` files.

### Frontend ↔ Backend Contract (frontend/)
Next.js 16 App Router on port 3001. Auth is **Supabase-owned on the client** — the Next app uses `@supabase/supabase-js` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable, safe for client bundle). The backend never issues tokens — only verifies them.

Key integration points:
- **API client** (`frontend/src/lib/api/client.ts`) auto-attaches `Authorization: Bearer <access_token>` from the active Supabase session to every request. On 401 from any non-`/auth/*` endpoint it calls `supabase.auth.signOut()` and redirects to `/login`.
- **Socket handshake** uses the same Supabase access token via `socket.handshake.auth.token`. Backend verifies via the same JWKS path as HTTP requests.
- **OAuth flow**: Supabase handles provider redirects client-side → `frontend/src/app/auth/callback` receives the session → frontend calls `POST /auth/ensure-profile` on the backend to create/fetch the DB profile row → if `username` is null, frontend routes to `(auth)/choose-username`.
- **CORS**: backend reads `CORS_ORIGINS` (comma-separated) and applies it to both HTTP middleware and Socket.IO CORS. In dev the default `"*"` works; in production this MUST be set to the frontend origin.
- **Frontend env example** lives in `frontend/.env.example` — copy to `.env.local` before running `npm run dev`.

Frontend internals (route groups, Zustand stores, Monaco, shadcn) are deliberately not documented here — read the code. This section only captures cross-stack contracts that can't be derived from one side.
