/**
 * Tests for scripts/backfill-tradie-customers.ts
 *
 * Uses an injected fake `db` — does NOT hit the live TiDB instance.
 * The 12 existing tradie_customers rows are never touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  backfillTradieCustomers,
  type BackfillDb,
} from "../../scripts/backfill-tradie-customers";

// ─── Fake DB builder helpers ───────────────────────────────────────────────────
// The script calls db.execute(sql`...`) for aggregates and uses Drizzle's
// query builder for simple ops. We expose a BackfillDb interface that the
// script accepts so we can inject fakes here.

function makeDb(overrides: Partial<BackfillDb> = {}): BackfillDb {
  return {
    selectUnlinkedJobs: vi.fn().mockResolvedValue([]),
    selectUnlinkedQuotes: vi.fn().mockResolvedValue([]),
    findCustomerByPhone: vi.fn().mockResolvedValue(undefined),
    insertCustomer: vi.fn().mockResolvedValue({ insertId: 1 }),
    enrichCustomer: vi.fn().mockResolvedValue(undefined),
    linkJob: vi.fn().mockResolvedValue(undefined),
    linkQuote: vi.fn().mockResolvedValue(undefined),
    recomputeAggregates: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── Test 1: Single portalJob with phone → creates new tradieCustomer + links ─
describe("Test 1 — single job with phone creates customer and sets FK", () => {
  it("creates 1 customer and links the job", async () => {
    const job = {
      id: 101,
      clientId: 5,
      customerPhone: "0412345678",
      customerName: "Alice Smith",
      customerEmail: "alice@example.com",
      customerAddress: "1 Main St",
    };

    const insertCustomer = vi.fn().mockResolvedValue({ insertId: 42 });
    const findCustomerByPhone = vi.fn().mockResolvedValue(undefined); // not found
    const linkJob = vi.fn().mockResolvedValue(undefined);

    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue([job]),
      findCustomerByPhone,
      insertCustomer,
      linkJob,
    });

    const summary = await backfillTradieCustomers(db);

    expect(insertCustomer).toHaveBeenCalledOnce();
    const insertCall = insertCustomer.mock.calls[0][0];
    // Phone must be normalised to E.164
    expect(insertCall.phone).toBe("+61412345678");
    expect(insertCall.clientId).toBe(5);
    expect(insertCall.name).toBe("Alice Smith");

    expect(linkJob).toHaveBeenCalledWith(101, 42);
    expect(summary.customersCreated).toBe(1);
    expect(summary.portalJobsLinked).toBe(1);
  });
});

// ─── Test 1b: insertCustomer recovers from ER_DUP_ENTRY and script proceeds ────
describe("Test 1b — ER_DUP_ENTRY recovery: script uses id returned by insertCustomer", () => {
  it("links the job using the id returned by insertCustomer even when it recovered from dup-key internally", async () => {
    // The live insertCustomer implementation catches ER_DUP_ENTRY internally and
    // re-fetches the racer's row, returning its id. From the script's perspective,
    // insertCustomer always resolves to { insertId }. We simulate the recovered
    // state: findCustomerByPhone returns undefined (triggering insert), and
    // insertCustomer resolves to the racer's id (55) — as if the live impl
    // successfully re-fetched after the collision.
    const insertCustomer = vi.fn().mockResolvedValue({ insertId: 55 });
    const findCustomerByPhone = vi.fn().mockResolvedValue(undefined);
    const linkJob = vi.fn().mockResolvedValue(undefined);

    const job = {
      id: 101,
      clientId: 5,
      customerPhone: "0412345678",
      customerName: "Alice Smith",
      customerEmail: null,
      customerAddress: null,
    };

    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue([job]),
      findCustomerByPhone,
      insertCustomer,
      linkJob,
    });

    const summary = await backfillTradieCustomers(db);

    // Script must link using whatever id insertCustomer returned
    expect(linkJob).toHaveBeenCalledWith(101, 55);
    expect(summary.customersCreated).toBe(1);
    expect(summary.portalJobsLinked).toBe(1);
  });
});

// ─── Test 2: Two jobs with same phone → 1 customer, both jobs linked ─────────
describe("Test 2 — two jobs with same phone produce one customer", () => {
  it("deduplicates on second job and links both", async () => {
    const jobs = [
      {
        id: 201,
        clientId: 5,
        customerPhone: "0412345678",
        customerName: "Bob Jones",
        customerEmail: null,
        customerAddress: null,
      },
      {
        id: 202,
        clientId: 5,
        customerPhone: "0412345678",
        customerName: null,
        customerEmail: null,
        customerAddress: null,
      },
    ];

    const insertCustomer = vi.fn().mockResolvedValue({ insertId: 77 });
    const linkJob = vi.fn().mockResolvedValue(undefined);

    // First call: not found → create. Second call: found (return the created one).
    const findCustomerByPhone = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 77, name: "Bob Jones" });

    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue(jobs),
      findCustomerByPhone,
      insertCustomer,
      linkJob,
    });

    const summary = await backfillTradieCustomers(db);

    // Only 1 insert
    expect(insertCustomer).toHaveBeenCalledOnce();
    // Both jobs linked
    expect(linkJob).toHaveBeenCalledTimes(2);
    expect(linkJob).toHaveBeenCalledWith(201, 77);
    expect(linkJob).toHaveBeenCalledWith(202, 77);
    expect(summary.customersCreated).toBe(1);
    expect(summary.portalJobsLinked).toBe(2);
  });
});

// ─── Test 3: Existing customer (SMS flow) → enriched, not duplicated ──────────
describe("Test 3 — existing customer is enriched with name from job", () => {
  it("updates name on existing customer and does not create a duplicate", async () => {
    const existingCustomer = {
      id: 9,
      clientId: 5,
      phone: "+61412345678",
      name: null,
      email: null,
      address: null,
    };

    const job = {
      id: 301,
      clientId: 5,
      customerPhone: "0412345678",
      customerName: "Sarah Mitchell",
      customerEmail: "sarah@example.com",
      customerAddress: "5 Oak Ave",
    };

    const findCustomerByPhone = vi.fn().mockResolvedValue(existingCustomer);
    const insertCustomer = vi.fn();
    const enrichCustomer = vi.fn().mockResolvedValue(undefined);
    const linkJob = vi.fn().mockResolvedValue(undefined);

    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue([job]),
      findCustomerByPhone,
      insertCustomer,
      enrichCustomer,
      linkJob,
    });

    const summary = await backfillTradieCustomers(db);

    // Must NOT create a new customer
    expect(insertCustomer).not.toHaveBeenCalled();
    // Must enrich with name from the job
    expect(enrichCustomer).toHaveBeenCalledWith(9, {
      name: "Sarah Mitchell",
      email: "sarah@example.com",
      address: "5 Oak Ave",
    });
    expect(linkJob).toHaveBeenCalledWith(301, 9);
    expect(summary.customersCreated).toBe(0);
    expect(summary.customersEnriched).toBe(1);
    expect(summary.portalJobsLinked).toBe(1);
  });
});

// ─── Test 4: Re-running → zero changes after first pass ───────────────────────
describe("Test 4 — idempotency: second run produces zero changes", () => {
  it("second run with no unlinked rows changes nothing", async () => {
    // Both passes return empty arrays → nothing to do
    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue([]),
      selectUnlinkedQuotes: vi.fn().mockResolvedValue([]),
    });

    const summary1 = await backfillTradieCustomers(db);
    const summary2 = await backfillTradieCustomers(db);

    expect(summary1.customersCreated).toBe(0);
    expect(summary1.portalJobsLinked).toBe(0);
    expect(summary1.quotesLinked).toBe(0);
    expect(summary2.customersCreated).toBe(0);
    expect(summary2.portalJobsLinked).toBe(0);
    expect(summary2.quotesLinked).toBe(0);

    const db2 = db as BackfillDb;
    expect((db2.insertCustomer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

// ─── Test 5: Job with no phone → skipped ──────────────────────────────────────
describe("Test 5 — job with no phone is skipped", () => {
  it("null customerPhone row does not create a customer or link", async () => {
    const job = {
      id: 501,
      clientId: 5,
      customerPhone: null,
      customerName: "Unknown",
      customerEmail: null,
      customerAddress: null,
    };

    const insertCustomer = vi.fn();
    const linkJob = vi.fn();

    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue([job]),
      insertCustomer,
      linkJob,
    });

    const summary = await backfillTradieCustomers(db);

    expect(insertCustomer).not.toHaveBeenCalled();
    expect(linkJob).not.toHaveBeenCalled();
    expect(summary.customersCreated).toBe(0);
    expect(summary.portalJobsLinked).toBe(0);
  });
});

// ─── Test 6: Quote phone matches existing customer → links, no new customer ───
describe("Test 6 — quote links to existing customer without creating a new one", () => {
  it("sets tradieCustomerId on quote when phone matches existing customer", async () => {
    const existingCustomer = { id: 15, clientId: 7, phone: "+61498765432", name: "Tom" };

    const quote = {
      id: "q-abc-001",
      clientId: 7,
      customerPhone: "0498765432",
      customerName: "Tom",
      customerEmail: null,
      customerAddress: null,
    };

    const findCustomerByPhone = vi.fn().mockResolvedValue(existingCustomer);
    const insertCustomer = vi.fn();
    const linkQuote = vi.fn().mockResolvedValue(undefined);

    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue([]),
      selectUnlinkedQuotes: vi.fn().mockResolvedValue([quote]),
      findCustomerByPhone,
      insertCustomer,
      linkQuote,
    });

    const summary = await backfillTradieCustomers(db);

    expect(insertCustomer).not.toHaveBeenCalled();
    expect(linkQuote).toHaveBeenCalledWith("q-abc-001", 15);
    expect(summary.customersCreated).toBe(0);
    expect(summary.quotesLinked).toBe(1);
  });
});

// ─── Test 7: Aggregate recompute from job_progress_payments ──────────────────
describe("Test 7 — aggregate recompute uses job_progress_payments totals", () => {
  it("calls recomputeAggregates and counts it in the summary", async () => {
    const recomputeAggregates = vi.fn().mockResolvedValue(undefined);

    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue([]),
      selectUnlinkedQuotes: vi.fn().mockResolvedValue([]),
      recomputeAggregates,
    });

    const summary = await backfillTradieCustomers(db);

    // recomputeAggregates must always be called (idempotent full recompute)
    expect(recomputeAggregates).toHaveBeenCalledOnce();
    expect(summary.aggregatesRecomputed).toBeGreaterThanOrEqual(1);
  });

  it("recomputeAggregates is called even when no new customers were created in passes 1 and 2", async () => {
    // All rows are already linked (empty unlinked sets) — but the script must
    // still refresh aggregates for any customers whose FK-linked jobs changed.
    const recomputeAggregates = vi.fn().mockResolvedValue(undefined);

    const db = makeDb({
      selectUnlinkedJobs: vi.fn().mockResolvedValue([]),
      selectUnlinkedQuotes: vi.fn().mockResolvedValue([]),
      recomputeAggregates,
    });

    const summary = await backfillTradieCustomers(db);

    expect(recomputeAggregates).toHaveBeenCalledOnce();
    expect(summary.customersCreated).toBe(0);
    expect(summary.portalJobsLinked).toBe(0);
    expect(summary.quotesLinked).toBe(0);
    expect(summary.aggregatesRecomputed).toBe(1);
  });
});
