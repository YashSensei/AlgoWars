# AlgoWars — Waitlist System Execution Plan

## Overview

Closed beta launch system. Every new user gets a permanent waitlist number and waits for admin wave-approval or uses an invite code for instant access.

---

## Status Flow

```
Signup → WAITLISTED (#347)
                ├── Admin approves in wave → APPROVED
                ├── Uses invite code → EARLY_ACCESS
                ├── Admin rejects → REJECTED
                └── Admin bans → BANNED
```

Both `APPROVED` and `EARLY_ACCESS` = full platform access.

---

## Database

### New Enum: `user_status`
```
WAITLISTED | EARLY_ACCESS | APPROVED | REJECTED | BANNED
```

### New Columns on `users`
```sql
status         user_status  DEFAULT 'WAITLISTED' NOT NULL
waitlist_number integer     -- permanent, assigned once on signup
approved_at    timestamp    -- when access was granted
admin_notes    text         -- internal notes ("CF 2100", "YouTube creator")
```

### New Table: `invite_codes`
```sql
id          UUID PRIMARY KEY
code        VARCHAR(32) UNIQUE    -- "KIRI100", "ALPHA2026"
max_uses    INTEGER DEFAULT 0     -- 0 = unlimited
used_count  INTEGER DEFAULT 0
created_by  TEXT FK → users.id
created_at  TIMESTAMP
expires_at  TIMESTAMP             -- nullable
```

### Migration Strategy
- All existing users → `status = 'APPROVED'`, `waitlist_number = 0`
- All bots → `status = 'APPROVED'`
- New signups get sequential `waitlist_number` starting from 1

---

## Backend Endpoints

### Public (auth required, no approval needed)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me/waitlist-status` | Position, total count, wave progress |
| POST | `/auth/redeem-invite` | Apply invite code → EARLY_ACCESS |

### Protected (requireApproved)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/matches/queue` | Matchmaking |
| POST | `/submissions` | Code submission |
| All match/queue/submission routes | | Gameplay |

### Admin Only
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/waitlist` | List by status, paginated |
| GET | `/admin/waitlist/stats` | Counts per status |
| POST | `/admin/waitlist/:id/approve` | Single approve + socket notify |
| POST | `/admin/waitlist/:id/reject` | Reject user |
| POST | `/admin/waitlist/batch-approve` | Approve next N by position |
| PATCH | `/admin/waitlist/:id/notes` | Update admin notes |
| POST | `/admin/invite-codes` | Create invite code |
| GET | `/admin/invite-codes` | List all codes |
| DELETE | `/admin/invite-codes/:id` | Deactivate code |

---

## Frontend Pages

### `/waitlist` (auth group — no approval needed)

```
┌──────────────────────────────────────┐
│       ALGOWARS アルゴウォーズ          │
├──────────────────────────────────────┤
│                                      │
│   Welcome, Warrior.                  │
│   You're on the waitlist.            │
│                                      │
│   YOUR POSITION: #347                │
│   JOINED: May 29, 2026              │
│                                      │
│   WAVE PROGRESS                      │
│   [██████░░░░░░] Wave #1-#100       │
│   Your Position: #347                │
│                                      │
│   ─────────────────────────          │
│                                      │
│   Have an invite code?               │
│   [____________] [REDEEM]            │
│                                      │
│   Warriors are accepted in waves.    │
│                                      │
│                    [LOGOUT]           │
└──────────────────────────────────────┘
```

- Socket listener: `user:approved` → refresh → redirect to /arena
- Invite code input → POST /auth/redeem-invite → on success, redirect

### `/admin/waitlist` (main group — admin only)

```
┌──────────────────────────────────────────────────────┐
│ WAITLIST MANAGEMENT                                   │
├──────────────────────────────────────────────────────┤
│ Waitlisted: 342  │  Approved: 58  │  Rejected: 3    │
├──────────────────────────────────────────────────────┤
│ [Approve Next 20] [Approve Next 50] [Approve Next 100]│
├──────────────────────────────────────────────────────┤
│ # │ Username │ Email        │ Joined  │ Notes │ Act  │
│ 1 │ kirito   │ k@bits.ac.in │ May 25  │ BITS  │ ✓ ✗ │
│ 2 │ asuna    │ a@gmail.com  │ May 26  │       │ ✓ ✗ │
│ 3 │ naruto   │ n@sst.com   │ May 27  │ CF2100│ ✓ ✗ │
├──────────────────────────────────────────────────────┤
│ INVITE CODES                                          │
│ KIRI100  │ 3/10 used │ [Copy] [Delete]               │
│ ALPHA26  │ 47/∞ used │ [Copy] [Delete]               │
│ [+ Create New Code]                                   │
└──────────────────────────────────────────────────────┘
```

---

## Realtime Flow (Socket.IO)

```
Admin clicks "Approve" on panel
  → POST /admin/waitlist/:id/approve
  → Backend: status = APPROVED, approvedAt = now()
  → Backend: socketEmit.userApproved(userId)
  → Socket event arrives at user's browser (user:{userId} room)
  → Frontend: refreshUser() → user.status = "APPROVED"
  → Frontend: router.push("/arena")
  → User sees: instant access, no refresh needed
```

---

## Invite Code Flow

```
User on /waitlist page enters "KIRI100"
  → POST /auth/redeem-invite { code: "KIRI100" }
  → Backend validates: exists, not expired, not maxed
  → Backend: user.status = "EARLY_ACCESS", code.usedCount++
  → Response: { success: true }
  → Frontend: refreshUser() → redirect to /arena
```

---

## EmailJS Welcome Email

**When:** Admin approves a user (single or batch)
**Who sends:** Admin panel frontend (client-side EmailJS)
**Template vars:** `to_email`, `username`, `waitlist_number`
**Template:** Premium dark design — "Access Granted. Enter the Arena."

For batch: iterate with 200ms delay between sends.

---

## Security

- `requireApproved` middleware on all game routes — server-side, can't bypass
- BANNED users rejected at `authMiddleware` level (before any route handler)
- Invite codes validated server-side (existence, expiry, max uses)
- Admin endpoints gated by `adminMiddleware` (role === ADMIN)
- Waitlist number assigned server-side (can't be manipulated)
- Username reserved at signup (UNIQUE constraint) — safe during waitlist period

---

## Edge Cases

| Case | Handling |
|------|----------|
| Existing users on deploy | Migration sets APPROVED + waitlistNumber=0 |
| Bot accounts | Always APPROVED, never shown in waitlist |
| Admin creates new admin | Must also set status=APPROVED manually |
| User redeems code while already APPROVED | No-op, return success |
| Expired invite code | 400 "Code expired" |
| Max-uses reached on code | 400 "Code no longer valid" |
| User BANNED while in a match | Match continues (check is per-request, not per-session) — next API call fails |
| Server restart loses socket | User refreshes /waitlist → re-connects → re-subscribes to event |

---

## Implementation Order

```
Phase 1: Schema + Migration
Phase 2: Backend middleware (requireApproved)
Phase 3: Admin endpoints + invite codes
Phase 4: Socket event
Phase 5: Frontend types + route guard
Phase 6: Frontend /waitlist page
Phase 7: Frontend admin panel
Phase 8: EmailJS welcome template
Phase 9: Edge cases + quality gate
Phase 10: Deploy + run migration
```

Each phase is independently deployable (behind feature flag: the default status is WAITLISTED, so new users are gated even if the admin panel isn't built yet).
