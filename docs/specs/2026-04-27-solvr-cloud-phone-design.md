# Solvr Cloud Phone (V2) — Design Spec

**Status:** Approved (design phase). Ready for implementation planning.
**Author:** Jayden Kowaider + Claude (brainstorming session)
**Date:** 2026-04-27
**Sequencing:** This ships AFTER build 24 (QOL pass) lands in the App Store. Do not delay launch for this.
**Related docs:** `docs/specs/2026-04-25-post-launch-roadmap.md`

---

## TL;DR

A native iOS Capacitor plugin (`@buildalpha/capacitor-voice`) plus server-side wiring that gives every Solvr-subscribed tradie a phone number that rings inside the app like WhatsApp, records every call, transcribes + AI-summarises it, and routes the post-call action (Generate Quote / Add Note / Link to Job) based on detected intent. Bundled with the existing AI Receptionist as a paid `$39/month` add-on with a 200-inbound / 100-outbound minute fair-use cap.

The native plugin is **Solvr-blind by design** so it can drop into the next tradie app you build without rewriting native code.

---

## Context & motivation

SOLVR's current setup:
- AI Receptionist (Vapi) handles inbound calls when the tradie can't answer
- Twilio is wired for SMS but not Voice
- Voice-to-Quote pipeline exists (Whisper + GPT-4o) for tradies to dictate quotes from a recording
- Quote Engine generates branded PDF proposals
- `tradieCustomers` table exists but is only linked from SMS — `portalJobs` and `quotes` still store customer details denormalised

The gap: every call a tradie makes or receives is invisible to Solvr. The "Generate Quote in 12 seconds" magic only works when they remember to record themselves describing the job. If we route the actual call through Solvr, every conversation becomes a potential lead.

