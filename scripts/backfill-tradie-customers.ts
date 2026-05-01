/**
 * Backfill script — links existing portal_jobs and quotes rows to
 * tradie_customers by phone-matching, then recomputes aggregate columns.
 *
 * IDEMPOTENCY GUARANTEES
 * ─────────────────────
 * • Pass 1 (portal_jobs): WHERE tradieCustomerId IS NULL — only touches
 *   unlinked rows. Running twice skips everything already linked.
 * • Pass 2 (quotes):      same WHERE tradieCustomerId IS NULL guard.
 * • Unique index tradie_customers(clientId, phone) prevents duplicate
 *   customer rows even if the script somehow ran concurrently.
 * • Pass 3 (aggregates):  full recompute — always produces the correct
 *   result regardless of prior state (idempotent by design).
 *
 * Run during the V2 deploy AFTER the schema migration (0080) is applied.
 * DO NOT run this against the dev TiDB in tests — use the injected db
 * interface (BackfillDb) so tests can pass fake implementations.
 *
 * Usage: pnpm tsx scripts/backfill-tradie-customers.ts
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 2.2)
 */

import { normalisePhone } from "../server/lib/phoneNumber";
import { getDb } from "../server/db";
import {
  portalJobs,
  quotes,
  tradieCustomers,
  jobProgressPayments,
} from "../drizzle/schema";
import { isNull, eq, and, isNotNull, sql, max, count, sum } from "drizzle-orm";

// ─── Public interface (injected for tests) ────────────────────────────────────

export interface UnlinkedJob {
  id: number;
  clientId: number;
  customerPhone: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
}

export interface UnlinkedQuote {
  id: string;
  clientId: number;
  customerPhone: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
}

export interface FoundCustomer {
  id: number;
  clientId: number;
  phone: string | null;
  name: string | null;
  email?: string | null;
  address?: string | null;
}

