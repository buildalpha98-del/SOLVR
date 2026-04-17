/**
 * Price List router — CRUD for a tradie's personal price catalogue.
 *
 * All procedures require a valid portal session (getPortalClient).
 * Items are scoped to the authenticated client — tradies can never
 * read or modify another client's price list.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../_core/trpc";
import { getPortalClient } from "../_core/portalAuth";
import {
  listPriceListItems,
  getPriceListItem,
  insertPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
} from "../db";

// ── Shared Zod schemas ────────────────────────────────────────────────────────

const categoryEnum = z.enum(["labour", "materials", "call_out", "subcontractor", "other"]);

const priceListItemInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullish(),
  unit: z.string().min(1).max(50).default("each"),
  category: categoryEnum.default("labour"),
  /** Cost price in cents — what the tradie pays. Nullable. */
  costCents: z.number().int().nonnegative().nullish(),
  /** Sell price in cents — what the customer is charged. Required. */
  sellCents: z.number().int().positive(),
  sortOrder: z.number().int().nonnegative().default(0),
});

// ── Procedures ────────────────────────────────────────────────────────────────

export const priceListRouter = {
  /**
   * List all active price list items for the authenticated tradie.
   * Returns items sorted by category → sortOrder → name.
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const portalAuth = await getPortalClient(ctx.req);
    if (!portalAuth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required" });
    return listPriceListItems(portalAuth.client.id);
  }),

  /**
   * Create a new price list item.
   */
  create: publicProcedure
    .input(priceListItemInput)
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await getPortalClient(ctx.req);
      if (!portalAuth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required" });
      const clientId = portalAuth.client.id;

      await insertPriceListItem({
        clientId,
        name: input.name,
        description: input.description ?? null,
        unit: input.unit,
        category: input.category,
        costCents: input.costCents ?? null,
        sellCents: input.sellCents,
        isActive: true,
        sortOrder: input.sortOrder,
      });

      return { success: true };
    }),

  /**
   * Update an existing price list item.
   * Only the owning client can update their own items.
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        ...priceListItemInput.partial().shape,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await getPortalClient(ctx.req);
      if (!portalAuth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required" });
      const clientId = portalAuth.client.id;

      const existing = await getPriceListItem(input.id, clientId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Price list item not found" });

      const { id, ...rest } = input;
      await updatePriceListItem(id, clientId, {
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.description !== undefined && { description: rest.description ?? null }),
        ...(rest.unit !== undefined && { unit: rest.unit }),
        ...(rest.category !== undefined && { category: rest.category }),
        ...(rest.costCents !== undefined && { costCents: rest.costCents ?? null }),
        ...(rest.sellCents !== undefined && { sellCents: rest.sellCents }),
        ...(rest.sortOrder !== undefined && { sortOrder: rest.sortOrder }),
      });

      return { success: true };
    }),

  /**
   * Soft-delete a price list item (sets isActive = false).
   */
  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await getPortalClient(ctx.req);
      if (!portalAuth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required" });
      const clientId = portalAuth.client.id;

      const existing = await getPriceListItem(input.id, clientId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Price list item not found" });

      await deletePriceListItem(input.id, clientId);
      return { success: true };
    }),
};
