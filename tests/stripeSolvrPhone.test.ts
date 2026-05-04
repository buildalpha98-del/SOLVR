/**
 * Tests for Solvr Phone add-on Stripe webhook handling.
 *
 * Covers the 7 state transitions required by spec (Task 5.4):
 *  1. trialing → active         (first invoice paid)
 *  2. active → past_due         (payment failed, retry grace period)
 *  3. past_due → active         (retry succeeded)
 *  4. past_due → unpaid         (retries exhausted)
 *  5. unpaid → active           (manual re-subscribe)
 *  6. any → canceled            (user cancelled or terminal)
 *  7. incomplete on create      (initial payment never succeeded)
 *
 * Also covers:
 *  - Events without metadata.product === "solvr_phone" do NOT touch
 *    clientPhoneNumbers (the AI Receptionist flow is not disrupted)
 *  - customer.subscription.created with solvr_phone metadata is handled
 *  - incomplete_expired maps to "incomplete"
 *  - trialing maps to "trial"
 *
 * Auth model: webhook signature verification is bypassed in tests by
 * leaving STRIPE_WEBHOOK_SECRET unset, which causes the handler to fall
 * through to raw JSON.parse of the body.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 5.4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import type Stripe from "stripe";

// ── Hoist mock factories ──────────────────────────────────────────────────────
const { mockGetDb, mockStripeCreate, mockRequirePortalWrite } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockStripeCreate: vi.fn(),
  mockRequirePortalWrite: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock("../server/db", () => ({ getDb: mockGetDb }));

// Suppress email sends from other webhook branches
vi.mock("../server/_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../server/routers/portalAuth", () => ({
  requirePortalAuth: vi.fn().mockResolvedValue({ client: { id: 77, isActive: true }, clientId: 77, role: "owner" }),
  requirePortalWrite: mockRequirePortalWrite,
}));

// Partial mock of server/stripe — keep everything real except getStripe so
// startSubscription tests can intercept the Stripe API call.
vi.mock("../server/stripe", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/stripe")>();
  return {
    ...original,
    getStripe: () => ({
      subscriptions: { create: mockStripeCreate },
    }),
  };
});

// ── Imports under test (after mocks) ─────────────────────────────────────────
import { handleStripeWebhook } from "../server/stripe";
import { phoneRouter, _resetTokenCache } from "../server/routers/phone";
import { _resetRateLimitBuckets } from "../server/_core/trpcRateLimit";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a Stripe subscription object for phone add-on events.
 */
function makePhoneSub(
  status: Stripe.Subscription.Status,
  subId = "sub_phone_test_001",
): Stripe.Subscription {
  return {
    id: subId,
    object: "subscription",
    status,
    metadata: { product: "solvr_phone", clientId: "42", clientPhoneNumberId: "7" },
    items: {
      data: [{ price: { id: "price_phone_39", product: "prod_phone" } }],
    } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
    customer: "cus_test_001",
  } as unknown as Stripe.Subscription;
}

/**
 * Build a fake Express Request for the webhook endpoint.
 * Event IDs must NOT start with "evt_test_" to avoid the early-exit guard.
 */
let _evtCounter = 0;
function makeWebhookReq(
  eventType: string,
  dataObject: unknown,
): Request {
  const event: Stripe.Event = {
    id: `evt_phone_${++_evtCounter}`,
    object: "event",
    type: eventType as Stripe.Event["type"],
    data: { object: dataObject as Stripe.Event.Data["object"] },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    api_version: "2023-10-16",
  };
  return {
    body: Buffer.from(JSON.stringify(event)),
    headers: {},
  } as unknown as Request;
}

/** Build a mock Response that captures the final status. */
function makeRes(): Response & { _status: number } {
  const r = {
    _status: 200,
    status(code: number) { this._status = code; return this; },
    json(body: unknown) { return this; },
    send(body: unknown) { return this; },
  };
  return r as unknown as Response & { _status: number };
}

/**
 * Build a drizzle-like db mock where db.update().set() captures the value
 * passed to set() and makes it available via capturedSet.
 */
