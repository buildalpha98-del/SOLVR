/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 *
 * portalSubcontractors — CRUD for subcontractor profiles, job assignments,
 * and timesheet logging. Costs auto-feed into Job Costing report.
 */
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "../_core/portalAuth";
import { randomUUID } from "crypto";
import {
  listSubcontractors,
  getSubcontractor,
  createSubcontractor,
  updateSubcontractor,
  deactivateSubcontractor,
  assignSubcontractorToJob,
  listJobAssignments,
  updateAssignmentStatus,
  removeAssignment,
  logSubcontractorHours,
  listJobTimesheets,
  listSubcontractorTimesheets,
  getAssignmentByToken,
  getPortalJob,
  getCrmClientById,
  getClientProfile,
} from "../db";
import { sendEmail } from "../_core/email";

export const portalSubcontractorsRouter = router({
  // ─── Subcontractor CRUD ──────────────────────────────────────────────────
  list: publicProcedure.query(async ({ ctx }) => {
    const { clientId } = await requirePortalAuth(ctx.req);
    return listSubcontractors(clientId);
  }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return getSubcontractor(input.id, clientId);
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      trade: z.string().optional(),
      abn: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      hourlyRateCents: z.number().min(0).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const id = await createSubcontractor({ ...input, clientId });
      return { id };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      trade: z.string().optional(),
      abn: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      hourlyRateCents: z.number().min(0).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const { id, ...data } = input;
      await updateSubcontractor(id, clientId, data);
      return { success: true };
    }),

  deactivate: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      await deactivateSubcontractor(input.id, clientId);
      return { success: true };
    }),

  // ─── Job Assignments ─────────────────────────────────────────────────────
  assignToJob: publicProcedure
    .input(z.object({
      jobId: z.number(),
      subcontractorId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const magicToken = randomUUID().replace(/-/g, "");
      const id = await assignSubcontractorToJob({
        ...input,
        clientId,
        magicToken,
      });

      // ── Auto-send notification email to subbie ──
      try {
        const subbie = await getSubcontractor(input.subcontractorId, clientId);
        if (subbie?.email) {
          const job = await getPortalJob(input.jobId);
          const client = await getCrmClientById(clientId);
          const profile = await getClientProfile(clientId);
          const businessName = profile?.tradingName ?? client?.businessName ?? "Your Business";
          const origin = ctx.req.headers.origin || "https://solvr.com.au";
          const magicLink = `${origin}/subbie/job/${magicToken}`;

          const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1F2937;max-width:600px;margin:0 auto;padding:20px">
<div style="text-align:center;margin-bottom:24px">
  <h2 style="color:#0F1F3D;margin:0">Job Assignment</h2>
  <p style="color:#6B7280;margin:4px 0 0">from ${businessName}</p>
</div>
<p>Hi ${subbie.name},</p>
<p>You've been assigned to a new job. Here are the details:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:8px;font-weight:600;color:#6B7280;width:120px">Job Type</td>
    <td style="padding:8px">${job?.jobType ?? "—"}</td>
  </tr>
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:8px;font-weight:600;color:#6B7280">Location</td>
    <td style="padding:8px">${job?.location ?? "—"}</td>
  </tr>
  ${job?.preferredDate ? `<tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:8px;font-weight:600;color:#6B7280">Scheduled</td>
    <td style="padding:8px">${job.preferredDate}</td>
  </tr>` : ""}
  ${input.notes ? `<tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:8px;font-weight:600;color:#6B7280">Notes</td>
    <td style="padding:8px">${input.notes}</td>
  </tr>` : ""}
</table>
<div style="text-align:center;margin:24px 0">
  <a href="${magicLink}" style="display:inline-block;background:#F5A623;color:#0F1F3D;padding:12px 32px;border-radius:6px;font-weight:600;text-decoration:none">View Job Details</a>
</div>
<p style="color:#9CA3AF;font-size:12px;text-align:center;margin-top:32px">This link is unique to you. Do not share it.<br/>Sent via <a href="https://solvr.com.au" style="color:#9CA3AF">Solvr</a></p>
</body></html>`;

          await sendEmail({
            to: subbie.email,
            subject: `New Job Assignment from ${businessName}`,
            html,
            fromName: businessName,
          });
        }
      } catch (err) {
        // Don't fail the assignment if email fails — log and continue
        console.error("[SubbieNotify] Failed to send assignment email:", err);
      }

      return { id, magicToken };
    }),

  listJobAssignments: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return listJobAssignments(input.jobId, clientId);
    }),

  updateAssignmentStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["assigned", "accepted", "declined", "completed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      await updateAssignmentStatus(input.id, clientId, input.status);
      return { success: true };
    }),

  removeAssignment: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      await removeAssignment(input.id, clientId);
      return { success: true };
    }),

  // ─── Timesheets ──────────────────────────────────────────────────────────
  logHours: publicProcedure
    .input(z.object({
      assignmentId: z.number(),
      jobId: z.number(),
      subcontractorId: z.number(),
      workDate: z.string(),
      hours: z.string(),
      rateCents: z.number(),
      totalCents: z.number(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const id = await logSubcontractorHours({
        ...input,
        clientId,
        workDate: new Date(input.workDate),
      });
      return { id };
    }),

  listJobTimesheets: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return listJobTimesheets(input.jobId, clientId);
    }),

  listSubbieTimesheets: publicProcedure
    .input(z.object({ subcontractorId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return listSubcontractorTimesheets(input.subcontractorId, clientId);
    }),

  // ─── Public: magic-link access for subbies ───────────────────────────────
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      return getAssignmentByToken(input.token);
    }),
});
