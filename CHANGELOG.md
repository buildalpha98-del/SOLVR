# Changelog — Solvr

All notable changes to the Solvr platform are documented here, organised by sprint. Each entry reflects the actual state of the feature at the time of writing (21 April 2026), not aspirational scope.

**Status key:**

| Tag | Meaning |
|-----|---------|
| **LIVE** | Deployed, tested, working in production with real data |
| **BUILT** | Code complete and passing tests, but depends on an external service that is not yet configured (e.g. missing API key) |
| **PARTIAL** | Core logic exists but specific sub-features are incomplete or untested end-to-end |
| **SCAFFOLD** | UI and/or route exists but backend is placeholder or not wired |

---

## Pre-Launch — 1–3 April 2026

The initial build sprint established the marketing site, brand identity, and sales infrastructure before any portal or product code was written.

**1 April** — Project bootstrapped. React 19 + Tailwind 4 + Express + tRPC stack initialised. Solvr brand identity created (navy #0F1F3D, amber #F5A623, Syne + DM Sans typography). Homepage built with six industry sector cards (law, plumbers, carpenters, builders, health clinics, physios), services section, FAQ accordion, and animated stat counters. AI Business Report landing page created as a lead-generation tool.

**2 April** — Voice Agent product page with feature breakdown, pricing table, and embedded Calendly demo booking links. SEO meta tags, Open Graph images, and `robots.txt` added. Custom domain `solvr.com.au` configured. Owner notification system wired via Manus built-in notification API.

**3 April** — **LIVE**: Stripe integration with 3 test-mode products (Solvr Quotes $49/mo, Solvr Jobs $99/mo, Solvr AI $197/mo) and real Stripe price IDs. Calendly strategy call booking link configured via `VITE_CALENDLY_URL`. Terms of Service and Privacy Policy pages published. ABN displayed in footer. LinkedIn content drafted. Vapi voice agent webhook endpoint registered. Admin console with MRR chart, CRM pipeline, and lead management. Client onboarding form with multi-step wizard.

| Deliverable | Status | Notes |
|---|---|---|
| Marketing homepage (6 sectors) | **LIVE** | Later rewritten to tradie-only in Sprint 5 |
| Stripe checkout (3 plans) | **LIVE** | Test mode; sandbox claimed but not KYC-verified |
| Admin console (CRM, pipeline, MRR) | **LIVE** | Used by Jayden for lead tracking |
| Vapi webhook endpoint | **LIVE** | Receives call transcripts, creates job cards |
| Calendly booking | **LIVE** | Link-only integration, no webhook/data sync |

---

## Sprint 1 — Client Portal Foundation — 4–5 April 2026

Built the tradie-facing portal from scratch: authentication, dashboard, and core navigation.

**4 April** — Portal layout with sidebar navigation (desktop) and bottom tab bar (mobile). Password-based authentication replacing earlier magic-link approach. Portal dashboard with welcome card, recent activity feed, and quick-action buttons. Portal calls page displaying Vapi call transcripts with search and filtering. Portal jobs page with kanban board (drag-and-drop columns: New, Scheduled, In Progress, Completed) and list view toggle. Portal calendar with day/week/month views and event creation modal. Gmail MCP automations for onboarding email sequences. Pre-launch pricing page. Referral partner system with unique codes and conversion tracking.

**5 April** — Portal cookie/session fixes for cross-domain auth. Production deployment to `solvr.com.au`.

| Deliverable | Status | Notes |
|---|---|---|
| Portal auth (password + session) | **LIVE** | Manus OAuth for admin, password auth for tradies |
| Portal dashboard | **LIVE** | KPI cards added later in Sprint 8 |
| Portal calls (Vapi transcripts) | **LIVE** | Requires VAPI_API_KEY (configured) |
| Portal jobs (kanban + list) | **LIVE** | Drag-and-drop, status transitions |
| Portal calendar | **LIVE** | Day/week/month views, event CRUD |
| Referral system | **LIVE** | Partner codes, conversion tracking, blast logs |

---

## Sprint 2 — Voice-to-Quote Engine — 8–9 April 2026

The core product differentiator: record a voice note on-site, get a professional PDF quote in seconds.

**8 April** — Four new DB tables (`quote_voice_recordings`, `quotes`, `quote_line_items`, `quote_photos`). 15 tRPC procedures for the full quote lifecycle. LLM-powered quote extraction from voice transcripts using `invokeLLM()` with structured JSON schema output — extracts customer name, address, line items with quantities and prices, notes, and terms. Quote PDF generation with branded header (logo, ABN, business details), line item table, totals, and terms. Public quote acceptance page at `/quote/:token` where customers can view, accept, or request changes. Feature gating tied to subscription plan (`hasVoiceQuote()` check). Stripe upgrade flow prompting free users to subscribe. iOS audio recording fix for Safari/WebKit `MediaRecorder` API.

**9 April** — Password authentication system (replacing magic links) with bcrypt hashing, login/register flows, forgot-password email via Resend, and reset-password token flow. Portal settings page with profile editing, business details, and bank details for invoice payment instructions. Client login navigation in site header. Footer redesign. Web push notification system using VAPID keys (configured). Test account seeded for demo purposes.

| Deliverable | Status | Notes |
|---|---|---|
| Voice recording → LLM extraction → PDF quote | **LIVE** | End-to-end pipeline working |
| Public quote acceptance page | **LIVE** | Token-based, no auth required |
| Quote follow-up cron | **LIVE** | Sends email reminders for pending quotes |
| Password auth (register/login/forgot/reset) | **LIVE** | Resend email configured |
| Web push notifications | **LIVE** | VAPID keys configured, subscription management |
| Feature gating by plan | **LIVE** | Free/quotes/jobs/ai tiers enforced |

---

## Sprint 3 — Portal Expansion — 10 April 2026

Filled out the operational features a tradie needs day-to-day: invoicing, job documentation, and client communication.

**10 April** — Invoice PDF generation with branded layout matching quote PDF style, sent to customers via Resend email. Before/after job photos with LLM-powered photo analysis (describes damage, identifies materials, estimates scope). Bank details section in portal settings for payment instructions on invoices. Job completion reports at `/report/:token` — public page showing job summary, photos, and sign-off. Onboarding drip email sequence (5-email series over 14 days via cron). Admin console reporting dashboard with basic metrics. Client referral programme UI in portal. Board/list view toggle on jobs page. Web push notification prompts. "Send invoice to client" button with email delivery. Quote engine upgrade prompts for free-tier users.

| Deliverable | Status | Notes |
|---|---|---|
| Invoice PDF + email delivery | **LIVE** | Branded PDF, Resend email |
| Before/after photos + LLM analysis | **LIVE** | Photo upload, AI description |
| Public completion report | **LIVE** | Token-based public page |
| Onboarding drip emails (5-email cron) | **LIVE** | Resend + cron, 14-day sequence |
| Client referral programme | **LIVE** | Referral codes, tracking, portal UI |

---

## Sprint 4 — App Store Prep + Subscription Gating — 12 April 2026

Prepared the platform for iOS App Store submission via Capacitor, and hardened the subscription enforcement layer.

**12 April** — `isNativeApp()` and `getSolvrOrigin()` helpers for Capacitor iOS detection (replaces `capacitor://localhost` with `https://solvr.com.au` for OAuth redirects). Apple and Android reviewer test accounts seeded with realistic data. Subscription gating enforced across all portal features via `planToPackage()` mapping. Stripe Customer Portal integration (`bpc_1TLZA9IJ0SuqQaYDB4bBhsy1`) for self-service plan management. Package audit logging for subscription changes. Admin package override for manual plan assignment. Dashboard UX improvements. `APPLE_APP_STORE_SUBMISSION.md` guide written.

| Deliverable | Status | Notes |
|---|---|---|
| Capacitor iOS detection helpers | **LIVE** | `getSolvrOrigin()` handles OAuth redirect |
| Subscription gating (all portal features) | **LIVE** | Plan checks on every protected procedure |
| Stripe Customer Portal | **LIVE** | Self-service upgrade/downgrade/cancel |
| Apple reviewer test account | **LIVE** | Seeded via `seed-apple-upgrade.mjs` |
| Capacitor Xcode project | **NOT IN THIS REPO** | Lives on Jayden's local machine; no `ios/` directory or `capacitor.config.ts` in the web project |

---

## Sprint 5 — Tradie Pivot + Multilingual + SEO — 14–16 April 2026

Major strategic pivot: dropped the multi-industry positioning and went all-in on Australian tradies. Rebuilt the entire marketing site accordingly.

**14 April** — Complete homepage rewrite removing law firms, health clinics, and physio sectors. New tradie-only positioning with plumber/electrician/carpenter/builder/HVAC/painter/roofer focus. Multilingual voice support for 15 languages (Arabic, Vietnamese, Mandarin, Cantonese, Greek, Italian, Turkish, Hindi, Punjabi, Tagalog, Korean, Spanish, Portuguese, Samoan, Serbian) — the LLM extraction prompt handles non-English transcripts and the quote PDF renders correctly including Arabic RTL via a dedicated `ArabicQuotePDF` component. iOS-safe build adjustments for Apple Review Guidelines 3.1.1 (subscription disclosure).

**15 April** — Seven trade-specific SEO landing pages (`/trades/plumbers`, `/trades/electricians`, `/trades/carpenters`, `/trades/builders`, `/trades/hvac`, `/trades/painters`, `/trades/roofers`). `sitemap.xml` and `robots.txt` generated. Meta tags, canonical URLs, and JSON-LD structured data on all public pages.

**16 April** — Five competitor comparison pages (`/vs/tradify`, `/vs/servicem8`, `/vs/fergus`, `/vs/simpro`, `/vs/buildxact`). Thirteen blog articles covering quoting, business growth, accounting software, and trade-specific "best quoting app" posts. GA4 tag added (`G-XCK9Q37BLV`). `SiteFooter` component rebuilt with trade links, blog links, and legal pages.

| Deliverable | Status | Notes |
|---|---|---|
| Tradie-only homepage | **LIVE** | 7 trade sectors, no more law/health |
| 15-language voice extraction | **LIVE** | LLM handles multilingual transcripts |
| Arabic RTL quote PDF | **LIVE** | Dedicated `ArabicQuotePDF` component |
| 7 trade SEO landing pages | **LIVE** | Static React components, no CMS |
| 5 competitor comparison pages | **LIVE** | Static content, manually maintained |
| 13 blog articles | **LIVE** | Static React components, no CMS |
| GA4 analytics | **LIVE** | Passive tracking only, no server-side events |

---

## Sprint 6 — Portal Feature Expansion — 17 April 2026

A dense sprint that shipped 12 distinct portal features in a single day. Some are fully wired; others depend on Twilio which is not yet configured.

**17 April (morning)** — Bug fixes across the portal (Sprint 0 cleanup). Price list management with CRUD UI and CSV import. Job status tracking with progress payments and cost items. Activation checklist guiding new users through setup steps.

**17 April (afternoon)** — SMS notification system: server-side `sendSms()` helper using Twilio, inbound SMS webhook (`/api/twilio/inbound`), SMS opt-out handling, campaign management with scheduling, bulk SMS composer, SMS templates. Role-based access control (`admin` vs `user` roles on the `users` table, `adminProcedure` guard). Customer management page with CRUD, notes, and tag system. Smart Job Board with AI-powered job matching.

| Deliverable | Status | Notes |
|---|---|---|
| Price list (CRUD + CSV import) | **LIVE** | `price_list_items` table, full UI |
| Job status tracking + progress payments | **LIVE** | Status transitions, cost tracking |
| Activation checklist | **LIVE** | Guides new users through setup |
| Role-based access (admin/user) | **LIVE** | `ctx.user.role` enforcement |
| Customer management | **LIVE** | CRUD, notes, tags, detail page |
| SMS notifications (send, receive, campaigns) | **BUILT — NOT CONFIGURED** | All code written and tested, but `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` are **not in the environment**. Every SMS call silently logs a warning and returns without sending. This means: bulk SMS campaigns, scheduled SMS, SMS opt-out, inbound SMS webhook, appointment reminders via SMS, quote follow-up SMS, and review request SMS are all dead code until Twilio is configured. |
| Smart Job Board | **PARTIAL** | UI exists, AI matching logic present, but not tested with real job data at scale |

---

## Sprint 7 — Product Maturity — 18 April 2026 (morning)

Product audit, UX overhaul, and monetisation infrastructure.

**18 April (morning)** — 28-item product audit completed. UX rebuild: tradie-first navigation with bottom tab bar, workflow consolidation, swipe gestures via touch event handlers (no native gesture library), pull-to-refresh pattern. Trade AI Assistant (`PortalAssistant.tsx`) — a chat interface powered by `invokeLLM()` with context about the tradie's business, jobs, quotes, and customers. Custom job templates allowing tradies to save reusable job configurations. End-to-end pipeline test (`pipeline.e2e.test.ts`) validating voice recording → quote extraction → PDF generation → email delivery. IP protection documentation (`ClearPath AI` branding).

**18 April (morning cont.)** — RevenueCat integration for iOS in-app purchases. Server-side: webhook endpoint at `/api/revenuecat/webhook` with signature verification, subscription status sync to DB. Client-side: `@revenuecat/purchases-js` installed, `useRevenueCat` hook, `RevenueCatPaywall` component replacing Stripe checkout on mobile. Three RevenueCat entitlements configured via API (`solvr_quotes`, `solvr_jobs`, `solvr_ai`), six products, three offerings.

| Deliverable | Status | Notes |
|---|---|---|
| Trade AI Assistant (chat) | **LIVE** | LLM-powered, business context injected |
| Custom job templates | **LIVE** | Save/load reusable job configs |
| E2E pipeline test | **LIVE** | 376 tests passing across 38 files |
| RevenueCat server webhook | **BUILT — PARTIAL** | Code complete, but `REVENUECAT_WEBHOOK_SECRET` is **not in the environment**. Webhook signature verification will throw an error. `VITE_REVENUECAT_API_KEY` IS configured, so the client-side paywall renders, but purchase events from Apple won't process server-side until the webhook secret is added. |
| RevenueCat client paywall | **LIVE** | Renders on mobile, falls back to Stripe on web |
| Swipe gestures / pull-to-refresh | **PARTIAL** | Touch event handlers exist but no native gesture library (e.g. Hammer.js). Works on touch screens but lacks inertia/physics. |

---

## Sprint 8 — Portal Power Features — 18 April 2026 (evening)

The heaviest feature sprint: reporting, subcontractors, purchase orders, forms, and compliance documents.

**18 April (evening, batch 1)** — Reporting dashboard (`PortalReporting.tsx`) with three tabs: Revenue (monthly bar chart via Recharts, KPI cards for total revenue/outstanding/average job value), Quote Conversion (funnel visualisation, monthly volume chart), and Job Costing (per-job margin table, cost breakdown pie chart). Date range picker on all three tabs. Branded report PDF export via `ReportPDF` component uploaded to S3.

**18 April (evening, batch 2)** — Subcontractor management: three new DB tables (`subcontractors`, `subcontractor_assignments`, `subcontractor_timesheets`), 14 DB helpers, 13 tRPC procedures. `PortalSubcontractors` UI with CRUD, job assignment modal, and timesheet tracking. Magic-link email sent to subbies when assigned to a job. Subbie costs auto-feed into the Job Costing report. Supplier portal at `/supplier-portal/:token` for subbies to view their assignments.

**18 April (evening, batch 3)** — Purchase order system: three DB tables (`suppliers`, `purchase_orders`, `purchase_order_items`), 12 DB helpers, 12 tRPC procedures. `PurchaseOrderPDF` component with branded layout. Email-to-supplier on PO creation via Resend. `PortalPurchaseOrders` UI with supplier management tab, PO creation wizard, line item editor, and status tracking (Draft → Sent → Received → Cancelled). Supplier portal receives PO and can mark items as received.

**18 April (evening, batch 4)** — Forms system built in four sub-sprints:

The forms system is the most complex feature in the platform. It includes form template builder (drag-and-drop field types: text, number, date, photo, signature, checkbox, select, textarea), form submission engine, digital signature capture via HTML5 Canvas, branded PDF certificate generation (`FormCertificatePDF` component), and customer-facing form completion at `/job/:token`.

Sub-sprint 5a: Base forms system — template CRUD, submission engine, signature capture, PDF generation.

Sub-sprint 5b: Invoice blocking — `requiredFormTemplateIds` JSON field on `portal_jobs`, `checkJobFormCompliance` DB helper guards invoice generation until required forms are submitted. Forms tab on job detail page showing linked submissions and compliance status. Branded form PDF with navy header, logo, ABN, amber accent bar.

Sub-sprint 5c: Handover checklist template (30 fields including before/after photos, defects, warranty, dual sign-off) seeded as a system template. Required forms configuration UI in `PortalSettings` — autocomplete job types, select required templates per type, auto-populate on job creation. `job_type_form_requirements` table.

Sub-sprint 5d: Form versioning (`templateSnapshot` stored on each submission so template changes don't break historical records). Bulk form assignment with "Apply to existing jobs" checkbox. Customer-facing form completion via `CustomerFormsSection` on the public job status page (`/job/:token`) with full form filler modal, signature capture, and PDF download.

**18 April (evening, batch 5)** — Dashboard KPIs: `RevenueSnapshot` component on `PortalDashboard` with 6-month revenue bar chart, outstanding invoices count, and quote conversion rate. SEO fixes: title tag reduced to 45 chars, meta description to 115 chars, keywords reduced from 9 to 5.

| Deliverable | Status | Notes |
|---|---|---|
| Reporting dashboard (3 tabs) | **LIVE** | Revenue, quote conversion, job costing |
| Report PDF export | **LIVE** | Branded PDF, S3 upload, download |
| Subcontractor management | **LIVE** | CRUD, assignment, timesheets, cost feed |
| Subbie magic-link email | **LIVE** | Resend email on assignment |
| Supplier portal | **LIVE** | Token-based access for subbies |
| Purchase orders (full lifecycle) | **LIVE** | Draft → Sent → Received → Cancelled |
| PO PDF + email to supplier | **LIVE** | Branded PDF, Resend delivery |
| Forms system (templates + submissions) | **LIVE** | Template builder, submission engine, signature |
| Form PDF certificates | **LIVE** | Branded PDF with logo, ABN, signature |
| Invoice blocking on incomplete forms | **LIVE** | Guards in `generateInvoice` procedure |
| Customer-facing form completion | **LIVE** | Public page at `/job/:token` |
| Form versioning (templateSnapshot) | **LIVE** | Historical submissions preserved |
| Required forms config per job type | **LIVE** | Auto-populate on job creation |
| Dashboard KPIs | **LIVE** | Revenue chart, outstanding, conversion rate |

---

## Sprint 9 — Mobile Polish — 19–20 April 2026

Systematic mobile audit of every portal page for the Capacitor iOS app. No new features — purely responsive design fixes and native feel improvements.

**19 April** — `PortalAssistant` mobile redesign: full-width chat bubbles with 12px padding (was narrow centered column), sticky input bar with `env(safe-area-inset-bottom)` for iPhone home indicator, horizontal-scroll prompt chips replacing 2-column grid, 14px body / 12px metadata font sizes, `overflow-wrap: anywhere` on streamed AI responses, sidebar as overlay drawer with backdrop on mobile.

**19 April** — `PortalPurchaseOrders` mobile fix: card-based PO list on mobile (table hidden via `sm:hidden`), PO items as stacked cards on mobile, all dialogs `w-[calc(100vw-2rem)]`, dialog footers stack buttons vertically (`flex-col-reverse`), supplier cards stack vertically, `pb-24` for tab bar clearance.

**19–20 April** — `PortalForms` mobile fix: submissions as card list on mobile, form filler as full-screen overlay (`fixed inset-0 z-50`) with sticky bottom actions and safe-area padding, signature canvas `h-32` for finger signing, all dialogs full-width on mobile. `PortalCompliance` mobile fix: header and buttons stack vertically, DocPdfPanel stacks with full-width "Open PDF" button, `pb-24` added.

**20 April** — `PortalSubcontractors` mobile fix: card-based layout, full-width dialogs, stacked buttons. `PortalSettings` mobile fix: removed `max-w-xl` constraint on mobile, save buttons full-width, delete confirm stacked.

**20 April** — Global `max-w-` audit across all 13 remaining portal pages: added `sm:` prefix to page-level containers and `w-[calc(100vw-2rem)]` to 6 dialog containers that were clipping at 375px. Pages fixed: `PortalJobDetail`, `PortalJobs`, `PortalOnboarding`, `PortalReferral`, `PortalStaff`, `PortalSubscription`, `PortalReviews`, `PortalQuoteSettings`, `PortalCustomers`, `PortalInvoices`, `PortalPriceList`, `PortalQuoteDetail`, `PortalTeam`, `QuoteListContent`.

**20 April** — Capacitor haptic feedback: upgraded `client/src/lib/haptics.ts` to use `@capacitor/haptics` (native Taptic Engine on iOS) with `navigator.vibrate()` fallback on Android/web. Wired `hapticSuccess` into save/create callbacks, `hapticWarning` into delete callbacks, and `hapticMedium` into send/export callbacks across all 22 portal pages that have user actions.

| Deliverable | Status | Notes |
|---|---|---|
| PortalAssistant mobile redesign | **LIVE** | Full-width chat, sticky input, scroll chips |
| PortalPurchaseOrders mobile fix | **LIVE** | Card layout, full-width dialogs |
| PortalForms mobile fix | **LIVE** | Full-screen form filler, finger signature |
| PortalCompliance mobile fix | **LIVE** | Stacked layout, full-width buttons |
| PortalSubcontractors mobile fix | **LIVE** | Card layout, stacked buttons |
| PortalSettings mobile fix | **LIVE** | Full-width on mobile, stacked saves |
| Global max-w- audit (13 pages) | **LIVE** | All portal pages render at 375px |
| Capacitor haptic feedback (22 pages) | **LIVE** | Native Taptic Engine on iOS, vibrate fallback |

---

## Sprint 10 — iOS Smoke Test Fixes — 21 April 2026

Systematic bug-fix sprint driven by a full iOS smoke test of every portal feature. 18 issues identified and resolved across four batches, plus 18 new vitest tests.

**21 April (batch 1)** — Jobs filter persistence: viewMode, search term, and stage filter now persist to `localStorage` so users don’t lose their filter state when navigating away. Google Places `AddressAutocomplete` component created and wired into the Add Job modal for Australian address suggestions. `openMaps` utility created for Capacitor-native Maps app links (falls back to Google Maps web) — wired into `PortalJobDetail`, `StaffCheckin`, and `StaffToday`. Reusable `ErrorState` component with retry buttons added to Dashboard, Jobs, Calls, and Customers pages. `OfflineBanner` was already wired into `PortalLayout`. Seed scripts (`seed-apple-upgrade.mjs` and `seed-demo.mjs`) updated with bcrypt-hashed staff PINs, hourly rates, licence numbers, and 8 `job_schedule` entries per staff member so the Staff Portal login, Today, Roster, and Check-in pages all work out of the box.

**21 April (batch 2)** — Ran `seed-apple-upgrade.mjs` against the live database — Apple reviewer account now has full staff data, schedule entries, and a completed SWMS form submission. Customers auto-upsert enhanced: email-only fallback when phone is missing, `jobCount` incremented on each new job, missing email/address backfilled on existing records. Bulk SMS dialog overflow fixed (`max-h-[85vh]` + `overflow-y-auto`). Reports PDF export hardened with granular error handling — separate try/catch for data fetch, PDF render, and S3 upload, with the actual error message surfaced in the frontend toast. Invoice PDF total fix: `actualValue` (stored in dollars) was being divided by 100 again in the revenue metrics calculation; corrected with a unit-aware fallback chain. Zero-total guard added to `generateInvoiceForJob` — throws a user-friendly error instead of silently generating a $0 invoice. Frontend warning on job detail when no value source exists. Quote PDF accept link fix: `generatePdf` now saves `pdfUrl` back to the quote record in the database, and the `send` procedure also persists `pdfUrl` if provided. `AddressAutocomplete` wired into Add Customer dialog and PO delivery address field.

**21 April (batch 3)** — AI Assistant layout fix: removed negative-margin hack, recalculated height to properly account for PortalLayout header (`h-14` + `safe-area-inset-top`) and tab bar (`60px` + `safe-area-inset-bottom`). Input bar now clears the tab bar on all iPhone models. Forms page full dark-theme restyle: `STATUS_COLORS` updated to dark variants, signature pad restyled, all labels/inputs/cards/tables/dialogs converted from light (bg-white/text-gray-900) to the portal’s navy theme (#0B1629/#0F1F3D). Job detail active tab fix: replaced inline `style` with `className` overrides using `!important` to beat shadcn’s `data-[state=active]:bg-background` specificity — active tab now shows amber (#F5A623) background with dark text. `AddressAutocomplete` wired into the manual quote creation form in `QuoteListContent`.

**21 April (batch 4)** — 18 new vitest tests in `sprint10.test.ts` covering: invoice zero-total guard (7 tests — throws on $0, handles null line items, converts dollars to cents correctly), revenue metrics unit handling (4 tests — actualValue not divided, invoicedAmount/amountPaid divided, fallback chain), quote pdfUrl persistence (4 tests — URL format, send with/without pdfUrl), and GST calculation (3 tests — inclusive GST, rounding, small amounts).

Verified that issues #8 (PO delivery address presets), #10 (inline edit Enter/Escape), #11 (multi-select photos + before/after), #12 (Settings collapsible sections), and #13 (Remember Me — 365-day session cookie) were already implemented in prior sprints.

| Deliverable | Status | Notes |
|---|---|---|
| Jobs filter persistence (localStorage) | **LIVE** | viewMode, search, stageFilter saved |
| AddressAutocomplete (Google Places) | **LIVE** | Wired into Add Job, Add Customer, PO delivery, Quote creation |
| Native Maps links (Capacitor) | **LIVE** | `openMaps` utility, 3 pages updated |
| ErrorState + retry buttons | **LIVE** | Dashboard, Jobs, Calls, Customers |
| Staff seed data (PINs, schedules) | **LIVE** | Both seed scripts updated and run |
| Customer auto-upsert (enhanced) | **LIVE** | Email fallback, jobCount, backfill |
| Bulk SMS dialog overflow | **LIVE** | max-h-[85vh] + overflow-y-auto |
| Reports PDF error handling | **LIVE** | Granular try/catch, frontend error toast |
| Invoice total unit fix | **LIVE** | actualValue (dollars) no longer double-divided |
| Invoice zero-total guard | **LIVE** | Throws error, frontend warning |
| Quote pdfUrl persistence | **LIVE** | generatePdf + send both save to DB |
| AI Assistant layout fix | **LIVE** | Proper height calc, tab bar clearance |
| Forms dark theme restyle | **LIVE** | Full page converted to navy theme |
| Job detail active tab fix | **LIVE** | Amber background with !important override |
| Sprint 10 regression tests (18 tests) | **LIVE** | 394 total tests, 39 files |

---

## Known Blockers and Incomplete Items

The following items are built in code but **will not function** until the corresponding environment variables or external configuration steps are completed.

| Blocker | What it affects | What's needed |
|---|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` not configured | All SMS features: bulk campaigns, scheduled SMS, appointment reminders (SMS path), quote follow-up (SMS path), review requests (SMS path), inbound SMS webhook, SMS opt-out. **Email paths for these features still work via Resend.** | Create Twilio account, purchase Australian number, add 3 env vars in Settings → Secrets |
| `REVENUECAT_WEBHOOK_SECRET` not configured | Apple IAP purchase events won't process server-side. Client-side paywall renders (API key IS configured), but subscription activation after Apple payment will fail silently. | Add webhook secret in Settings → Secrets. Also: create 6 IAP products in App Store Connect, enter App Store Connect API key in RevenueCat Dashboard. |
| Additional User Seat add-on | `stripeProductId` and `stripePriceId` are empty strings in `stripeProducts.ts` | Create product + price in Stripe Dashboard, update the file |
| Stripe KYC | All payments are in test mode (card 4242 4242 4242 4242). No real money can be collected. | Complete Stripe KYC verification, swap test keys for live keys in Settings → Payment |
| Capacitor iOS project | Not in this repository. No `capacitor.config.ts`, no `ios/` directory. The Xcode project lives on Jayden's local machine. | `npx cap init`, `npx cap add ios`, `npx cap sync ios` — or continue managing separately |
| Blog / SEO content | All 13 blog articles and 12 landing pages are static React components. No CMS, no editing without a code deploy. | Acceptable for now; consider headless CMS if content velocity increases |

---

## Codebase Stats (as of 21 April 2026)

| Metric | Count |
|---|---|
| Database tables | 60 |
| Database migrations | 68 |
| tRPC router files | 27 |
| Portal pages | 33 |
| Cron jobs | 14 |
| Test files | 39 |
| Passing tests | 394 |
| TypeScript errors | 0 |
| Public routes | 28 |
| Blog articles | 13 |
| Trade landing pages | 7 |
| Competitor comparison pages | 5 |
