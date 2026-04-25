# Xero Integration — Scoping Document

**Status:** Draft, not yet approved for implementation
**Author:** Jayden + Claude (this session)
**Date:** 2026-04-25
**Audience:** Anyone picking up the Xero integration build

---

## TL;DR

SOLVR already has a one-way **Xero CSV export** (`invoiceChasing.exportXeroCsv`) — the user clicks "Export to Xero" and imports the file manually. This document scopes the proper **two-way Xero API integration**: OAuth-connect once, then invoices flow SOLVR → Xero automatically, and paid-status flows Xero → SOLVR via webhooks. Goal: the tradie sees paid/unpaid status in SOLVR without ever opening Xero.

This is a **post-launch v2** feature — not blocking App Store submission. The CSV export is good enough for v1.

---

## Goals (in scope for v1 of the integration)

- **Connect Xero account** via OAuth 2.0 (PKCE) from PortalSettings → Integrations.
- **Auto-create Xero invoices** when a SOLVR invoice is created (or marked sendable).
- **Auto-sync payment status** from Xero → SOLVR via Xero webhooks. When a customer marks the invoice paid in Xero (or via Xero's payment link), the corresponding SOLVR invoice flips to `paid` and the chase sequence stops.
- **Sync contacts** (customer name + email + phone + address) from SOLVR → Xero on first invoice creation, idempotent by SOLVR customer ID stored as a Xero contact `AccountNumber`.
- **Disconnect** flow that revokes the refresh token and cleanly stops syncing.
- **Per-client multi-tenant**: each SOLVR client connects their own Xero organisation. No cross-tenant data leak.

## Non-goals (explicitly v2+)

- Pulling existing Xero invoices INTO SOLVR (history sync). Out of scope — existing invoices stay in Xero.
- Bank reconciliation / payment matching beyond what Xero already does.
- Quote sync (SOLVR → Xero quotes). Out of scope — the SOLVR quote PDF is the canonical record.
- Multi-currency. AUD-only at launch. Xero supports more, we don't.
- Tracking categories / classes. Use the Xero default sales account.
- Automatic Xero "Send" of the invoice email. We let the user opt in to "create invoice in Xero" vs "create + send via Xero email". V1 just creates as Draft.
- MYOB / QuickBooks / Reckon. Different doc.
- Importing the Xero chart of accounts to let users pick a sales account. V1 uses Xero's default sales code (200) — same as the CSV export does today.

---

## User stories

1. **Tradie connects Xero**: From SOLVR portal → Settings → Integrations, taps "Connect Xero". Browser opens Xero's auth screen. Approves SOLVR for the org. Lands back on the Settings page with a green "Connected to {Xero Org Name}" badge.
2. **Tradie creates invoice in SOLVR**: Existing flow. SOLVR generates the PDF and queues the chase sequence. Now also pushes the invoice to Xero as Draft (or Approved, configurable). User sees a "✓ in Xero" chip on the invoice card.
3. **Customer pays in Xero**: Customer either receives the SOLVR-emailed invoice (with optional Xero payment link) or pays via Xero directly. Xero fires a webhook. SOLVR receives it, finds the matching invoice by InvoiceNumber, marks it `paid`, stops the chase, and shows the "Marked paid via Xero" event in the audit trail.
4. **Tradie disconnects Xero**: From Settings → Integrations. Confirmation modal: "Existing Xero invoices stay in Xero. Future SOLVR invoices won't sync." Revokes the token. Marks the integration `disconnected` with timestamp.

---

## Architecture

### Overview diagram

```
                   ┌──────────────────┐
                   │  Tradie's Phone  │
                   │  SOLVR Portal    │
                   └────────┬─────────┘
                            │ create invoice
                            ▼
                   ┌──────────────────┐         OAuth 2.0
                   │  SOLVR Server    │  ◀──────────────────▶  Xero Identity
                   │  (Node + tRPC)   │                        (login.xero.com)
                   └────────┬─────────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
         POST invoices  GET invoice    Webhook receiver
         to Xero API    status         (signature-verified)
              │             │              │
              ▼             ▼              ▲
                ┌──────────────────┐       │
                │   Xero API       │───────┘ invoice.UPDATE event
                │  api.xero.com    │
                └──────────────────┘
```

### Data flow — invoice creation

1. User creates SOLVR invoice via existing flow (`invoiceChasing.create` or job → invoice path).
2. Server side: after the SOLVR invoice row is committed, an async job pushes to Xero:
   - Resolve or create the Xero **Contact** (idempotent — match by AccountNumber = `solvr-cust-{customerId}`).
   - POST `/api.xro/2.0/Invoices` with `Type=ACCREC`, `Status=DRAFT` (or `AUTHORISED` if user opted in).
   - Store `xeroInvoiceId` on the SOLVR invoice row.
3. If Xero call fails: log to `xero_sync_log`, retry up to 3 times with backoff (60s, 5m, 30m). After that surface a "Sync failed" badge with a manual retry button.

### Data flow — payment status webhook

1. Xero fires webhook to `POST /api/webhooks/xero` with `events: [{ resourceId, resourceUrl, eventType, eventCategory, ... }]`.
2. Verify HMAC-SHA256 signature using the webhook signing key (per-tenant).
3. For `eventCategory=INVOICE`, fetch the invoice from Xero API, check `AmountPaid >= Total`.
4. Look up SOLVR invoice by `xeroInvoiceId`. If found: mark paid, stop chase, emit audit event.
5. ACK the webhook within 5s (Xero will retry otherwise).

---

## Auth flow (OAuth 2.0 PKCE + offline)

Xero requires standard OAuth 2.0 with offline access for long-lived sync.

```
1. SOLVR generates state (CSRF) + code_verifier + code_challenge (PKCE)
2. Redirect to: https://login.xero.com/identity/connect/authorize
   ?response_type=code
   &client_id=<SOLVR_XERO_CLIENT_ID>
   &redirect_uri=<SOLVR_REDIRECT_URI>
   &scope=offline_access accounting.transactions accounting.contacts
   &state=<state>
   &code_challenge=<challenge>
   &code_challenge_method=S256

3. Xero redirects back to /api/xero/callback?code=…&state=…

4. SOLVR POSTs to https://identity.xero.com/connect/token
     grant_type=authorization_code
     code=<code>
     redirect_uri=<SOLVR_REDIRECT_URI>
     code_verifier=<verifier>
   Returns { access_token, refresh_token, expires_in, id_token }

5. SOLVR fetches /connections to get the tenantId(s) granted.

6. Encrypt refresh_token at rest, store with clientId + tenantId in
   xero_connections table.

7. On each Xero API call, check access_token expiry; if <60s left,
   refresh using refresh_token (Xero rotates refresh tokens — must
   replace stored one with the new one returned).
```

**Required scopes:**
- `offline_access` — required for refresh tokens
- `accounting.transactions` — invoices
- `accounting.contacts` — contacts

**Token storage:** AES-256-GCM, key from `XERO_TOKEN_ENCRYPTION_KEY` env var. Never log raw refresh tokens.

**Token rotation:** Xero rotates refresh tokens on every refresh. We MUST persist the new one or we'll lose access on the next refresh.

---

## Schema changes (drizzle migration)

```ts
// drizzle/schema.ts — new table
export const xeroConnections = mysqlTable("xero_connections", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),  // 1:1 — one Xero org per client
  /** Xero tenant ID (org GUID) */
  tenantId: varchar("tenantId", { length: 36 }).notNull(),
  /** Display name for the Settings page badge */
  tenantName: varchar("tenantName", { length: 255 }).notNull(),
  /** AES-256-GCM encrypted */
  refreshTokenEncrypted: text("refreshTokenEncrypted").notNull(),
  /** AES-256-GCM encrypted */
  accessTokenEncrypted: text("accessTokenEncrypted").notNull(),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt").notNull(),
  /** Per-tenant webhook signing key */
  webhookSigningKeyEncrypted: text("webhookSigningKeyEncrypted"),
  /** When the user last revoked OR token refresh permanently failed */
  disconnectedAt: timestamp("disconnectedAt"),
  /** User pref: create as DRAFT or AUTHORISED in Xero */
  invoiceStatus: mysqlEnum("invoiceStatus", ["DRAFT", "AUTHORISED"]).default("DRAFT").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Add fields to existing invoice_chases / invoices table:
//   xeroInvoiceId: varchar("xeroInvoiceId", { length: 36 })  — null until synced
//   xeroSyncedAt: timestamp("xeroSyncedAt")
//   xeroSyncFailedAt: timestamp("xeroSyncFailedAt")
//   xeroSyncError: varchar("xeroSyncError", { length: 500 })

// Audit log for compliance / debugging:
export const xeroSyncLog = mysqlTable("xero_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  invoiceId: varchar("invoiceId", { length: 36 }),
  event: mysqlEnum("event", ["push_invoice", "pull_status", "webhook_received", "token_refresh", "connect", "disconnect"]).notNull(),
  outcome: mysqlEnum("outcome", ["ok", "error"]).notNull(),
  detail: json("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

---

## UI surface

### Settings → Integrations panel (new section)

```
┌─────────────────────────────────────────────┐
│  Xero                                  [   ] │
│  Sync invoices and payment status            │
│                                              │
│  ◯ Not connected                             │
│      [ Connect Xero ]                        │
│                                              │
│  OR (if connected):                          │
│  ✓ Connected to Smith Plumbing P/L           │
│  Last synced 2 minutes ago                   │
│                                              │
│  Invoice mode: ◉ Draft  ◯ Approved           │
│  (Draft = stays in Xero until you click      │
│   Approve. Approved = ready to email.)       │
│                                              │
│  [ Sync now ]   [ Disconnect ]               │
└─────────────────────────────────────────────┘
```

### Invoice card chip

In PortalInvoices list and on the job detail invoices section, each
invoice row gets a small Xero status chip:

- `✓ in Xero` (green) — synced successfully, has xeroInvoiceId
- `Sync pending` (amber) — queued but not yet pushed
- `⚠ Sync failed — Retry` (red) — push failed after 3 attempts; tap to retry
- (no chip) — Xero not connected

### Onboarding nudge

Adds a 5th step to the activation checklist (only when client has the
Jobs plan or higher): "Connect Xero (optional)" with description "Skip
the CSV export — sync invoices and payments automatically." Marked
optional so it doesn't block the all-done state.

---

## Failure modes & how we handle each

| Failure | Detection | Handling |
|---|---|---|
| Xero API down (5xx) | HTTP status | Retry with backoff (60s, 5m, 30m). After 3 fails, mark `xeroSyncFailedAt` and surface "Retry" chip. |
| Refresh token expired/revoked | 401 on refresh | Mark `disconnectedAt`, send tradie an email asking them to reconnect. Don't keep retrying. |
| Tenant disconnected (user revoked from inside Xero) | 401 on API call OR webhook for `org.disconnect` | Same as above. |
| Webhook signature mismatch | HMAC verify | Reject with 401, log to xero_sync_log. Don't process. |
| Webhook for unknown invoice | Lookup by xeroInvoiceId returns null | ACK the webhook (don't make Xero retry), log warning. |
| Duplicate invoice creation (race) | Unique idx on (clientId, invoiceNumber) | DB constraint. Catch + log. |
| Rate limit (60 req/min per tenant, 5000/day) | HTTP 429 | Respect Retry-After header. Queue with delay. |
| Customer email = null | Pre-check before push | Block push, surface "Add customer email to sync to Xero" inline. |
| GST settings differ in Xero | Default to TaxType=GST on Income | Documented; user can change in Xero after import. |

---

## Cost / pricing implications

- Xero API access is **free** for app developers, no per-request fees.
- Need to register as a **Xero Partner** to publish to the Xero App Store. Optional for MVP — for a private-use OAuth app you just register a "Custom Connection" which limits to one tenant. For multi-tenant we need full **Public App** registration. Free, requires a basic security review.
- Webhook signing key rotation: Xero rotates per-app, not per-tenant. We need a way to update it without downtime. Trivial.
- Compliance: Xero requires a public privacy policy and ToS link. SOLVR already has both.

Estimated effort: **2–3 weeks one engineer**. Major chunks:
- OAuth + token mgmt: 3 days
- Connect/disconnect UI: 1 day
- Push invoice flow: 3 days (incl. retries, dedup, error surfacing)
- Webhook receiver + signature verify: 2 days
- Status sync flow: 2 days
- Schema, migrations, tests: 2 days
- Settings UI + onboarding nudge: 2 days
- Xero Partner registration + security review: 5 days elapsed (mostly waiting)

---

## Phasing

**v1 — Connect + push (MVP):**
- OAuth connect/disconnect
- Push SOLVR invoice → Xero on creation
- Settings UI + sync chip on invoice cards
- Manual "Sync now" button
- No webhooks yet — paid status still requires manual mark-paid in SOLVR.
- Ship to a small alpha group (3-5 tradies who use Xero).

**v2 — Webhooks + auto-paid:**
- Webhook receiver
- Auto mark-paid based on Xero payment events
- Add "Marked paid via Xero" audit event in invoice timeline
- Activation checklist 5th step

**v3 — Polish:**
- Retry button on failed syncs
- Detailed sync log viewer in Settings (debugging)
- Configurable sales account code
- Bulk re-sync for invoices created before Xero was connected

---

## Open questions

1. **Should the SOLVR-generated invoice email also include the Xero payment link?** Pro: customer pays in 2 taps. Con: requires us to fetch the link from Xero before sending the SOLVR email, adding latency and a failure mode. Default answer: **no for v1**, customer follows the SOLVR portal link as today.

2. **What happens if the tradie creates an invoice in SOLVR while Xero is disconnected, then reconnects?** Default: the next "Sync now" tap pushes any unsynced invoices created since disconnect. Cap at 60 days lookback to avoid pushing ancient invoices.

3. **Should we let the tradie choose which Xero org if they have multiple?** Most tradies have one. For v1 we connect to whatever Xero returns first in `/connections` and document the limitation. v3 adds a tenant picker if there are 2+.

4. **Tracking categories**: some tradies use Xero tracking categories to split jobs by location/team. We don't expose this in v1. Add as a v3 advanced setting.

5. **What about invoices the tradie created directly in Xero (before connecting)?** Out of scope. They stay in Xero. SOLVR doesn't see them.

6. **Refunds / credit notes**: out of scope for v1. v3.

---

## What this doc is NOT

- An implementation plan. Once approved, the next step is `superpowers:writing-plans` to break this into engineering tasks.
- A commitment to ship. This is a reference for when post-launch scope opens up.
- A user-facing product description. Marketing copy comes later.

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-25 | DRAFT v1 of this doc | Captured during the post-launch QOL pass. Not greenlit for build yet. |

---

## Next steps if/when this gets greenlit

1. Read the latest Xero API docs (https://developer.xero.com/documentation/api/accounting/overview) — the OAuth and webhook sections specifically. Some details above may be stale by build time.
2. Register the SOLVR Public App at https://developer.xero.com/app/manage. Get client_id + client_secret. Add to env vars.
3. Run `superpowers:writing-plans` against this doc to produce the task breakdown.
4. Add migration files for `xero_connections`, `xero_sync_log`, and the new fields on `invoice_chases`.
5. Build OAuth path first, validate connect/disconnect end-to-end before pushing invoices.
6. Alpha test with 3 tradies before the broader rollout.
