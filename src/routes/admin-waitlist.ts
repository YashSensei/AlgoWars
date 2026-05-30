/**
 * Admin Waitlist Routes
 * Mounted under /admin/waitlist/* — requires auth + admin role (inherited from parent)
 *
 * GET  /admin/waitlist          - List users by status (paginated)
 * GET  /admin/waitlist/stats    - Count per status
 * POST /admin/waitlist/:id/approve  - Approve single user
 * POST /admin/waitlist/:id/reject   - Reject single user
 * POST /admin/waitlist/batch-approve - Approve next N by position
 * PATCH /admin/waitlist/:id/notes   - Update admin notes
 * POST /admin/invite-codes     - Create invite code
 * GET  /admin/invite-codes     - List invite codes
 * DELETE /admin/invite-codes/:id - Deactivate code
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { inviteCodes, users } from "../db/schema";
import { db } from "../lib/db";
import { Errors } from "../lib/errors";
import { logger } from "../lib/logger";
import { socketEmit } from "../socket";

export const adminWaitlistRoutes = new Hono();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

/**
 * GET /admin/waitlist
 */
adminWaitlistRoutes.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;
  const status = c.req.query("status") || "WAITLISTED";

  const result = await db.query.users.findMany({
    where: eq(users.status, status as "WAITLISTED" | "APPROVED" | "REJECTED" | "BANNED"),
    columns: {
      id: true,
      username: true,
      email: true,
      status: true,
      waitlistNumber: true,
      accessSource: true,
      adminNotes: true,
      createdAt: true,
      approvedAt: true,
    },
    orderBy: [desc(users.createdAt)],
    limit,
    offset,
  });

  return c.json({ users: result, limit, offset });
});

/**
 * GET /admin/waitlist/stats
 */
adminWaitlistRoutes.get("/stats", async (c) => {
  const [stats] = await db
    .select({
      waitlisted: sql<number>`count(*) filter (where ${users.status} = 'WAITLISTED')`,
      approved: sql<number>`count(*) filter (where ${users.status} = 'APPROVED')`,
      rejected: sql<number>`count(*) filter (where ${users.status} = 'REJECTED')`,
      banned: sql<number>`count(*) filter (where ${users.status} = 'BANNED')`,
    })
    .from(users)
    .where(eq(users.isBot, false));

  return c.json(stats);
});

/**
 * POST /admin/waitlist/:id/approve
 */
adminWaitlistRoutes.post("/:id/approve", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid user ID");
  const admin = c.get("user");

  const [updated] = await db
    .update(users)
    .set({
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: admin.id,
      accessSource: "waitlist",
    })
    .where(and(eq(users.id, id), eq(users.status, "WAITLISTED")))
    .returning({ id: users.id, username: users.username, email: users.email });

  if (!updated) throw Errors.BadRequest("User not found or not waitlisted");

  socketEmit.userApproved(id);
  logger.info("Admin", `Approved user ${id.slice(0, 8)} by ${admin.id.slice(0, 8)}`);

  return c.json({ success: true, user: updated });
});

/**
 * POST /admin/waitlist/:id/reject
 */
adminWaitlistRoutes.post("/:id/reject", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid user ID");

  const [updated] = await db
    .update(users)
    .set({ status: "REJECTED" })
    .where(and(eq(users.id, id), eq(users.status, "WAITLISTED")))
    .returning({ id: users.id });

  if (!updated) throw Errors.BadRequest("User not found or not waitlisted");

  return c.json({ success: true });
});

const batchSchema = z.object({ count: z.number().min(1).max(100) });

/**
 * POST /admin/waitlist/batch-approve
 * Approves the next N waitlisted users by waitlist_number order
 */
adminWaitlistRoutes.post("/batch-approve", async (c) => {
  const admin = c.get("user");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) throw Errors.BadRequest("Invalid count");

  const toApprove = await db.query.users.findMany({
    where: eq(users.status, "WAITLISTED"),
    columns: { id: true },
    orderBy: [sql`${users.waitlistNumber} ASC NULLS LAST`],
    limit: parsed.data.count,
  });

  if (toApprove.length === 0) return c.json({ success: true, approved: 0 });

  const ids = toApprove.map((u) => u.id);
  await db
    .update(users)
    .set({
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: admin.id,
      accessSource: "waitlist",
    })
    .where(sql`${users.id} = ANY(${ids})`);

  for (const u of toApprove) socketEmit.userApproved(u.id);
  logger.info("Admin", `Batch approved ${ids.length} users`);

  return c.json({ success: true, approved: ids.length });
});

const notesSchema = z.object({ notes: z.string().max(500) });

/**
 * PATCH /admin/waitlist/:id/notes
 */
adminWaitlistRoutes.patch("/:id/notes", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid user ID");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = notesSchema.safeParse(body);
  if (!parsed.success) throw Errors.BadRequest("Invalid notes");

  await db.update(users).set({ adminNotes: parsed.data.notes }).where(eq(users.id, id));
  return c.json({ success: true });
});

// ============================================
// INVITE CODES
// ============================================

const createCodeSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, "Alphanumeric + underscore/hyphen only"),
  maxUses: z.number().min(0).default(0),
  expiresAt: z.string().datetime().optional(),
});

/**
 * POST /admin/invite-codes
 */
adminWaitlistRoutes.post("/invite-codes", async (c) => {
  const admin = c.get("user");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw Errors.BadRequest("Invalid JSON body");
  }

  const parsed = createCodeSchema.safeParse(body);
  if (!parsed.success) throw Errors.BadRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const [code] = await db
    .insert(inviteCodes)
    .values({
      code: parsed.data.code.toUpperCase(),
      maxUses: parsed.data.maxUses,
      createdBy: admin.id,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    })
    .returning();

  return c.json({ success: true, code }, 201);
});

/**
 * GET /admin/invite-codes
 */
adminWaitlistRoutes.get("/invite-codes", async (c) => {
  const codes = await db.query.inviteCodes.findMany({
    orderBy: [desc(inviteCodes.createdAt)],
  });
  return c.json({ codes });
});

/**
 * DELETE /admin/invite-codes/:id
 */
adminWaitlistRoutes.delete("/invite-codes/:id", async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) throw Errors.BadRequest("Invalid code ID");

  const [deleted] = await db
    .delete(inviteCodes)
    .where(eq(inviteCodes.id, id))
    .returning({ id: inviteCodes.id });

  if (!deleted) throw Errors.NotFound("Invite code");
  return c.json({ success: true });
});
