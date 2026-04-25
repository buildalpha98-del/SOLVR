/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Customer-import router. Bulk-create tradie_customers rows from a CSV
 * uploaded by the tradie (typically a ServiceM8 / Tradify / MYOB export).
 *
 * Two-step flow:
 *   importCsv : the client has already parsed + previewed locally.
 *               Server validates each row, dedups against existing
 *               (clientId, phone) and (clientId, email) pairs, and
 *               batches the inserts.
 *
 * No schema change — uses the existing tradie_customers table.
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalWrite } from "./portalAuth";
import {
  listTradieCustomers,
  createTradieCustomer,
} from "../db";

/**
 * Permissive normaliser: trim, drop "(none)" / "n/a" placeholders, return
 * empty string for any falsy.
 */
function clean(value: string | null | undefined): string {
  if (!value) return "";
  const t = value.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower === "n/a" || lower === "(none)" || lower === "-" || lower === "—") return "";
  return t;
}

/**
 * Best-effort phone normalisation to E.164 AU format.
 * Handles 0412345678 → +61412345678, 61412345678 → +61412345678, etc.
 * Returns "" if it can't normalise to something we'd actually use.
 */
function normaliseAuPhone(raw: string): string {
  const t = clean(raw);
  if (!t) return "";
  const digits = t.replace(/\D/g, "");
  if (!digits) return "";
  if (t.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("61") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+61${digits.slice(1)}`;
  // Unrecognised — return as-is, the user can fix it later
  return t;
}

const customerRowSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(512).optional().or(z.literal("")),
  suburb: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(50).optional().or(z.literal("")),
  postcode: z.string().trim().max(10).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const customerImportRouter = router({
  /**
   * Bulk-import customers. Caller passes pre-parsed rows. Server:
   *   1. Validates each row against customerRowSchema (drops invalid).
   *   2. Normalises phones to E.164 AU.
   *   3. Loads existing customers ONCE to build a (phone, email) dedup set.
   *   4. Inserts new rows in batch (one per insert — small total volume,
   *      no transaction needed).
   *   5. Returns { imported, skippedDuplicate, skippedInvalid, errors }.
   */
  importCsv: publicProcedure
    .input(z.object({
      rows: z.array(z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        suburb: z.string().optional(),
        state: z.string().optional(),
        postcode: z.string().optional(),
        notes: z.string().optional(),
      })).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);

      // Pre-load the dedup keys once.
      const existing = await listTradieCustomers(client.id);
      const existingPhones = new Set(
        existing.map(c => c.phone ? normaliseAuPhone(c.phone) : "").filter(Boolean),
      );
      const existingEmails = new Set(
        existing.map(c => (c.email ?? "").toLowerCase()).filter(Boolean),
      );

      let imported = 0;
      let skippedDuplicate = 0;
      let skippedInvalid = 0;
      const errors: Array<{ rowIndex: number; reason: string }> = [];

      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const candidate = {
          name: clean(raw.name),
          email: clean(raw.email).toLowerCase(),
          phone: normaliseAuPhone(raw.phone ?? ""),
          address: clean(raw.address),
          suburb: clean(raw.suburb),
          state: clean(raw.state),
          postcode: clean(raw.postcode),
          notes: clean(raw.notes),
        };

        // Validate
        const parsed = customerRowSchema.safeParse(candidate);
        if (!parsed.success) {
          skippedInvalid++;
          errors.push({
            rowIndex: i,
            reason: parsed.error.issues[0]?.message ?? "Invalid row",
          });
          continue;
        }

        // A customer with no email AND no phone can't be contacted — skip.
        if (!candidate.email && !candidate.phone) {
          skippedInvalid++;
          errors.push({ rowIndex: i, reason: "No phone or email" });
          continue;
        }

        // Dedup against existing rows
        const phoneDup = candidate.phone && existingPhones.has(candidate.phone);
        const emailDup = candidate.email && existingEmails.has(candidate.email);
        if (phoneDup || emailDup) {
          skippedDuplicate++;
          continue;
        }

        try {
          await createTradieCustomer({
            clientId: client.id,
            name: candidate.name,
            email: candidate.email || null,
            phone: candidate.phone || null,
            address: candidate.address || null,
            suburb: candidate.suburb || null,
            state: candidate.state || null,
            postcode: candidate.postcode || null,
            notes: candidate.notes || null,
            jobCount: 0,
            totalSpentCents: 0,
            // Generate fresh unsubscribe tokens so bulk-SMS opt-out links work
            smsUnsubscribeToken: randomUUID().replace(/-/g, ""),
            emailUnsubscribeToken: randomUUID().replace(/-/g, ""),
          });
          // Update dedup sets so within-batch duplicates also skip
          if (candidate.phone) existingPhones.add(candidate.phone);
          if (candidate.email) existingEmails.add(candidate.email);
          imported++;
        } catch (err) {
          skippedInvalid++;
          errors.push({
            rowIndex: i,
            reason: err instanceof Error ? err.message.slice(0, 200) : "Insert failed",
          });
        }
      }

      return {
        imported,
        skippedDuplicate,
        skippedInvalid,
        totalProcessed: input.rows.length,
        // Cap errors returned to the client to keep the payload small
        errors: errors.slice(0, 50),
      };
    }),
});