The vision (in the user's words): "Their number is linked to the app. It rings similar to WhatsApp in the app. They answer the call. The call's immediately recorded. And it's logged against the jobs. And if the recording is a quote, recording, it will fire the quote feature for the tradie to review. And if it's a follow-up on the job, it's added as a note and a call log."

---

## Goals

1. **WhatsApp-feel inbound:** When a customer calls a tradie's Solvr number, the app rings via CallKit's lock-screen UI. Lift to answer. Hang up like a regular call.
2. **Outbound from anywhere in the portal:** Click any customer phone number in the portal → in-app VoIP call.
3. **Every call recorded server-side** (Twilio TwiML `record="record-from-answer-dual"`) — no on-device audio capture.
4. **AI post-call routing:** Whisper transcribe → GPT-4o intent classification → suggest one primary action ("Generate Quote" / "Add note to Bathroom Reno" / etc.) — tradie taps to confirm.
5. **No-answer fallback:** Vapi AI Receptionist takes the call, transcript saved into the same `call_logs` row.
6. **Reusable:** The native plugin is generic — tradie-app agnostic. Drop it into the next tradie app you build.
7. **Break even on costs:** $39/month add-on covers Twilio + Vapi + AI inference at fair-use volumes with healthy margin.

## Non-goals

- Replacing the tradie's existing personal phone (forwarding from existing number is the migration path)
- Conference calls, three-way calls, call merging
- SMS within the phone tab (existing `smsConversations` flow stays separate)
- Auto-firing actions without tradie confirmation (suggest + one-tap confirm only)
- Metered overage billing in V2 (cap pauses feature; V2.5 if needed)
- Android in V2 (V2.5)

---

## Pre-requisite refactors (before any V2 work begins)

Three small refactors that pay back instantly. Not optional — the V2 work depends on them.

1. **Extract `normalisePhone` to `server/lib/phoneNumber.ts`.** Today it's exported from `server/twilioInboundSms.ts:63` AND duplicated at `server/vapiTools.ts:120`. The phone webhooks need it; deduplicate now.
2. **Extract Twilio webhook signature validation to `server/lib/twilio.ts`.** Currently inlined in `twilioInboundSms.ts`; the new voice webhooks need the same validation pattern.
3. **Extract Whisper transcription helper to `server/lib/transcription.ts`.** Used today by Voice-to-Quote (`server/audioUpload.ts`). The phone AI pipeline reuses it. The GPT-4o intent classifier itself is **new** (built atop `invokeLLM`) — it does NOT exist today and isn't a refactor.

Do these as their own PR before merging V2 work. ~half a day.

---

## Decisions log

The brainstorming session settled six decisions. These are non-negotiable for V2; deviating means revisiting the design.

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Platform scope | iOS first, Android in V2.5 | Solvr's app is iOS today. Plugin's JS surface designed platform-agnostic so Android slots in cleanly later. |
| 2 | Plugin reusability | Generic private plugin (`@buildalpha/capacitor-voice`) | Future tradie apps wire their own JS layer atop the same native plugin. No diverging native codebases. |
| 3 | Post-call routing | AI suggests + one-tap confirm | Auto-firing breaks trust the first time AI is wrong. Always-menu makes AI useless. Suggest-confirm is the iOS-native pattern. |
| 4 | AI fallback (no-answer) | Smart default ON, configurable | Vapi already integrated. Defaulting on means first missed call captures a lead. Settings let opt-outers disable. |
| 5 | Customer linking | Promote `tradieCustomers` to central, backfill `portalJobs` + `quotes` | Single source of truth. Customers tab becomes useful instead of half-built. |
| 6 | Provisioning + pricing | Opt-in via wizard. **$39/month Stripe add-on** with 200/100 min fair-use cap. Past cap → feature pauses (no metered overage in V2). | Cost ~$26/month at cap; ~$13/month margin. Light users (~$8 cost) subsidise heavy. Higher-tier upsell happens via the Quote Engine sticking. |

---

## Architecture: three-layer split

```
┌──────────────────────────────────────────────────────────────┐
│  @buildalpha/capacitor-voice  (native, Solvr-agnostic)        │
│  Pure telephony primitives. No business logic.                │
│                                                                │
│  iOS:  Twilio Voice iOS SDK + CallKit + PushKit + AVAudio     │
│  Android (V2.5): Twilio Voice Android + ConnectionService     │
│                  + FCM high-priority push                     │
│                                                                │
│  JS API:                                                       │
│   • registerVoipPush()                                         │
│   • connect(token, params)                                     │
│   • events: incomingCall, callConnected, callEnded,            │
│             recordingReady, error, voipTokenUpdated            │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  Solvr Capacitor app (JS layer — Solvr-specific)              │
│                                                                │
│  • useSolvrPhone() hook wraps the plugin, adds customer       │
│    lookup, post-call routing, AI-suggestion confirm UX        │
│  • Phone tab, Customers tab, post-call sheet, dial pad        │
│  • SSE listener for server-pushed events                      │
└──────────────────────────┬───────────────────────────────────┘
                           │ tRPC + webhooks
┌──────────────────────────▼───────────────────────────────────┐
│  Solvr server (Node + tRPC, existing infra)                   │
│                                                                │
│  • Twilio webhooks: /voice, /dial-result, /recording, /outgoing│
│  • AI analysis: Whisper → GPT-4o intent + summary + actions   │
│  • VoIP push delivery via APNs → wakes the app on incoming    │
│  • Number provisioning + tradieCustomers backfill             │
│  • Vapi handoff on no-answer (existing integration)           │
│  • Stripe subscription for the $39/month add-on               │
└──────────────────────────────────────────────────────────────┘
```

**Why the split:** the native plugin must work for any tradie app, not just Solvr. So it knows nothing about jobs, quotes, customers, or AI. It bridges Twilio's iOS SDK to JS-callable events. All "this customer is calling about Job #45" intelligence happens in the JS layer.

---

## Native plugin surface (`@buildalpha/capacitor-voice`)

**iOS native:** Swift. Depends on Twilio Voice iOS SDK Cocoapod (`twilio-voice-ios ~> 6.x`), CallKit, PushKit, AVFoundation. Single Capacitor plugin class.

**JS API (TypeScript declarations):**

```ts
export interface BuildAlphaVoicePlugin {
  // ── Setup ─────────────────────────────────────────────────────
  /** One-time on app launch. Returns the VoIP token to send to your server. */
  registerVoipPush(): Promise<{ token: string; platform: 'ios' | 'android' }>;

  /** iOS rotates VoIP tokens — re-send to server when this fires. */
  addListener('voipTokenUpdated', (e: { token: string }) => void);

  // ── Outbound ──────────────────────────────────────────────────
  connect(opts: {
    token: string;                          // Twilio access token, ~1hr TTL
    toNumber: string;                       // E.164
    params?: Record<string, string>;        // Opaque — passed to your TwiML
  }): Promise<{ callSid: string }>;

  // ── Active call control ──────────────────────────────────────
  acceptIncoming(): Promise<void>;
  rejectIncoming(): Promise<void>;
  disconnect(): Promise<void>;
  setMuted(opts: { muted: boolean }): Promise<void>;
  setSpeaker(opts: { on: boolean }): Promise<void>;

  // ── Lifecycle events ────────────────────────────────────────
  addListener('incomingCall', (e: {
    callSid: string;
    fromNumber: string;                     // E.164 — JS does customer lookup
    customParams: Record<string, string>;
  }) => void);

  addListener('callConnected', (e: { callSid: string }) => void);

  addListener('callEnded', (e: {
    callSid: string;
    durationSeconds: number;
    endedBy: 'local' | 'remote' | 'error';
    errorCode?: number;
  }) => void);

  addListener('recordingReady', (e: {
    callSid: string;
    recordingSid: string;
  }) => void);
}
```

**Recording: server-side, not on-device.** Twilio's TwiML `<Dial record="record-from-answer-dual">` records on Twilio's infrastructure. Plugin doesn't capture local audio. Server downloads from Twilio and uploads to R2. Two reasons:
1. **App Store review** — local audio capture in a VoIP app needs extra justification.
2. **Quality** — Twilio's recording is dual-track at full PSTN quality.

**Apple-mandated:** plugin MUST call CallKit's `reportNewIncomingCall` synchronously inside the PushKit handler. Skip it once → iOS bans the VoIP token. Plugin enforces this; JS never thinks about it.

**Permissions configured by the plugin's install hook:**
- `NSMicrophoneUsageDescription` — "Solvr uses your microphone for in-app calls."
- `UIBackgroundModes`: `audio` + `voip`
- VoIP services entitlement (requires VoIP push cert from Apple Developer)

**The plugin does NOT contain:**
- Customer/job/quote lookup (JS layer)
- AI analysis (server)
- Twilio access token generation (server tRPC procedure)
- Recording download / R2 upload (server)
- Push notifications about post-call summary (server SSE → JS)

---

## Schema changes

Three new tables, four FK additions on existing tables, one backfill migration. All Drizzle.

### New: `client_phone_numbers`

```ts
export const clientPhoneNumbers = mysqlTable("client_phone_numbers", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),                          // FK→crmClients
  twilioSid: varchar("twilioSid", { length: 100 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),  // E.164
  friendlyNumber: varchar("friendlyNumber", { length: 20 }).notNull(),
  type: mysqlEnum("type", ["provisioned", "ported", "forwarded"]).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  isDefault: boolean("isDefault").notNull().default(true),
  ringTimeoutSeconds: int("ringTimeoutSeconds").notNull().default(20),
  aiFallbackEnabled: boolean("aiFallbackEnabled").notNull().default(true),
  // Stripe subscription state — feature gate.
  // Mirrors all Stripe statuses we care about: trial (free trial),
  // active (paid + valid), past_due (payment failed but in retry grace),
  // unpaid (retry exhausted), incomplete (initial payment failed),
  // cancelled (user-cancelled or terminal). Feature is enabled for
  // {trial, active, past_due}; disabled for {unpaid, incomplete, cancelled}.
  // past_due gets a soft "payment failed, please update card" banner in
  // the portal but inbound calls keep ringing for the grace window.
  subscriptionStatus: mysqlEnum("subscriptionStatus",
    ["trial", "active", "past_due", "unpaid", "incomplete", "cancelled"]
  ).notNull().default("trial"),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 100 }),
  // Usage tracking — gates the fair-use cap.
  // Reset to 0 every billing cycle by a daily cron that compares
  // billingCycleStart to NOW() and rolls over if a new cycle has begun.
  // The /voice webhook reads inboundMinutesUsed before allowing a call
  // through; over cap → routes to Vapi fallback only.
  billingCycleStart: timestamp("billingCycleStart").notNull().defaultNow(),
  inboundMinutesUsed: int("inboundMinutesUsed").notNull().default(0),
  outboundMinutesUsed: int("outboundMinutesUsed").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

Indexes: `(clientId)`, unique `(phoneNumber)`.

### New: `call_logs`

Source of truth for every call. Distinct from `crmInteractions` (general CRM touchpoints) — `call_logs` is the telephony record with Twilio SIDs, recording URL, AI intent.

```ts
export const callLogs = mysqlTable("call_logs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  twilioCallSid: varchar("twilioCallSid", { length: 100 }).notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  status: mysqlEnum("status", [
    "ringing", "in_progress", "completed", "missed",
    "voicemail", "no_answer", "busy", "failed"
  ]).notNull(),
  fromNumber: varchar("fromNumber", { length: 20 }).notNull(),
  toNumber: varchar("toNumber", { length: 20 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }),  // normalised
  tradieCustomerId: int("tradieCustomerId"),                // FK→tradieCustomers
  answeredBy: mysqlEnum("answeredBy",
    ["human", "ai_receptionist", "voicemail"]),
  durationSeconds: int("durationSeconds"),
  talkTimeSeconds: int("talkTimeSeconds"),
  recordingUrl: varchar("recordingUrl", { length: 500 }),    // R2
  recordingSid: varchar("recordingSid", { length: 100 }),
  transcript: text("transcript"),
  aiSummary: text("aiSummary"),
  aiIntent: mysqlEnum("aiIntent", [
    "new_quote", "quote_followup", "job_update", "new_job",
    "complaint", "payment", "general_enquiry", "scheduling", "other"
  ]),
  aiActionItems: json("aiActionItems").$type<string[]>(),
  aiSentiment: mysqlEnum("aiSentiment", ["positive", "neutral", "negative"]),
  linkedQuoteId: int("linkedQuoteId"),                       // FK→quotes
  linkedJobId: int("linkedJobId"),                           // FK→portalJobs
  calledAt: timestamp("calledAt").notNull(),
  answeredAt: timestamp("answeredAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

Indexes:
- `(clientId, calledAt DESC)` — main list query
- `(clientId, tradieCustomerId)` — customer call history
- `twilioCallSid` unique — webhook dedup

### New: `voip_push_tokens`

```ts
export const voipPushTokens = mysqlTable("voip_push_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deviceId: varchar("deviceId", { length: 100 }).notNull(),
  platform: mysqlEnum("platform", ["ios", "android"]).notNull(),
  token: varchar("token", { length: 500 }).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

Multiple rows per user intentional — tradie has app on iPhone + iPad, both ring on incoming.

### FK additions to existing tables

- `portalJobs.tradieCustomerId` (FK → `tradieCustomers`, nullable)
- `portalJobs.sourceCallLogId` (FK → `call_logs`, nullable)
- `quotes.tradieCustomerId` (FK → `tradieCustomers`, nullable)
- `quotes.sourceCallLogId` (FK → `call_logs`, nullable)
- `tradieCustomers` gets a unique index on `(clientId, normalisedPhone)`

Bidirectional: a quote/job knows which call spawned it; a call knows which job/quote it belongs to.

### Backfill migration (idempotent)

For each existing `portalJobs` row with `customerPhone`:
1. Normalise phone to E.164 using `server/lib/phoneNumber.ts:normalisePhone` (extracted from `server/twilioInboundSms.ts:63` per pre-requisite refactor #1).
2. `tradieCustomers.findOrCreate({ clientId, phone })`.
3. Set `portalJobs.tradieCustomerId`.

Same for `quotes`. Names, emails, addresses from `portalJobs`/`quotes` populate empty `tradieCustomers` fields. `jobCount`, `totalSpentCents`, `lastJobAt` recomputed from aggregates.

Re-runnable via the unique constraint. Existing `tradieCustomers` from SMS get enriched, not replaced.

---

## Server architecture

All inside the existing tRPC + webhook stack. No separate microservice.

### Webhook routes (file: `server/webhooks/twilioVoice.ts`, modelled on `server/twilioInboundSms.ts`)

**`POST /api/webhooks/twilio/voice`** — inbound entry point.

1. Validate Twilio signature using `server/lib/twilio.ts:validateTwilioSignature` (extracted per pre-requisite refactor #2)
2. Look up `client_phone_numbers` by `To` (404 TwiML if unknown)
3. **Subscription gate.** If `subscriptionStatus ∉ {trial, active, past_due}` OR `inboundMinutesUsed > 200` → if `aiFallbackEnabled`, redirect to Vapi fallback only; else 486 busy. Don't ring the device.
4. **Concurrent-call gate.** Query `call_logs` for any `(clientId, status='in_progress')` row in the last 30 min. If one exists, redirect to Vapi fallback (don't try to ring the device — would crash CallKit).
5. Look up `tradieCustomers` by `(clientId, normalised(From))`
6. INSERT `call_logs` row, status `ringing`
7. **APNs VoIP-push to ALL the tradie's `voip_push_tokens`** → every active device (iPhone + iPad) wakes and rings
8. Return TwiML: `<Dial timeout=20 record="record-from-answer-dual" action=/dial-result>` to client identity `client:<userId>`

**`POST /api/webhooks/twilio/dial-result`** — no-answer fallback.

If `DialCallStatus ∈ {no-answer, busy, failed}` and `clientPhone.aiFallbackEnabled`:
- TwiML `<Redirect>` to a Twilio Bin (or another endpoint) that routes to the existing Vapi number, passing `callLogId` as a query param.
- Vapi handles the call. Its existing `vapiWebhook.ts` finds the `call_logs` row by `callLogId` and updates `aiSummary`, `transcript`, etc. — same row, single source of truth.

If disabled → TwiML `<Say>` voicemail greeting + `<Record>`.

**`POST /api/webhooks/twilio/recording`** — recording ready.

**Idempotency-first.** Twilio retries POSTs on any non-2xx for ~24h. Guard:
1. Look up `call_logs` by `twilioCallSid`.
2. If `recordingSid` is already set on the row → return 200 immediately. Skip the rest.

Otherwise: fetch audio from Twilio API → upload to R2 via existing `storagePut()` (key `call-recordings/{clientId}/{callLogId}.mp3`) → UPDATE `call_logs.recordingUrl/recordingSid/durationSeconds` → trigger AI pipeline.

Update `client_phone_numbers.inboundMinutesUsed` (or `outboundMinutesUsed`) atomically here based on the call's `direction` and `durationSeconds`.

**`POST /api/webhooks/twilio/outgoing`** — TwiML for outbound. Returns `<Dial callerId=<businessNumber> record="record-from-answer-dual">` so outgoing calls show the business number and get recorded.

**`POST /api/webhooks/twilio/status`** — call status callbacks. Progresses `call_logs.status` (`in_progress` → `completed`).

### VoIP push delivery flow

```
Customer dials business number
  → /voice webhook
  → Server INSERT call_logs + APNs VoIP push to ALL user's tokens
  → Each device wakes (even if killed)
  → Each plugin's PushKit handler IMMEDIATELY reports to CallKit → lock-screen UI
  → User taps Accept on Device A → Plugin calls phone.acceptIncoming
       ↓
  → Server fans out a "cancel" VoIP push to all OTHER tokens of the same user
       (carries the callSid + a CXEndCallAction signal in the payload)
  → Other devices' plugins receive cancel push → CallKit dismisses ringing UI
       ↓
  → Device A's plugin connects via Twilio SDK using fresh access token (from tRPC)
  → Audio flows; server-side Twilio recording begins
```

**Apple's hard requirement:** the plugin MUST call `CXProvider.reportNewIncomingCall` synchronously in the PushKit handler — even for the cancel push, where the plugin reports + immediately ends the call. Skipping this once → iOS bans the VoIP token. Not negotiable; plugin enforces.

**Server-side delivery uses the `.p12` certificate flow** with `apn` 2.x or `@parse/node-apn`. The token-based `.p8` auth-key flow is **NOT supported by Apple for VoIP pushes** (only for regular APNs) — you'll waste half a day debugging if you go that route. Two distinct push certs are needed: one regular APNs cert (existing, for post-call summaries) and one new VoIP Services cert (this spec's new requirement).

### AI pipeline (`server/_core/callIntelligence.ts`)

Triggered after `/recording` webhook completes the R2 upload.

**What's reused from the existing Voice-to-Quote flow:**
- Whisper transcription helper (`server/lib/transcription.ts`, extracted per pre-requisite refactor #3 from `server/audioUpload.ts`).

**What's new:**
- GPT-4o-mini intent classifier, system prompt, JSON schema, action-item extraction, sentiment analysis, `quoteSeed` extraction. None of this exists today — built fresh atop `invokeLLM`. Budget ~half a day for prompt tuning against real call transcripts before declaring it production-ready.

```
R2 audio
  → Whisper transcript (REUSED helper)
  → GPT-4o-mini call analysis (NEW) with system prompt + JSON schema:
      output: { summary, intent, actionItems, sentiment,
                callerNameExtracted, referencedQuoteNumber,
                referencedJobTitle, quoteSeed }
  → UPDATE call_logs.{aiSummary, aiIntent, aiActionItems, aiSentiment}
  → If callerNameExtracted + tradieCustomer.name is empty, populate it
  → Regular APNs push (NOT VoIP) → "Sarah — leaking tap quote — tap to review"
  → SSE event for any open Phone tabs to live-refresh
```

System prompt and JSON schema match the user's original build prompt (Section 5.2/5.3). Australian English, 2-4 sentence summary, intent enum, action items as short tasks, optional `quoteSeed` for direct-to-Quote-Engine handoff.

### tRPC router (new: `server/routers/phone.ts`)

| Procedure | Purpose | Rate limit |
|---|---|---|
| `phone.getAccessToken` | Issues 1hr Twilio Voice token for outbound `connect()`. **Must refresh only when ≤5 min remain on previous token; cap at 10 rpm/user.** Token-mint endpoints are abuse magnets. | 10 rpm/user |
| `phone.registerVoipToken` | Saves the APNs token from plugin's `registerVoipPush()` | 60 rpm/user (default) |
| `phone.initiateCall` | Pre-creates `call_logs` for outbound before plugin connects | 30 rpm/user |
| `phone.listCalls` | Phone tab queries (paginated, filterable) | 60 rpm/user |
| `phone.getCall` | Call Detail page | 60 rpm/user |
| `phone.linkToQuote` / `phone.linkToJob` | Manual linking from post-call screen | 60 rpm/user |
| `phone.startSubscription` | Starts the $39/month Stripe subscription | 5 rpm/user |
| `phone.provisionNumber` | Onboarding wizard backend | 3 rpm/user (Twilio cost-per-call) |
| `phone.updateSettings` | Ring timeout + AI fallback toggle | 60 rpm/user |

### Vapi handoff (corrected from initial design)

The original "pass `callLogId` as a query param through TwiML `<Redirect>`" approach **doesn't work** — TwiML doesn't propagate query params into Vapi's webhook payload. Two viable alternatives:

**Approach (selected for V2): reconcile by Twilio call SID.**

Vapi's webhook payload includes the originating phone-call provider's call ID (under `call.phoneCallProviderId` for Twilio-originated calls). Solvr already stores `twilioCallSid` on the `call_logs` row from the original `/voice` webhook. So:

1. `/dial-result` webhook fires with `DialCallStatus = no-answer`.
2. TwiML `<Redirect>` to a Solvr-controlled `/api/webhooks/twilio/vapi-handoff?callLogId=N` endpoint.
3. That endpoint stashes `(twilioCallSid → callLogId)` in a short-lived map (5-min TTL in Redis or in-memory cache) AND returns TwiML `<Dial><Number>` to the per-tradie Vapi number (looked up from `crmClients.vapiAgentId` → assistant config → its phone).
4. Vapi answers, fires its own webhook with `phoneCallProviderId` set to the Twilio call SID.
5. `vapiWebhook.ts` looks up the `(twilioCallSid → callLogId)` cache; if present, it merges into the existing `call_logs` row instead of creating new `crmInteractions`.

**Approach (V2.5 if Vapi's payload doesn't expose Twilio SID):** Use Vapi's REST API to start the call with `assistantOverrides.metadata = { callLogId }`. The metadata flows back in the webhook. More implementation work; defer until needed.

**Verify before implementation:** does Vapi's webhook payload actually include `call.phoneCallProviderId`? If not, fall back immediately to the metadata approach. Spec assumes (i); reviewer should confirm against Vapi docs as a Week-1 task.

**`vapiWebhook.ts` changes:**
- New: when `phoneCallProviderId` matches a known `call_logs.twilioCallSid`, UPDATE the existing row with transcript/summary instead of inserting a fresh `crmInteractions` row.
- Otherwise: existing behaviour (Vapi-only call → `crmInteractions` insert).

This avoids double-writing the same call into both tables.

### Stripe subscription wiring

- New Stripe Price: `Solvr Phone — $39/month AUD`
- `phone.startSubscription` mutation creates a Stripe subscription with this price + tradie's existing customer ID
- Stripe webhook (existing infra) flips `client_phone_numbers.subscriptionStatus` on subscription state changes
- Server checks `subscriptionStatus = 'active'` (or `'trial'`) before issuing access tokens, before VoIP-pushing inbound calls, before allowing outbound `connect()`. Inactive → return a 402 / "subscription required" error to the JS layer
- Cancellation: feature stops at end of current billing period. `client_phone_numbers` row stays so historical call logs remain accessible

---

## JS layer (Solvr-specific UX)

### `useSolvrPhone()` hook

Mounted at the portal root inside `PortalLayout`. Wraps `@buildalpha/capacitor-voice` + adds:

- VoIP token registration on launch → `phone.registerVoipToken` mutation
- `incomingCall` event → tRPC customer/active-job lookup → renders incoming overlay
- `callConnected` → renders the in-call screen with context
- `callEnded` → SSE listener waits for AI-analysis result → renders post-call confirm
- `makeCall(toNumber, { quoteId?, jobId? })` → `phone.initiateCall` mutation pre-creates `call_logs` row, then plugin's `connect()`

```ts
const { state, makeCall, accept, reject, hangUp, mute, speaker } = useSolvrPhone();
// state: 'idle' | 'incoming' | 'connecting' | 'connected' | 'ended'
```

### In-call screen (custom, renders after CallKit accept)

```
┌────────────────────────────────────────┐
│  Sarah Mitchell           02:34       │
│  0412 987 654                          │
│                                        │
│  ─ Active context ─────────────       │
│  Open quote: Q-00012 ($896.50)         │
│  Active job: Bathroom Reno (Job #45)   │
│                                        │
│      [Mute]  [Speaker]  [Keypad]       │
│           [End Call ●]                 │
└────────────────────────────────────────┘
```

The "Active context" panel is what makes this smart — the tradie sees who they're talking to and what's open mid-call without leaving the screen.

### Post-call confirm sheet

Slides up after `callEnded` + AI analysis lands. Typically 5–15 sec after hangup; SSE delivery from the AI pipeline fires the render.

```
┌────────────────────────────────────────┐
│  ✅ Call ended · Sarah · 4:12          │
│                                        │
│  📝 "Sarah called about a leaking      │
│   bathroom tap at her Penrith          │
│   property. She'd like a quote for     │
│   tap replacement, this week."         │
│                                        │
│  Looks like a quote request →          │
│  ┌──────────────────────────────┐     │
│  │  [📋 Generate Quote]   ←     │ ← primary CTA from aiIntent
│  └──────────────────────────────┘     │
│                                        │
│  or:                                   │
│  • Add as a note                       │
│  • Link to existing job                │
│  • Dismiss                             │
│                                        │
│  ▶ Recording  4:12                     │
│  ▶ Full transcript (collapsible)      │
└────────────────────────────────────────┘
```

Primary CTA computed from `aiIntent`:

| `aiIntent` | Primary CTA | Action |
|---|---|---|
| `new_quote` | **Generate Quote** | `quotes.createFromCall` (reuses Voice-to-Quote pipeline) |
| `quote_followup` | **Add note to Q-00012** | `crmInteractions` insert + link to quote |
| `job_update` / `new_job` | **Add note to Bathroom Reno** | `crmInteractions` + `portalJob` link |
| anything else | **Add as a note** | `crmInteractions` standalone |

Tap → mutation → optimistic toast → done. One tap, no navigation.

### Phone tab (`/portal/phone`)

Replaces the existing "Calls" tab in the bottom nav (per original prompt's open question #9). Existing Vapi-only call summaries continue to appear, merged into the unified list.

Layout: chronological, grouped by Today / Yesterday / This Week / Earlier. Each card: direction arrow + customer name + duration + intent badge + 1-line AI summary. Tap → call detail. FAB bottom-right → Dial Pad.

### Call Detail (`/portal/phone/[callLogId]`)

Same shape as the post-call sheet, full-screen. Adds:
- Customer history (other calls + linked quotes/jobs)
- Recording player + transcript
- Linked quote/job (if any) with deep-link
- Sticky bottom: [📞 Call back]

### Customers tab (newly enabled by the backfill)

Empty before V2 because `tradieCustomers` was barely linked. After Section "Schema changes" backfill, this becomes a real customer list.
- List view: name, phone, last contact, lifetime spend
- Detail view: every call/quote/job for that customer (one source of truth view)

### Onboarding wizard (one-time, on first Phone-tab visit)

```
Empty state: "Set up your Solvr Phone — $39/month"
  → Stripe checkout (single-page, embedded)
  → Pick area code (default 04XX mobile)
  → Twilio search shows 5 candidates → pick one
  → Provisioning... (~10s)
  → "Your number is 0412 345 678.
     Set up forwarding from your existing number? [Show me how] / [Not now]"
  → Phone tab populates.
```

The "Show me how" links to per-carrier (Telstra/Optus/Vodafone) forwarding instructions. Porting is a separate slower flow under Phone Settings (5–20 business days).

### Click-to-call hooks (the silent multiplier)

Every customer phone in the portal becomes tappable:
- `PortalJobDetail` → 📞 → call with `linkedJobId` pre-set
- `PortalQuoteDetail` → 📞 → call with `linkedQuoteId` pre-set
- Customers tab → 📞 → call with `tradieCustomerId` pre-set

Makes the phone feel native — no separate "phone mode" to switch into.

---

## Operations: Apple, Twilio, env, costs

### Apple Developer setup

| Item | Required |
|---|---|
| **VoIP Services Certificate** | Yes — separate from existing APNs cert. Generate from Apple Developer → Certificates → "VoIP Services Certificate" |
| **App ID capabilities** | Push Notifications enabled |
| **Provisioning profiles** | Regenerate Dev + Distribution profiles after enabling VoIP cert |

### Info.plist (added by plugin install hook)

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Solvr uses your microphone for in-app calls.</string>
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
</array>
```

### Twilio account setup (with AU region for data residency)

- Voice API enabled in Twilio console (existing account already used for SMS)
- **Use Twilio's AU region** (`au1.twilio.com` API endpoint, AU edge location for media) — Australian tradie call audio stays in AU infra. Configure region per-API-call OR set the subaccount's default region. Without this, recordings default to US-region storage which is a privacy disclosure issue you don't need.
- New API Key + Secret for issuing Voice access tokens (don't reuse Account Auth Token)
- TwiML App configured pointing to `/api/webhooks/twilio/outgoing`
- One AU test number for dev/staging
- **R2 bucket region:** confirm Cloudflare R2 bucket uses `apac` location hint so call recordings stay in Asia-Pacific.

### New env vars

```
TWILIO_API_KEY_SID=SKxxx
TWILIO_API_KEY_SECRET=xxx
TWILIO_TWIML_APP_SID=APxxx
TWILIO_REGION=au1                    # ensures AU-region routing
APN_VOIP_CERT_P12_BASE64=...         # base64-encoded .p12 VoIP cert
APN_VOIP_CERT_PASSPHRASE=xxx         # cert passphrase
STRIPE_PRICE_ID_SOLVR_PHONE=price_xxx
```

**Note on `VAPI_TRANSFER_NUMBER`:** removed from initial spec — Vapi is per-tradie via `crmClients.vapiAgentId` (existing setup). The redirect resolves the tradie's specific Vapi number from their assistant config at `/dial-result` time, not a global env var. There is no shared transfer number.

### App Store review — what the reviewer will check

VoIP apps get extra scrutiny:

1. **Is PushKit actually used for VoIP?** — Solvr uses VoIP push only for inbound calls. ✓
2. **Is CallKit invoked synchronously inside the PushKit handler?** — Plugin enforces. ✓
3. **Does the app actually make/receive calls?** — Reviewer will likely call the demo business number. Need a working test instance.
4. **Microphone usage description clear?** — "Solvr uses your microphone for in-app calls." ✓
5. **App Store listing must mention VoIP calling** — update marketing copy when shipping.

Expected outcome: first submission may bounce once on metadata/permission wording (~3–7 day cycle). Plan accordingly.

### Cost-of-goods per active tradie

| Item | $/month |
|---|---|
| Twilio number | $3.50 |
| Inbound calls (200 min × $0.04/min cap) | $8.00 |
| Outbound calls (100 min × $0.08/min cap) | $8.00 |
| Recording (300 min × $0.0025/min) | $0.75 |
| AI analysis (~$0.01/call × 150 calls) | $1.50 |
| Vapi fallback (~10 missed × 2 min × $0.05/min) | $1.00 |
| APNs VoIP push | $0 |
| **Total at cap** | **~$22.75** |
| **Total at average usage (~75 min)** | **~$8.50** |

### Pricing

**Solvr Phone — $39/month** (Stripe add-on, AUD).

| Included | Cap |
|---|---|
| Solvr-provisioned Twilio number | 1 |
| Inbound minutes | 200 |
| Outbound minutes | 100 |
| Recording + AI analysis on every call | ✓ |
| AI Receptionist no-answer fallback (Vapi) | ✓ |

Past the cap: feature pauses at end of billing month with a "you've hit your minutes — upgrade to unlimited or it'll reset on [date]" notice. **No metered overage billing in V2.**

Margin: $13–$31/month per active tradie depending on usage.

**V2.5 if data justifies:** add a "Solvr Phone Pro — $79/month" tier with 500 inbound + 300 outbound (margin ~$20-25/month at cap).

---

## Implementation timeline

4 weeks core dev + 1–2 weeks App Store review buffer.

| Week | Deliverable |
|---|---|
| **1** | Native plugin scaffold: `@buildalpha/capacitor-voice` package, Twilio Voice iOS SDK integrated, VoIP push registration, CallKit `reportNewIncomingCall` flow, JS API matches contract. Unit-tested on physical device. |
| **2** | Server: schema migration + idempotent backfill, Twilio webhooks, VoIP push delivery via `node-apn`, AI pipeline refactored into shared helper, Vapi handoff redirect, Stripe subscription wiring. |
| **3** | JS integration: `useSolvrPhone` hook, in-call screen, post-call confirm sheet, Phone tab, Call Detail, Customers tab, onboarding wizard, click-to-call hooks. |
| **4** | Real-device testing (PushKit doesn't work in simulator). Edge cases: killed-app → VoIP push wakes; network drop mid-call; concurrent calls; app-backgrounded-during-call. TestFlight beta with 2-3 real tradies. App Store submission. |
| **+1–2** | App Store review cycles. |

---

## Risks (ranked by likelihood × impact)

| Risk | Mitigation |
|---|---|
| Apple bounces first submission (VoIP scrutiny) | +1–2 week buffer baked in. Engage Apple's review-feedback flow if specific metadata issue raised. |
| VoIP token revoked from a single missed `reportNewIncomingCall` | Plugin enforces it as the very first line of the PushKit handler. Logged + alerted server-side. |
| Network edge cases on real devices | Week 4 explicitly carved out for device testing. |
| Twilio cost runaway from one heavy-volume tradie | Per-subaccount spend caps in Twilio + alerting at 80% of budget. Feature pauses at fair-use cap (200/100 min) regardless. |
| Vapi `phoneCallProviderId` field doesn't exist in webhook payload | Verify Week 1 against Vapi docs/staging. If absent, switch to `assistantOverrides.metadata` approach via Vapi REST API. |
| Multi-device VoIP push (iPhone + iPad) — both keep ringing after one accepts | Server-side fan-out: on first `phone.acceptIncoming`, push a "cancel" VoIP push to all OTHER `voipPushTokens` rows for the user. Each device's plugin reports + immediately ends the call to satisfy Apple's `reportNewIncomingCall` requirement. |
| Twilio recording webhook retries → double-processing | `recordingSid` idempotency check at top of `/recording` handler — return 200 + skip if already set. |
| Stripe `past_due` silently breaks the feature on one failed renewal | `past_due` is allowed in the gate (grace period). UI banner surfaces "Payment failed, please update card." Feature only hard-stops on `unpaid`/`incomplete`/`cancelled`. |
| Recordings stored in R2 forever → cost runaway | Daily cron purges recordings older than 90 days. Per-tradie retention override available later. |
| Australian privacy concern from US-region recording storage | Twilio AU region + R2 `apac` location hint. Privacy disclosure in onboarding wizard. |
| Stripe subscription state drift vs `client_phone_numbers.subscriptionStatus` | Existing Stripe webhook reconciliation pattern in the codebase handles this. |
| Concurrent inbound call while tradie is on a Solvr call → CallKit crash | `/voice` webhook gates on existing `in_progress` row for the user → routes the second call to Vapi fallback or voicemail; never tries to ring the device twice. |

---

## Open questions for implementation

These need answering during writing-plans, not now:

1. **Recording retention — locked to 90 days.** Daily cron deletes from R2 + nulls `call_logs.recordingUrl`. Per-tradie override comes V2.5.
2. **Recording consent announcement.** Australian law requires one-party consent (party = the tradie). UX cleaner without an announcement. Tradie-configurable toggle in Phone Settings, default OFF.
3. **Multi-staff ring groups.** V2.5 — most Solvr clients are solo tradies today.
4. **Number porting flow detail.** V2.5 — porting takes 5–20 business days regardless of UX polish.
5. **Phone Settings detailed UX.** Ring timeout slider (5–60s), AI fallback toggle, recording-announcement toggle, default outgoing caller ID. Implementation-plan grain.
6. **Suspend behaviour on cap-reached — locked to "AI fallback only."** Past 200 inbound min, the `/voice` webhook redirects directly to Vapi (preserving lead capture) and shows a "minutes used up" banner in the portal.
7. **Vapi webhook payload verification.** Week-1 task: confirm `call.phoneCallProviderId` exposes the Twilio call SID. If not, switch to `assistantOverrides.metadata` approach.
8. **Region failover.** If Twilio AU region has an outage, fall back to US? V2 = no, just take the outage. V2.5 if it bites.

---

## Files this design will touch (preview for implementation plan)

**Pre-requisite refactor PR (do first, separately):**
- `server/lib/phoneNumber.ts` — new, exports `normalisePhone` extracted from `server/twilioInboundSms.ts`
- `server/lib/twilio.ts` — new, exports `validateTwilioSignature` extracted from `server/twilioInboundSms.ts`
- `server/lib/transcription.ts` — new, exports Whisper helper extracted from `server/audioUpload.ts`
- `server/twilioInboundSms.ts` — modified, imports from `lib/`
- `server/vapiTools.ts` — modified, removes its duplicate `normalisePhone`
- `server/audioUpload.ts` — modified, imports from `lib/transcription.ts`

**New (V2 main work):**
- `packages/capacitor-voice/` — the plugin (separate package, private npm or git submodule)
- `drizzle/schema.ts` — three new tables + FK columns + unique index on `tradieCustomers (clientId, phone)`
- `drizzle/migrations/0xxx_solvr_cloud_phone.sql`
- `server/webhooks/twilioVoice.ts`
- `server/_core/callIntelligence.ts` — NEW GPT-4o intent classifier (not a refactor)
- `server/_core/voipPush.ts` — APNs `.p12` cert-based delivery
- `server/_core/usageTracking.ts` — daily cron for billing-cycle rollover + recording purge
- `server/routers/phone.ts`
- `server/routers/customers.ts` (extends the existing `tradieCustomers` flow with the V2-needed CRUD)
- `client/src/hooks/useSolvrPhone.ts`
- `client/src/components/phone/IncomingCallOverlay.tsx`
- `client/src/components/phone/InCallScreen.tsx`
- `client/src/components/phone/PostCallSheet.tsx`
- `client/src/pages/portal/PortalPhone.tsx`
- `client/src/pages/portal/PortalCallDetail.tsx`
- `client/src/pages/portal/PhoneOnboardingWizard.tsx`

**Modified:**
- `server/vapiWebhook.ts` — when `phoneCallProviderId` matches a known `call_logs.twilioCallSid`, merge into existing row instead of inserting `crmInteractions`
- `server/storage.ts` — add `call-recordings/` key prefix helper (optional)
- `client/src/pages/portal/PortalLayout.tsx` — replace Calls tab with Phone tab; mount `useSolvrPhone` hook
- `client/src/pages/portal/PortalJobDetail.tsx` — click-to-call on customer phone (sets `linkedJobId`)
- `client/src/pages/portal/QuoteListContent.tsx` — click-to-call (sets `linkedQuoteId`)
- `client/src/pages/portal/PortalCustomers.tsx` — **already exists**; extend with call-history section, click-to-call, lifetime-spend rollup (NOT a placeholder)
- `capacitor.config.ts` — add `@buildalpha/capacitor-voice` plugin config
- `ios/App/App/Info.plist` — VoIP background modes + mic permission (handled by plugin install hook)
- `ios/App/Podfile` — Twilio Voice iOS Cocoapod
- `package.json` — `@buildalpha/capacitor-voice`, `apn` 2.x or `@parse/node-apn` (NOT the unmaintained `node-apn` 1.x)

---

## Sequencing reminder

**Ship build 24 (QOL pass) to the App Store first.** Get the app approved and into tradies' hands. V2 phone system ships as a v1.1 update once it's built. Don't hold the launch hostage to a 4-6 week native build.

This spec is the source-of-truth design. Implementation plan comes next via the writing-plans skill.
