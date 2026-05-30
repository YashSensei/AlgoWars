# AlgoWars — Private Duel: Implementation Plan

## Overview

A new game mode ("Private Duel") allowing users to challenge a specific friend via invite link. The match is ranked (full Elo), uses the existing match engine, and feels identical to a normal match once started. The only difference is how the two players find each other — invite code instead of queue.

---

## User Flow

```
Host clicks "Private Duel" (⚔️) on arena
  → Room created (unique invite code generated)
  → Shows invite link + "Copy Link" button
  → Waits for friend to join

Friend opens link: /friend/ABCD1234
  → Sees "Yash invited you to a duel" + [Join Match]
  → Clicks Join → enters lobby

Both in lobby:
  → Host sees: [Start Match] button (enabled when both present)
  → Host clicks Start → problem selected → match begins
  → Both redirected to /match/:id (existing match page)

Match plays out identically to ranked (timer, submissions, AI judge, Elo).
```

---

## Database

### New Table: `friend_rooms`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| id | text (UUID) | PK | Room identifier |
| inviteCode | varchar(8) | unique, generated | Short shareable code (e.g., "ABCD1234") |
| hostUserId | text FK → users.id | not null | Who created the room |
| guestUserId | text FK → users.id | nullable | Who joined |
| matchId | text FK → matches.id | nullable | Created when match starts |
| status | enum | "waiting" | waiting → ready → active → completed / expired |
| duration | integer | 900 | Match duration in seconds (blitz default) |
| createdAt | timestamp | now() | |
| expiresAt | timestamp | now() + 15 min | Room auto-expires if not started |

### New Enum: `friend_room_status`

```
waiting | ready | active | completed | expired
```

### Status Transitions (V1 — no explicit leave)

```
waiting → ready      (guest joins)
ready → active       (host starts match)
active → completed   (match ends naturally)
waiting → expired    (15 min timeout)
ready → expired      (15 min timeout)
```

No `ready → waiting` transition exists in V1. Once a guest joins, they stay joined until the room expires or the match starts. If the guest closes their tab, the room stays "ready" — the host can still start the match. If the guest is truly gone when the match begins, the existing 10-second disconnect auto-forfeit handles it (same as any ranked match).

---

## Backend

### New Route File: `src/routes/friend.ts`

Mounted at `/friend/*`. Requires `authMiddleware` + `requireApproved`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/friend/create` | Create room, generate invite code |
| GET | `/friend/:code` | Get room info (for join page) |
| POST | `/friend/:code/join` | Join room as guest |
| POST | `/friend/:code/leave` | Leave room (guest) or cancel (host) |
| POST | `/friend/:code/start` | Host starts the match |

### POST /friend/create

```ts
// Check: user doesn't already have an active room (one room per host)
//   → If existingRoom in status "waiting"/"ready" → return it (idempotent)
// Generate 8-char alphanumeric code
// Insert friend_rooms row: { hostUserId, inviteCode, status: "waiting", expiresAt: +15min }
// Return: { roomId, inviteCode }
```

### GET /friend/:code

```ts
// Find room by inviteCode
// Return: { room, host: {id, username}, guest: {id, username} | null, canStart }
// Used by the lobby page for both host and guest
```

### POST /friend/:code/join

```ts
// Verify: room exists, status = "waiting", guestUserId is null
// Verify: user !== host, user is not already in another active room
// Set: guestUserId = user.id, status = "ready"
// Emit socket: friend:lobby-update { room, host, guest, canStart: true }
// Return: { success, room }
```

### POST /friend/:code/start

```ts
// Idempotent: if match already created, return existing matchId (prevents double-click)
// if (room.matchId) return { matchId: room.matchId }
//
// CRITICAL: Use SELECT FOR UPDATE to prevent race with guest disconnecting
// Inside transaction:
//   → Lock room row
//   → Verify: user is host, status = "ready", guestUserId IS NOT NULL
//   → Create match via createMatch(host, guest, duration)
//   → Set room.status = "active", room.matchId = matchId
//   → COMMIT
// Emit socket: friend:match-created { matchId } to both players
// Return: { matchId }
```

**NOTE:** No `/leave` endpoint in V1. If host/guest leaves, the room expires naturally (15 min). Simplifies implementation — explicit leave can be added later.

### Key design: `createMatch` from matchmaking.ts is reused directly
The existing `createMatch(p1, p2, duration)` function handles:
- Problem selection
- Transaction (match + match_players insert)
- `notifyMatchedPlayers` (socket emit)

We call it with both players' data — same as if matchmaking paired them.

---

## Socket Events

| Event | Direction | When | Payload |
|-------|-----------|------|---------|
| `friend:lobby-update` | S→C | Any lobby state change (guest joins, room state update) | `{ room, host, guest, canStart }` |
| `friend:match-created` | S→C | Host starts match | `{ matchId }` |

Both players are in room `user:{userId}` already (from connection). Events are sent to individual user rooms — no new room needed.

---

## Frontend

### Pages (simplified — single lobby page)

| Path | Route Group | Purpose |
|------|-------------|---------|
| `/friend` | (main) | Landing — "Create Duel" button |
| `/friend/[code]` | (main) | The lobby — both host and guest use this page |

### Arena Page Addition

Add to `GAME_MODES` array:
```ts
{
  title: "Private Duel",
  description: "Challenge a friend",
  icon: "swords",
  route: "/friend",
  live: true,
}
```

### `/friend` Page

Simple landing:
```
⚔️ PRIVATE DUEL

