/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Invoice Chasing Router
 *
 * Uses the same portal session cookie pattern as portal.ts —
 * all portal procedures resolve clientId via getPortalClient().
 *
 * Portal procedures (client-facing):
 *   invoiceChasing.list         — list all chases for the logged-in portal client
 *   invoiceChasing.create       — create a new invoice chase
 *   invoiceChasing.markPaid     — mark an invoice as paid (stops the chase)
 *   invoiceChasing.snooze       — snooze a chase until a given date
 *   invoiceChasing.cancel       — cancel a chase entirely
 *   invoiceChasing.update       — update notes on a chase
 *
 * Admin procedures (console):
 *   adminInvoiceChasing.listAll — list all chases across all clients
 *   adminInvoiceChasing.stats   — aggregate stats (total outstanding, escalated count)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getCrmClientById, getPortalSessionBySessionToken, getDb } from "../db";
import { invoiceChases, crmClients, clientProfiles, paymentLinks } from "../../drizzle/schema";
import type { InsertInvoiceChase } from "../../drizzle/schema";
import { and, eq, desc, sum, count, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

const PORTAL_COOKIE = "solvr_portal_session";

function parseCookieHeader(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split(";").map(p => p.trim().split("=").map(decodeURIComponent))
  );
}

// ─── Shared helper: resolve portal client from cookie session ─────────────────

async function resolvePortalClient(req: unknown) {
  const r = req as { cookies?: Record<string, string>; headers?: Record<string, string | string[] | undefined> };
  let sessionToken: string | undefined;
  const rawHeader = (r.headers as Record<string, string | undefined>)?.cookie;
  if (rawHeader) {
    const parsed = parseCookieHeader(rawHeader);
    sessionToken = parsed[PORTAL_COOKIE];
  } else {
    sessionToken = r.cookies?.[PORTAL_COOKIE];
  }
  if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
  const session = await getPortalSessionBySessionToken(sessionToken);
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session not found." });
  if (session.sessionExpiresAt && new Date(session.sessionExpiresAt) < new Date()) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired." });
  }
  const client = await getCrmClientById(session.clientId);
  if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
  return client;
}

// ─── Shared input schemas ─────────────────────────────────────────────────────

const createChaseInput = z.object({
  quoteId: z.string().optional(),
  jobId: z.number().int().optional(),
  invoiceNumber: z.string().min(1).max(32),
  customerName: z.string().min(1).max(255),
  customerEmail: z.string().email().max(320),
  customerPhone: z.string().max(50).optional(),
  description: z.string().max(512).optional(),
  amountDue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid dollar amount"),
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional(),
});

// ─── Portal router (client-facing) ───────────────────────────────────────────

