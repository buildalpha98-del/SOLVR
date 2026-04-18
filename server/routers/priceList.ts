/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Price List router — CRUD + CSV import for a tradie's personal price catalogue.
 *
 * All procedures require a valid portal session (getPortalClient).
 * Items are scoped to the authenticated client — tradies can never
 * read or modify another client's price list.
 *
 * CSV Import (importCsv):
 *   Accepts a raw CSV string (max 200 rows). Columns are auto-detected using
 *   fuzzy header matching so tradies can upload Xero exports, Tradify exports,
 *   or their own spreadsheets without reformatting.
 *
 *   Supported column names (case-insensitive, spaces/underscores interchangeable):
 *     name / item / description / service / product
 *     unit / uom / unit_of_measure
 *     cost / cost_price / buy_price / purchase_price
 *     sell / sell_price / sale_price / unit_price / price / rate / amount
 *     category / type / group
 *
 *   Rows with no name or no valid sell price are skipped and reported back.
 *   Existing items are NOT replaced — the import is always additive.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../_core/trpc";
import { getPortalClient, requirePortalAuth, requirePortalWrite } from "../_core/portalAuth";
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

// ── CSV parsing helpers ───────────────────────────────────────────────────────

const MAX_CSV_ROWS = 200;

/**
 * Normalise a header string for fuzzy matching:
 * lowercase, strip spaces/underscores/hyphens/parens.
 */
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-()]/g, "");
}

/**
 * Find the first header index that matches any of the candidate patterns.
 */
function findCol(headers: string[], ...candidates: string[]): number {
  const normalised = headers.map(normaliseHeader);
  for (const c of candidates) {
    const idx = normalised.indexOf(normaliseHeader(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parse a dollar/cents string to integer cents.
 * Handles: "$95.00", "95", "95.5", "1,250.00", "0"
 * Returns null if unparseable or <= 0.
 */
function parseCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

/**
 * Map a raw category string to our enum values.
 * Falls back to "other" if unrecognised.
 */
function mapCategory(raw: string | undefined): "labour" | "materials" | "call_out" | "subcontractor" | "other" {
  if (!raw) return "other";
  const s = raw.toLowerCase().trim();
  if (s.includes("labour") || s.includes("labor") || s.includes("service") || s.includes("install")) return "labour";
  if (s.includes("material") || s.includes("supply") || s.includes("part") || s.includes("product")) return "materials";
  if (s.includes("call") || s.includes("callout") || s.includes("travel") || s.includes("fee")) return "call_out";
  if (s.includes("sub") || s.includes("contractor") || s.includes("outsource")) return "subcontractor";
  return "other";
}

/**
 * Parse a raw CSV string into rows of cells.
 * Handles quoted fields with embedded commas and newlines.
 */
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let inQuote = false;
    let cell = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

// ── Procedures ────────────────────────────────────────────────────────────────

export const priceListRouter = {
  /**
   * List all active price list items for the authenticated tradie.
   * Returns items sorted by category → sortOrder → name.
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const portalAuth = await requirePortalAuth(ctx.req);
    return listPriceListItems(portalAuth.client.id);
  }),

  /**
   * Create a new price list item.
   */
  create: publicProcedure
    .input(priceListItemInput)
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
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
      const portalAuth = await requirePortalWrite(ctx.req);
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
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;

      const existing = await getPriceListItem(input.id, clientId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Price list item not found" });

      await deletePriceListItem(input.id, clientId);
      return { success: true };
    }),

  /**
   * Import price list items from a CSV string.
   *
   * The CSV is parsed server-side so the client only needs to read the file
   * and send the raw text — no preprocessing required.
   *
   * Returns:
   *   imported: number of rows successfully inserted
   *   skipped:  array of { row, reason } for rows that were skipped
   */
  importCsv: publicProcedure
    .input(
      z.object({
        /** Raw CSV text — max 50 KB */
        csv: z.string().min(1).max(50_000),
        /**
         * If true, delete all existing items before importing.
         * Defaults to false (additive import).
         */
        replace: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;

      const rows = parseCsvRows(input.csv);
      if (rows.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV must have at least a header row and one data row.",
        });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1, MAX_CSV_ROWS + 1);

      // Detect column positions
      const nameIdx    = findCol(headers, "name", "item", "description", "service", "product", "item name", "item description");
      const unitIdx    = findCol(headers, "unit", "uom", "unit of measure", "unitofmeasure");
      const costIdx    = findCol(headers, "cost", "cost price", "buy price", "purchase price", "costprice", "buyprice");
      const sellIdx    = findCol(headers, "sell", "sell price", "sale price", "unit price", "price", "rate", "amount", "sellprice", "saleprice", "unitprice");
      const categoryIdx = findCol(headers, "category", "type", "group", "item type");
      const descIdx    = nameIdx !== -1 ? findCol(headers, "notes", "details", "memo", "item description") : -1;

      if (nameIdx === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not find a 'Name' column. Expected a column named: Name, Item, Service, or Product.",
        });
      }
      if (sellIdx === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not find a 'Price' column. Expected a column named: Price, Sell Price, Unit Price, Rate, or Amount.",
        });
      }

      // If replacing, soft-delete all existing items first
      if (input.replace) {
        const existing = await listPriceListItems(clientId);
        await Promise.all(existing.map((item) => deletePriceListItem(item.id, clientId)));
      }

      const skipped: Array<{ row: number; reason: string }> = [];
      let imported = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2; // 1-indexed, accounting for header

        const name = row[nameIdx]?.trim();
        if (!name) {
          skipped.push({ row: rowNum, reason: "Empty name — row skipped." });
          continue;
        }

        const sellCents = parseCents(row[sellIdx]);
        if (!sellCents || sellCents <= 0) {
          skipped.push({ row: rowNum, reason: `"${name}" — missing or zero sell price.` });
          continue;
        }

        const costCents = costIdx !== -1 ? parseCents(row[costIdx]) : null;
        const unit = unitIdx !== -1 && row[unitIdx]?.trim() ? row[unitIdx].trim() : "each";
        const category = mapCategory(categoryIdx !== -1 ? row[categoryIdx] : undefined);
        // Use a separate description column if found; otherwise leave null
        const description = descIdx !== -1 && row[descIdx]?.trim() ? row[descIdx].trim() : null;

        await insertPriceListItem({
          clientId,
          name,
          description,
          unit,
          category,
          costCents: costCents ?? null,
          sellCents,
          isActive: true,
          sortOrder: imported,
        });

        imported++;
      }

      return { imported, skipped };
    }),
};
