# 🎮 AlgoWars - 1v1 Competitive Programming Platform

## Project Overview

AlgoWars is a real-time 1v1 competitive programming platform where users compete head-to-head solving algorithmic problems. The platform integrates with VJudge to fetch problems from Codeforces and submit solutions programmatically.

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
| `problems` | Cached problems from Codeforces via VJudge |
| `matches` | Match instances with status, timing, winner |
| `match_players` | Junction table linking users to matches |
| `submissions` | Code submissions with VJudge verdict |

### Enums

- `GameMode`: BLITZ (expandable to RAPID, CLASSIC, PRACTICE)
- `MatchStatus`: WAITING, STARTING, ACTIVE, COMPLETED, ABORTED
- `PlayerResult`: PENDING, WON, LOST, DRAW
- `Verdict`: PENDING, JUDGING, ACCEPTED, WRONG_ANSWER, TIME_LIMIT, etc.

---

## 🌐 VJudge Integration

### Endpoints Used

| Action | Method | Endpoint |
|--------|--------|----------|
| Login | POST | `/user/login` |
| Get Problem | GET | `/problem/data` |
| Submit | POST | `/problem/submit` |
| Check Verdict | GET | `/solution/data/{runId}` |

### Language Map (Codeforces)

```typescript
const LANGUAGES = {
  cpp17: 54,
  cpp20: 73,
  python3: 31,
  java17: 87,
  pypy3: 70,
} as const
```

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
│   │   ├── auth.ts        # Auth logic, JWT
│   │   ├── vjudge.ts      # VJudge API client
│   │   ├── matchmaking.ts # (pending)
│   │   └── match.ts       # (pending)
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
POST /auth/register    { username, email, password } → { user, token }
POST /auth/login       { email, password } → { user, token }
```

### Users
```
GET  /users/me         → current user + stats (protected)
GET  /users/:id        → public profile
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

### Phase 4: VJudge Service ⬜
- [ ] Session management (login, cookies)
- [ ] Problem fetching
- [ ] Solution submission
- [ ] Verdict polling

### Phase 5: Matchmaking ⬜
- [ ] Queue (in-memory)
- [ ] Pairing logic (by rating ±100)
- [ ] Problem selection (random from pool)

### Phase 6: Match Engine ⬜
- [ ] State machine (WAITING → ACTIVE → COMPLETED)
- [ ] Timer handling (10 min timeout)
- [ ] Rating updates (+5/-5)

### Phase 7: WebSocket ⬜
- [ ] Socket.IO setup
- [ ] Room management
- [ ] Real-time event handlers

### Phase 8: Integration ⬜
- [ ] Submit flow end-to-end
- [ ] Error handling
- [ ] Testing

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

# VJudge
VJUDGE_USERNAME=your_username
VJUDGE_PASSWORD=your_password
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
bun run db:seed       # Seed problems
bun run db:studio     # Visual DB browser
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

## 🚦 Current Status

**Completed:** Phases 1-3 (Project Setup, Database, Auth)
**Next Up:** Phase 4 (VJudge Integration)

Ready to build the VJudge service for submitting code and polling verdicts! 🚀