export const portalInvoiceChasingRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["active", "paid", "snoozed", "cancelled", "escalated", "all"]).default("all"),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const client = await resolvePortalClient(ctx.req);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions = [eq(invoiceChases.clientId, client.id)];
      if (input?.status && input.status !== "all") {
        conditions.push(eq(invoiceChases.status, input.status));
      }

      // LEFT JOIN payment_links so the UI knows whether a Pay Now link
      // exists and its current refund state — without making the client
      // round-trip per row.
      const rows = await db
        .select({
          chase: invoiceChases,
          paymentLinkToken: paymentLinks.token,
          paymentLinkAmountCents: paymentLinks.amountCents,
          paymentLinkRefundedCents: paymentLinks.refundedAmountCents,
          paymentLinkPaidAt: paymentLinks.paidAt,
          paymentLinkStatus: paymentLinks.status,
          paymentLinkPiId: paymentLinks.stripePaymentIntentId,
        })
        .from(invoiceChases)
        .leftJoin(paymentLinks, and(
          eq(paymentLinks.jobId, invoiceChases.jobId),
          eq(paymentLinks.clientId, invoiceChases.clientId),
        ))
        .where(and(...conditions))
        .orderBy(desc(invoiceChases.createdAt));

      // De-dup if a job somehow has multiple payment_links (rare — repeat
      // re-invoicing). Keep the most recent paid one, else the latest.
      const byChaseId = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        const prev = byChaseId.get(r.chase.id);
        if (!prev) { byChaseId.set(r.chase.id, r); continue; }
        const prevHasPaid = prev.paymentLinkStatus === "paid";
        const thisHasPaid = r.paymentLinkStatus === "paid";
        if (thisHasPaid && !prevHasPaid) byChaseId.set(r.chase.id, r);
      }

      return Array.from(byChaseId.values()).map(r => ({
        ...r.chase,
        paymentLinkToken: r.paymentLinkToken,
        paymentLinkAmountCents: r.paymentLinkAmountCents,
        paymentLinkRefundedCents: r.paymentLinkRefundedCents,
        paymentLinkPaidAt: r.paymentLinkPaidAt,
        paymentLinkStatus: r.paymentLinkStatus,
        // Whether a refund is possible: paid + has a payment intent + not fully refunded
        canRefund: !!(r.paymentLinkPiId && r.paymentLinkStatus === "paid" &&
          (r.paymentLinkRefundedCents ?? 0) < (r.paymentLinkAmountCents ?? 0)),
      }));
    }),

  create: publicProcedure
    .input(createChaseInput)
    .mutation(async ({ ctx, input }) => {
      const client = await resolvePortalClient(ctx.req);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const dueDate = new Date(input.dueDate);
      const nextChaseAt = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000);
      const newId = randomUUID();

      const newChase: InsertInvoiceChase = {
        id: newId,
        clientId: client.id,
        quoteId: input.quoteId ?? null,
        jobId: input.jobId ?? null,
        invoiceNumber: input.invoiceNumber,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone ?? null,
        description: input.description ?? null,
        amountDue: input.amountDue,
        issuedAt: new Date(input.issuedAt),
        dueDate: dueDate,
        status: "active",
        chaseCount: 0,
        nextChaseAt,
        notes: input.notes ?? null,
      };

      await db.insert(invoiceChases).values(newChase);

      return { id: newId, success: true };
    }),

  markPaid: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      amountReceived: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await resolvePortalClient(ctx.req);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [chase] = await db
        .select({ clientId: invoiceChases.clientId })
        .from(invoiceChases)
        .where(and(eq(invoiceChases.id, input.id), eq(invoiceChases.clientId, client.id)))
        .limit(1);

      if (!chase) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice chase not found" });

      await db
        .update(invoiceChases)
        .set({
          status: "paid",
          paidAt: new Date(),
          nextChaseAt: null,
          amountReceived: input.amountReceived ?? null,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(invoiceChases.id, input.id));

      return { success: true };
    }),

  snooze: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      snoozeUntil: z.string().datetime(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await resolvePortalClient(ctx.req);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [chase] = await db
        .select({ clientId: invoiceChases.clientId })
        .from(invoiceChases)
        .where(and(eq(invoiceChases.id, input.id), eq(invoiceChases.clientId, client.id)))
        .limit(1);

      if (!chase) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice chase not found" });

      const snoozeUntil = new Date(input.snoozeUntil);
      await db
        .update(invoiceChases)
        .set({
          status: "snoozed",
          snoozeUntil,
          nextChaseAt: snoozeUntil,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(invoiceChases.id, input.id));

      return { success: true };
    }),

  cancel: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await resolvePortalClient(ctx.req);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [chase] = await db
        .select({ clientId: invoiceChases.clientId })
        .from(invoiceChases)
        .where(and(eq(invoiceChases.id, input.id), eq(invoiceChases.clientId, client.id)))
        .limit(1);

      if (!chase) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice chase not found" });

      await db
        .update(invoiceChases)
        .set({
          status: "cancelled",
          nextChaseAt: null,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(invoiceChases.id, input.id));

      return { success: true };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      notes: z.string().max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await resolvePortalClient(ctx.req);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [chase] = await db
        .select({ clientId: invoiceChases.clientId })
        .from(invoiceChases)
        .where(and(eq(invoiceChases.id, input.id), eq(invoiceChases.clientId, client.id)))
        .limit(1);

      if (!chase) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice chase not found" });

      await db
        .update(invoiceChases)
        .set({ notes: input.notes, updatedAt: new Date() })
        .where(eq(invoiceChases.id, input.id));

      return { success: true };
    }),

  summary: publicProcedure.query(async ({ ctx }) => {
    const client = await resolvePortalClient(ctx.req);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [activeStats] = await db
      .select({ totalOutstanding: sum(invoiceChases.amountDue), activeCount: count() })
      .from(invoiceChases)
      .where(and(eq(invoiceChases.clientId, client.id), eq(invoiceChases.status, "active")));

    const [escalatedStats] = await db
      .select({ escalatedCount: count() })
      .from(invoiceChases)
      .where(and(eq(invoiceChases.clientId, client.id), eq(invoiceChases.status, "escalated")));

    const [paidStats] = await db
      .select({ paidCount: count(), totalCollected30d: sum(invoiceChases.amountReceived) })
      .from(invoiceChases)
      .where(and(
        eq(invoiceChases.clientId, client.id),
        eq(invoiceChases.status, "paid"),
        gte(invoiceChases.paidAt, thirtyDaysAgo),
      ));

    return {
      activeCount: Number(activeStats?.activeCount ?? 0),
      escalatedCount: Number(escalatedStats?.escalatedCount ?? 0),
      totalOutstanding: activeStats?.totalOutstanding ?? "0",
      paidCount30d: Number(paidStats?.paidCount ?? 0),
      totalCollected30d: paidStats?.totalCollected30d ?? "0",
      avgDaysToPay: null as number | null,
    };
  }),

  /**
   * Export invoices as Xero-compatible CSV.
   * Returns a CSV string that can be imported directly into Xero > Business > Invoices > Import.
   * Format: ContactName, EmailAddress, InvoiceNumber, InvoiceDate, DueDate, Description, Quantity, UnitAmount, AccountCode, TaxType, Total
   */
  exportXeroCsv: publicProcedure
    .input(z.object({
      status: z.enum(["active", "paid", "snoozed", "cancelled", "escalated", "all"]).default("all"),
    }).optional())
    .query(async ({ ctx, input }) => {
      const client = await resolvePortalClient(ctx.req);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [eq(invoiceChases.clientId, client.id)];
      const statusFilter = input?.status ?? "all";
      if (statusFilter !== "all") {
        conditions.push(eq(invoiceChases.status, statusFilter));
      }

      const chases = await db
        .select()
        .from(invoiceChases)
        .where(and(...conditions))
        .orderBy(desc(invoiceChases.issuedAt));

      if (chases.length === 0) {
        return { csv: "", count: 0 };
      }

      // Xero CSV header
      const headers = [
        "*ContactName",
        "EmailAddress",
        "*InvoiceNumber",
        "*InvoiceDate",
        "*DueDate",
        "*Description",
        "*Quantity",
        "*UnitAmount",
        "*AccountCode",
        "TaxType",
        "Currency",
      ];

      const rows: string[][] = [];
      for (const chase of chases) {
        // Each invoice becomes one row (single line item = total amount)
        // GST is 10% of the total in Australia
        const total = parseFloat(chase.amountDue) || 0;
        const exGst = (total / 1.1).toFixed(2);

        rows.push([
          escapeCsvField(chase.customerName),
          escapeCsvField(chase.customerEmail),
          escapeCsvField(chase.invoiceNumber),
          formatXeroDate(chase.issuedAt),
          formatXeroDate(chase.dueDate),
          escapeCsvField(chase.description ?? `Invoice ${chase.invoiceNumber}`),
          "1",
          exGst,
          "200", // Xero default: Sales account code
          "GST on Income",
          "AUD",
        ]);
      }

      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      return { csv, count: chases.length };
    }),
});

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatXeroDate(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`; // DD/MM/YYYY for Australian Xero
}

// ─── Admin router (console-facing) ───────────────────────────────────────────

export const adminInvoiceChasingRouter = router({
  listAll: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "paid", "snoozed", "cancelled", "escalated", "all"]).default("all"),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions = input?.status && input.status !== "all"
        ? [eq(invoiceChases.status, input.status)]
        : [];

      return db
        .select({
          chase: invoiceChases,
          clientBusinessName: crmClients.businessName,
          clientEmail: crmClients.contactEmail,
          tradingName: clientProfiles.tradingName,
        })
        .from(invoiceChases)
        .leftJoin(crmClients, eq(invoiceChases.clientId, crmClients.id))
        .leftJoin(clientProfiles, eq(invoiceChases.clientId, clientProfiles.clientId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(invoiceChases.createdAt));
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [activeStats] = await db
      .select({
        totalOutstanding: sum(invoiceChases.amountDue),
        activeCount: count(),
      })
      .from(invoiceChases)
      .where(eq(invoiceChases.status, "active"));

    const [escalatedStats] = await db
      .select({ escalatedCount: count() })
      .from(invoiceChases)
      .where(eq(invoiceChases.status, "escalated"));

    const [paidStats] = await db
      .select({
        totalCollected: sum(invoiceChases.amountReceived),
        paidCount: count(),
      })
      .from(invoiceChases)
      .where(eq(invoiceChases.status, "paid"));

    return {
      totalOutstanding: activeStats?.totalOutstanding ?? "0",
      activeCount: Number(activeStats?.activeCount ?? 0),
      escalatedCount: Number(escalatedStats?.escalatedCount ?? 0),
      totalCollected: paidStats?.totalCollected ?? "0",
      paidCount: Number(paidStats?.paidCount ?? 0),
    };
  }),
});
