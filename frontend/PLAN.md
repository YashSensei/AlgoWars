# AlgoWars Frontend Plan

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State**: Zustand (with persist middleware)
- **Forms**: React Hook Form + Zod
- **Real-time**: Socket.IO Client
- **HTTP**: Custom fetch wrapper with auto-auth

## Design System

### Colors (from login-signup.html)
| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#ff3344` | Buttons, accents, focus states |
| `primary-hover` | `#d62839` | Button hover |
| `secondary` | `#4f46e5` | Indigo for depth/gradients |
| `bg-dark` | `#0a0a0c` | Page background |
| `card-dark` | `#131316` | Panel backgrounds |
| `input-bg` | `#0f0f12` | Input field backgrounds |
| `border-dark` | `#27272a` | Borders, dividers |
| `text-muted` | `#9ca3af` | Secondary text |
| `accent-gold` | `#fbbf24` | Warnings, highlights |

### Typography
- **Display**: Space Grotesk (headings, UI text)
- **Japanese**: Noto Sans JP (decorative kanji/kana)
- **Mono**: JetBrains Mono (code, stats, placeholders)

### Core Components
- `GlassPanel` - Blur backdrop card with corner accents
- `Button` - Primary (white→red), secondary (border), ghost
- `Input` - Icon box left, bottom border focus
- `Logo` - Rotating geometric shape + ALGOWARS text
- `BackgroundEffects` - Noise texture, gradient orbs
- `StatusIndicator` - Pulsing dot with label

---

## Implementation Phases

### Phase 1: Foundation ✅
- [x] Initialize Next.js 14 with TypeScript
- [x] Configure Tailwind v4 with custom theme
- [x] Setup global CSS (glass-panel, noise, animations)
- [x] Create base UI components
- [x] Setup path aliases (@/*)

### Phase 2: Authentication ✅
- [x] Build Login page (EXACT copy of design)
- [x] Build Signup page
- [x] Create API client with auto-auth
- [x] Create Zustand auth store
- [x] Connect forms to backend API

### Phase 3: Landing Page ✅
- [x] Hero section ("CODE. COMPETE. CONQUER.")
- [x] Features grid
- [x] Stats/social proof section
- [x] CTA buttons (Find Match, Sign Up)
- [x] Responsive design

### Phase 4: Arena/Dashboard ✅
- [x] Protected route wrapper
- [x] User stats display
- [x] Quick match button
- [x] Recent matches list
- [x] Navigation header

### Phase 5: Matchmaking Queue ✅
- [x] Queue status display
- [x] Scan animation
- [x] Cancel button
- [ ] Socket.IO integration for queue events (pending backend)
- [ ] Match found transition (pending backend)

### Phase 6: Match Arena (Core Game) ✅
- [x] 3-column layout (Problem | Editor | Opponent)
- [x] Problem display with samples
- [x] Code editor (textarea placeholder - Monaco can be added later)
- [x] Submission handling (mock)
- [x] Real-time opponent status feed (mock)
- [x] Timer display
- [ ] Socket.IO events for match state (pending backend)

### Phase 7: Match Results ✅
- [x] Victory/Defeat display
- [x] Rating change animation
- [x] Match statistics
- [x] Play again / Return to arena buttons

### Phase 8: Leaderboard ✅
- [x] "Hall of Shoguns" header
- [x] Top 3 podium display
- [x] Paginated leaderboard table (mock data)
- [ ] User highlighting
- [ ] Filter by time period

### Phase 9: Profile Page
- [ ] User info display
- [ ] Stats overview (rating, W/L, streak)
- [ ] Match history list
- [ ] Settings (future)

---

## File Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (main)/
│   │   │   ├── arena/page.tsx
│   │   │   ├── match/[id]/page.tsx
│   │   │   ├── queue/page.tsx
│   │   │   ├── results/[id]/page.tsx
│   │   │   ├── leaderboard/page.tsx
│   │   │   ├── profile/[id]/page.tsx
│   │   │   └── layout.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx (landing)
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/           # Base components
│   │   ├── auth/         # Auth-specific
│   │   ├── match/        # Match-specific
│   │   └── layout/       # Header, Footer, etc.
│   ├── lib/
│   │   ├── api/          # API client + endpoints
│   │   ├── socket/       # Socket.IO client
│   │   └── utils.ts
│   ├── stores/           # Zustand stores
│   └── hooks/            # Custom React hooks
├── public/
│   └── fonts/
└── design-reference/     # HTML design files
```

## Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `queue:join` | `{ gameMode }` | Join matchmaking queue |
| `queue:leave` | - | Leave queue |
| `match:submit` | `{ matchId, code, language }` | Submit solution |
| `match:surrender` | `{ matchId }` | Forfeit match |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `queue:joined` | `{ position }` | Confirmed in queue |
| `queue:match_found` | `{ matchId, opponent, problem }` | Match ready |
| `match:started` | `{ matchId, startTime }` | Match begins |
| `match:opponent_update` | `{ status, submissionCount }` | Opponent activity |
| `match:submission_result` | `{ verdict, feedback }` | Your submission result |
| `match:ended` | `{ result, ratingChange }` | Match complete |

## API Endpoints

### Auth
- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Create new account

### Users
- `GET /users/me` - Current user profile
- `GET /users/:id` - User by ID
- `GET /users/leaderboard` - Top users

### Matches
- `GET /matches/:id` - Match details
- `GET /matches/history` - User's match history
- `POST /matches/:id/submit` - Submit code

### Problems
- `GET /problems/:id` - Problem details

---

## Design Rules

### DO
- Use `glass-panel` class for all cards
- Add corner accents to important panels
- Use Japanese text as decorative elements
- Maintain dark theme throughout
- Use primary red for CTAs and focus states
- Apply noise texture to backgrounds

### DON'T
- No light mode
- No rounded corners > 8px (keep angular aesthetic)
- No bright colors outside the palette
- No generic sans-serif fonts
- No animations > 500ms (keep snappy)

---

## Current Status
- **Phase 1**: ✅ Complete (Foundation)
- **Phase 2**: ✅ Complete (Authentication)
- **Phase 3**: ✅ Complete (Landing Page)
- **Phase 4**: ✅ Complete (Arena/Dashboard)
- **Phase 5**: ✅ Complete (Matchmaking Queue)
- **Phase 6**: ✅ Complete (Match Arena)
- **Phase 7**: ✅ Complete (Match Results)
- **Phase 8**: ✅ Complete (Leaderboard)
- **Phase 9**: ⏳ Pending (Profile Page)

## Next Steps
- Integrate Socket.IO for real-time matchmaking and match state
- Replace textarea with Monaco Editor for syntax highlighting
- Connect to actual backend API endpoints
- Add Profile page (Phase 9)
