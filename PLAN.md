# 🎮 AlgoWars - 1v1 Competitive Programming Platform

## Project Overview

AlgoWars is a real-time 1v1 competitive programming platform where users compete head-to-head solving algorithmic problems. The platform integrates with VJudge to fetch problems from Codeforces and submit solutions programmatically.

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

| Component | Technology | Reason |
|-----------|------------|--------|
| Runtime | Node.js 20+ | Async-friendly, great ecosystem |
| Language | TypeScript | Type safety, better DX |
| Framework | Express.js | Simple, battle-tested |
| Database | PostgreSQL | ACID compliance, reliable |
| ORM | Prisma | Type-safe queries, migrations |
| Real-time | Socket.IO | Bi-directional, room support |
| Auth | JWT + bcrypt | Stateless, secure |
| Queue | In-memory (MVP) → Redis (later) | Simple start, scalable |
| VJudge | Custom HTTP client | Session-based auth |

---

## 🗄️ Database Schema

```prisma
model User {
  id            String    @id @default(uuid())
  username      String    @unique
  email         String    @unique
  passwordHash  String
  rating        Int       @default(1000)
  wins          Int       @default(0)
  losses        Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  matchesAsPlayer1  Match[]      @relation("Player1")
  matchesAsPlayer2  Match[]      @relation("Player2")
  submissions       Submission[]
}

model Problem {
  id          String   @id @default(uuid())
  ojName      String   // "CodeForces"
  problemNum  String   // "1A"
  title       String
  difficulty  Int?     // Optional rating
  cachedAt    DateTime @default(now())

  matches     Match[]

  @@unique([ojName, problemNum])
}

model Match {
  id          String      @id @default(uuid())
  player1Id   String
  player2Id   String
  problemId   String
  winnerId    String?
  status      MatchStatus @default(PENDING)
  startedAt   DateTime?
  endedAt     DateTime?
  createdAt   DateTime    @default(now())

  player1     User        @relation("Player1", fields: [player1Id], references: [id])
  player2     User        @relation("Player2", fields: [player2Id], references: [id])
  problem     Problem     @relation(fields: [problemId], references: [id])
  submissions Submission[]
}

model Submission {
  id           String           @id @default(uuid())
  matchId      String
  userId       String
  vjudgeRunId  String?          // VJudge submission ID for polling
  code         String           // Stored for reference
  language     String           // e.g., "cpp17", "python3"
  verdict      SubmissionVerdict @default(PENDING)
  submittedAt  DateTime         @default(now())
  judgedAt     DateTime?

  match        Match            @relation(fields: [matchId], references: [id])
  user         User             @relation(fields: [userId], references: [id])
}

enum MatchStatus {
  PENDING      // Waiting for match to start
  IN_PROGRESS  // Match is live
  COMPLETED    // Someone won
  ABORTED      // Timeout - no winner
}

enum SubmissionVerdict {
  PENDING
  ACCEPTED
  WRONG_ANSWER
  TIME_LIMIT
  MEMORY_LIMIT
  RUNTIME_ERROR
  COMPILE_ERROR
}
```

---

## 🌐 VJudge Integration

### Authentication
VJudge uses session-based auth. We'll maintain a service account:

```
POST https://vjudge.net/user/login
Content-Type: application/x-www-form-urlencoded

username=<service_account>&password=<password>&captcha=
```

**Response**: `"success"` on valid credentials

### Fetching Problems
```
GET https://vjudge.net/problem/data
Params: OJId=CodeForces, probNum=1A, start=0, length=20
```

**Response**: Problem metadata including title, source, category

### Submitting Solutions
```
POST https://vjudge.net/problem/submit
Content-Type: application/x-www-form-urlencoded

oj=CodeForces
probNum=1A
language=<language_id>
source=<encoded_source_code>
captcha=
```

**Response**: `{ "runId": 12345678 }` - Used for polling verdict

### Polling Submission Status
```
GET https://vjudge.net/solution/data/<runId>
```

**Response**:
```json
{
  "memory": 0,
  "access": 1,
  "statusType": 0,  // 0=Accepted, 1=WA, etc.
  "runtime": 30,
  "status": "Accepted",
  "processing": false
}
```

### Language IDs (Codeforces via VJudge)
| Language | ID |
|----------|-----|
| GNU C++17 | 54 |
| GNU C++20 | 73 |
| Python 3 | 31 |
| Java 17 | 87 |
| PyPy 3 | 70 |

---

## 📡 API Endpoints

### Authentication
```
POST /api/auth/register
Body: { username, email, password }
Response: { user, token }

POST /api/auth/login
Body: { email, password }
Response: { user, token }
```

### User
```
GET /api/users/me
Headers: Authorization: Bearer <token>
Response: { id, username, email, rating, wins, losses }

GET /api/users/:id/stats
Response: { rating, wins, losses, matchHistory }
```

### Matchmaking
```
POST /api/match/queue
Headers: Authorization: Bearer <token>
Response: { queued: true, position: 1 }
→ WebSocket emits "match:found" when opponent found

DELETE /api/match/queue
Headers: Authorization: Bearer <token>
Response: { queued: false }
```

### Match
```
GET /api/match/:id
Response: { match details, problem (if started), submissions }

POST /api/match/:id/submit
Headers: Authorization: Bearer <token>
Body: { code, language }
Response: { submissionId, status: "pending" }
```

---

