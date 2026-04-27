# Solvr Cloud Phone V2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Solvr Cloud Phone V2 — every Solvr-subscribed tradie gets a Twilio AU phone number that rings inside the iOS app like WhatsApp via a custom Capacitor plugin (CallKit + PushKit), records calls server-side, AI-routes the post-call action (Generate Quote / Add Note / Link to Job), and bills as a $39/month Stripe add-on.

**Architecture:** Three-layer split. (1) `@buildalpha/capacitor-voice` — Solvr-blind native plugin wrapping Twilio Voice iOS SDK + CallKit + PushKit + AVFoundation. (2) Solvr Capacitor app's JS layer — `useSolvrPhone` hook, Phone tab, post-call confirm sheet. (3) Solvr server — Twilio webhooks, AI pipeline (Whisper + GPT-4o), VoIP push delivery via APNs `.p12` cert, Stripe subscription wiring, Vapi handoff on no-answer. Full architecture in `docs/specs/2026-04-27-solvr-cloud-phone-design.md`.

**Tech Stack:** Capacitor 7, Swift, Twilio Voice iOS SDK (Cocoapod `twilio-voice-ios ~> 6.x`), CallKit, PushKit, Node.js, tRPC, Drizzle (MySQL), `apn` 2.x, Cloudflare R2, OpenAI Whisper + GPT-4o, Stripe, Vapi (existing).

**Source spec:** `docs/specs/2026-04-27-solvr-cloud-phone-design.md`

**Sequencing reminder:** This work begins AFTER iOS build 24 lands in the App Store. Do not block the QOL launch on V2.

---

## Pre-flight (read before starting)

You're picking up a 4–6 week native iOS project. Before any code:

1. Read the **full spec** at `docs/specs/2026-04-27-solvr-cloud-phone-design.md`. Especially: the 6 locked decisions, the three-layer split, the Vapi handoff via `phoneCallProviderId` reconciliation, and the pricing/cap mechanics.
2. Verify access to:
   - The Twilio account (existing — already used for SMS at `server/twilioInboundSms.ts`)
   - Apple Developer account with the ability to generate VoIP push certs
   - Cloudflare R2 (existing — `server/storage.ts`)
   - Stripe (existing)
   - The Solvr Vapi assistants config (existing — `server/vapi.ts`, per-tradie via `crmClients.vapiAgentId`)
3. Have an iPhone available for **physical-device testing**. PushKit + CallKit do not work in the iOS Simulator. Without a real device, the plugin cannot be validated.
4. Set up a TestFlight beta group with 2–3 willing tradies for Week 4 dogfooding.

5. **CRITICAL — Verify Vapi webhook payload exposes the Twilio call SID** *before any Chunk-4 work begins.* Spec §"Vapi handoff (corrected)" assumes Vapi's webhook payload includes `call.phoneCallProviderId` (the originating Twilio call SID). Reality-check this against staging Vapi:
   - Place a call to a Vapi-controlled number from your phone
   - Capture the webhook payload Vapi sends to `server/vapiWebhook.ts`
   - Confirm the Twilio call SID is present somewhere in the payload
   - **If absent**, switch to the `assistantOverrides.metadata` approach (spec §"Approach (V2.5 if Vapi's payload doesn't expose Twilio SID)") and rewrite Task 4.3 Step 2 before starting Chunk 4. This affects the entire handoff design.

If any of those is blocked, stop and resolve it. Don't write code waiting on dependencies.

---

## File structure preview

Files this plan creates or modifies, grouped by chunk. Reference the spec's "Files this design will touch" section for the canonical list.

### Chunk 1 — Pre-requisite refactors

- NEW: `server/lib/phoneNumber.ts`
- NEW: `server/lib/twilio.ts`
- NEW: `server/lib/transcription.ts`
- MOD: `server/twilioInboundSms.ts`
- MOD: `server/vapiTools.ts`
- MOD: `server/audioUpload.ts`
- MOD: `server/_core/voiceTranscription.ts`

### Chunk 2 — Schema + backfill

- MOD: `drizzle/schema.ts`
- NEW: `drizzle/migrations/00xx_solvr_cloud_phone.sql`
- NEW: `scripts/backfill-tradie-customers.ts`
- TESTS: `tests/scripts/backfill-tradie-customers.test.ts`

### Chunk 3 — Native Capacitor plugin (`@buildalpha/capacitor-voice`)

- NEW package: `packages/capacitor-voice/`
  - `package.json`, `tsconfig.json`, `BuildAlphaCapacitorVoice.podspec`
  - `src/index.ts`, `src/definitions.ts`, `src/web.ts`
  - `ios/Plugin/BuildAlphaVoicePlugin.swift`
  - `ios/Plugin/PushKitDelegate.swift`
  - `ios/Plugin/CallKitProvider.swift`
  - `ios/Plugin/TwilioVoiceClient.swift`
  - `ios/Plugin/Permissions.swift`
- TESTS: `packages/capacitor-voice/src/index.test.ts` (TS surface only — native bits tested on device)

### Chunk 4 — Twilio webhooks + Vapi handoff

- NEW: `server/webhooks/twilioVoice.ts`
- NEW: `server/_core/voipPush.ts`
- NEW: `server/_core/usageTracking.ts`
- MOD: `server/vapiWebhook.ts`
- MOD: `server/storage.ts` (call-recordings/ key prefix helper)
- TESTS: `tests/webhooks/twilioVoice.test.ts`, `tests/_core/voipPush.test.ts`

### Chunk 5 — AI pipeline + tRPC router + Stripe wiring

- NEW: `server/_core/callIntelligence.ts`
- NEW: `server/routers/phone.ts`
- MOD: `server/routers/customers.ts`
- MOD: `server/_core/index.ts` (register routes)
- MOD: `server/stripeWebhook.ts` (or wherever Stripe events are handled)
- TESTS: `tests/_core/callIntelligence.test.ts`, `tests/routers/phone.test.ts`

### Chunk 6 — JS hook + Phone tab + Customers tab

- NEW: `client/src/hooks/useSolvrPhone.ts`
- NEW: `client/src/pages/portal/PortalPhone.tsx`
- NEW: `client/src/pages/portal/PortalCallDetail.tsx`
- MOD: `client/src/pages/portal/PortalCustomers.tsx`
- MOD: `client/src/pages/portal/PortalLayout.tsx`
- TESTS: `client/src/hooks/useSolvrPhone.test.ts` (with mock plugin)

### Chunk 7 — In-call screen + post-call sheet + onboarding

- NEW: `client/src/components/phone/IncomingCallOverlay.tsx`
- NEW: `client/src/components/phone/InCallScreen.tsx`
- NEW: `client/src/components/phone/PostCallSheet.tsx`
- NEW: `client/src/components/phone/DialPad.tsx`
- NEW: `client/src/pages/portal/PhoneOnboardingWizard.tsx`
- MOD: `client/src/pages/portal/PortalJobDetail.tsx` (click-to-call)
- MOD: `client/src/pages/portal/QuoteListContent.tsx` (click-to-call)
- MOD: `capacitor.config.ts` (register plugin)
- MOD: `package.json` (add `@buildalpha/capacitor-voice`, `apn` 2.x)
- MOD: `ios/App/Podfile`

### Chunk 8 — Real-device testing + App Store submission

- New testing scripts under `scripts/qa/`
- TestFlight beta group setup
- App Store Connect submission with VoIP-aware metadata

---

## Chunk 1: Pre-requisite refactors

These three small extractions remove duplicate code and create the seams V2 needs. Do this as its own PR before the V2 main work — it's safe and stands alone.

**Skills referenced:**
- @superpowers:test-driven-development — extract under tests so behaviour can't drift
- Existing patterns in `server/twilioInboundSms.ts` and `server/_core/voiceTranscription.ts`

### Task 1.1: Extract `normalisePhone` to `server/lib/phoneNumber.ts`

**Files:**
- Create: `server/lib/phoneNumber.ts`
- Create: `tests/lib/phoneNumber.test.ts`
- Modify: `server/twilioInboundSms.ts:63` (remove the local definition + import from new location)
- Modify: `server/vapiTools.ts:120` (remove the duplicate + import from new location)

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/phoneNumber.test.ts
import { describe, it, expect } from "vitest";
import { normalisePhone } from "@/server/lib/phoneNumber";