Challenge a friend to a ranked match.
Share the link. First to solve wins.

[ Create Duel ]
```

On click: `POST /friend/create` → navigate to `/friend/ABCD1234`

### `/friend/[code]` Page (THE lobby — one page for both roles)

This single page handles everything:

**If user is the host (hostUserId === me):**
- Show invite link + Copy button
- Show waiting state or guest info
- Show [Start Match] button (enabled only when guest present)

**If user is a guest (not joined yet):**
- Show "X invited you to a duel" + [Join Match] button
- On join → page updates to lobby view

**If user is the guest (already joined):**
- Show both players + "Waiting for host to start"

**Socket listener:**
- `friend:lobby-update` → re-render lobby state
- `friend:match-created` → navigate to `/match/:id`

**One code path. One URL. Host and guest on the same page.**

### Socket Payload (enriched)

```ts
// friend:lobby-update
{
  room: { id, inviteCode, status, duration },
  host: { id, username, rating },
  guest: { id, username, rating } | null,
  canStart: boolean,  // true only when status === "ready" and both present
}
```

Frontend becomes dumb — just renders what the backend tells it.

### Invite Link Format

```
https://www.algowars.online/friend/ABCD1234
```

Short, shareable, works in DMs. Host and guest literally on the same URL.

---

## Reused Systems

| System | How it's reused |
|--------|-----------------|
| `createMatch(p1, p2, duration)` | Exact same function from matchmaking.ts — creates match + match_players |
| Match Engine | Identical — state machine, timer, processVerdict, forfeit, abort |
| AI Judge | Same — submissions route unchanged |
| Elo Rating | Same — processVerdict calls calculateEloDelta |
| XP System | Same — awardXP fires on match end |
| Socket.IO | Same user rooms, same match events after match starts |
| Bot Engine | NOT used — friend matches always have a real opponent |
| Match Page UI | Identical — /match/[id] renders the same regardless of how the match was created |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Invalid invite link | GET /friend/:code returns 404 → show "Room not found" |
| Expired room (15 min) | Backend rejects join/start → show "Room expired, create a new one" |
| Host closes tab | Room expires naturally after 15 min (no /leave endpoint needed) |
| Guest closes tab | Room stays "ready" — no state change. Host can still start. If guest is truly gone when match begins, they auto-forfeit via existing 10s disconnect logic (same as any ranked match). |
| Host opens two rooms | `POST /friend/create` returns existing active room (idempotent). One room per host enforced. |
| Guest joins multiple rooms | `POST /friend/:code/join` rejects: "You are already in an active lobby" |
| Same user opens invite twice | GET returns current state → page renders correctly (same lobby view) |
| Room full (guest already joined) | POST /friend/:code/join → 400 "Room is full" |
| Match already started (room status = active) | GET /friend/:code shows "Match in progress" + link to /match/:id if user is a player |
| Host tries to start without guest | Button disabled (frontend) + backend SELECT FOR UPDATE verifies guestUserId IS NOT NULL |
| Race: host clicks Start while guest closes tab at same instant | Transaction locks row, verifies `guestUserId IS NOT NULL` and `status = "ready"`. Both are true (closing tab doesn't change DB state). Match is created. Guest has 10s reconnect window, then auto-forfeits. No special handling needed — same as any disconnect during a match. |
| Disconnect during lobby | No auto-action. Room is patient. User refreshes → re-fetches state. |
| Disconnect during match | Existing 10s reconnect window + auto-forfeit (unchanged) |
| Browser refresh in lobby | GET /friend/:code re-fetches → re-renders correctly |
| Room cleanup | Every 60s: expire rooms where `expiresAt < now()` AND status in ("waiting", "ready") |

---

## Room Expiry

Add a periodic cleanup (like the existing queue cleanup in `src/index.ts`):

```ts
// Every 60s, expire stale friend rooms
setInterval(async () => {
  await db.update(friendRooms)
    .set({ status: "expired" })
    .where(and(
      inArray(friendRooms.status, ["waiting", "ready"]),
      lt(friendRooms.expiresAt, new Date())
    ));
}, 60_000);
```

---

## Implementation Order

1. **Schema**: Add `friendRoomStatusEnum` + `friend_rooms` table + migration
2. **Backend routes**: `src/routes/friend.ts` — create, get, join, start (4 endpoints)
3. **Socket events**: Add `friend:lobby-update` and `friend:match-created` emits
4. **Frontend pages**: `/friend` (landing) + `/friend/[code]` (unified lobby)
5. **Arena card**: Add "Private Duel" to the game mode grid
6. **Room cleanup**: Periodic expiry in `src/index.ts`
7. **Quality gate**: Typecheck, lint, function-length, dry-run all paths

---

## What NOT to build (V1)

- Custom match settings (duration, difficulty) — use fixed Blitz defaults
- `/leave` endpoint — rooms expire naturally (15 min). Add explicit leave later.
- Rematch button — player can create a new room manually
- Friends list / social features — just share the link
- Spectator mode — out of scope
- Unranked option — all friend matches are ranked
- Multiple rooms per host — one active room enforced

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/db/schema.ts` | New enum + friend_rooms table |
| `src/routes/friend.ts` | **New** — 4 endpoints (create, get, join, start) |
| `src/routes/index.ts` | Mount friend routes |
| `src/index.ts` | Add room cleanup interval |
| `frontend/src/app/(main)/arena/page.tsx` | Add "Private Duel" card |
| `frontend/src/app/(main)/friend/page.tsx` | **New** — landing "Create Duel" |
| `frontend/src/app/(main)/friend/[code]/page.tsx` | **New** — unified lobby (host + guest) |

---

## Verification

| Test | Expected |
|------|----------|
| Create room | Returns invite code, room visible in DB |
| Open invite link (logged in) | Shows host name + Join button |
| Open invite link (not logged in) | Redirected to login → back to invite page |
| Join room | Status changes to "ready", host sees lobby update |
| Host starts | Match created, both players navigate to /match/:id |
| Match plays out | Timer, submissions, verdicts — identical to ranked |
| Match ends | Elo updates, XP awarded, results page shows correctly |
| Room expires (15 min) | Cannot join or start, shows "Room expired, create a new one" |
| Host closes tab | Room expires naturally after 15 min, no immediate action |
| Guest closes tab after joining | Room stays "ready", host can still start, guest auto-forfeits if absent when match begins |