## 🔌 WebSocket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join:match` | `{ matchId }` | Join match room |
| `leave:match` | `{ matchId }` | Leave match room |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `match:found` | `{ matchId, opponentId, opponentUsername }` | Opponent found |
| `match:starting` | `{ matchId, startsIn: 5 }` | Countdown to start |
| `match:started` | `{ matchId, problem, endsAt }` | Match begins with problem |
| `match:submission` | `{ matchId, userId, verdict }` | Submission verdict update |
| `match:ended` | `{ matchId, winnerId, reason }` | Match concluded |
| `opponent:submitted` | `{ matchId }` | Opponent made submission |

---

## 📁 Project Structure

```
algowars/
├── src/
│   ├── config/
│   │   ├── database.ts      # Prisma client setup
│   │   ├── env.ts           # Environment variables
│   │   └── socket.ts        # Socket.IO setup
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── match.controller.ts
│   │   └── submission.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── match.service.ts
│   │   ├── matchmaking.service.ts
│   │   ├── submission.service.ts
│   │   └── vjudge.service.ts    # VJudge API integration
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT verification
│   │   ├── error.middleware.ts  # Global error handler
│   │   └── validate.middleware.ts
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── match.routes.ts
│   │   └── index.ts
│   │
│   ├── socket/
│   │   ├── handlers/
│   │   │   ├── match.handler.ts
│   │   │   └── connection.handler.ts
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   └── response.ts
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   └── app.ts               # Express app setup
│   └── server.ts            # Entry point
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Implementation Phases

### Phase 1: Project Setup ✅
- [x] Plan created
- [ ] Initialize Node.js + TypeScript
- [ ] Configure Express.js
- [ ] Setup Prisma + PostgreSQL
- [ ] Environment configuration
- [ ] Basic project structure

### Phase 2: Database & Models
- [ ] Create Prisma schema
- [ ] Run migrations
- [ ] Seed sample problems

### Phase 3: Authentication
- [ ] Register endpoint
- [ ] Login endpoint
- [ ] JWT middleware
- [ ] Password hashing

### Phase 4: User Management
- [ ] Get current user
- [ ] Get user stats
- [ ] Update profile (optional)

### Phase 5: VJudge Integration
- [ ] VJudge service class
- [ ] Login/session management
- [ ] Problem fetching
- [ ] Solution submission
- [ ] Verdict polling

### Phase 6: Matchmaking
- [ ] Queue data structure
- [ ] Join queue endpoint
- [ ] Leave queue endpoint
- [ ] Matching algorithm
- [ ] Problem selection

### Phase 7: Match Engine
- [ ] Create match
- [ ] Match state machine
- [ ] Timer management
- [ ] Win/loss detection
- [ ] Rating updates

### Phase 8: WebSocket Layer
- [ ] Socket.IO setup
- [ ] Authentication middleware
- [ ] Match room management
- [ ] Real-time events

### Phase 9: Submission Flow
- [ ] Submit endpoint
- [ ] VJudge submission
- [ ] Verdict polling loop
- [ ] Result broadcast

### Phase 10: Polish & Testing
- [ ] Error handling
- [ ] Input validation
- [ ] Integration tests
- [ ] Load testing

---

## 🔐 Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/algowars

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# VJudge Service Account
VJUDGE_USERNAME=your_vjudge_account
VJUDGE_PASSWORD=your_vjudge_password

# Optional: Redis (for production queue)
REDIS_URL=redis://localhost:6379
```

---

## 🎲 Problem Selection Strategy

For MVP, we'll select problems from Codeforces with:
- Rating: 800-1200 (beginner-friendly for 10 min limit)
- Tags: implementation, math, greedy (solvable quickly)
- Random selection from pre-cached pool

```typescript
// Example problem pool query
const problems = await prisma.problem.findMany({
  where: {
    ojName: 'CodeForces',
    difficulty: { gte: 800, lte: 1200 }
  },
  take: 100
});

const selectedProblem = problems[Math.floor(Math.random() * problems.length)];
```

---

## 📊 Match Flow Diagram

```
┌─────────────┐     ┌─────────────┐
│   Player 1  │     │   Player 2  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │ POST /match/queue │ POST /match/queue
       ▼                   ▼
┌──────────────────────────────────┐
│         Matchmaking Queue        │
│   (pairs players by rating ±100) │
└──────────────────┬───────────────┘
                   │
                   ▼ Match Found!
┌──────────────────────────────────┐
│          Create Match            │
│   - Select random problem        │
│   - Set 10 min timer             │
└──────────────────┬───────────────┘
                   │
    ┌──────────────┴──────────────┐
    ▼                             ▼
┌─────────┐                 ┌─────────┐
│ WS emit │                 │ WS emit │
│ match:  │                 │ match:  │
│ found   │                 │ found   │
└────┬────┘                 └────┬────┘
     │                           │
     ▼                           ▼
┌─────────────────────────────────────────┐
│              Match In Progress          │
│  - Both see same problem                │
│  - Monaco editor for coding             │
│  - Submit goes to VJudge via backend    │
│  - Verdicts polled and broadcast        │
└────────────────────┬────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  First Accepted │    │    Timeout      │
│  = Winner       │    │  = Both Lose    │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────┐
│           Update Ratings                │
│   Winner: +5  │  Loser: -5              │
│   Timeout: Both -5                      │
└─────────────────────────────────────────┘
```

---

## 🚦 Next Steps

Ready to begin **Phase 1: Project Setup**?

This will include:
1. Initialize npm project with TypeScript
2. Install dependencies (Express, Prisma, Socket.IO, etc.)
3. Configure TypeScript and ESLint
4. Setup basic Express server
5. Configure Prisma with PostgreSQL
6. Create folder structure

Let me know when you're ready to proceed!
