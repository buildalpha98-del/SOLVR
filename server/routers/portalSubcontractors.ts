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
} from "../db";

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
