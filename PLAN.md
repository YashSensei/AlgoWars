# 🎮 AlgoWars - 1v1 Competitive Programming Platform

## Project Overview

AlgoWars is a real-time 1v1 competitive programming platform where users compete head-to-head solving algorithmic problems. The platform uses an AI-powered judge (Claude via MegaLLM) to evaluate code submissions.

> **Note:** VJudge integration was initially planned but abandoned because Codeforces captcha blocks bot account submissions. The AI judge is a PoC approach that can be swapped for a real judge (like Judge0 or custom sandbox) later.

**Design Principles:**
- 🎯 **Lean & Clean**: Minimal code, maximum clarity
- 🔌 **Extensible**: Easy to add game modes, features, integrations
- ⚡ **Fast**: Bun runtime + efficient architecture
- ✅ **Quality**: Automated checks before every commit

---

## 🎯 MVP Features (Blitz Mode)

### Core Gameplay
- **1v1 Matches**: Two players compete on the same problem
- **Blitz Mode**: Single question, 10-minute time limit
- **Win Condition**: First player to get "Accepted" verdict wins
- **Timeout**: If neither solves within 10 mins, match aborts (both lose rating)

### Rating System
- Starting rating: **1000**
- Win: **+5 points**
- Loss: **-5 points**
- Abort (timeout): **-5 points** for both

---

## 🔧 Tech Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Runtime | **Bun** | 3x faster than Node, native TS |
| Language | TypeScript | Type safety |
| Build | **tsup** | Zero-config, fast builds |
| Framework | Hono | Lightweight, Bun-optimized |
| Database | PostgreSQL | Reliable, extensible |
| ORM | **Drizzle** | Lightweight, type-safe, Bun-native |
| Real-time | Socket.IO | Rooms, reconnection |
| Auth | JWT + Bun.password | Native, fast |
| Linting | **Biome** | Fast, replaces ESLint+Prettier |
| Git Hooks | **Husky + lint-staged** | Pre-commit quality |

---

## 🗄️ Database Schema

Using Drizzle ORM with PostgreSQL. Schema defined in `src/db/schema.ts`.

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts (id, username, email, passwordHash) |
| `user_stats` | Rating & win/loss stats (1:1 with users) |
| `problems` | Cached competitive programming problems |
| `matches` | Match instances with status, timing, winner |
| `match_players` | Junction table linking users to matches |
| `submissions` | Code submissions with AI judge verdicts |

### Enums

- `GameMode`: BLITZ (expandable to RAPID, CLASSIC, PRACTICE)
- `MatchStatus`: WAITING, STARTING, ACTIVE, COMPLETED, ABORTED
- `PlayerResult`: PENDING, WON, LOST, DRAW
- `Verdict`: PENDING, JUDGING, ACCEPTED, WRONG_ANSWER, TIME_LIMIT, etc.

---

## 🌐 Problem & Judging Architecture

### Key Principle
```
AlgoWars owns problems → AI Judge evaluates code
```

### Problem Sourcing

**Two-Step Process:**

1. **Ingest Metadata** (`bun scripts/ingest-problems.ts`)
   - Load problem metadata from JSON files in `codeforces_scraped_problems/`
   - Fields: contest_id, problem_index, name, rating, tags, url
   - NO problem statement text (just links)

2. **Fetch Statements** (`bun scripts/fetch-statements.ts`)
   - Scrapes actual problem text from Codeforces HTML pages
   - Extracts: statement, input/output specs, examples, notes
   - Rate limited: 1 request per 2.5 seconds (Codeforces limit)
   - Stores in `statement` column for AI judge

**Rating Buckets:** `0800-1199`, `1200-1399`, `1400-1599`

**Current Status:**
- ~2900 problems metadata ingested
- 100 problems with full statements (50 per bucket for 800-1399)
- During matches, ALL problem data served from AlgoWars DB

### AI Judge (PoC)

Uses Claude (via MegaLLM API) to analyze code correctness. The judge evaluates:
- **Correctness**: Edge cases, boundary conditions, negative numbers, duplicates
- **Time Complexity**: O(n!) to O(log n) based on input constraints
- **Memory Usage**: Stack overflow, large allocations
- **Runtime Safety**: Division by zero, null access, infinite loops
- **Syntax**: Compilation errors, missing imports

### Supported Languages

```typescript
type Language = "cpp17" | "cpp20" | "python3" | "java17" | "pypy3"
```

### Verdicts

| Verdict | Description |
|---------|-------------|
| `ACCEPTED` | Correct for all cases, optimal complexity |
| `WRONG_ANSWER` | Logic error, fails on some test cases |
| `TIME_LIMIT` | Correct logic but O(n²) when O(n) needed |
| `MEMORY_LIMIT` | Excessive memory usage (>256MB) |
| `RUNTIME_ERROR` | Crashes (segfault, division by zero) |
| `COMPILE_ERROR` | Syntax errors, missing imports |
| `INVALID_CODE` | Empty or doesn't attempt to solve |

