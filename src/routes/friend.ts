/**
 * Friend Duel Routes
 * POST /friend/create - Create a private duel room
 * GET /friend/:code - Get room info (lobby state)
 * POST /friend/:code/join - Join room as guest
 * POST /friend/:code/start - Host starts the match
 */

import { and, eq, gt, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import { friendRooms, userStats, users } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { authMiddleware } from "../middleware/auth";
import { createMatch, hasActiveMatch, type QueuedPlayer } from "../services/matchmaking";
import { socketEmit } from "../socket";

export const friendRoutes = new Hono();

friendRoutes.use("*", authMiddleware);

const ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * POST /friend/create
 * Create a room or return existing active room (idempotent per host)
 */
friendRoutes.post("/create", async (c) => {
  const user = c.get("user");

  const activeMatchId = await hasActiveMatch(user.id);
  if (activeMatchId) return c.json({ redirect: `/match/${activeMatchId}`, matchId: activeMatchId });

  // Cancel any previous waiting/ready rooms for this host
  await db
    .update(friendRooms)
    .set({ status: "expired" })
    .where(
      and(eq(friendRooms.hostUserId, user.id), inArray(friendRooms.status, ["waiting", "ready"])),
    );

  const inviteCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + ROOM_TTL_MS);

  const [room] = await db
    .insert(friendRooms)
    .values({ inviteCode, hostUserId: user.id, expiresAt })
    .returning({ id: friendRooms.id, inviteCode: friendRooms.inviteCode });

  if (!room) throw Errors.BadRequest("Failed to create room");

  return c.json({ roomId: room.id, inviteCode: room.inviteCode }, 201);
});

/**
 * GET /friend/:code
 * Get room info — used by the lobby page for both host and guest
 */
friendRoutes.get("/:code", async (c) => {
  const { code } = c.req.param();
  const room = await findRoomByCode(code);
  if (!room) throw Errors.NotFound("Room");

  const statsColumns = { rating: true, wins: true, losses: true, winStreak: true } as const;

  const host = await db.query.users.findFirst({
    where: eq(users.id, room.hostUserId),
    columns: { id: true, username: true },
    with: { stats: { columns: statsColumns } },
  });

  let guest = null;
  if (room.guestUserId) {
    guest = await db.query.users.findFirst({
      where: eq(users.id, room.guestUserId),
      columns: { id: true, username: true },
      with: { stats: { columns: statsColumns } },
    });
  }

  return c.json({
    room: {
      id: room.id,
      inviteCode: room.inviteCode,
      status: room.status,
      duration: room.duration,
      matchId: room.matchId,
      expiresAt: room.expiresAt,
    },
    host: formatPlayer(host),
    guest: guest ? formatPlayer(guest) : null,
    canStart: room.status === "ready" && !!room.guestUserId,
  });
});

/**
 * POST /friend/:code/join
 * Join room as guest
 */
friendRoutes.post("/:code/join", async (c) => {
  const user = c.get("user");
  const { code } = c.req.param();

  const activeMatchId = await hasActiveMatch(user.id);
  if (activeMatchId) return c.json({ redirect: `/match/${activeMatchId}`, matchId: activeMatchId });

  const room = await findRoomByCode(code);
  if (!room) throw Errors.NotFound("Room");
  if (room.status === "expired" || room.expiresAt < new Date()) {
    throw Errors.BadRequest("Room expired, create a new one");
  }
  if (room.status !== "waiting") throw Errors.BadRequest("Room is full");
  if (room.hostUserId === user.id) throw Errors.BadRequest("Cannot join your own room");

  const existingRoom = await db.query.friendRooms.findFirst({
    where: and(
      or(eq(friendRooms.hostUserId, user.id), eq(friendRooms.guestUserId, user.id)),
      inArray(friendRooms.status, ["waiting", "ready"]),
      gt(friendRooms.expiresAt, new Date()),
    ),
  });
  if (existingRoom) throw Errors.Conflict("You are already in an active lobby");

  await db
    .update(friendRooms)
    .set({ guestUserId: user.id, status: "ready" })
    .where(and(eq(friendRooms.id, room.id), eq(friendRooms.status, "waiting")));

  await emitLobbyUpdate(room.id);

  return c.json({ success: true });
});

/**
 * POST /friend/:code/start
 * Host starts the match (idempotent — returns existing matchId if already started)
 */
