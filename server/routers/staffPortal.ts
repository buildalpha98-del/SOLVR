/**
 * Staff Portal Router
 *
 * PIN-based auth for staff members. Separate from the owner portal.
 * Session stored in a dedicated cookie: solvr_staff_session
 *
 * Procedures:
 *  staffPortal.login        — verify PIN, issue session cookie
 *  staffPortal.me           — get current staff member from session
 *  staffPortal.logout       — clear session cookie
 *  staffPortal.todayJobs    — jobs scheduled for the staff member today
 *  staffPortal.weekRoster   — full week schedule for the staff member
 *  staffPortal.checkIn      — GPS check-in to a job
 *  staffPortal.checkOut     — GPS check-out from a job
 *  staffPortal.activeCheckIn — get current open check-in (if any)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { parse as parseCookieHeader } from "cookie";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import {
  listStaffMembers,
  getStaffMember,
  updateStaffMember,
  createStaffSession,
  getStaffSessionByToken,
  deleteStaffSession,
  listScheduleEntriesForStaffWeek,
  getActiveCheckIn,
  createTimeEntry,
  updateTimeEntry,
  getCrmClientById,
} from "../db";

const STAFF_COOKIE = "solvr_staff_session";
const SESSION_TTL_DAYS = 7;

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getStaffSession(req: {
  cookies?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
}) {
  let token: string | undefined;
  const rawHeader = (req.headers as Record<string, string | undefined>)?.cookie;
  if (rawHeader) {
    const parsed = parseCookieHeader(rawHeader);
    token = parsed[STAFF_COOKIE];
  } else {
    token = req.cookies?.[STAFF_COOKIE];
  }
  if (!token) return null;
  const session = await getStaffSessionByToken(token);
  if (!session) return null;
  const staff = await getStaffMember(session.staffId);
  if (!staff || !staff.isActive) return null;
  const client = await getCrmClientById(session.clientId);
  if (!client) return null;
  return { session, staff, client, token };
}

function getStaffCookieOptions(req: { headers?: Record<string, string | string[] | undefined> }) {
  const origin = (req.headers as Record<string, string | undefined>)?.origin ?? "";
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
  return {
    httpOnly: true,
    secure: !isLocalhost,
    sameSite: (isLocalhost ? "lax" : "none") as "lax" | "none",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const staffPortalRouter = router({
  /**
   * Step 1: get list of staff names for a client (by portal subdomain / client slug).
   * Staff select their name, then enter their PIN.
   * We look up the client by their portal password token (reuse existing portal auth).
   */
  listStaffNames: publicProcedure
    .input(z.object({
      /** The numeric client ID — passed from the owner's portal session */
      clientId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      const client = await getCrmClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Business not found." });
      const staff = await listStaffMembers(client.id);
      return staff.map((s: { id: number; name: string; trade: string | null }) => ({ id: s.id, name: s.name, trade: s.trade }));
    }),

  /**
   * PIN login — staff select their name and enter their 4-digit PIN.
   * Issues a session cookie on success.
   */
  login: publicProcedure
    .input(z.object({
      staffId: z.number().int().positive(),
      pin: z.string().min(4).max(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const staff = await getStaffMember(input.staffId);
      if (!staff || !staff.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
      }
      if (!staff.staffPin) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No PIN set for this staff member. Ask your manager to set one." });
      }
      const valid = await bcrypt.compare(input.pin, staff.staffPin);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect PIN." });
      }
      const token = randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      await createStaffSession({ staffId: staff.id, clientId: staff.clientId, token, expiresAt });
      const cookieOptions = getStaffCookieOptions(ctx.req);
      ctx.res.cookie(STAFF_COOKIE, token, cookieOptions);
      return { success: true, staffId: staff.id, name: staff.name };
    }),

  /**
   * Get current staff member from session cookie.
   */
  me: publicProcedure.query(async ({ ctx }) => {
    const session = await getStaffSession(ctx.req);
    if (!session) return null;
    return {
      id: session.staff.id,
      name: session.staff.name,
      trade: session.staff.trade,
      clientId: session.client.id,
      businessName: session.client.businessName,
    };
  }),

  /**
   * Logout — clear session cookie and delete DB session.
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const session = await getStaffSession(ctx.req);
    if (session) {
      await deleteStaffSession(session.token);
    }
    const cookieOptions = getStaffCookieOptions(ctx.req);
    ctx.res.clearCookie(STAFF_COOKIE, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  }),

  /**
   * Today's scheduled jobs for the logged-in staff member.
   */
  todayJobs: publicProcedure.query(async ({ ctx }) => {
    const session = await getStaffSession(ctx.req);
    if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const entries = await listScheduleEntriesForStaffWeek(
      session.staff.id,
      session.client.id,
      todayStart,
      todayEnd,
    );

    // Enrich with job details
    const { getPortalJob } = await import("../db");
    const enriched = await Promise.all(entries.map(async (entry) => {
      const job = await getPortalJob(entry.jobId);
      return {
        scheduleId: entry.id,
        jobId: entry.jobId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        status: entry.status,
        notes: entry.notes,
        job: job ? {
          id: job.id,
          jobType: job.jobType,
          description: job.description,
          location: job.location,
          customerName: job.customerName,
          customerPhone: job.customerPhone,
          stage: job.stage,
        } : null,
      };
    }));

    return enriched;
  }),

  /**
   * Week roster for the logged-in staff member.
   * Returns Mon–Sun of the requested week (defaults to current week).
   */
  weekRoster: publicProcedure
    .input(z.object({
      /** ISO date string for any day in the target week, e.g. "2026-04-14" */
      weekOf: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

      const ref = input.weekOf ? new Date(input.weekOf) : new Date();
      const day = ref.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day; // Monday
      const weekStart = new Date(ref);
      weekStart.setDate(ref.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const entries = await listScheduleEntriesForStaffWeek(
        session.staff.id,
        session.client.id,
        weekStart,
        weekEnd,
      );

      const { getPortalJob } = await import("../db");
      const enriched = await Promise.all(entries.map(async (entry) => {
        const job = await getPortalJob(entry.jobId);
        return {
          scheduleId: entry.id,
          jobId: entry.jobId,
          startTime: entry.startTime,
          endTime: entry.endTime,
          status: entry.status,
          notes: entry.notes,
          job: job ? {
            id: job.id,
            jobType: job.jobType,
            description: job.description,
            location: job.location,
            customerName: job.customerName,
            stage: job.stage,
          } : null,
        };
      }));

      return { weekStart, weekEnd, entries: enriched };
    }),

  /**
   * GPS check-in to a job.
   */
  checkIn: publicProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      scheduleId: z.number().int().positive().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

      // Check not already checked in
      const existing = await getActiveCheckIn(session.staff.id, input.jobId);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Already checked in to this job." });

      const { insertId } = await createTimeEntry({
        clientId: session.client.id,
        jobId: input.jobId,
        staffId: session.staff.id,
        scheduleId: input.scheduleId ?? null,
        checkInAt: new Date(),
        checkInLat: input.lat ? String(input.lat) : null,
        checkInLng: input.lng ? String(input.lng) : null,
      });

      return { success: true, timeEntryId: insertId };
    }),

  /**
   * GPS check-out from a job.
   */
  checkOut: publicProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

      const entry = await getActiveCheckIn(session.staff.id, input.jobId);
      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "No active check-in found for this job." });

      const checkOutAt = new Date();
      const durationMinutes = Math.round((checkOutAt.getTime() - new Date(entry.checkInAt).getTime()) / 60000);

      await updateTimeEntry(entry.id, {
        checkOutAt,
        checkOutLat: input.lat ? String(input.lat) : null,
        checkOutLng: input.lng ? String(input.lng) : null,
        durationMinutes,
      });

      return { success: true, durationMinutes };
    }),

  /**
   * Get active check-in for a job (if any).
   */
  activeCheckIn: publicProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) return null;
      return getActiveCheckIn(session.staff.id, input.jobId);
    }),

  /**
   * Confirm a scheduled shift.
   */
  confirmShift: publicProcedure
    .input(z.object({ scheduleId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { getScheduleEntry, updateScheduleEntry } = await import("../db");
      const entry = await getScheduleEntry(input.scheduleId);
      if (!entry || entry.staffId !== session.staff.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shift not found." });
      }
      await updateScheduleEntry(input.scheduleId, {
        status: "confirmed",
        staffConfirmedAt: new Date(),
        staffDeclinedAt: null,
      });
      return { success: true };
    }),

  /**
   * Decline a scheduled shift.
   */
  declineShift: publicProcedure
    .input(z.object({ scheduleId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { getScheduleEntry, updateScheduleEntry } = await import("../db");
      const entry = await getScheduleEntry(input.scheduleId);
      if (!entry || entry.staffId !== session.staff.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shift not found." });
      }
      await updateScheduleEntry(input.scheduleId, {
        status: "pending",
        staffDeclinedAt: new Date(),
        staffConfirmedAt: null,
      });
      return { success: true };
    }),

  /**
   * Register a Web Push subscription for this staff member's device.
   * Called after the browser grants notification permission.
   */
  registerPush: publicProcedure
    .input(z.object({
      subscription: z.string(), // JSON.stringify(PushSubscription)
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      await updateStaffMember(session.staff.id, { pushSubscription: input.subscription });
      return { success: true };
    }),

  /**
   * Return the VAPID public key so the client can subscribe.
   */
  vapidPublicKey: publicProcedure.query(() => {
    return { key: process.env.VAPID_PUBLIC_KEY ?? null };
  }),
});