### Submission Flow

```
1. User submits code
2. Backend validates user is in active match
3. Build problem statement from DB
4. Code + problem → AI Judge
5. AI returns verdict with confidence & feedback
6. Store submission, update match state
```

### Rate Limiting (MVP)
- 1 active submission at a time (in-memory lock)
- Returns 429 if judge is busy
- Prevents queue flooding

---

## 📁 Project Structure

```
algowars/
├── src/
│   ├── index.ts           # Entry point
│   ├── app.ts             # Hono app setup
│   │
│   ├── db/
│   │   ├── schema.ts      # Drizzle schema (all tables)
│   │   └── seed.ts        # Problem seeder
│   │
│   ├── routes/
│   │   ├── index.ts       # Route aggregator
│   │   ├── auth.ts        # Register, login
│   │   ├── users.ts       # User profiles
│   │   └── matches.ts     # (pending)
│   │
│   ├── services/
│   │   ├── auth.ts            # Auth logic, JWT
│   │   ├── ai-judge.ts        # AI Judge (Claude via MegaLLM)
│   │   ├── submission-queue.ts # Single submission lock
│   │   ├── matchmaking.ts     # (pending)
│   │   └── match.ts           # (pending)
│   │
│   ├── middleware/
│   │   └── auth.ts        # JWT verification
│   │
│   ├── socket/
│   │   └── index.ts       # WebSocket events
│   │
│   ├── lib/
│   │   ├── db.ts          # Drizzle client
│   │   ├── env.ts         # Typed env vars
│   │   └── errors.ts      # Custom errors
│   │
│   └── types.ts           # Shared types
│
├── drizzle/               # Migration files
├── docker-compose.yml     # PostgreSQL
├── .husky/pre-commit      # Quality gate
├── biome.json
├── drizzle.config.ts
├── tsup.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

---

## 📡 API Endpoints

### Auth
```
POST /auth/register    { username, email, password } → { user + stats, token }
POST /auth/login       { email, password } → { user + stats, token }
```

### Users
```
GET  /users/me         → current user + stats (protected)
GET  /users/:username  → public profile + stats
```

### Matches (pending)
```
POST /matches/queue    → join matchmaking
DELETE /matches/queue  → leave queue
GET  /matches/:id      → match details
POST /matches/:id/submit  { code, language }
```

---

## 🔌 WebSocket Events

```typescript
// Client → Server
socket.emit('match:join', { matchId })
socket.emit('match:leave', { matchId })

// Server → Client
socket.on('queue:matched', { matchId, opponent })
socket.on('match:countdown', { seconds: 5 })
socket.on('match:start', { problem, endsAt })
socket.on('match:submission', { userId, verdict })
socket.on('match:end', { winnerId, reason })
```

---

## 🚀 Implementation Phases

### Phase 1: Project Setup ✅
- [x] Init Bun project
- [x] Configure tsup + TypeScript
- [x] Setup Biome
- [x] Setup Husky + lint-staged
- [x] Create folder structure

### Phase 2: Database ✅
- [x] Setup Drizzle + PostgreSQL (Docker)
- [x] Create schema (6 tables)
- [x] Run migrations
- [x] Seed 20 Codeforces problems

### Phase 3: Auth ✅
- [x] Register endpoint (with user_stats creation)
- [x] Login endpoint (returns user + stats + JWT)
- [x] JWT middleware for protected routes
- [x] Password hashing (Bun.password)
- [x] GET /users/me and /users/:id

### Phase 4: AI Judge Service ✅

> **Note:** VJudge was originally planned but abandoned because Codeforces captcha blocks bot submissions. Pivoted to AI-powered judging as a PoC.

#### 4.1 AI Judge (`src/services/ai-judge.ts`)
- [x] Claude integration via MegaLLM OpenAI-compatible API
- [x] Comprehensive prompt evaluating correctness, complexity, memory, runtime safety
- [x] JSON response parsing with markdown stripping
- [x] Verdict types: ACCEPTED, WRONG_ANSWER, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR, COMPILE_ERROR, INVALID_CODE

#### 4.2 Submission Queue (`src/services/submission-queue.ts`)
- [x] In-memory lock (1 active submission at a time)
- [x] Returns 429 "busy" if judge is processing
- [x] Immediate verdict return (AI is fast)

#### 4.3 API Endpoint (`src/routes/submissions.ts`)
- [x] `POST /submissions` - validate match, build problem statement, call AI judge
- [x] `GET /submissions/status` - check current submission status
- [x] `GET /submissions/:id` - get submission details
- [x] Map AI verdicts to DB enum

### Phase 5: Matchmaking ✅
- [x] Queue (in-memory Map)
- [x] Pairing logic (by rating ±100)
- [x] Problem selection (random from rating bucket)
- [x] Match routes (queue, leave, status, details, start)

### Phase 6: Match Engine ✅
- [x] State machine (STARTING → ACTIVE → COMPLETED/ABORTED)
- [x] Timer handling (10 min timeout with auto-abort)
- [x] Rating updates (+5 win, -5 loss, -5 each on abort)
- [x] Win detection (first ACCEPTED verdict wins)

### Phase 7: WebSocket ⬜
- [ ] Socket.IO setup
- [ ] Room management
- [ ] Real-time event handlers

### Phase 8: Integration ⬜
- [ ] Submit flow end-to-end
- [ ] Error handling
- [ ] Testing

### Phase 9: Admin Panel ⬜
- [ ] Add `role` column to users (USER, ADMIN)
- [ ] Admin middleware (role check)
- [ ] Problem management routes (bulk import, fetch statements)
- [ ] User management routes (view, ban, rating adjust)
- [ ] Match management routes (view, force-end)

### Phase 10: MongoDB Integration ⬜
- [ ] Setup MongoDB (Docker or Atlas)
- [ ] Migrate match history to MongoDB (better for time-series)
- [ ] Store submission code in MongoDB (large text)
- [ ] Keep PostgreSQL for users, ratings, active matches
- [ ] Hybrid approach: PG for relational, Mongo for documents

---

## 🔐 Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database (Docker)
DATABASE_URL=postgresql://algowars:algowars@localhost:5432/algowars

# Auth
JWT_SECRET=your-secret-key-min-16-chars

# AI Judge (MegaLLM)
MEGALLM_API_KEY=your_megallm_api_key
```