function makeWebhookDb() {
  let capturedSet: unknown = undefined;
  const db = {
    capturedSet: undefined as unknown,
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((val: unknown) => {
        capturedSet = val;
        db.capturedSet = val;
        return { where: vi.fn().mockResolvedValue({}) };
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(resolve([])),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue({}),
    }),
  };
  return db;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STRIPE_WEBHOOK_SECRET;
  _resetRateLimitBuckets();

  process.env.STRIPE_PRICE_ID_SOLVR_PHONE = "price_solvr_phone_test";

  mockRequirePortalWrite.mockResolvedValue({
    client: { id: 77, isActive: true, contactName: "Test Tradie" },
    clientId: 77,
    role: "owner",
  });

  mockStripeCreate.mockResolvedValue({
    id: "sub_new_001",
    status: "active",
    metadata: { product: "solvr_phone", clientId: "77", clientPhoneNumberId: "1" },
  });
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_ID_SOLVR_PHONE;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Webhook state-transition tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("handleStripeWebhook — Solvr Phone add-on state transitions", () => {

  async function fireEvent(
    type: string,
    sub: Stripe.Subscription,
  ) {
    const db = makeWebhookDb();
    mockGetDb.mockResolvedValue(db);
    const req = makeWebhookReq(type, sub);
    const res = makeRes();
    await handleStripeWebhook(req, res);
    return { db, res };
  }

  it("1. trialing → active: subscriptionStatus set to 'active'", async () => {
    const { db } = await fireEvent(
      "customer.subscription.updated",
      makePhoneSub("active"),
    );
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "active" });
  });

  it("2. active → past_due: subscriptionStatus set to 'past_due'", async () => {
    const { db } = await fireEvent(
      "customer.subscription.updated",
      makePhoneSub("past_due"),
    );
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "past_due" });
  });

  it("3. past_due → active (retry succeeded): subscriptionStatus set to 'active'", async () => {
    const { db } = await fireEvent(
      "customer.subscription.updated",
      makePhoneSub("active"),
    );
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "active" });
  });

  it("4. past_due → unpaid (retries exhausted): subscriptionStatus set to 'unpaid'", async () => {
    const { db } = await fireEvent(
      "customer.subscription.updated",
      makePhoneSub("unpaid"),
    );
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "unpaid" });
  });

  it("5. unpaid → active (manual re-subscribe): subscriptionStatus set to 'active'", async () => {
    const { db } = await fireEvent(
      "customer.subscription.updated",
      makePhoneSub("active"),
    );
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "active" });
  });

  it("6. any → canceled: subscriptionStatus set to 'cancelled' on subscription.deleted", async () => {
    const { db } = await fireEvent(
      "customer.subscription.deleted",
      makePhoneSub("canceled"),
    );
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "cancelled" });
  });

  it("7. incomplete on create: subscriptionStatus set to 'incomplete'", async () => {
    const { db } = await fireEvent(
      "customer.subscription.created",
      makePhoneSub("incomplete"),
    );
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "incomplete" });
  });

  it("incomplete_expired maps to 'incomplete'", async () => {
    const { db } = await fireEvent(
      "customer.subscription.updated",
      makePhoneSub("incomplete_expired"),
    );
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "incomplete" });
  });

  it("trialing status maps to 'trial'", async () => {
    const { db } = await fireEvent(
      "customer.subscription.updated",
      makePhoneSub("trialing"),
    );
    expect(db.capturedSet).toMatchObject({ subscriptionStatus: "trial" });
  });

  it("non-phone sub event does NOT set subscriptionStatus (AI Receptionist path)", async () => {
    const aiSub = {
      ...makePhoneSub("active"),
      metadata: { plan: "solvr_ai", clientId: "99" }, // no product: "solvr_phone"
    } as unknown as Stripe.Subscription;

    const db = makeWebhookDb();
    mockGetDb.mockResolvedValue(db);
    const req = makeWebhookReq("customer.subscription.updated", aiSub);
    const res = makeRes();

    await handleStripeWebhook(req, res);

    // The AI Receptionist path sets { status: ..., updatedAt: ... }, not { subscriptionStatus: ... }
    expect(db.capturedSet).not.toMatchObject({ subscriptionStatus: expect.anything() });
    expect(res._status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// phone.startSubscription mutation tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("phone.startSubscription — real Stripe wiring (Task 5.4)", () => {

  function makeSelectDb(rows: unknown[][]) {
    let callCount = 0;
    return {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        // Each .then() call consumes the next rows array
        then: (resolve: (v: unknown[]) => unknown) => {
          const result = rows[callCount] ?? [];
          callCount++;
          return Promise.resolve(resolve(result));
        },
      }),
    };
  }

  function makeUpdateDb() {
    const capturedSets: unknown[] = [];
    const db = {
      capturedSets,
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((val: unknown) => {
          capturedSets.push(val);
          return { where: vi.fn().mockResolvedValue({}) };
        }),
      }),
    };
    return db;
  }

  function makeCombinedDb(rows: unknown[][], captureSets = true) {
    const selectPart = makeSelectDb(rows);
    const updatePart = captureSets ? makeUpdateDb() : { update: vi.fn(), capturedSets: [] };
    return { ...selectPart, ...updatePart };
  }

  function makeCaller() {
    const ctx = { req: { headers: { cookie: "solvr_portal_session=test" } }, res: {}, user: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (phoneRouter as any).createCaller(ctx);
  }

  it("creates a Stripe subscription and updates clientPhoneNumbers row", async () => {
    const voiceRow = { stripeCustomerId: "cus_test_777" };
    const phoneRow = { id: 1, clientId: 77, subscriptionStatus: "incomplete", isActive: true };
    const db = makeCombinedDb([[voiceRow], [phoneRow]]);
    mockGetDb.mockResolvedValue(db);

    const result = await makeCaller().startSubscription({});

    expect(result.ok).toBe(true);
    expect(result.alreadyActive).toBe(false);
    expect(result.subscriptionId).toBe("sub_new_001");
    expect(result.subscriptionStatus).toBe("active");

    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_test_777",
        items: [{ price: "price_solvr_phone_test" }],
        metadata: expect.objectContaining({ product: "solvr_phone" }),
      })
    );

    expect(db.capturedSets[0]).toMatchObject({
      stripeSubscriptionId: "sub_new_001",
      subscriptionStatus: "active",
    });
  });

  it("idempotency — already active: returns alreadyActive=true, no Stripe call", async () => {
    const voiceRow = { stripeCustomerId: "cus_test_777" };
    const phoneRow = { id: 1, clientId: 77, subscriptionStatus: "active", isActive: true };
    const db = makeCombinedDb([[voiceRow], [phoneRow]]);
    mockGetDb.mockResolvedValue(db);

    const result = await makeCaller().startSubscription({});

    expect(result).toMatchObject({ ok: true, alreadyActive: true });
    expect(mockStripeCreate).not.toHaveBeenCalled();
    expect((db as unknown as { capturedSets: unknown[] }).capturedSets).toHaveLength(0);
  });

  it("idempotency — already trialling: returns alreadyActive=true, no Stripe call", async () => {
    const voiceRow = { stripeCustomerId: "cus_test_777" };
    const phoneRow = { id: 1, clientId: 77, subscriptionStatus: "trial", isActive: true };
    const db = makeCombinedDb([[voiceRow], [phoneRow]]);
    mockGetDb.mockResolvedValue(db);

    const result = await makeCaller().startSubscription({});

    expect(result).toMatchObject({ ok: true, alreadyActive: true });
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  it("throws PRECONDITION_FAILED when no Stripe customer found", async () => {
    const db = makeCombinedDb([[/* empty — no voice sub row */]]);
    mockGetDb.mockResolvedValue(db);

    await expect(makeCaller().startSubscription({})).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when no active phone number row", async () => {
    const voiceRow = { stripeCustomerId: "cus_test_777" };
    const db = makeCombinedDb([[voiceRow], [/* empty — no phone row */]]);
    mockGetDb.mockResolvedValue(db);

    await expect(makeCaller().startSubscription({})).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });
});