export interface InsertCustomerInput {
  clientId: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

export interface EnrichFields {
  name?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface AggregateData {
  jobCount: number;
  totalSpentCents: number;
  lastJobAt: Date | null;
}

/**
 * Injectable DB interface — the live implementation calls Drizzle/TiDB,
 * the test implementation uses vi.fn() stubs.
 */
export interface BackfillDb {
  selectUnlinkedJobs(): Promise<UnlinkedJob[]>;
  selectUnlinkedQuotes(): Promise<UnlinkedQuote[]>;
  findCustomerByPhone(clientId: number, normalisedPhone: string): Promise<FoundCustomer | undefined>;
  insertCustomer(input: InsertCustomerInput): Promise<{ insertId: number }>;
  enrichCustomer(customerId: number, fields: EnrichFields): Promise<void>;
  linkJob(jobId: number, customerId: number): Promise<void>;
  linkQuote(quoteId: string, customerId: number): Promise<void>;
  recomputeAggregates(): Promise<void>;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface BackfillSummary {
  customersCreated: number;
  customersEnriched: number;
  portalJobsLinked: number;
  quotesLinked: number;
  aggregatesRecomputed: number;
}

// ─── Core backfill function ───────────────────────────────────────────────────

/**
 * Runs the full backfill. Pass a `BackfillDb` implementation to use a
 * fake DB in tests; omit for the live TiDB run (builds the real impl).
 */
export async function backfillTradieCustomers(
  db?: BackfillDb,
): Promise<BackfillSummary> {
  const impl = db ?? (await buildLiveDb());

  const summary: BackfillSummary = {
    customersCreated: 0,
    customersEnriched: 0,
    portalJobsLinked: 0,
    quotesLinked: 0,
    aggregatesRecomputed: 0,
  };

  // ── PASS 1: portal_jobs ──────────────────────────────────────────────────────
  const unlinkedJobs = await impl.selectUnlinkedJobs();
  console.log(`[backfill] Pass 1: ${unlinkedJobs.length} unlinked portal_jobs`);

  for (const job of unlinkedJobs) {
    // Skip rows with no usable phone
    if (!job.customerPhone || !job.customerPhone.trim()) continue;

    const normPhone = normalisePhone(job.customerPhone.trim());
    if (!normPhone) continue;

    // Find or create the customer record
    let customer = await impl.findCustomerByPhone(job.clientId, normPhone);

    if (!customer) {
      // Create new customer — name is required by schema, fall back to phone
      const result = await impl.insertCustomer({
        clientId: job.clientId,
        name: job.customerName ?? normPhone,
        phone: normPhone,
        email: job.customerEmail ?? null,
        address: job.customerAddress ?? null,
      });
      customer = { id: result.insertId, clientId: job.clientId, phone: normPhone, name: job.customerName };
      summary.customersCreated++;
    } else {
      // Enrich blank fields on existing customer (e.g. SMS-flow rows with name=NULL)
      const enrichFields: EnrichFields = {};
      if (!customer.name && job.customerName) enrichFields.name = job.customerName;
      if (!customer.email && job.customerEmail) enrichFields.email = job.customerEmail;
      if (!customer.address && job.customerAddress) enrichFields.address = job.customerAddress;

      if (Object.keys(enrichFields).length > 0) {
        await impl.enrichCustomer(customer.id, enrichFields);
        summary.customersEnriched++;
      }
    }

    await impl.linkJob(job.id, customer.id);
    summary.portalJobsLinked++;
  }

  // ── PASS 2: quotes ────────────────────────────────────────────────────────────
  const unlinkedQuotes = await impl.selectUnlinkedQuotes();
  console.log(`[backfill] Pass 2: ${unlinkedQuotes.length} unlinked quotes`);

  for (const quote of unlinkedQuotes) {
    if (!quote.customerPhone || !quote.customerPhone.trim()) continue;

    const normPhone = normalisePhone(quote.customerPhone.trim());
    if (!normPhone) continue;

    let customer = await impl.findCustomerByPhone(quote.clientId, normPhone);

    if (!customer) {
      // Create customer from quote data — Pass 1 may not have seen this phone
      const result = await impl.insertCustomer({
        clientId: quote.clientId,
        name: quote.customerName ?? normPhone,
        phone: normPhone,
        email: quote.customerEmail ?? null,
        address: quote.customerAddress ?? null,
      });
      customer = { id: result.insertId, clientId: quote.clientId, phone: normPhone, name: quote.customerName };
      summary.customersCreated++;
    }
    // No enrichment in Pass 2 — Pass 1 already handled any existing customers.

    await impl.linkQuote(quote.id, customer.id);
    summary.quotesLinked++;
  }

  // ── PASS 3: aggregate recompute ───────────────────────────────────────────────
  // Runs across ALL tradie_customers (not just newly created) to ensure
  // jobCount / totalSpentCents / lastJobAt are always correct after this run.
  // totalSpentCents = SUM(amountCents) from job_progress_payments joined to
  // portal_jobs — NOT from invoices (that table does not exist in this schema).
  console.log("[backfill] Pass 3: recomputing aggregates");
  await impl.recomputeAggregates();
  summary.aggregatesRecomputed = 1;

  console.log("[backfill] Summary:", summary);
  return summary;
}

// ─── Live DB implementation ───────────────────────────────────────────────────

async function buildLiveDb(): Promise<BackfillDb> {
  const db = await getDb();
  if (!db) throw new Error("[backfill] Database not available — is DATABASE_URL set?");

  return {
    async selectUnlinkedJobs(): Promise<UnlinkedJob[]> {
      return db
        .select({
          id: portalJobs.id,
          clientId: portalJobs.clientId,
          customerPhone: portalJobs.customerPhone,
          customerName: portalJobs.customerName,
          customerEmail: portalJobs.customerEmail,
          customerAddress: portalJobs.customerAddress,
        })
        .from(portalJobs)
        .where(
          and(
            isNull(portalJobs.tradieCustomerId),
            isNotNull(portalJobs.customerPhone),
          ),
        );
    },

    async selectUnlinkedQuotes(): Promise<UnlinkedQuote[]> {
      return db
        .select({
          id: quotes.id,
          clientId: quotes.clientId,
          customerPhone: quotes.customerPhone,
          customerName: quotes.customerName,
          customerEmail: quotes.customerEmail,
          customerAddress: quotes.customerAddress,
        })
        .from(quotes)
        .where(
          and(
            isNull(quotes.tradieCustomerId),
            isNotNull(quotes.customerPhone),
          ),
        );
    },

    async findCustomerByPhone(
      clientId: number,
      normalisedPhone: string,
    ): Promise<FoundCustomer | undefined> {
      const rows = await db
        .select({
          id: tradieCustomers.id,
          clientId: tradieCustomers.clientId,
          phone: tradieCustomers.phone,
          name: tradieCustomers.name,
          email: tradieCustomers.email,
          address: tradieCustomers.address,
        })
        .from(tradieCustomers)
        .where(
          and(
            eq(tradieCustomers.clientId, clientId),
            eq(tradieCustomers.phone, normalisedPhone),
          ),
        )
        .limit(1);
      return rows[0];
    },

    async insertCustomer(input: InsertCustomerInput): Promise<{ insertId: number }> {
      const result = await db.insert(tradieCustomers).values({
        clientId: input.clientId,
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        address: input.address ?? null,
        jobCount: 0,
        totalSpentCents: 0,
      });
      return { insertId: Number((result as any)[0]?.insertId ?? 0) };
    },

    async enrichCustomer(customerId: number, fields: EnrichFields): Promise<void> {
      const update: Record<string, unknown> = {};
      if (fields.name != null) update.name = fields.name;
      if (fields.email != null) update.email = fields.email;
      if (fields.address != null) update.address = fields.address;
      if (Object.keys(update).length === 0) return;
      await db
        .update(tradieCustomers)
        .set(update)
        .where(eq(tradieCustomers.id, customerId));
    },

    async linkJob(jobId: number, customerId: number): Promise<void> {
      await db
        .update(portalJobs)
        .set({ tradieCustomerId: customerId })
        .where(eq(portalJobs.id, jobId));
    },

    async linkQuote(quoteId: string, customerId: number): Promise<void> {
      await db
        .update(quotes)
        .set({ tradieCustomerId: customerId })
        .where(eq(quotes.id, quoteId));
    },

    async recomputeAggregates(): Promise<void> {
      // Raw SQL for the aggregate update — Drizzle's fluent API gets clunky
      // for the correlated SUM-with-JOIN subquery (TiDB MySQL dialect).
      // This matches the pattern used elsewhere in server/_core/usageTracking.ts.
      await db.execute(sql`
        UPDATE tradie_customers tc
        SET
          tc.jobCount = (
            SELECT COUNT(*)
            FROM portal_jobs pj
            WHERE pj.tradieCustomerId = tc.id
              AND pj.stage = 'completed'
          ),
          tc.totalSpentCents = COALESCE((
            SELECT SUM(jpp.amountCents)
            FROM job_progress_payments jpp
            INNER JOIN portal_jobs pj ON jpp.jobId = pj.id
            WHERE pj.tradieCustomerId = tc.id
          ), 0),
          tc.lastJobAt = (
            SELECT MAX(pj.completedAt)
            FROM portal_jobs pj
            WHERE pj.tradieCustomerId = tc.id
          )
      `);
    },
  };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

// ESM-compatible main check: tsx compiles to CJS for scripts, so we can use
// require.main. If migrated to pure ESM, replace with an import.meta.main check.
if (typeof require !== "undefined" && require.main === module) {
  backfillTradieCustomers()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[backfill] Fatal error:", e);
      process.exit(1);
    });
}