---

## 🧪 Quick Commands

```bash
# Development
bun run dev           # Start server with hot reload
bun run build         # Build for production
bun run start         # Run production build

# Code Quality
bun run lint          # Check code
bun run lint:fix      # Auto-fix issues
bun run typecheck     # Verify types

# Database
docker compose up -d  # Start PostgreSQL
bun run db:generate   # Generate migrations
bun run db:migrate    # Apply migrations
bun run db:studio     # Visual DB browser

# Problem Management
bun scripts/ingest-problems.ts    # Load problem metadata from JSON
bun scripts/fetch-statements.ts   # Bulk fetch 100 statements (~4 min)
bun scripts/fetch-single.ts 1A    # Fetch single problem by ID

# Testing
bun scripts/test-api.ts           # Test all API endpoints
bun scripts/test-matchmaking.ts   # Test matchmaking flow
```

---

## 📊 Future Extensions

| Feature | Schema Change | Code Change |
|---------|--------------|-------------|
| Rapid mode (3 problems) | Add `RAPID` to GameMode | New matching logic |
| Teams | Add `team` field to MatchPlayer | Team queue |
| Seasons | Add `season` to UserStats | Reset logic |
| Practice mode | Add `PRACTICE` to GameMode | Skip rating |
| Friends | New `Friendship` model | Friend routes |
| Chat | New `Message` model | Socket events |

---

## 🔧 Admin Panel (Planned)

### Problem Management
- **Bulk Import**: Upload JSON file with problem metadata → auto-fetch statements from Codeforces
- **Manual Add**: Add individual problems with custom statements
- **Fetch Statements**: Trigger statement fetch for problems missing them
- **Problem Stats**: View problem usage, solve rates, etc.

### User Management
- View/search users
- Rating adjustments (manual)
- Ban/suspend accounts

### Match Management
- View active/completed matches
- Force-end stuck matches
- View match history with submissions

### Implementation Plan
```
src/routes/admin.ts     # Admin-only routes (role check middleware)
src/middleware/admin.ts # isAdmin check
users table             # Add `role` column (USER, ADMIN)
```

### Scripts Available Now
```bash
bun scripts/ingest-problems.ts    # Load problems from JSON files
bun scripts/fetch-statements.ts   # Fetch statements from Codeforces
```

---

## 🚦 Current Status

**Completed:** Phases 1-6 (Project Setup, Database, Auth, AI Judge, Matchmaking, Match Engine)
**In Progress:** Problem statement scraping (100 problems target)
**Next:** Phase 7 (WebSocket)

### Notes:
- VJudge abandoned → AI judge (Claude via MegaLLM) as PoC
- Matchmaking uses in-memory queue with rating-based pairing (±100)
- Problem selection picks random problem from rating bucket
- Match engine uses in-memory timers for 10-min timeout
- First ACCEPTED submission wins the match

### Problem Database:
- ~2900 problem metadata ingested (from Codeforces JSON)
- Statements scraped via HTML (Codeforces API doesn't provide them)
- Rate limit: 1 req/2.5s to avoid Codeforces blocking
- Target: 50 problems per bucket (0800-1199, 1200-1399)