friendRoutes.post("/:code/start", async (c) => {
  const user = c.get("user");
  const { code } = c.req.param();

  const room = await findRoomByCode(code);
  if (!room) throw Errors.NotFound("Room");

  if (room.matchId) return c.json({ matchId: room.matchId });

  if (room.hostUserId !== user.id) throw Errors.Forbidden("Only the host can start");
  if (room.status !== "ready") throw Errors.BadRequest("Room is not ready");
  if (!room.guestUserId) throw Errors.BadRequest("No guest in room");

  const guestUserId = room.guestUserId;
  let matchId: string;
  try {
    matchId = await startFriendMatch({
      id: room.id,
      hostUserId: room.hostUserId,
      guestUserId,
      duration: room.duration,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start match";
    if (msg.includes("No problems available")) {
      throw Errors.BadRequest("No problems available. Please try again.");
    }
    throw err;
  }

  socketEmit.friendMatchCreated(room.hostUserId, matchId);
  socketEmit.friendMatchCreated(guestUserId, matchId);

  return c.json({ matchId }, 201);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findRoomByCode(code: string) {
  return db.query.friendRooms.findFirst({
    where: eq(friendRooms.inviteCode, code.toUpperCase()),
  });
}

function toQueuedPlayer(userId: string, rating: number, duration: number): QueuedPlayer {
  return { userId, rating, joinedAt: Date.now(), duration };
}

async function startFriendMatch(room: {
  id: string;
  hostUserId: string;
  guestUserId: string;
  duration: number;
}): Promise<string> {
  // Claim the room FIRST — prevents double-start creating orphan matches
  const claimed = await db
    .update(friendRooms)
    .set({ status: "active" })
    .where(and(eq(friendRooms.id, room.id), eq(friendRooms.status, "ready")))
    .returning({ id: friendRooms.id });

  if (!claimed.length) throw Errors.Conflict("Room already started");

  try {
    return await createMatchForRoom(room);
  } catch (err) {
    // Revert room to "ready" so host can retry
    await db.update(friendRooms).set({ status: "ready" }).where(eq(friendRooms.id, room.id));
    throw err;
  }
}

async function createMatchForRoom(room: {
  id: string;
  hostUserId: string;
  guestUserId: string;
  duration: number;
}): Promise<string> {
  const [hostStats, guestStats] = await Promise.all([
    db.query.userStats.findFirst({ where: eq(userStats.userId, room.hostUserId) }),
    db.query.userStats.findFirst({ where: eq(userStats.userId, room.guestUserId) }),
  ]);

  if (!hostStats || !guestStats) throw Errors.BadRequest("Player stats not found");

  const p1 = toQueuedPlayer(room.hostUserId, hostStats.rating, room.duration);
  const p2 = toQueuedPlayer(room.guestUserId, guestStats.rating, room.duration);
  const matchId = await createMatch(p1, p2, room.duration);

  await db.update(friendRooms).set({ matchId }).where(eq(friendRooms.id, room.id));
  return matchId;
}

type PlayerRow = {
  id?: string;
  username?: string | null;
  stats?: { rating: number; wins: number; losses: number; winStreak: number } | null;
};

function formatPlayer(player: PlayerRow | undefined | null) {
  return {
    id: player?.id ?? "",
    username: player?.username ?? null,
    rating: player?.stats?.rating ?? 1000,
    wins: player?.stats?.wins ?? 0,
    losses: player?.stats?.losses ?? 0,
    winStreak: player?.stats?.winStreak ?? 0,
  };
}

function buildLobbyPayload(
  room: {
    id: string;
    inviteCode: string;
    status: string;
    duration: number;
    guestUserId: string | null;
  },
  host: PlayerRow | undefined,
  guest: PlayerRow | null,
) {
  return {
    room: {
      id: room.id,
      inviteCode: room.inviteCode,
      status: room.status,
      duration: room.duration,
    },
    host: formatPlayer(host),
    guest: guest ? formatPlayer(guest) : null,
    canStart: room.status === "ready" && !!room.guestUserId,
  };
}

const STATS_COLUMNS = { rating: true, wins: true, losses: true, winStreak: true } as const;

async function emitLobbyUpdate(roomId: string): Promise<void> {
  const room = await db.query.friendRooms.findFirst({
    where: eq(friendRooms.id, roomId),
  });
  if (!room) return;

  const host = await db.query.users.findFirst({
    where: eq(users.id, room.hostUserId),
    columns: { id: true, username: true },
    with: { stats: { columns: STATS_COLUMNS } },
  });

  let guest = null;
  if (room.guestUserId) {
    guest = await db.query.users.findFirst({
      where: eq(users.id, room.guestUserId),
      columns: { id: true, username: true },
      with: { stats: { columns: STATS_COLUMNS } },
    });
  }

  const payload = buildLobbyPayload(room, host, guest ?? null);
  socketEmit.friendLobbyUpdate(room.hostUserId, payload);
  if (room.guestUserId) {
    socketEmit.friendLobbyUpdate(room.guestUserId, payload);
  }
}
