# AlgoWars — Complete Project Knowledge Base

**Live:** [algowarss.vercel.app](https://algowarss.vercel.app)  
**Repository:** [github.com/YashSensei/AlgoWars](https://github.com/YashSensei/AlgoWars)

AlgoWars is a real-time 1v1 competitive programming platform. Two players queue up, get matched by rating, receive the same algorithmic problem, and race to solve it first. Submissions are evaluated by an AI judge (Claude) in real-time — no sandbox, no compiler toolchain, just intelligent code analysis. First player to get an accepted verdict wins; ratings update via Elo.

---

## Table of Contents

1. [How a Match Works](#how-a-match-works)
2. [Bot / Phantom Opponent System](#bot--phantom-opponent-system)
3. [Rating System (Elo)](#rating-system-elo)
4. [Tech Stack](#tech-stack)
5. [Architecture](#architecture)
6. [Authentication Flow](#authentication-flow)
7. [Match State Machine](#match-state-machine)
8. [AI Judge System](#ai-judge-system)
9. [Problem Management](#problem-management)
10. [Concurrency Model](#concurrency-model)
11. [Real-time Communication](#real-time-communication)
12. [Frontend Architecture](#frontend-architecture)
13. [Deployment & Infrastructure](#deployment--infrastructure)
14. [Database Schema](#database-schema)
15. [API Endpoints](#api-endpoints)
16. [Key Design Decisions](#key-design-decisions)
17. [Known Limitations](#known-limitations)
18. [Future Roadmap](#future-roadmap)

---

## How a Match Works

### Game Modes

| Mode | Duration | Opponent | Elo Affected | Description |
|------|----------|----------|--------------|-------------|
| **Blitz** | 15 min | Real or Bot | Yes | Fast 1v1 — one problem, race to solve |
| **Classical** | 20 min | Real or Bot | Yes | Longer 1v1 — more time to think |
| **Against Time** | 8 min | None (solo) | No | Solo practice — you vs the clock |

### Match Flow (Competitive: Blitz / Classical)

```
Arena → Select Mode → Queue (15s max) → Matched → ACTIVE → COMPLETED/ABORTED
```

1. A player selects Blitz or Classical on the arena hub. They enter a mode-specific, rating-based queue (matched within ±100 Elo, same mode only).
2. If a real opponent is found within 15 seconds, they're paired. If not, a phantom bot opponent is assigned (player doesn't know it's a bot).
3. The server selects a random Codeforces problem from the appropriate rating bracket and starts the timer.
4. Both players see the same problem statement in a Monaco code editor. They write solutions in C++ (17/20), Python 3, Java 17, or PyPy 3.
5. On submit, the code is sent to Claude (via MegaLLM's OpenAI-compatible API) which analyzes the logic and returns a verdict: ACCEPTED, WRONG_ANSWER, COMPILE_ERROR, RUNTIME_ERROR, or JUDGE_TIMEOUT.
6. First player to receive ACCEPTED wins. Elo ratings update asymmetrically based on the rating difference. XP is awarded to both players.
7. Players can also surrender (instant loss + Elo penalty) or disconnect (10-second grace window before auto-forfeit).
8. If neither solves it in time, the match is aborted with no rating change (but participation XP is still awarded).

### Match Flow (Solo: Against Time)

```
Arena → "Against Time" → /solo (instant) → ACTIVE (8 min) → WIN or TIMEOUT
```

1. Player clicks "Against Time" — no queue, no waiting.
2. A match is instantly created with a silent bot placeholder (for schema compatibility). The bot never acts.
3. Player has 8 minutes to solve the problem.
4. If ACCEPTED → "Victory" screen. If timer expires → "Defeat." No Elo change either way.
5. XP is still awarded (+10 win, +5 loss).

---

## Bot / Phantom Opponent System

When no real opponent is found within 15 seconds, the system creates a match against a bot account that masquerades as a real player. The player is never told they're facing a bot.

### Bot Behavior During a Match

| Time | Action |
|------|--------|
| 0:00 | Match starts, bot is "Coding" |
| 1-4 min (random) | Bot emits 1-2 fake WRONG_ANSWER submissions via socket (player sees opponent submission count increment) |
| 5-10 min (random) | Bot submits ACCEPTED — sources real working code for the results page |

### Where the Bot's Code Comes From (Priority Order)

1. **Reuse:** Check if any previous match using this problem has an ACCEPTED human submission → use that code
2. **Generate:** Call Claude via MegaLLM with a solver prompt → get a fresh Python 3 solution
3. **Fallback:** If generation fails (timeout, API error), use a marked placeholder (filtered out of future reuse)

### Bot Design Principles

- Bot accounts have `isBot = true` in the users table. 8 bots are seeded with varied ratings (950-1100).
- Bot ratings are **exempt from Elo changes** — they stay fixed to prevent drift over many matches.
- If the real player solves first, all bot timers are cancelled immediately via `botEngine.cancel(matchId)`.
- Bot matches use the same state machine, same mutex, same DB schema as real matches — no special-case code paths.
- The illusion works because: (a) bot username looks human, (b) fake wrong submissions create engagement, (c) the results page shows real code.

### Files

- `src/services/bot-engine.ts` — orchestrates bot behavior (timers, fake submissions, solve trigger)
- `src/services/bot-solver.ts` — generates real Python solutions via Claude
- `scripts/seed-bots.ts` — creates bot accounts in the database

---

## Rating System (Elo)

Standard Elo formula with K=32, replacing the original flat ±5 system.

### Formula

```
Rating Change = K × (Actual - Expected)

Where:
  K = 32
  Expected = 1 / (1 + 10^((opponentRating - yourRating) / 400))
  Actual = 1 (win), 0 (loss)
  Minimum delta = 1 (winning always earns at least 1 point)
  Rating floor = 100 (can't drop below)
```

### Examples

| Scenario | Winner gets | Loser loses |
|----------|------------|-------------|
| 1000 vs 1000 (equal) | +16 | -16 |
| 900 vs 1200 (underdog wins!) | +27 | -27 |
| 1200 vs 900 (favorite wins) | +5 | -5 |
| 1100 vs 1000 (slight favorite) | +12 | -12 |

### Match Outcomes and Rating Effects

| Outcome | Rating Effect |
|---------|--------------|
| Win (solved first) | +Elo delta (based on opponent's rating) |
| Loss (opponent solved first) | -Elo delta |
| Surrender / Disconnect | Same as loss — full Elo penalty |
| Timeout (10 min, nobody solved) | 0 change for both (draw, no penalty) |
| Bot match (player wins) | Player gains Elo normally; bot rating unchanged |
| Bot match (bot wins) | Player loses Elo normally; bot rating unchanged |

### Starting Rating

All new accounts start at **1000 Elo**. Bots are seeded between 950-1100.

---

## Experience (XP) System

XP is a **progression metric separate from Elo**. Elo measures skill (goes up and down); XP measures engagement (only goes up). Every completed match awards XP regardless of mode.

### XP Rewards

| Outcome | XP Gained |
|---------|-----------|
| Win (ACCEPTED first) | +10 |
| Loss (opponent won, or surrender) | +5 |
| Draw (timeout) | +3 |
| Bot accounts | 0 (exempt) |

### Rank Progression (Japanese Warrior Theme)

| Rank | XP Range | Flavor |
|------|----------|--------|
| **Ashigaru** | 0–99 | Foot soldier, beginner |
| **Shinobi** | 100–249 | Stealthy learner |
| **Rōnin** | 250–499 | Wandering warrior |
| **Hatamoto** | 500–999 | Trusted bannerman |
| **Shōgun** | 1000+ | Supreme commander |

### Implementation

- `src/services/xp.ts` — `awardXP(userId, result)`, `getRankFromXP(xp)`, `getXPProgressToNextRank(xp)`
- `frontend/src/lib/xp.ts` — client-side mirror for display (same rank thresholds)
- XP stored in `user_stats.xp` column (integer, default 0)
- Awarded server-side in `match-engine.ts` on every terminal match path (processVerdict, forfeit, abort)
- Bots are exempt (same `isBot` check as Elo)
- Arena sidebar shows current rank, XP count, and progress bar to next rank
- Results page shows "+X XP" earned from the match

### Design Principles

- XP **only goes up** — losing still earns XP, preventing frustration
- Awards are server-side only — can't be faked client-side
- Timeout gives minimal XP (3) — prevents AFK farming
- Rank is computed from XP (no separate rank column) — single source of truth
- System is extensible: seasonal boosts, quests, cosmetics can be layered on top

---

## Tech Stack

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Bun | 1.3+ | Native TypeScript execution, fast startup, built-in test runner |
| Framework | Hono | 4.x | Lightweight HTTP framework, middleware-based, TypeScript-first |
| Database | Supabase Postgres + Drizzle ORM | Drizzle 0.45+ | Managed Postgres, type-safe schema, migration generation |
| Real-time | Socket.IO | 4.x | Bi-directional events, room management, auto-reconnection |
| Auth | Supabase Auth + jose (JWKS) | — | Backend only verifies JWTs via JWKS public keys, never issues tokens |
| AI Judge | Claude (Sonnet 4.6) via MegaLLM | OpenAI SDK 6.x | OpenAI-compatible endpoint, low-temperature structured JSON output |
| Concurrency | Custom Mutex + MutexManager | — | FIFO lock queue (matchmaking), per-entity lock map (match state) |
| Build | tsup | 8.x | ESM bundling for production |
| Linting | Biome | 2.3+ | Replaces ESLint + Prettier — formatting + lint in one fast tool |

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 16.x | React 19, file-based routing, fast refresh |
| Styling | Tailwind CSS | v4 | Utility-first, dark theme, responsive design |
| Code Editor | Monaco Editor (@monaco-editor/react) | 4.x | VS Code engine in browser, syntax highlighting, multi-language |
| State Management | Zustand | 5.x | Minimal store, selector-based re-renders, no boilerplate |
| UI Components | shadcn/ui + custom glass panels | — | Composable primitives with cyberpunk aesthetic |
| Forms | React Hook Form + Zod | 7.x / 4.x | Type-safe validation, resolver pattern |
| Auth Client | @supabase/supabase-js | 2.x | Token auto-refresh, OAuth flows, session persistence in localStorage |
| Panels | react-resizable-panels | 2.x | Draggable panel layout for the match IDE |

### Infrastructure

| Concern | Solution | Details |
|---------|----------|---------|
| Backend hosting | Render | Docker-based, free tier, self-ping keep-alive (14 min interval) |
| Frontend hosting | Vercel | Native Next.js, edge network, auto-deploy on push |
| Database | Supabase | Managed Postgres, free tier with 5-day keep-alive pinger |
| Auth Provider | Supabase Auth | Google OAuth, email/password, JWKS key rotation |
| AI API | MegaLLM | OpenAI-compatible proxy for Claude models |
| CI | GitHub Actions | typecheck + lint + function-length + build |
| DNS/CORS | Render env vars | `CORS_ORIGINS` must exactly match the Vercel frontend URL |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  Next.js 16 (App Router) + Zustand + Monaco + Socket.IO Client  │
└─────────────┬────────────────────────┬──────────────────────────┘
              │ HTTP (REST)            │ WebSocket (Socket.IO)
              ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HONO SERVER (Bun)                           │
│                                                                  │
│  ┌──────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────────┐  │
│  │  Routes  │ │ Match Engine │ │ Matchmaker│ │  Bot Engine  │  │
│  │ (HTTP)   │ │ (State Mach.)│ │ (Queue)   │ │  (Phantom)   │  │
│  └────┬─────┘ └──────┬───────┘ └─────┬─────┘ └──────┬───────┘  │
│       │               │               │              │           │
│  ┌────┴───────────────┴───────────────┴──────────────┴───────┐  │
│  │                    Shared Services                         │  │
│  │  AI Judge │ Submission Queue │ Problem Fetcher │ Auth Svc  │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌────────────────┐
    │  Supabase    │ │ Supabase │ │    MegaLLM     │
    │  Postgres    │ │   Auth   │ │  (Claude API)  │
    │  (Drizzle)   │ │  (JWKS)  │ │                │
    └──────────────┘ └──────────┘ └────────────────┘
```

### Data Flow — Single Submission

```
1. User clicks SUBMIT in Monaco editor
2. Frontend: POST /submissions {matchId, code, language}
3. Backend: authMiddleware verifies JWT → loads user from DB
4. Backend: validateMatchAndPlayer → confirms match is ACTIVE, user is a player
5. Backend: submissionQueue.submit() → acquires per-user lock
6. Backend: ai-judge.judgeCode() → calls MegaLLM with problem + code
7. MegaLLM: Claude analyzes code, returns {verdict, confidence, feedback}
8. Backend: INSERT submission row → verdict stored
9. Backend: matchEngine.processVerdict() → acquires per-match mutex
10. If ACCEPTED:
    a. Match transitions ACTIVE → COMPLETED
    b. Elo calculated and applied (winner +N, loser -N)
    c. botEngine.cancel() if bot match
    d. Socket emits match:end to both players
    e. Timer cleared
11. If not ACCEPTED:
    a. Socket emits match:submission to match room
    b. Match stays ACTIVE
12. Frontend: receives 201 response with verdict
13. Frontend: if matchEnded → router.push(/results/:id)
```

---

## Authentication Flow

### Three Auth Paths

**Path 1 — Google OAuth (primary, recommended):**
```
Login/Signup page → "Continue with Google"
  → supabase.auth.signInWithOAuth({provider: "google"})
  → Redirect to Google → consent → Supabase callback
  → Supabase mints JWT → redirect to /auth/callback
  → Frontend: POST /auth/ensure-profile (creates DB rows if first login)
  → If username null → /choose-username
  → router.push("/arena")
```

**Path 2 — Email/Password (OTP verification via EmailJS):**
```
Signup:
  1. User fills form → POST /auth/register {username, email, password}
     → Backend validates, checks availability, generates 6-digit OTP
     → Returns {code} to frontend (NO user created yet)
  2. Frontend sends code via EmailJS to user's email
  3. User enters code → POST /auth/verify-otp {email, code}
     → Backend verifies OTP → creates Supabase user + public.users + user_stats
     → Backend auto-signs in → returns session tokens
  4. Frontend: authFlags.isNavigating = true → signInWithPassword → 300ms delay
     → window.location.href = "/arena" (hard navigate, avoids auth state race)

Login:
  1. authFlags.isNavigating = true
  2. supabase.auth.signInWithPassword → session stored in localStorage
  3. 300ms delay → window.location.href = "/arena" (hard navigate)
  4. Fresh page: AuthProvider.initialize() → getMe() → arena renders
```

**Path 3 — Token Refresh (automatic):**
```
API client sends request → 401 response
  → supabase.auth.refreshSession() → new access token
  → Retry the same request with fresh token
  → If retry also 401s → sign out, redirect to /login
  (Suppressed on /login, /signup, /auth/callback, /match/* pages)
```

### Race Condition Prevention

- `authFlags.isNavigating` — set BEFORE `signInWithPassword`, blocks `onAuthStateChange` handler from firing `initialize()` during the hard navigate. Prevents SyntaxError from in-flight fetches on a dying page.
- `authFlags.isInitializing` — prevents concurrent `initialize()` calls (from useEffect + onAuthStateChange racing).
- Both flags reset on error paths so they don't permanently block.
- Public auth endpoints (`/auth/register`, `/auth/verify-otp`) skip token retrieval to avoid broken localStorage blocking signup.

### Token Architecture

- **Frontend** owns the session (stored in localStorage via @supabase/supabase-js)
- **Backend** only verifies tokens via JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) using the `jose` library
- No shared secret between frontend and backend — verification is by public key only
- Socket.IO uses the same access token via `socket.handshake.auth.token`
- Two middleware levels:
  - `authMiddleware` — verifies token AND loads user from DB (most endpoints)
  - `supabaseAuthMiddleware` — verifies token only, no DB lookup (for `/auth/ensure-profile` where the DB row may not exist yet)
- `ensureProfile` auto-heals missing `user_stats` rows (handles partial signup failures gracefully)

---

## Match State Machine

```
WAITING* → STARTING → ACTIVE → COMPLETED
                 ↘            ↗
                  → ABORTED ←
```

*WAITING is reserved for future lobby mode; matchmaking creates matches directly in STARTING.

### Transition Rules

| From | To | Trigger |
|------|-----|---------|
| STARTING | ACTIVE | Either player's frontend calls `POST /matches/:id/start` |
| STARTING | ABORTED | Server restart (zombie cleanup), or system error |
| ACTIVE | COMPLETED | ACCEPTED verdict processed, or forfeit |
| ACTIVE | ABORTED | 10-minute timer expires, or server restart |

### Enforcement

- Every state-modifying operation runs inside `matchMutexes.withLock(matchId, ...)`
- Invalid transitions return `{success: false}` — they never throw, never crash
- Terminal states (COMPLETED, ABORTED) trigger a 5-second delayed mutex cleanup
- On server restart, `abortZombieMatches()` marks all ACTIVE/STARTING matches as ABORTED (no rating penalty)

---

## AI Judge System

### How It Works

1. **Pre-check:** Fast regex-based language detection. If declared language mismatches code patterns (e.g., Python code submitted as C++), returns COMPILE_ERROR instantly without calling AI.
2. **AI Call:** Sends problem statement + code + language to Claude via MegaLLM's OpenAI-compatible endpoint.
3. **Response Parsing:** Extracts JSON `{verdict, confidence, feedback}` from Claude's response. Handles markdown code blocks, loose JSON, and regex fallbacks.
4. **Timeout:** 60-second AbortController. If exceeded, returns JUDGE_TIMEOUT.

### Prompt Structure

```
System: You are an expert competitive programming judge. [rules for each verdict]
User: PROBLEM STATEMENT: {...} SUBMITTED CODE ({language}): {...}
      Think step by step, then output JSON: {"verdict":"...","confidence":85,"feedback":"..."}
```

### Verdict Enum

| Verdict | Meaning | Source |
|---------|---------|--------|
| PENDING | Not yet judged | DB-only lifecycle state |
| JUDGING | Currently being evaluated | DB-only lifecycle state |
| ACCEPTED | Code is correct | AI judge |
| WRONG_ANSWER | Logic error | AI judge |
| COMPILE_ERROR | Syntax error or language mismatch | AI judge or pre-check |
| RUNTIME_ERROR | Would crash at runtime (div by zero, etc.) | AI judge |
| TIME_LIMIT | Algorithm too slow (aspirational) | AI judge (rarely emitted) |
| MEMORY_LIMIT | Uses too much memory (aspirational) | AI judge (rarely emitted) |
| JUDGE_TIMEOUT | AI didn't respond in 60s | Timeout handler |

### Supported Languages

`cpp17`, `cpp20`, `python3`, `java17`, `pypy3`

---

## Problem Management

### Ingestion Pipeline

```
Codeforces Public API ─── ingest-from-cf-api.ts ───► problems table (metadata only)
                                                         │
                                                         ▼ (on-demand, during match)
                                              problem-fetcher.ts ───► statement, timeLimit, memoryLimit
```

1. **Bulk ingest** (`scripts/ingest-from-cf-api.ts`): Calls `codeforces.com/api/problemset.problems`, batch-inserts ~10k rated problems in ~30s. No statements — just metadata (title, difficulty, tags, url, ratingBucket).
2. **Lazy fetch** (`src/services/problem-fetcher.ts`): When matchmaking picks a problem without a cached statement, fetches the Codeforces HTML page, parses it into sections (statement, input, output, examples, notes), and saves it permanently.
3. **Optional pre-warm** (`scripts/fetch-statements.ts`): Rate-limited batch fetcher for the low-rating buckets (0800-1399). Optional because lazy fetch covers this at the cost of ~3s first-use latency.

### Rating Buckets

Problems are bucketed by Codeforces difficulty rating:

| Bucket | CF Rating Range | Who Gets These |
|--------|----------------|----------------|
| 0800-1199 | 800-1199 | Players rated < 1200 |
| 1200-1399 | 1200-1399 | Players rated 1200-1399 |
| 1400-1599 | 1400-1599 | Players rated ≥ 1400 |

Matchmaking averages both players' ratings, maps to a bucket, picks a random problem from that bucket.

### Statement Parsing

Regex-based HTML parsing extracts:
- Main problem text (between `problem-statement` and `input-specification` divs)
- Input/Output specification
- Sample test cases (input/output pairs)
- Notes section
- Time/memory limits from header

HTML entities decoded, tags stripped, math notation preserved where possible. Problems that fail parsing (interactive, math-heavy) get `statement = NULL` and are skipped by matchmaking.

---

## Concurrency Model

### Primitives

| Primitive | Location | Scope | Purpose |
|-----------|----------|-------|---------|
| `Mutex` | `src/lib/mutex.ts` | Global (1 instance) | FIFO lock for the matchmaking queue — prevents double-matching |
| `MutexManager` | `src/lib/mutex.ts` | Per-entity (keyed by ID) | Per-match state locking, per-problem fetch dedup |
| `Map<userId, QueuedPlayer>` | In-memory | Global | The matchmaking queue itself |
| `Map<userId, timeout>` | In-memory | Global | Bot fallback timers |
| `Map<matchId, BotMatchState>` | In-memory | Global | Active bot states (timers + cancelled flag) |
| `Map<userId, submission>` | In-memory | Global | Per-user submission lock (prevents spam) |
| `Map<matchId, timeout>` | In-memory | Global | Match duration timers |

### Key Invariants

1. **No two users are matched with the same opponent at the same time** — queueMutex ensures read-check-write is atomic.
2. **No match transitions twice** — matchMutex per match ensures only one state change at a time.
3. **No duplicate fetches for the same problem** — MutexManager keyed by problemId.
4. **No user submits concurrently** — per-user lock in SubmissionQueue.
5. **Bot timers are cancelled on every exit path** — cancel on: real match found, user leaves queue, match ends, server restart.

### What Happens on Server Restart

All in-memory state is lost. On boot:
1. `abortZombieMatches()` — marks all ACTIVE/STARTING matches as ABORTED (no rating penalty)
2. Queue is empty — users must re-queue (instant, no data loss)
3. Bot timers are gone — no orphan timer can fire (activeBots map is fresh)
4. Socket connections are gone — clients reconnect automatically

---

## Real-time Communication

### Socket.IO Events

| Direction | Event | Payload | When |
|-----------|-------|---------|------|
| S→C | `queue:matched` | `{matchId, opponent: {id, username}}` | Player gets paired |
| S→C | `match:countdown` | `{seconds}` | Countdown before match start |
| S→C | `match:start` | `{problem, endsAt}` | Match transitions to ACTIVE |
| S→C | `match:submission` | `{userId, verdict}` | Any player's submission is judged |
| S→C | `match:end` | `{winnerId, reason}` | Match reaches terminal state |
| S→C | `opponent:disconnected` | `{disconnectedUserId, timeout}` | Opponent lost connection |
| S→C | `opponent:reconnected` | `{}` | Opponent re-established connection |
| C→S | `match:join` | `{matchId, opponentId}` | Client joins match room |
| C→S | `match:leave` | `{matchId}` | Client leaves match room |

### Room Strategy

- `user:{userId}` — personal room for user-specific events (queue:matched)
- `match:{matchId}` — shared room for match events (submissions, end)

### Disconnect Handling

- Socket auth uses the same Supabase access token as HTTP
- Multi-tab support: `userSocketCount` map tracks how many sockets per user
- Only when ALL tabs disconnect → 10-second grace timer starts
- If user reconnects within 10s → timer cancelled, opponent notified
- If 10s expires → auto-forfeit (opponent wins, Elo updated)

---

## Frontend Architecture

### Route Groups (Next.js App Router)

| Group | Routes | Auth Required | Purpose |
|-------|--------|--------------|---------|
| `(auth)` | `/login`, `/signup`, `/choose-username` | No | Authentication pages |
| `(main)` | `/arena`, `/queue`, `/profile`, `/leaderboard`, `/results/[id]` | Yes | Main app pages |
| `(match)` | `/match/[id]` | Yes | Full-screen match IDE |
| `auth` | `/auth/callback` | No | OAuth callback handler |

### State Management (Zustand)

- `useAuthStore` — user session, login/logout/register actions, OAuth
- Auth state flows: `initialize()` on app load → `onAuthStateChange` listener → `refreshUser()` after match

### Key Frontend Patterns

- **API client auto-retry on 401**: Refreshes Supabase session and retries once before declaring session death
- **Socket singleton with race guard**: `getSocket()` reuses existing socket even if still connecting
- **Wall-clock timer**: Match countdown computes from `startedAt + duration - Date.now()` each tick (never drifts)
- **Auto-logout suppression**: Disabled on `/auth/callback` and `/match/*` pages where 401s are transient

---

## Deployment & Infrastructure

### Backend (Render)

- **Runtime:** Docker (`oven/bun:1.3-slim`, multi-stage build)
- **Plan:** Free tier
- **Health check:** `GET /health` returns `{status: "ok", timestamp}`
- **Sleep prevention:** Self-ping every 14 minutes via `RENDER_EXTERNAL_URL/health`
- **Blueprint:** `render.yaml` at repo root auto-configures the service

### Frontend (Vercel)

- **Root Directory:** `frontend` (monorepo split)
- **Framework:** Auto-detected as Next.js
- **Build:** `npm run build` inside `frontend/`
- **Env vars:** `NEXT_PUBLIC_*` baked into JS bundle at build time — changing them requires a redeploy

### Startup Lifecycle (src/index.ts)

1. `verifyDbConnection()` — exits code 1 if Supabase unreachable
2. `abortZombieMatches()` — cleans orphaned ACTIVE/STARTING matches
3. HTTP server + Socket.IO listen on PORT
4. Queue cleanup interval (every 30s)
5. DB keep-alive pinger (every 5 days)
6. Self-ping for Render (every 14 min, production only)

### Environment Variables

**Backend (.env):**

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | — | Supabase pooler connection string |
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes | — | Server-side secret key (non-empty) |
| `MEGALLM_API_KEY` | Yes | — | MegaLLM/Claude API key (non-empty) |
| `AI_MODEL` | No | `claude-sonnet-4-6` | Model ID for judge + bot solver |
| `AI_TIMEOUT_MS` | No | `60000` | Judge timeout in ms |
| `CORS_ORIGINS` | No | `*` | Comma-separated origins or `*` for dev |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | development / production / test |

**Frontend (.env.local):**

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL (e.g., `https://algowars-backend.onrender.com`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Same Supabase project as backend |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Client-safe publishable key |

---

## Database Schema

Six tables with Drizzle ORM relations. RLS enabled on all tables.

### Tables

**users**
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK, auto-generated |
| username | varchar(32) | Unique, nullable (null for fresh OAuth users) |
| email | varchar(255) | Unique, not null |
| role | enum(USER, ADMIN) | Default USER |
| isBot | boolean | Default false — marks phantom bot accounts |
| createdAt, updatedAt | timestamp | Auto-set |

**user_stats** (1:1 with users, cascade delete)
| Column | Type | Notes |
|--------|------|-------|
| userId | text | FK → users.id, unique |
| rating | integer | Default 1000, floor 100 |
| wins, losses, draws | integer | Counters |
| winStreak, maxStreak | integer | Current and all-time best |

**problems**
| Column | Type | Notes |
|--------|------|-------|
| oj, contestId, problemIndex, externalId | — | Codeforces identity |
| title, difficulty, ratingBucket, tags, url | — | Metadata |
| statement | text (nullable) | Lazy-fetched HTML-parsed content |
| timeLimit, memoryLimit | integer (nullable) | Parsed from CF page |
| statementFetchedAt | timestamp (nullable) | When statement was cached |

**matches**
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| mode | enum(BLITZ) | Currently only BLITZ |
| status | enum(WAITING, STARTING, ACTIVE, COMPLETED, ABORTED) | State machine |
| duration | integer | Default 600 seconds |
| problemId | text | FK → problems.id |
| winnerId | text (nullable) | Set on COMPLETED |
| startedAt, endedAt, createdAt | timestamp | Lifecycle timestamps |

**match_players** (junction, 2 rows per match)
| Column | Type | Notes |
|--------|------|-------|
| matchId | text | FK → matches.id (cascade) |
| userId | text | FK → users.id |
| result | enum(PENDING, WON, LOST, DRAW) | Set on match end |
| ratingBefore, ratingAfter | integer | Snapshot for history display |

**submissions**
| Column | Type | Notes |
|--------|------|-------|
| matchId | text | FK → matches.id (cascade) |
| userId | text | FK → users.id |
| code | text | Full source code |
| language | varchar(32) | e.g., "cpp20", "python3" |
| verdict | enum(...) | Judge result |
| submittedAt, judgedAt | timestamp | Timing |

---

## API Endpoints

### Auth

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | None | Create Supabase user + DB profile |
| POST | `/auth/login` | None | Sign in via Supabase |
| POST | `/auth/refresh` | None | Refresh session tokens |
| POST | `/auth/ensure-profile` | Token-only | Create DB profile for OAuth users |

### Users

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/users/me` | Yes | Current user + stats |
| PATCH | `/users/me/username` | Yes | Set username (OAuth users) |
| GET | `/users/me/matches` | Yes | Match history (COMPLETED + ABORTED) |
| GET | `/users/leaderboard` | No | Top users by rating |
| GET | `/users/:username` | No | Public profile |

### Matches

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/matches/queue` | Yes | Join matchmaking queue |
| DELETE | `/matches/queue` | Yes | Leave queue |
| GET | `/matches/queue/status` | Yes | Check if in queue |
| GET | `/matches/active` | Yes | Current active match |
| GET | `/matches/:id` | Yes | Match details + players + problem |
| POST | `/matches/:id/start` | Yes | Transition STARTING → ACTIVE |
| POST | `/matches/:id/forfeit` | Yes | Surrender (opponent wins) |
| GET | `/matches/:id/submissions` | Yes | All submissions (only for terminal matches) |

### Submissions

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/submissions` | Yes | Submit code for judging |
| GET | `/submissions/:id` | Yes | Submission metadata (no code) |

---

## Key Design Decisions

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| AI judge instead of real execution | Can be tricked, can't measure time/memory | Zero infra cost, instant deploy, no security sandbox needed |
| In-memory matchmaking queue | Lost on restart | Simple, fast, acceptable for single-process MVP |
| Per-match mutex (not DB locks) | Single-process only | No round-trip for lock acquisition, sub-ms lock/unlock |
| Supabase Auth client-side, verified server-side | Frontend owns session lifecycle | Clean separation, no session storage on backend |
| Phantom bots | Consumes 1 MegaLLM API call per bot solve | Users always find a match; platform feels alive with 0 real users |
| Elo with K=32 | More volatile than K=16 | New players find their level within 10-15 games |
| Bot ratings exempt from changes | Bots stay at fixed ratings forever | Prevents drift that would break matchmaking brackets |
| Lazy problem statement fetch | First match per problem has 2-3s extra latency | Eliminates batch pre-processing dependency |
| 10-minute match duration | Too short for hard problems, too long for trivial ones | Configurable per-match in DB; 10 min is the balanced default |
| Timeout = 0 rating change | Neither player is penalized for hard problems | Timeout means "problem was too hard" not "you played badly" |
| Self-ping keep-alive | Slightly against Render's free-tier spirit | Service stays awake, users don't hit 30s cold starts |
| Wall-clock timer (frontend) | Slightly more complex than decrement counter | Never drifts, survives state transitions, accurate across both clients |

---

## Known Limitations

- **Single process** — matchmaking queue and match mutexes are in-memory. Can't run multiple backend instances without moving to Redis.
- **AI judge accuracy** — Claude is good but not perfect. Can be fooled by code that "looks correct" but has subtle bugs, or penalize correct code using unfamiliar patterns.
- **No real code execution** — TIME_LIMIT and MEMORY_LIMIT verdicts exist in schema but AI can't actually measure them.
- **Free-tier hosting** — Render sleeps after 15 min (mitigated by self-ping), Supabase pauses after 7 days (mitigated by keep-alive).
- **Problem quality** — Codeforces HTML parsing is regex-based; occasionally drops math notation or interactive problem formats.
- **Synchronous judge** — Submission HTTP request blocks for 5-60s while AI judges. Long requests can timeout on client/proxy side.
- **8 bots** — Fixed pool. If 8+ solo users queue simultaneously, some wait for a bot to be "free" (rare in practice).
- **No spectator mode** — Can't watch other people's matches.
- **Desktop-optimized** — Match IDE layout not responsive on mobile.

---

## Future Roadmap

- **Async submission flow** — Return 202 immediately, deliver verdict via WebSocket. Fixes timeout issues.
- **Spectator mode** — Watch live matches, see both players' submission counts.
- **Match replay** — Step through both players' submissions chronologically after the match.
- **Real code execution judge** — Sandboxed execution (Docker/Firecracker), measures actual runtime/memory. Upgrade path from AI.
- **Leaderboard seasons** — Monthly rating resets with badges for final standing.
- **Rating decay** — Inactive accounts slowly drift toward 1000 to prevent stale rankings.
- **Problem difficulty auto-calibration** — Track solve rates per problem, adjust effective difficulty dynamically.
- **Multi-region deployment** — Fly.io edge deploys for lower latency (India + US).
- **Mobile match UI** — Responsive layout with collapsible panels for tablets/phones.
