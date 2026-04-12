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
  markStaffUnavailable,
  removeStaffUnavailability,
  listMyUnavailability,
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
      const { getScheduleEntry, updateScheduleEntry, getPortalJob } = await import("../db");
      const entry = await getScheduleEntry(input.scheduleId);
      if (!entry || entry.staffId !== session.staff.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shift not found." });
      }
      await updateScheduleEntry(input.scheduleId, {
        status: "confirmed",
        staffConfirmedAt: new Date(),
        staffDeclinedAt: null,
      });
      // Notify the owner (portal client) that staff confirmed
      void (async () => {
        try {
          const { sendPushToClient } = await import("../pushNotifications");
          const job = await getPortalJob(entry.jobId);
          const start = new Date(entry.startTime);
          const timeStr = start.toLocaleString("en-AU", {
            weekday: "short", day: "numeric", month: "short",
            hour: "numeric", minute: "2-digit", hour12: true,
          });
          await sendPushToClient(session.client.id, {
            title: `\u2705 ${session.staff.name} confirmed a shift`,
            body: `${job?.jobType ?? "Job"} \u2014 ${timeStr}`,
            url: `/portal/jobs/${entry.jobId}`,
          });
        } catch (e) {
          console.error("[Push] Failed to notify owner on shift confirm:", e);
        }
      })();
      return { success: true };
    }),

  /**
   * Decline a scheduled shift.
   */
  declineShift: publicProcedure
    .input(z.object({
      scheduleId: z.number().int().positive(),
      /** One of: sick | unavailable | personal | other */
      reason: z.enum(["sick", "unavailable", "personal", "other"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { getScheduleEntry, updateScheduleEntry, getPortalJob } = await import("../db");
      const entry = await getScheduleEntry(input.scheduleId);
      if (!entry || entry.staffId !== session.staff.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shift not found." });
      }
      await updateScheduleEntry(input.scheduleId, {
        status: "pending",
        staffDeclinedAt: new Date(),
        staffConfirmedAt: null,
        declineReason: input.reason ?? null,
      });
      // Notify the owner that staff can't make it
      void (async () => {
        try {
          const { sendPushToClient } = await import("../pushNotifications");
          const job = await getPortalJob(entry.jobId);
          const start = new Date(entry.startTime);
          const timeStr = start.toLocaleString("en-AU", {
            weekday: "short", day: "numeric", month: "short",
            hour: "numeric", minute: "2-digit", hour12: true,
          });
          const reasonLabel = input.reason
            ? { sick: "Sick", unavailable: "Unavailable", personal: "Personal", other: "Other" }[input.reason]
            : null;
          await sendPushToClient(session.client.id, {
            title: `\u26a0\ufe0f ${session.staff.name} can't make a shift`,
            body: `${job?.jobType ?? "Job"} \u2014 ${timeStr}${reasonLabel ? ` (${reasonLabel})` : ""} \u2014 needs reassignment`,
            url: `/portal/jobs/${entry.jobId}`,
          });
        } catch (e) {
          console.error("[Push] Failed to notify owner on shift decline:", e);
        }
      })();
      return { success: true };
    }),

  /**
   * Upload a photo against a job from the staff portal.
   * Accepts a base64-encoded image, uploads to S3, and creates a jobPhotos row.
   * The photo immediately appears in the owner's portal job detail.
   */
  uploadJobPhoto: publicProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      /** base64-encoded image data (without the data: prefix) */
      base64: z.string().min(1),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
      photoType: z.enum(["before", "after", "during", "other"]).default("during"),
      caption: z.string().max(255).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

      // Verify the job belongs to this client
      const { getPortalJob } = await import("../db");
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== session.client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }

      // Upload to S3
      const { storagePut } = await import("../storage");
      const { randomBytes } = await import("crypto");
      const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const fileKey = `staff-photos/${session.client.id}/${input.jobId}/${randomBytes(8).toString("hex")}.${ext}`;
      const buffer = Buffer.from(input.base64, "base64");
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Create jobPhotos row
      const { createJobPhoto } = await import("../db");
      const photoId = randomBytes(18).toString("hex");
      await createJobPhoto({
        id: photoId,
        jobId: input.jobId,
        clientId: session.client.id,
        photoType: input.photoType,
        imageUrl: url,
        imageKey: fileKey,
        caption: input.caption ?? null,
        sortOrder: 0,
        uploadedByStaffId: session.staff.id,
        uploadedByStaffName: session.staff.name,
      });

      // Notify the owner a photo was added (non-blocking)
      void (async () => {
        try {
          const { sendPushToClient } = await import("../pushNotifications");
          await sendPushToClient(session.client.id, {
            title: `\ud83d\udcf8 ${session.staff.name} added a photo`,
            body: `${job.jobType ?? "Job"} \u2014 ${input.photoType} photo`,
            url: `/portal/jobs/${input.jobId}`,
          });
        } catch (e) {
          console.error("[Push] Failed to notify owner on staff photo upload:", e);
        }
      })();

      return { success: true, photoId, url };
    }),

  /**
   * List photos for a job (staff can see what's been uploaded).
   */
  listJobPhotos: publicProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { listJobPhotos } = await import("../db");
      return listJobPhotos(input.jobId);
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

  // ─── Staff Availability ───────────────────────────────────────────────────────

  /**
   * Mark self as unavailable on a specific date.
   * Staff tap a day in their roster and hit "Mark as unavailable".
   */
  markUnavailable: publicProcedure
    .input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
      reason: z.enum(["personal", "sick", "annual_leave", "other"]).optional(),
      note: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      await markStaffUnavailable(session.client.id, session.staff.id, input.date, input.reason, input.note);
      return { success: true };
    }),

  /**
   * Remove an unavailability record (staff marks themselves available again).
   */
  removeUnavailability: publicProcedure
    .input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      await removeStaffUnavailability(session.client.id, session.staff.id, input.date);
      return { success: true };
    }),

  /**
   * List this staff member's unavailability records for a date range.
   * Used to show blocked days in the roster view.
   */
  listMyUnavailability: publicProcedure
    .input(z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input, ctx }) => {
      const session = await getStaffSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      return listMyUnavailability(session.staff.id, input.from, input.to);
    }),
});