describe("normalisePhone", () => {
  it("returns AU mobile with leading 0 unchanged", () => {
    expect(normalisePhone("0412345678")).toBe("0412345678");
  });
  it("converts +61 prefix to 0 prefix", () => {
    expect(normalisePhone("+61412345678")).toBe("0412345678");
  });
  it("strips spaces, parens, and dashes", () => {
    expect(normalisePhone("(04) 1234-5678")).toBe("0412345678");
  });
  it("strips +61 with internal spaces", () => {
    expect(normalisePhone("+61 4 1234 5678")).toBe("0412345678");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/lib/phoneNumber.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/lib/phoneNumber.ts`** by copying the logic from `server/twilioInboundSms.ts:63` verbatim, exporting `normalisePhone`. No behaviour change.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/lib/phoneNumber.test.ts
```
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Update callers** — replace the local `normalisePhone` definitions in `server/twilioInboundSms.ts` and `server/vapiTools.ts` with `import { normalisePhone } from "@/server/lib/phoneNumber"`. Run the existing test suite to confirm nothing else broke.

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/phoneNumber.ts tests/lib/phoneNumber.test.ts \
        server/twilioInboundSms.ts server/vapiTools.ts
git commit -m "refactor(server/lib): extract normalisePhone, dedupe SMS + Vapi callers"
```

### Task 1.2: Extract Twilio webhook signature validation to `server/lib/twilio.ts`

**Files:**
- Create: `server/lib/twilio.ts`
- Create: `tests/lib/twilio.test.ts`
- Modify: `server/twilioInboundSms.ts` (replace inline call to `twilio.validateRequest` with import from new module)

- [ ] **Step 1: Read existing inlined validation** at `server/twilioInboundSms.ts:284-293` to understand the signature header + URL hashing used.

- [ ] **Step 2: Write the failing test**

```ts
// tests/lib/twilio.test.ts
import { describe, it, expect } from "vitest";
import { validateTwilioSignature } from "@/server/lib/twilio";

describe("validateTwilioSignature", () => {
  it("returns true for a valid signature", () => {
    const result = validateTwilioSignature({
      authToken: "test-token",
      signature: "...",  // pre-computed via twilio.RequestClient
      url: "https://example.com/webhook",
      params: { From: "+61412345678" },
    });
    expect(result).toBe(true);
  });
  it("returns false for a tampered URL", () => { /* ... */ });
  it("returns false for missing signature header", () => { /* ... */ });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm vitest run tests/lib/twilio.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Implement `server/lib/twilio.ts`** wrapping `twilio.validateRequest` with a typed signature.

```ts
import twilio from "twilio";

export function validateTwilioSignature(opts: {
  authToken: string;
  signature: string | undefined;
  url: string;
  params: Record<string, string>;
}): boolean {
  if (!opts.signature) return false;
  return twilio.validateRequest(
    opts.authToken,
    opts.signature,
    opts.url,
    opts.params,
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm vitest run tests/lib/twilio.test.ts
```
Expected: PASS.

- [ ] **Step 6: Replace caller in `server/twilioInboundSms.ts`** with the new import. Run full test suite.

- [ ] **Step 7: Commit**

```bash
git add server/lib/twilio.ts tests/lib/twilio.test.ts server/twilioInboundSms.ts
git commit -m "refactor(server/lib): extract validateTwilioSignature for V2 reuse"
```

### Task 1.3: Extract Whisper transcription helper to `server/lib/transcription.ts`

**Files:**
- Create: `server/lib/transcription.ts`
- Create: `tests/lib/transcription.test.ts`
- Modify: `server/_core/voiceTranscription.ts` (re-export from `server/lib/transcription.ts` for back-compat) — or move callers directly
- Modify: `server/audioUpload.ts` (update import path)

- [ ] **Step 1: Read existing helper** at `server/_core/voiceTranscription.ts` to understand inputs/outputs.

- [ ] **Step 2: Write a failing test** with a small mock audio Buffer + mocked OpenAI client returning a known transcript.

- [ ] **Step 3: Run test, verify failure.**

- [ ] **Step 4: Move the helper to `server/lib/transcription.ts`**, exporting `transcribeAudio({ audioBuffer | audioUrl, language? })`. Keep the function signature identical.

- [ ] **Step 5: Update callers** — `server/audioUpload.ts` now imports from `lib/transcription.ts`. The old `server/_core/voiceTranscription.ts` either re-exports or is deleted (preference: delete).

- [ ] **Step 6: Run full test suite + Voice-to-Quote happy path manually** (record audio, hit `audioUpload`, verify transcript still extracted). The Voice-to-Quote pipeline must still work.

- [ ] **Step 7: Commit**

```bash
git add server/lib/transcription.ts tests/lib/transcription.test.ts \
        server/audioUpload.ts server/_core/voiceTranscription.ts
git commit -m "refactor(server/lib): extract transcribeAudio for V2 phone AI pipeline"
```

### Task 1.4: PR + merge

- [ ] **Step 1: Open PR** titled `refactor: extract server/lib helpers for Cloud Phone V2 pre-reqs`
- [ ] **Step 2: Land PR.** All three extractions merge together as the V2 prerequisite.
- [ ] **Step 3: Tag the merge commit** as `solvr-cloud-phone-prereqs-complete` for traceability.

---

## Chunk 2: Schema + backfill migration

This chunk lands the new tables, FK additions, and the idempotent backfill that promotes `tradieCustomers` to the central customer table.

**Skills referenced:**
- @superpowers:test-driven-development — backfill tests are critical (idempotency)
- @superpowers:writing-tests — the backfill tests should cover edge cases (duplicate phones, null names, phones from both `portalJobs` and `quotes`)

**Spec sections:** "Schema changes", "Backfill migration"

### Task 2.1: Add new tables + FK columns to `drizzle/schema.ts`

**Files:**
- Modify: `drizzle/schema.ts`

- [ ] **Step 1: Add `clientPhoneNumbers` table** — copy the Drizzle definition from spec §"Schema changes / New: `client_phone_numbers`" verbatim, including `subscriptionStatus` enum with all 6 Stripe states + usage counters (`inboundMinutesUsed`, `outboundMinutesUsed`, `billingCycleStart`).

- [ ] **Step 2: Add `callLogs` table** — copy definition from spec §"New: `call_logs`". Indexes: `(clientId, calledAt DESC)`, `(clientId, tradieCustomerId)`, unique `(twilioCallSid)`.

- [ ] **Step 3: Add `voipPushTokens` table** — copy definition from spec, **with one addition:** add a nullable column `regularApnsToken: varchar("regularApnsToken", { length: 500 })`. Both VoIP push tokens (`.p12` cert, used for ringing) and regular APNs tokens (`.p8` token-auth, used for post-call summary banners) live on the same row keyed by `(userId, deviceId)`. Don't rename the table — the historical name stays — but document in a comment that the table holds BOTH token types. The downstream `phone.registerVoipToken` mutation (Task 5.2) writes both columns when the plugin reports them.

- [ ] **Step 4: Add FK columns to `portalJobs` and `quotes`:**
  - `portalJobs.tradieCustomerId` (int, nullable)
  - `portalJobs.sourceCallLogId` (int, nullable)
  - `quotes.tradieCustomerId` (int, nullable)
  - `quotes.sourceCallLogId` (int, nullable)

- [ ] **Step 5: Add unique index on `tradieCustomers (clientId, phone)`.** Critical for the backfill's idempotency.

- [ ] **Step 6: Generate migration**

```bash
pnpm drizzle-kit generate
```
Verify the generated SQL covers all 5 changes. Adjust file name to be descriptive: `00xx_solvr_cloud_phone.sql`.

- [ ] **Step 7: Apply migration locally**

```bash
pnpm drizzle-kit migrate
```

- [ ] **Step 8: Commit**

```bash
git add drizzle/schema.ts drizzle/migrations/00xx_solvr_cloud_phone.sql
git commit -m "feat(schema): add client_phone_numbers, call_logs, voip_push_tokens + FK additions"
```

### Task 2.2: Write the idempotent backfill script

**Files:**
- Create: `scripts/backfill-tradie-customers.ts`
- Create: `tests/scripts/backfill-tradie-customers.test.ts`

- [ ] **Step 1: Write failing tests** covering:
  1. Single `portalJob` with phone → creates new `tradieCustomer`, links the job
  2. Two `portalJobs` with the same phone → only one `tradieCustomer` created, both jobs linked
  3. Existing `tradieCustomer` from SMS flow → enriched with name from `portalJobs`, not duplicated
  4. Re-running the script after first pass → no duplicate `tradieCustomers`, no FK changes
  5. `portalJob` with no phone → skipped (no FK set)
  6. `quotes` row with phone matching an existing `tradieCustomer` → links to existing, doesn't create new

```ts
// tests/scripts/backfill-tradie-customers.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { backfillTradieCustomers } from "@/scripts/backfill-tradie-customers";
// ... seed test DB before each, assert state after run
```

- [ ] **Step 2: Run tests, verify failure.**

- [ ] **Step 3: Implement `scripts/backfill-tradie-customers.ts`:**

```ts
import { db } from "@/server/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { normalisePhone } from "@/server/lib/phoneNumber";
import { portalJobs, quotes, tradieCustomers, invoices } from "@/drizzle/schema";

interface BackfillSummary {
  customersCreated: number;
  customersEnriched: number;
  portalJobsLinked: number;
  quotesLinked: number;
  aggregatesRecomputed: number;
}

export async function backfillTradieCustomers(): Promise<BackfillSummary> {
  const summary: BackfillSummary = {
    customersCreated: 0, customersEnriched: 0,
    portalJobsLinked: 0, quotesLinked: 0, aggregatesRecomputed: 0,
  };

  // ── PASS 1: portalJobs ─────────────────────────────────────────
  // Only touch rows where tradieCustomerId is NULL (idempotency).
  const jobs = await db.select().from(portalJobs)
    .where(and(isNull(portalJobs.tradieCustomerId), sql`customerPhone IS NOT NULL`));

  for (const job of jobs) {
    if (!job.customerPhone?.trim()) continue;
    const phone = normalisePhone(job.customerPhone);
    if (!phone) continue;

    // findOrCreate by (clientId, phone) — relies on the unique index from Task 2.1.
    let customer = await db.query.tradieCustomers.findFirst({
      where: and(eq(tradieCustomers.clientId, job.clientId), eq(tradieCustomers.phone, phone)),
    });

    if (!customer) {
      const inserted = await db.insert(tradieCustomers).values({
        clientId: job.clientId,
        phone,
        name: job.customerName ?? "Unknown",
        email: job.customerEmail ?? null,
        address: job.customerAddress ?? null,
      }).$returningId();
      customer = { ...inserted[0], clientId: job.clientId, phone };
      summary.customersCreated++;
    } else {
      // Enrich: populate name/email/address only if currently empty.
      const updates: Partial<typeof tradieCustomers.$inferInsert> = {};
      if (!customer.name && job.customerName) updates.name = job.customerName;
      if (!customer.email && job.customerEmail) updates.email = job.customerEmail;
      if (!customer.address && job.customerAddress) updates.address = job.customerAddress;
      if (Object.keys(updates).length > 0) {
        await db.update(tradieCustomers).set(updates).where(eq(tradieCustomers.id, customer.id));
        summary.customersEnriched++;
      }
    }

    await db.update(portalJobs)
      .set({ tradieCustomerId: customer.id })
      .where(eq(portalJobs.id, job.id));
    summary.portalJobsLinked++;
  }

  // ── PASS 2: quotes ─────────────────────────────────────────────
  // Same shape as PASS 1 but reads quotes.customerPhone/Email/Name.
  const quotesToLink = await db.select().from(quotes)
    .where(and(isNull(quotes.tradieCustomerId), sql`customerPhone IS NOT NULL`));

  for (const quote of quotesToLink) {
    if (!quote.customerPhone?.trim()) continue;
    const phone = normalisePhone(quote.customerPhone);
    if (!phone) continue;

    let customer = await db.query.tradieCustomers.findFirst({
      where: and(eq(tradieCustomers.clientId, quote.clientId), eq(tradieCustomers.phone, phone)),
    });
    if (!customer) {
      const inserted = await db.insert(tradieCustomers).values({
        clientId: quote.clientId, phone,
        name: quote.customerName ?? "Unknown",
        email: quote.customerEmail ?? null,
        address: quote.customerAddress ?? null,
      }).$returningId();
      customer = { ...inserted[0], clientId: quote.clientId, phone };
      summary.customersCreated++;
    }
    // (Skip enrichment if customer already exists — PASS 1 handled it.)
    await db.update(quotes).set({ tradieCustomerId: customer.id }).where(eq(quotes.id, quote.id));
    summary.quotesLinked++;
  }

  // ── PASS 3: aggregate recompute ────────────────────────────────
  // Sources of truth:
  //   - jobCount: COUNT(*) FROM portalJobs WHERE tradieCustomerId = X AND status='completed'
  //   - totalSpentCents: SUM(amountPaid) FROM invoices joined to portalJobs WHERE tradieCustomerId = X AND paid
  //     (NOT from quotes — unaccepted quotes shouldn't count)
  //   - lastJobAt: MAX(completedAt) FROM portalJobs WHERE tradieCustomerId = X
  const allCustomers = await db.select({ id: tradieCustomers.id }).from(tradieCustomers);
  for (const { id } of allCustomers) {
    // Single SQL with subqueries for atomicity.
    await db.execute(sql`
      UPDATE tradie_customers tc SET
        jobCount = (SELECT COUNT(*) FROM portal_jobs WHERE tradieCustomerId = ${id} AND status = 'completed'),
        totalSpentCents = COALESCE((SELECT SUM(i.amountPaidCents) FROM invoices i JOIN portal_jobs pj ON i.jobId = pj.id WHERE pj.tradieCustomerId = ${id} AND i.status = 'paid'), 0),
        lastJobAt = (SELECT MAX(completedAt) FROM portal_jobs WHERE tradieCustomerId = ${id})
      WHERE tc.id = ${id}
    `);
    summary.aggregatesRecomputed++;
  }

  console.log("[backfill] Summary:", summary);
  return summary;
}

if (require.main === module) {
  backfillTradieCustomers().then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

**Note on `invoices` schema:** if `invoices.amountPaidCents` is a different column name (or paid status is tracked differently), adjust the SUM expression. Run a quick `\\d invoices` first to confirm.

- [ ] **Step 4: Run tests, verify pass.**

- [ ] **Step 5: Run on a staging snapshot** of the production DB. Verify:
  - No duplicate `tradieCustomers` rows post-run
  - `portalJobs.tradieCustomerId` populated for all rows that had `customerPhone`
  - Re-running produces zero changes (idempotency)

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-tradie-customers.ts tests/scripts/backfill-tradie-customers.test.ts
git commit -m "feat(scripts): idempotent backfill of tradieCustomers + FKs on portalJobs/quotes"
```

### Task 2.3: Run backfill against production (during V2 deploy)

This task is run AS PART of the V2 deployment, not now. Document it here so the deployment runbook is clear.

- [ ] **Step 1: Take MySQL snapshot before running.**
- [ ] **Step 2: Run `pnpm tsx scripts/backfill-tradie-customers.ts` against production DB.**
- [ ] **Step 3: Spot-check 10 customers manually** — verify `tradieCustomers.jobCount` matches the actual count of `portalJobs` for that customer.
- [ ] **Step 4: If anything is off, restore from snapshot. Otherwise proceed.**

---

## Chunk 3: Native Capacitor plugin (`@buildalpha/capacitor-voice`)

This is the riskiest chunk and the longest week. It's also the only piece that's reusable across other tradie apps you build later — invest in it well.

**Skills referenced:**
- Apple's CallKit + PushKit guides (read these BEFORE writing Swift):
  - https://developer.apple.com/documentation/callkit
  - https://developer.apple.com/documentation/pushkit
  - https://www.twilio.com/docs/voice/sdks/ios

**Note on TDD for native code:** Most of the iOS side cannot be unit-tested without device hardware (PushKit + CallKit are device-only). The TS surface CAN be tested with TDD; native code is integration-tested manually on a real iPhone. Structure the Swift code so business logic (state machine) is testable in pure Swift unit tests, and the OS-bridging code is thin.

**Spec sections:** "Native plugin surface", entire spec §3.

### Task 3.1: Scaffold the plugin package

**Files:**
- Create: `packages/capacitor-voice/package.json`
- Create: `packages/capacitor-voice/tsconfig.json`
- Create: `packages/capacitor-voice/BuildAlphaCapacitorVoice.podspec`
- Create: `packages/capacitor-voice/README.md`
- Modify: root `package.json` (workspaces, add `packages/capacitor-voice`)

- [ ] **Step 1: Run the Capacitor plugin generator** in a sandbox to see the canonical structure:

```bash
cd /tmp
npx @capacitor/create-plugin@7 --name @buildalpha/capacitor-voice
```
Inspect the output — copy the file tree shape into `packages/capacitor-voice/`.

- [ ] **Step 2: Write `packages/capacitor-voice/package.json`** — name `@buildalpha/capacitor-voice`, peer dep `@capacitor/core ^7`, deps include `twilio-voice-ios` via Cocoapod (declared in podspec, not package.json).

- [ ] **Step 3: Write the podspec** declaring iOS dep on `TwilioVoice ~> 6.x`, source files in `ios/Plugin/**/*.swift`.

- [ ] **Step 4: Add as a workspace** in root `package.json`. Run `pnpm install` to verify the workspace resolves.

- [ ] **Step 5: Commit**

```bash
git add packages/capacitor-voice package.json pnpm-lock.yaml
git commit -m "feat(capacitor-voice): scaffold @buildalpha/capacitor-voice package"
```

### Task 3.2: Write the TypeScript JS API surface

**Files:**
- Create: `packages/capacitor-voice/src/definitions.ts` — public types (matches spec §"Native plugin surface")
- Create: `packages/capacitor-voice/src/index.ts` — `registerPlugin()` + re-exports
- Create: `packages/capacitor-voice/src/web.ts` — web-fallback no-op (for desktop preview builds)
- Create: `packages/capacitor-voice/src/index.test.ts` — unit tests for the TS surface

- [ ] **Step 1: Write failing test** for the TS surface — assert that the imported plugin object has methods `registerVoipPush`, `connect`, `acceptIncoming`, `rejectIncoming`, `disconnect`, `setMuted`, `setSpeaker`, `addListener`.

- [ ] **Step 2: Implement `definitions.ts`** copying the interface verbatim from spec §"JS API". Include all event types: `incomingCall`, `callConnected`, `callEnded`, `recordingReady`, `voipTokenUpdated`.

- [ ] **Step 3: Implement `web.ts`** — every method throws `Error("Solvr Phone is iOS-only")`. This is what runs in dev preview / Storybook.

- [ ] **Step 4: Implement `index.ts`** — `registerPlugin` from `@capacitor/core` with the web fallback.

- [ ] **Step 5: Run tests, verify pass.**

- [ ] **Step 6: Commit**

```bash
git add packages/capacitor-voice/src
git commit -m "feat(capacitor-voice): TypeScript JS API surface + web fallback"
```

### Task 3.3: Implement the iOS Swift plugin scaffold

**Files:**
- Create: `packages/capacitor-voice/ios/Plugin/BuildAlphaVoicePlugin.swift`
- Create: `packages/capacitor-voice/ios/Plugin/CallKitProvider.swift`
- Create: `packages/capacitor-voice/ios/Plugin/PushKitDelegate.swift`
- Create: `packages/capacitor-voice/ios/Plugin/TwilioVoiceClient.swift`
- Create: `packages/capacitor-voice/ios/Plugin/VoiceState.swift` — pure Swift state machine, unit-testable

- [ ] **Step 1: Read Twilio's official iOS Voice SDK quickstart** (`https://www.twilio.com/docs/voice/sdks/ios/get-started`). The pattern there is the model.

- [ ] **Step 2: Implement `VoiceState.swift`** — a pure Swift enum + state-machine class for call states (`idle`, `incoming`, `connecting`, `connected`, `ended`). This part IS unit-testable in Swift. Write XCTest cases for the state transitions.

- [ ] **Step 3: Implement `CallKitProvider.swift`** wrapping `CXProvider` + `CXCallController`. Methods:
  - `reportIncomingCall(uuid:from:displayName:completion:)`
  - `endCall(uuid:)`
  - `setMuted(uuid:muted:)`
  - Handle the delegate callbacks for `provider:performAnswerCallAction` etc., translating them to plugin events.

- [ ] **Step 4: Implement `PushKitDelegate.swift`:**
  - On `pushRegistry:didUpdate:for:type:` → store token, fire `voipTokenUpdated` event
  - On `pushRegistry:didReceiveIncomingPushWith:for:type:completion:` → branch on payload `type`:
    - `type === undefined` (default — incoming call): IMMEDIATELY `CallKitProvider.reportIncomingCall(...)` (within the same synchronous turn — this is non-negotiable per Apple). Parse the push payload: it carries the Twilio call SID, fromNumber, customParams from the server's APNs push.
    - `type === "cancel"` (server-side fan-out cancel push when another device accepted): IMMEDIATELY `CallKitProvider.reportIncomingCall(...)` (still required by Apple — can't skip!) AND immediately end the call via `CXEndCallAction`. The reportNewIncomingCall call must happen first; failing to call it will trigger an iOS VoIP token revocation regardless of the payload type. Add a unit test in `VoiceState.swift` for this transition: `incoming → cancelled` on receipt of a cancel-payload push.

- [ ] **Step 5: Implement `TwilioVoiceClient.swift`** wrapping `TVOCallDelegate`:
  - `connect(token, params)` for outbound
  - `accept()` for inbound (called when user taps Accept on CallKit)
  - Handle `TVOCall` lifecycle callbacks → emit plugin events

- [ ] **Step 6: Implement `BuildAlphaVoicePlugin.swift`** — the Capacitor plugin entry point:
  - `@objc(BuildAlphaVoice)` class declaration
  - Methods: `registerVoipPush`, `connect`, `acceptIncoming`, `rejectIncoming`, `disconnect`, `setMuted`, `setSpeaker` — each calls the relevant subsystem and resolves the JS Promise
  - **`acceptIncoming` must, before calling `TVOCall.accept()`, emit a `callAccepted` event with `{ callSid, deviceId }`** so the JS layer (Task 6.1) can call the server's `phone.notifyAccepted` mutation. This server mutation triggers the cancel-fan-out push to other devices (Task 4.6). Without this signal the cancel-fan-out never fires and other devices keep ringing.
  - Plugin events emitted via `notifyListeners`

- [ ] **Step 7: Run Swift unit tests** (state machine only):

```bash
cd packages/capacitor-voice/ios
xcodebuild test -scheme Plugin -destination 'platform=iOS Simulator,name=iPhone 15'
```
Expected: state-machine tests PASS. Other tests skipped (need device).

- [ ] **Step 8: Commit**

```bash
git add packages/capacitor-voice/ios
git commit -m "feat(capacitor-voice): iOS Swift implementation — Twilio Voice + CallKit + PushKit"
```

### Task 3.4: Plugin install hook for host-app Info.plist + entitlements

**Files:**
- Create: `packages/capacitor-voice/scripts/postinstall.ts` — appends required Info.plist keys to host app
- Create: `packages/capacitor-voice/README.md` — documents manual setup steps for VoIP cert (can't be automated)

- [ ] **Step 1: Write a script that, when the host app `pnpm install`s the plugin, appends to host's Info.plist:**
  - `NSMicrophoneUsageDescription` — "Solvr uses your microphone for in-app calls."
  - `UIBackgroundModes`: `audio`, `voip`
  Idempotent (don't re-add if present).

- [ ] **Step 2: Document in README** the manual steps the host-app developer must do:
  - Generate a VoIP Services Certificate at Apple Developer
  - Upload `.p12` + passphrase to the server's env vars (`APN_VOIP_CERT_P12_BASE64`, `APN_VOIP_CERT_PASSPHRASE`)
  - Regenerate provisioning profiles after enabling Push Notifications capability

- [ ] **Step 3: Commit**

```bash
git add packages/capacitor-voice/scripts packages/capacitor-voice/README.md
git commit -m "feat(capacitor-voice): postinstall hook + manual VoIP cert setup docs"
```

### Task 3.5: Test the plugin in a sandbox host app on a real device

This step ensures the plugin works end-to-end before integrating into the Solvr app.

- [ ] **Step 1: Create a minimal Capacitor host app** (`/tmp/voice-test-app`) that imports `@buildalpha/capacitor-voice` and exercises every JS API method. Buttons for: register VoIP, accept call, reject, end, mute toggle.

- [ ] **Step 2: Wire up a TEMPORARY server endpoint** that issues Twilio access tokens and a TEST Twilio number whose `/voice` webhook just dials the test client identity.

- [ ] **Step 3: Build for device, install via Xcode.**

- [ ] **Step 4: Manual smoke test:**
  - Tradie's phone receives an inbound call via Twilio → CallKit incoming UI shows on lock screen → tap accept → audio flows
  - Tradie places an outbound call → callee's phone shows business number → audio flows
  - Hangup mid-call → plugin emits `callEnded`
  - Mute toggle → caller hears nothing → unmute → audio resumes

If any of these fails, debug **before** integrating with the Solvr app. The plugin is the foundation; everything else assumes it works.

- [ ] **Step 5: Document test results** in a markdown file `packages/capacitor-voice/docs/device-test-runbook.md` for future regression checks.

- [ ] **Step 6: Commit**

```bash
git add packages/capacitor-voice/docs
git commit -m "docs(capacitor-voice): device-test runbook"
```

---

## Chunk 4: Twilio webhooks + Vapi handoff

Server-side wiring for inbound + outbound call flow, including the Vapi handoff via `phoneCallProviderId` reconciliation.

**Skills referenced:**
- @superpowers:test-driven-development — webhook idempotency is critical
- Existing pattern: `server/twilioInboundSms.ts` (signature validation + structure)

**Spec sections:** "Webhook routes", "VoIP push delivery flow", "Vapi handoff (corrected)"

### Task 4.1: Write the `/voice` webhook (inbound entry point)

**Files:**
- Create: `server/webhooks/twilioVoice.ts`
- Create: `tests/webhooks/twilioVoice.test.ts`
- Modify: `server/_core/index.ts` (register the route)

- [ ] **Step 1: Write failing tests** covering all branches:
  1. Unknown `To` number → 200 with `<Reject/>` TwiML
  2. Subscription `cancelled` → routes to Vapi if `aiFallbackEnabled`, else 486
  3. `inboundMinutesUsed >= 200` → routes to Vapi
  4. Existing `in_progress` call within 15 min for same client → routes to Vapi
  5. Happy path → INSERTs `call_logs`, calls `voipPush.sendIncoming`, returns `<Dial>` TwiML
  6. Twilio signature invalid → 403

- [ ] **Step 2: Implement `server/webhooks/twilioVoice.ts:handleIncomingCall`** following spec §"`POST /api/webhooks/twilio/voice`" steps 1–8 verbatim. Use `validateTwilioSignature` from Chunk 1.

- [ ] **Step 3: Run tests, verify pass.**

- [ ] **Step 4: Register the route** in `server/_core/index.ts` at `/api/webhooks/twilio/voice`.

- [ ] **Step 5: Commit**

```bash
git add server/webhooks/twilioVoice.ts tests/webhooks/twilioVoice.test.ts server/_core/index.ts
git commit -m "feat(webhooks): twilio /voice — inbound call entry with subscription + concurrency gates"
```

### Task 4.2: Write the `/dial-result` webhook (no-answer fallback)

**Files:**
- Modify: `server/webhooks/twilioVoice.ts` — add `handleDialResult`
- Modify: `tests/webhooks/twilioVoice.test.ts`

- [ ] **Step 1: Write failing tests:**
  1. `DialCallStatus = completed` → updates `call_logs.status = completed`, `answeredBy = human`, returns `<Hangup/>`
  2. `DialCallStatus = no-answer` + `aiFallbackEnabled = true` → returns `<Redirect>` to `/vapi-handoff?callLogId=N`, updates `call_logs.status = no_answer`, `answeredBy = ai_receptionist`
  3. `DialCallStatus = no-answer` + `aiFallbackEnabled = false` → returns voicemail TwiML, updates `call_logs.status = voicemail`

- [ ] **Step 2: Implement `handleDialResult`** per spec.

- [ ] **Step 3: Run tests.**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(webhooks): twilio /dial-result — Vapi fallback or voicemail on no-answer"
```

### Task 4.3: Write the `/vapi-handoff` endpoint + Vapi reconciliation

**Files:**
- Modify: `server/webhooks/twilioVoice.ts` — add `handleVapiHandoff`
- Modify: `server/vapiWebhook.ts` — recognize `phoneCallProviderId`
- Modify: `tests/webhooks/twilioVoice.test.ts`
- Modify: `tests/vapiWebhook.test.ts`

- [ ] **Step 0 (CRITICAL — Week-1 prep):** Before writing any code, **verify Vapi webhook payload exposes Twilio call SID.** Hit Vapi staging with a real Twilio-redirected call and capture the webhook payload. Look for `call.phoneCallProviderId` (or whatever the field is named today). If it's not present, switch to the `assistantOverrides.metadata` approach immediately — see spec §"Approach (V2.5 if Vapi's payload doesn't expose Twilio SID)".

- [ ] **Step 1: Write failing tests for `/vapi-handoff`:**
  1. Receives `?callLogId=N` → caches `(twilioCallSid → callLogId)` for 5 min, returns `<Dial><Number>` to that tradie's Vapi number
  2. `callLogId` missing → 400

- [ ] **Step 2: Implement `handleVapiHandoff`** per spec §"Vapi handoff (corrected)".

- [ ] **Step 3: Modify `vapiWebhook.ts`:**
  - Read `phoneCallProviderId` from incoming Vapi webhook
  - Look up `call_logs` by `twilioCallSid`
  - If found → UPDATE the existing row with transcript + summary; SKIP the `crmInteractions` insert
  - If not found → existing behaviour (insert into `crmInteractions`)

- [ ] **Step 4: Write failing tests for `vapiWebhook` merge path:**
  1. Vapi webhook with known `phoneCallProviderId` → updates existing `call_logs`, no `crmInteractions` insert
  2. Vapi webhook with unknown `phoneCallProviderId` → existing `crmInteractions` insert

- [ ] **Step 5: Run tests.**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(webhooks): vapi handoff via phoneCallProviderId reconciliation"
```

### Task 4.4: Write the `/recording` webhook (idempotent + atomic minute counters)

**Files:**
- Modify: `server/webhooks/twilioVoice.ts` — add `handleRecording`
- Modify: `server/storage.ts` — add `call-recordings/` key prefix helper (optional)
- Modify: `tests/webhooks/twilioVoice.test.ts`

- [ ] **Step 1: Write failing tests:**
  1. First call → fetches audio from Twilio, uploads to R2, UPDATES `call_logs.recordingUrl/Sid/durationSeconds`, increments `client_phone_numbers.inboundMinutesUsed`, kicks off AI pipeline
  2. **Idempotency:** second call with same payload → returns 200 immediately, no re-upload, no re-increment
  3. Outbound call → increments `outboundMinutesUsed` instead

- [ ] **Step 2: Implement `handleRecording`** per spec §"`POST /api/webhooks/twilio/recording`" with the explicit `recordingSid` idempotency guard.

- [ ] **Step 3: Run tests.**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(webhooks): twilio /recording — R2 upload, idempotent, atomic minute counters"
```

### Task 4.5: Write the `/outgoing` and `/status` webhooks

**Files:**
- Modify: `server/webhooks/twilioVoice.ts` — add `handleOutgoing`, `handleStatus`
- Modify: `tests/webhooks/twilioVoice.test.ts`

- [ ] **Step 1: Write failing tests for `/outgoing`** — returns `<Dial callerId={businessNumber} record="record-from-answer-dual">`. Validates Twilio signature.

- [ ] **Step 2: Write failing tests for `/status`** — updates `call_logs.status` based on `CallStatus` payload.

- [ ] **Step 3: Implement both handlers.**

- [ ] **Step 4: Run tests.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(webhooks): twilio /outgoing + /status — outbound TwiML and lifecycle updates"
```

### Task 4.6: VoIP push delivery (`server/_core/voipPush.ts`) AND regular APNs push (`server/_core/regularPush.ts`)

**Files:**
- Create: `server/_core/voipPush.ts` — VoIP push via `.p12` cert (incoming-call wake)
- Create: `server/_core/regularPush.ts` — regular APNs via `.p8` token (post-call summary, missed-call notifications)
- Create: `tests/_core/voipPush.test.ts`
- Create: `tests/_core/regularPush.test.ts`
- Modify: `package.json` — add `apn` 2.x

**Why two push helpers:** Apple's VoIP push channel REQUIRES the `.p12` certificate flow and is used for waking the app to ring. Regular APNs (badge/banner notifications for the post-call summary tap-to-review) supports the simpler `.p8` token-auth flow. They are NOT interchangeable. Spec §"VoIP push delivery" mandates the split.

**New env vars (in addition to the VoIP cert from spec):**
```
# Regular APNs (post-call summary banner)
APN_KEY_ID=xxx                   # APNs auth key ID from Apple Developer
APN_KEY_P8_BASE64=...             # base64-encoded .p8 file contents
APN_TEAM_ID=xxx                  # Apple Developer Team ID
IOS_BUNDLE_ID=com.solvr.mobile   # bundle ID for `topic` field
```

- [ ] **Step 1: Install `apn`:**

```bash
pnpm add apn
```

- [ ] **Step 2: Write failing tests:**
  1. `sendIncomingCallPush({ userId, callLogId, fromNumber })` → reads `voipPushTokens` rows, sends one push per device via APNs `.p12` cert, returns count of pushes sent
  2. `sendCancelPush({ userId, callLogId, exceptDeviceId })` → sends a "cancel" payload to all OTHER devices (used when one device accepts)
  3. Token expired (APNs returns 410) → DELETE that `voipPushTokens` row

- [ ] **Step 3: Implement `voipPush.ts`:**

```ts
import apn from "apn";
import { db } from "@/server/db";
import { voipPushTokens } from "@/drizzle/schema";

const provider = new apn.Provider({
  cert: Buffer.from(process.env.APN_VOIP_CERT_P12_BASE64!, "base64"),
  passphrase: process.env.APN_VOIP_CERT_PASSPHRASE!,
  production: process.env.NODE_ENV === "production",
});

export async function sendIncomingCallPush(opts: {
  userId: number;
  callLogId: number;
  fromNumber: string;
  callSid: string;
}): Promise<number> {
  const tokens = await db.select().from(voipPushTokens)
    .where(eq(voipPushTokens.userId, opts.userId));

  const note = new apn.Notification();
  note.topic = `${process.env.IOS_BUNDLE_ID}.voip`;
  note.pushType = "voip";
  note.priority = 10;
  note.payload = {
    callSid: opts.callSid,
    callLogId: opts.callLogId,
    fromNumber: opts.fromNumber,
    customParams: {},
  };

  const results = await provider.send(note, tokens.map(t => t.token));
  // Delete invalid tokens
  for (const failure of results.failed) {
    if (failure.status === "410") {
      await db.delete(voipPushTokens).where(eq(voipPushTokens.token, failure.device));
    }
  }
  return results.sent.length;
}

export async function sendCancelPush(opts: {
  userId: number;
  callSid: string;
  exceptDeviceId: string;
}): Promise<void> {
  // similar; payload includes { type: "cancel", callSid }
}
```

- [ ] **Step 4: Run tests.**

- [ ] **Step 5: Implement `regularPush.ts`** — same pattern but uses `.p8` token-auth (`apn.Provider({ token: { key, keyId, teamId } })`), `pushType: "alert"`, `topic: process.env.IOS_BUNDLE_ID` (no `.voip` suffix). Reads `voipPushTokens.regularApnsToken` (the column added in Task 2.1 Step 3) — same row, different column. Function: `sendCallSummaryPush({ userId, callLogId, callerName, summary })` queries all the user's `voipPushTokens` rows where `regularApnsToken IS NOT NULL`, sends one push per device, deletes any returning APNs 410 (token invalid).

- [ ] **Step 6: Wire into AI pipeline** — `callIntelligence.ts` (Task 5.1) calls `regularPush.sendCallSummaryPush` once analysis completes.

- [ ] **Step 7: Tests for both modules — verify VoIP push uses `.p12` cert auth and pushType=voip; regular push uses `.p8` token auth and pushType=alert.**

- [ ] **Step 8: Commit**

```bash
git add server/_core/voipPush.ts server/_core/regularPush.ts \
        tests/_core/voipPush.test.ts tests/_core/regularPush.test.ts \
        package.json pnpm-lock.yaml drizzle/schema.ts
git commit -m "feat(server): VoIP push (.p12) for ringing + regular APNs (.p8) for post-call summary"
```

### Task 4.7: Usage-tracking cron (`server/_core/usageTracking.ts`)

**Files:**
- Create: `server/_core/usageTracking.ts`
- Create: `tests/_core/usageTracking.test.ts`
- Modify: cron registry (e.g. `server/_core/cron.ts` if it exists, or wherever scheduled jobs live)

- [ ] **Step 1: Write failing tests:**
  1. `rolloverBillingCycles()` — finds rows where `billingCycleStart` is older than 30 days, resets `inboundMinutesUsed = 0`, `outboundMinutesUsed = 0`, advances `billingCycleStart` to today
  2. `purgeOldRecordings()` — finds `call_logs` with `recordingUrl` set and `calledAt > 90 days ago`, deletes from R2, NULLs `recordingUrl`
  3. `closeStaleInProgressCalls()` — finds `call_logs.status = 'in_progress'` rows older than 30 min, flips to `failed` (recovers from missed `/status` webhooks)
  4. **Cross-test with the 15-min `/voice` gate (Task 4.1)** — seed a `call_logs` row 31 min old with `status = 'in_progress'`, run the sweeper, then verify a fresh `/voice` webhook for the same client is NOT blocked (because the sweeper flipped the row to `failed`). This proves the sweeper + the gate's 15-min window work together rather than against each other.

- [ ] **Step 2: Implement the three functions.**

- [ ] **Step 3: Wire into the cron registry — schedule daily at 02:00 UTC.**

- [ ] **Step 4: Run tests.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(server): daily usage-tracking cron — billing rollover, recording purge, stale-call recovery"
```

---

## Chunk 5: AI pipeline + tRPC router + Stripe wiring

### Task 5.1: Implement `callIntelligence.ts`

**Files:**
- Create: `server/_core/callIntelligence.ts`
- Create: `tests/_core/callIntelligence.test.ts`

- [ ] **Step 1: Write failing tests** with a mock LLM client:
  1. New-quote transcript → returns `{ intent: "new_quote", quoteSeed: { jobTitle: ..., ... } }`
  2. Job-update transcript → returns `{ intent: "job_update", referencedJobTitle: "..." }`
  3. Empty transcript → returns `{ intent: "other", summary: "Call had no audio." }`
  4. Caller name extracted → returned in `callerNameExtracted`
  5. **Side effects after analysis completes:** `regularPush.sendCallSummaryPush` is called once with the right `userId` and the SSE broadcaster receives a `call:processed` event payload `{ callLogId, aiSummary, aiIntent, aiActionItems }` for that user. Both side effects must be assertion-tested with mocks.

- [ ] **Step 2: Implement** per spec §"AI pipeline". Reuses `transcribeAudio` from `lib/transcription.ts`. New: GPT-4o-mini intent classifier with the system prompt + JSON schema from spec §5.2 of the original prompt (preserved in spec for reference).

- [ ] **Step 3: Wire into `/recording` webhook** — at the end of `handleRecording`, call `analyseCallTranscript(callLogId)`, then send a regular APNs push with the summary, then SSE-broadcast.

- [ ] **Step 4: Run tests.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(server): callIntelligence — Whisper + GPT-4o intent classification"
```

### Task 5.2: tRPC router (`server/routers/phone.ts`)

**Files:**
- Create: `server/routers/phone.ts`
- Create: `tests/routers/phone.test.ts`
- Modify: `server/_core/index.ts` (register router)

- [ ] **Step 1: For each procedure listed in spec §"tRPC router", write a failing test, then implement, with the rate limits specified in the spec table.**

Procedures (with rate limits):
1. `getAccessToken` — **10 rpm/user.** Implementation: server-side cached. Mint a fresh token only when no cached token exists OR the cached one has ≤5 min remaining. Cache in-memory keyed by userId; eviction on next call after expiry. Pure server-side discipline — JS layer just calls this; no client-side timer logic needed.
2. `registerVoipToken` — 60 rpm. Saves both VoIP token AND regular APNs token (per Task 4.6 schema decision).
3. `initiateCall` — 30 rpm
4. **`notifyAccepted`** (NEW, derived from reviewer feedback) — 30 rpm. Body: `{ callSid: string, deviceId: string }`. Calls `voipPush.sendCancelPush({ userId, callSid, exceptDeviceId: deviceId })`. This is the bridge between the plugin's `acceptIncoming` (Task 3.3 Step 6) and the server-side cancel-fan-out (Task 4.6).
5. `listCalls` — 60 rpm
6. `getCall` — 60 rpm
7. `linkToQuote`, `linkToJob` — 60 rpm
8. `provisionNumber` — 3 rpm (Twilio cost-per-call)
9. `updateSettings` — 60 rpm
10. `startSubscription` — 5 rpm

For each procedure: write the Zod input schema, the rate-limit decorator, the handler logic, the auth guard.

- [ ] **Step 2: Implement each procedure following CLAUDE.md standards** — every authenticated route wrapped in `withApiAuth` (or tRPC equivalent), Zod-validated, rate-limited per the spec table.

- [ ] **Step 3: Per-procedure rate-limit tests** — for at least `getAccessToken`, `provisionNumber`, `startSubscription`, `notifyAccepted`: send the 11th request in 60 seconds and assert `429 Too Many Requests` is returned with a structured log entry per CLAUDE.md.

- [ ] **Step 4: Run tests for each.**

- [ ] **Step 5: Register router in `server/_core/index.ts`.**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(routers): phone — 10 procedures with rate limits + 429 tests + notifyAccepted bridge"
```

### Task 5.2b: SSE endpoint for live post-call updates

**Files:**
- Create: `server/routes/phoneEvents.ts` — plain HTTP Server-Sent Events endpoint at `/api/sse/phone-events`
- Modify: `server/_core/callIntelligence.ts` — broadcast on the channel after analysis completes
- Modify: `server/_core/index.ts` — register the route
- Create: `tests/routes/phoneEvents.test.ts`

The Post-Call Sheet (Task 7.3) needs to know when the AI analysis lands on the server. Decision (locked): plain HTTP SSE endpoint at `/api/sse/phone-events`, NOT a tRPC subscription. Rationale: SSE works trivially through CapacitorHttp + browser EventSource API; tRPC v10 subscriptions need a websocket adapter we don't currently have set up.

Find the existing SSE pattern in the codebase first via `grep -rn "EventSource\\|text/event-stream" server/`. If one exists, follow its idioms. If none, stand up a minimal in-memory broadcaster (sufficient for single-server deploys; for multi-server later, swap in Redis pub/sub).

- [ ] **Step 1: Write failing test** — connect to the SSE endpoint as user X, then trigger `analyseCallTranscript` for a call belonging to user X, assert the SSE stream emits a `call:processed` event with `{ callLogId, aiSummary, aiIntent, aiActionItems }`.

- [ ] **Step 2: Implement** — minimal Server-Sent Events handler that holds open connections per `userId`. `callIntelligence.ts` (Task 5.1) calls into this broadcaster after writing the analysis to `call_logs`.

- [ ] **Step 3: Auth gate** — SSE connection requires the same portal auth cookie/session as tRPC. Reject 401 otherwise.

- [ ] **Step 4: Test passes.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(server): SSE endpoint for live call:processed events"
```

### Task 5.3: Extend `customers.ts` router

**Files:**
- Modify: `server/routers/customers.ts`
- Modify: `tests/routers/customers.test.ts`

- [ ] **Step 1: Add procedures needed by the new Customers tab UI:**
  - `customers.getById` — full customer profile with call history, quotes, jobs (joins to `tradieCustomers` + `call_logs` + `portalJobs` + `quotes`)
  - `customers.search` — quick search by name or phone (for the dial-pad customer search)
- [ ] **Step 2: Tests + implement.**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(routers): customers — extend with getById + search for V2 Customers tab"
```

### Task 5.4: Stripe subscription wiring

**Files:**
- Modify: `server/stripeWebhook.ts` (or wherever Stripe events are handled — find via `grep -rn "stripe" server/ | grep -i webhook`)
- Modify: `tests/stripeWebhook.test.ts`

- [ ] **Step 1: Add a Stripe Price** in the Stripe dashboard (manually, not via code): `Solvr Phone — $39/month AUD`. Note the `price_xxx` ID. Add to env as `STRIPE_PRICE_ID_SOLVR_PHONE`.

- [ ] **Step 2: Implement `phone.startSubscription` handler** to create the subscription on Stripe with this price + the tradie's existing customer ID.

- [ ] **Step 3: Update Stripe webhook handler** to recognize subscription state changes and update `client_phone_numbers.subscriptionStatus`. Map Stripe statuses to your enum: `trialing → trial`, `active → active`, `past_due → past_due`, `unpaid → unpaid`, `incomplete → incomplete`, `canceled → cancelled`.

- [ ] **Step 4: Tests — explicit Stripe state transition cases:**
  1. `trialing → active` (first invoice paid) → `subscriptionStatus = active`, feature stays enabled
  2. `active → past_due` (payment failed) → `subscriptionStatus = past_due`, feature stays enabled (grace), banner triggers
  3. `past_due → active` (retry succeeded) → `subscriptionStatus = active`, banner clears
  4. `past_due → unpaid` (retries exhausted) → `subscriptionStatus = unpaid`, feature disabled
  5. `unpaid → active` (manual re-subscribe) → `subscriptionStatus = active`, feature re-enabled (verifies the path is reversible)
  6. Any → `canceled` → `subscriptionStatus = cancelled`, feature disabled
  7. `incomplete` (initial payment never succeeded) → `subscriptionStatus = incomplete`, feature disabled

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(stripe): wire Solvr Phone $39/mo subscription to client_phone_numbers.subscriptionStatus"
```

### Task 5.5: Number provisioning + AU-region Twilio client

**Files:**
- Create: `server/lib/twilioClient.ts` — singleton Twilio client constructed with AU region/edge
- Modify: `server/routers/phone.ts` — implement `provisionNumber` with Twilio API calls
- Modify: `server/webhooks/twilioVoice.ts` — use the AU-region client when fetching recordings
- Modify: `tests/routers/phone.test.ts`

- [ ] **Step 1: Write failing test for `twilioClient.ts`** — assert the constructed `twilio()` client has `region: 'au1'` and `edge: 'sydney'` (or whichever AU edge Twilio currently advertises) baked in. This guarantees Australian tradie data stays in AU infra (spec §"Operations" data-residency requirement).

- [ ] **Step 2: Implement `server/lib/twilioClient.ts`:**

```ts
import twilio from "twilio";

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
  {
    region: process.env.TWILIO_REGION ?? "au1",
    edge: "sydney",
  },
);
```

Replace any direct `twilio()` constructions in the codebase (existing SMS, new voice webhooks, provisionNumber) with imports from this module.

- [ ] **Step 3: Write failing test for `provisionNumber`** — given an `areaCode`, returns 5 candidate numbers from Twilio's available numbers API. After confirmation, purchases the number, configures webhooks, INSERTs `client_phone_numbers` row.

- [ ] **Step 4: Implement** — wraps `twilioClient.availablePhoneNumbers('AU').local.list({areaCode})` + `twilioClient.incomingPhoneNumbers.create()` configured to point at `/api/webhooks/twilio/voice`. Uses the AU-region singleton.

- [ ] **Step 5: Verify R2 bucket region** — run `aws s3api get-bucket-location` (with R2 endpoint) on the production bucket. Confirm it's `apac` or AU-adjacent. If not, file a follow-up to migrate (out of scope for V2 if cost is non-trivial).

- [ ] **Step 6: Tests pass.**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(phone): number provisioning + AU-region Twilio client (data residency)"
```

---

## Chunk 6: JS hook + Phone tab + Customers tab

### Task 6.1: `useSolvrPhone()` hook

**Files:**
- Create: `client/src/hooks/useSolvrPhone.ts`
- Create: `client/src/hooks/useSolvrPhone.test.ts` (with a mock plugin)

- [ ] **Step 1: Write failing tests** with a mock `BuildAlphaVoicePlugin`:
  1. On mount: calls `registerVoipPush()` and sends the token to server via `phone.registerVoipToken` mutation
  2. On mount: opens an `EventSource` to `/api/sse/phone-events` (Task 5.2b) and listens for `call:processed` events
  3. On `incomingCall` event: looks up customer + active job → sets state to `incoming` with context
  4. On `callConnected`: sets state to `connected`
  5. On `callAccepted` event from plugin (Task 3.3 Step 6): calls `phone.notifyAccepted` mutation with `{ callSid, deviceId }` to trigger server-side cancel-fan-out
  6. On `callEnded`: sets state to `ended`, waits for SSE `call:processed` event, then exposes the analysis to the post-call sheet
  7. `makeCall(toNumber, { quoteId })` → calls `phone.initiateCall` mutation, then plugin's `connect()`

- [ ] **Step 2: Implement** following spec §"`useSolvrPhone()` hook" verbatim.

- [ ] **Step 3: Tests pass.**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(hook): useSolvrPhone — wraps capacitor-voice with customer + job context lookup"
```

### Task 6.2: Phone tab (`PortalPhone.tsx`)

**Files:**
- Create: `client/src/pages/portal/PortalPhone.tsx`

- [ ] **Step 1: Implement** the layout from spec §"Phone tab": chronological list grouped by Today / Yesterday / This Week / Earlier; each card with direction arrow + customer name + duration + intent badge + 1-line AI summary. Uses `phone.listCalls` query.

- [ ] **Step 2: Add the cap-reached banner.** When the user's `client_phone_numbers.inboundMinutesUsed >= 200` (or returned from a tRPC query like `phone.getUsage`), render a sticky banner at the top of the Phone tab: "You've used 200 of 200 inbound minutes this billing cycle. Calls are routed to your AI Receptionist until [next billing date]." The banner is also shown if `subscriptionStatus = 'past_due'` ("Payment failed — update your card to avoid losing your phone number"). Spec §"Pricing" requires this UX.

- [ ] **Step 3: Add the FAB → Dial Pad navigation.**

- [ ] **Step 4: Replace the existing "Calls" tab** in `PortalLayout.tsx` bottom nav with this Phone tab.

- [ ] **Step 5: Manual smoke test** in dev — browse to `/portal/phone`, verify list renders.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(portal): Phone tab — unified call list with AI summaries, replaces Calls tab"
```

### Task 6.3: Call Detail (`PortalCallDetail.tsx`)

**Files:**
- Create: `client/src/pages/portal/PortalCallDetail.tsx`

- [ ] **Step 1: Implement** the layout from spec §"Call Detail": full-screen with customer info + AI summary + action items + recording player + transcript + linked quote/job + sticky [Call back] button. Uses `phone.getCall` query.

- [ ] **Step 2: Wire link buttons** — `phone.linkToQuote`, `phone.linkToJob` mutations.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(portal): Call Detail page — recording player, transcript, link actions"
```

### Task 6.4: Extend existing `PortalCustomers.tsx`

**Files:**
- Modify: `client/src/pages/portal/PortalCustomers.tsx` (already exists — confirm by reading first; do NOT rebuild from scratch)

- [ ] **Step 1: Read the existing implementation** and identify the integration points for V2's additions. The file already has list + search + customer-add flows from the SMS work. The V2 work is purely additive.

- [ ] **Step 2: Add a Customer Detail sub-view (or modal)** showing call history (`call_logs` joined via `tradieCustomerId`), linked quotes (`quotes.tradieCustomerId`), linked jobs (`portalJobs.tradieCustomerId`). Use the new `customers.getById` procedure from Task 5.3.

- [ ] **Step 3: Add click-to-call buttons** next to the customer phone in the existing list and detail rows. Use `useSolvrPhone().makeCall()`.

- [ ] **Step 4: Add a "calls" filter chip** so the existing list can show only customers with recent calls.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(portal): extend Customers tab with V2 call history, quotes, jobs view"
```

---

## Chunk 7: In-call screen + post-call sheet + onboarding

### Task 7.1: `IncomingCallOverlay.tsx`

**Files:**
- Create: `client/src/components/phone/IncomingCallOverlay.tsx`
- Create: `client/src/components/phone/IncomingCallOverlay.test.tsx`

- [ ] **Step 0: Write failing component test** with React Testing Library:
  1. When `useSolvrPhone().state === 'incoming'` (mocked), the overlay renders with customer name + last contact
  2. When state is `'idle'`, overlay is null
  3. Tapping Accept calls `useSolvrPhone().accept()`
  4. Tapping Decline calls `useSolvrPhone().reject()`
  5. Buttons have `min-h-[44px]` (uncle-test compliance)

- [ ] **Step 1: Run test, verify failure.**

- [ ] **Step 2: Implement** — full-screen overlay shown when `useSolvrPhone().state === 'incoming'`. Shows customer name, last contact, [Accept]/[Decline] buttons (44pt taps).

  Note: on iOS, CallKit handles the lock-screen incoming UI; this overlay is for in-app foreground state.

- [ ] **Step 3: Run test, verify pass.**

- [ ] **Step 4: Mount in `PortalLayout.tsx`** at the top level so it's visible from any portal page.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phone): incoming-call overlay for in-app foreground state"
```

### Task 7.2: `InCallScreen.tsx`

**Files:**
- Create: `client/src/components/phone/InCallScreen.tsx`

- [ ] **Step 1: Implement** the layout from spec §"In-call screen" — customer name, duration timer, "Active context" panel (open quote, active job), [Mute][Speaker][Keypad] controls, [End Call].

- [ ] **Step 2: Mute/Speaker call into `useSolvrPhone().mute()`/`speaker()`.**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(phone): in-call screen with active context (open quote, active job)"
```

### Task 7.3: `PostCallSheet.tsx` — the killer UX moment

**Files:**
- Create: `client/src/components/phone/PostCallSheet.tsx`
- Create: `client/src/components/phone/PostCallSheet.test.tsx`

- [ ] **Step 0: Write failing component tests:**
  1. Initially renders a "Processing call..." skeleton when `aiSummary` is null
  2. After `call:processed` SSE event arrives via the hook, renders summary + primary CTA based on `aiIntent`
  3. For `aiIntent: 'new_quote'`, primary CTA reads "Generate Quote" and tapping fires `quotes.createFromCall` mutation
  4. For `aiIntent: 'job_update'`, primary CTA reads "Add note to {jobTitle}"
  5. **Per CLAUDE.md: every mutation has an `onError` handler** showing a destructive toast — assert the toast appears when the mutation rejects
  6. "Dismiss" closes the sheet without writing anything

- [ ] **Step 1: Run tests, verify failure.**

- [ ] **Step 2: Implement** the layout from spec §"Post-call confirm sheet": slide-up sheet with AI summary + AI-suggested primary CTA + secondary actions + recording player + collapsible transcript.

- [ ] **Step 3: Implement primary-CTA logic** based on `aiIntent` per the table in spec:
  - `new_quote` → `quotes.createFromCall` mutation → toast → navigate to draft quote
  - `quote_followup` → `crmInteractions` insert + link to quote → toast
  - `job_update` / `new_job` → `crmInteractions` + link to job → toast
  - else → `crmInteractions` standalone → toast

  Every mutation gets an `onError` handler showing a destructive `toast.error` per CLAUDE.md. Every mutation button is `disabled={mutation.isPending}` to prevent double-tap.

- [ ] **Step 4: Add SSE subscriber wiring** — sheet reads from `useSolvrPhone()` which already subscribes to `/api/sse/phone-events` (Task 6.1). Sheet renders skeleton initially ("Processing call..."), then fills in once the `call:processed` event arrives.

- [ ] **Step 5: Run tests, verify pass.**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(phone): post-call sheet — AI summary + suggested primary CTA + secondary actions"
```

### Task 7.4: Dial Pad (`DialPad.tsx`)

**Files:**
- Create: `client/src/components/phone/DialPad.tsx`

- [ ] **Step 1: Implement** — number pad + customer-search field (uses `customers.search` query) + recent contacts list. Uses `useSolvrPhone().makeCall()`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(phone): dial pad with customer search + recent contacts"
```

### Task 7.5: Onboarding wizard (`PhoneOnboardingWizard.tsx`)

**Files:**
- Create: `client/src/pages/portal/PhoneOnboardingWizard.tsx`
- Create: `client/src/pages/portal/PhoneOnboardingWizard.test.tsx`

- [ ] **Step 0: Write failing tests** for each wizard step:
  1. Step 1 (Stripe checkout): mounts Stripe element, "Start subscription" button calls `phone.startSubscription` mutation. **Has `onError` toast** per CLAUDE.md.
  2. Step 2 (area code): defaults to 04XX, accepts custom input, validates AU area-code format
  3. Step 3 (number picker): renders 5 candidates from mocked `phone.provisionNumber` query, "Confirm" calls the purchase mutation
  4. Step 4 (provisioning): shows loading state with timeout fallback if Twilio takes >30s
  5. Step 5 (success): shows new number + carrier-forwarding doc links
  6. Wizard does NOT advance step on mutation failure — shows error inline

- [ ] **Step 1: Run tests, verify failure.**

- [ ] **Step 2: Implement** the multi-step wizard from spec §"Onboarding wizard":
  1. Stripe checkout (embedded) — uses `phone.startSubscription`
  2. Pick area code (default 04XX mobile)
  3. Show 5 candidate numbers from `phone.provisionNumber` (search step) → user picks → confirms
  4. Provisioning loading state (~10s)
  5. Success: shows the new number + optional "set up forwarding" instructional content with per-carrier links

  Every mutation gets `onError` + `disabled={isPending}` per CLAUDE.md.

- [ ] **Step 3: Show this wizard** when the user navigates to `/portal/phone` and has no `client_phone_numbers` row.

- [ ] **Step 4: Run tests, verify pass.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phone): onboarding wizard — Stripe checkout → number picker → activation"
```

### Task 7.6: Click-to-call hooks throughout the portal

**Files:**
- Modify: `client/src/pages/portal/PortalJobDetail.tsx`
- Modify: `client/src/pages/portal/QuoteListContent.tsx`
- (Customers tab already done in Task 6.4)

- [ ] **Step 1: Add a 📞 button** next to every customer phone display in JobDetail and QuoteListContent. Tapping fires `useSolvrPhone().makeCall(phone, { jobId | quoteId })`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(phone): click-to-call from job + quote detail pages, auto-link source"
```

### Task 7.7: Wire `@buildalpha/capacitor-voice` into the Solvr app

**Files:**
- Modify: `package.json` — add the workspace dep
- Modify: `capacitor.config.ts` — register the plugin
- Modify: `ios/App/Podfile` — pull in the Twilio Voice Cocoapod via the plugin's podspec

- [ ] **Step 1: Add to `package.json`:** `"@buildalpha/capacitor-voice": "workspace:*"`
- [ ] **Step 2: Run `pnpm install` + `npx cap sync ios`** — verify Cocoapods pulls in `TwilioVoice ~> 6.x`.
- [ ] **Step 3: Verify `Info.plist` got the VoIP entries** added by the plugin's postinstall hook.
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ios): integrate @buildalpha/capacitor-voice plugin into Solvr app"
```

---

## Chunk 8: Real-device testing + App Store submission

### Task 8.1: Real-device end-to-end smoke test

- [ ] **Step 1: Build the Solvr app to a real iPhone** via Xcode (Archive → Export → Install on Device).

- [ ] **Step 2: Run the manual smoke test plan** documented in `packages/capacitor-voice/docs/device-test-runbook.md` (from Task 3.5), but now hitting the real Solvr server with a real test tradie account:
  - Inbound: customer dials the test tradie's Twilio number → app rings (CallKit lock screen if backgrounded; in-app overlay if foreground) → accept → audio flows → hang up → post-call sheet shows AI summary within 15s → tap "Generate Quote" → quote appears in drafts
  - Outbound: portal click-to-call from a job → audio flows → hang up → call_logs row has `linkedJobId`
  - No-answer: don't accept → after 20s, Vapi takes over → tradie gets push with summary later
  - Multi-device: install app on iPad too → both devices ring → accept on iPhone → iPad CallKit dismisses
  - Concurrent call: while on a Solvr call, customer #2 dials → routes to Vapi (does NOT ring the device)

- [ ] **Step 2: Document any failures** as bugs to fix BEFORE TestFlight beta.

- [ ] **Step 3: Re-test after each bug fix** until the runbook is fully green.

### Task 8.2: TestFlight beta with 2-3 real tradies

- [ ] **Step 1: Identify 2-3 willing tradies.** Send them the existing Solvr Phone $39/mo signup flow.

- [ ] **Step 2: Provision real numbers** for each + walk them through forwarding their existing business number.

- [ ] **Step 3: Monitor for 1 week:**
  - Twilio call quality complaints
  - Crash reports (Sentry)
  - AI intent-classification accuracy (check 20 random calls — was the suggested CTA correct?)
  - Cost-of-goods reality vs spec projection

- [ ] **Step 4: Fix any P0/P1 issues uncovered.**

### Task 8.3: App Store Connect submission

- [ ] **Step 1: Update App Store listing copy** to mention VoIP calling.

- [ ] **Step 2: Provide reviewer with test-account credentials** + a demo phone number reviewer can call to test inbound. Include in App Review Notes:
  > "This app uses VoIP for calls between tradies and their customers. To test: install, sign in with reviewer credentials, navigate to Phone tab, tap 'Set up your Solvr Phone' to provision a test number. Call that number from any phone — the app will ring."

- [ ] **Step 3: Bump build number** in `ios/App/App.xcodeproj/project.pbxproj` (this will be Build 30+ depending on intervening releases).

- [ ] **Step 4: Archive + upload via Xcode.**

- [ ] **Step 5: Submit for review.** Plan +1-2 weeks for review cycles.

### Task 8.4: Post-approval rollout

- [ ] **Step 1: After App Store approval**, slowly enable the Phone feature for existing tradies via the Phone tab opt-in wizard.

- [ ] **Step 2: Watch metrics:**
  - % of tradies who activate Phone within 30 days of approval
  - Average minutes used per active tradie (compare to spec projection)
  - Quote Engine usage uplift attributable to call → quote conversions
  - Stripe MRR from the $39/mo add-on

- [ ] **Step 3: Iterate.** If average usage is way under cap (e.g. <50 min/mo), the cap might be too generous. If over, V2.5 Pro tier discussion.

---

## Done

If you reached here with all checkboxes ticked: V2 has shipped. Tag the merge commit `solvr-cloud-phone-v2-shipped` and write a short retro doc covering what surprised you during implementation — that retro is what informs V2.5 (Android, ring groups, porting) and the next tradie app you build using `@buildalpha/capacitor-voice`.
