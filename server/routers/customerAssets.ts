/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Customer Asset Register router (Sprint 4.1).
 *
 *   customerAssets.list           : all assets across the tradie's customers
 *   customerAssets.listByCustomer : assets for a single customer
 *   customerAssets.get            : single asset detail
 *   customerAssets.create         : add a new asset (manual or post-job)
 *   customerAssets.update         : edit fields (typically last-serviced
 *                                    auto-bumps next-due via the route)
 *   customerAssets.markServiced   : helper to bump lastServicedAt + recompute
 *                                    nextServiceDueAt in one shot
 *   customerAssets.delete         : remove (use sparingly — prefer
 *                                    markDecommissioned for history)
 *   customerAssets.markDecommissioned : status → decommissioned (no auto-jobs)
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import {
  createCustomerAsset,
  getCustomerAssetById,
  listCustomerAssets,
  listCustomerAssetsByCustomer,
  updateCustomerAsset,
  deleteCustomerAsset,
} from "../db";

/** Same shape used for create + update; everything but id/customerId nullable. */
const assetEditableFields = {
  assetType: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  make: z.string().max(100).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  serialNumber: z.string().max(100).nullable().optional(),
  photoUrl: z.string().url().max(2048).nullable().optional(),
  installedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  warrantyUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lastServicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  serviceIntervalMonths: z.number().int().positive().max(120).nullable().optional(),
  nextServiceDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
};

/** Add `interval months` to a YYYY-MM-DD date and return the new YYYY-MM-DD. */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const customerAssetsRouter = router({
  /** Everything across all the tradie's customers. */
  list: publicProcedure
    .input(z.object({
      status: z.enum(["active", "decommissioned"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      return listCustomerAssets(client.id, { status: input?.status });
    }),

  /** Assets attached to one customer — used by the per-customer Assets section. */
  listByCustomer: publicProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      return listCustomerAssetsByCustomer(client.id, input.customerId);
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const row = await getCustomerAssetById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
      return row;
    }),

  create: publicProcedure
    .input(z.object({
      customerId: z.number().int().positive(),
      ...assetEditableFields,
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);

      // If interval is set + lastServicedAt provided + nextServiceDueAt isn't
      // explicit, compute it. Saves the tradie a calculation.
      let nextDue = input.nextServiceDueAt ?? null;
      if (!nextDue && input.lastServicedAt && input.serviceIntervalMonths) {
        nextDue = addMonths(input.lastServicedAt, input.serviceIntervalMonths);
      }

      const id = randomUUID();
      await createCustomerAsset({
        id,
        clientId: client.id,
        customerId: input.customerId,
        assetType: input.assetType,
        label: input.label,
        make: input.make ?? null,
        model: input.model ?? null,
        serialNumber: input.serialNumber ?? null,
        photoUrl: input.photoUrl ?? null,
        installedAt: input.installedAt ?? null,
        warrantyUntil: input.warrantyUntil ?? null,
        lastServicedAt: input.lastServicedAt ?? null,
        serviceIntervalMonths: input.serviceIntervalMonths ?? null,
        nextServiceDueAt: nextDue,
        notes: input.notes ?? null,
        status: "active",
      });
      return { id };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string().min(1),
      ...assetEditableFields,
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const existing = await getCustomerAssetById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Re-derive nextServiceDueAt if the user changed the interval or
      // last-serviced date AND didn't manually override the next-due.
      const lastServiced = input.lastServicedAt ?? existing.lastServicedAt;
      const interval = input.serviceIntervalMonths ?? existing.serviceIntervalMonths;
      let nextDue = input.nextServiceDueAt ?? existing.nextServiceDueAt;
      if (input.nextServiceDueAt === undefined && lastServiced && interval) {
        nextDue = addMonths(lastServiced, interval);
      }

      const { id, ...rest } = input;
      await updateCustomerAsset(id, {
        ...rest,
        nextServiceDueAt: nextDue,
      });
      return { success: true };
    }),

  /** "Just serviced this asset today" shortcut — bumps lastServicedAt
   *  to today and recalculates nextServiceDueAt from the existing
   *  serviceIntervalMonths. */
  markServiced: publicProcedure
    .input(z.object({
      id: z.string().min(1),
      /** Defaults to today (YYYY-MM-DD) */
      servicedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      /** Optional FK to the job that did the work */
      jobId: z.number().int().positive().optional(),
      /** Optional notes appended to the asset's notes field */
      noteAddition: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const existing = await getCustomerAssetById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });

      const servicedOn = input.servicedOn ?? new Date().toISOString().slice(0, 10);
      const interval = existing.serviceIntervalMonths;
      const nextDue = interval ? addMonths(servicedOn, interval) : null;
      const newNotes = input.noteAddition && existing.notes
        ? `${existing.notes}\n\n[${servicedOn}] ${input.noteAddition}`
        : input.noteAddition
          ? `[${servicedOn}] ${input.noteAddition}`
          : existing.notes;

      await updateCustomerAsset(input.id, {
        lastServicedAt: servicedOn,
        nextServiceDueAt: nextDue,
        lastJobId: input.jobId ?? existing.lastJobId,
        notes: newNotes,
      });
      return { success: true, nextServiceDueAt: nextDue };
    }),

  markDecommissioned: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const existing = await getCustomerAssetById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
      await updateCustomerAsset(input.id, {
        status: "decommissioned",
        nextServiceDueAt: null,
      });
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const existing = await getCustomerAssetById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteCustomerAsset(input.id);
      return { success: true };
    }),
});
