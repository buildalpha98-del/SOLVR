# Solvr — Project TODO

> **Last updated:** 21 April 2026 (batch 3)
> **Test count:** 376 vitest tests passing (38 test files) · 0 TypeScript errors
> **Entity:** ClearPath AI Agency Pty Ltd, trading as Solvr

---

## Completed Features (Shipped)

All items below are live in production. Grouped by domain for reference.

### Core Pipeline (Voice → Quote → Job → Invoice → Payment)
- [x] Vapi AI Receptionist (webhook, transcript storage, push notification)
- [x] Voice-to-quote LLM extraction (Whisper → structured quote, multilingual, price list injection)
- [x] Quote PDF generation (branded, GST, bank details, translated column headers)
- [x] Quote email to customer (CTA button, customer quote link)
- [x] Quote follow-up automation (day 3 + day 14 expiry cron)
- [x] Customer accepts quote → auto-create job (booked status) + calendar entry + CRM upsert
- [x] Job Kanban board (new_lead → quoted → booked → in_progress → completed → invoiced → paid)
- [x] Auto-invoice on job completion (PDF, S3, email, SMS payment link, invoice chase record)
- [x] Invoice chasing cron (day 1/7/14 email+SMS, day 21 escalation, snooze/cancel)
- [x] SMS payment links (Twilio, /pay/:token Stripe checkout)
- [x] Appointment reminder SMS (daily 5pm AEST cron, 24hr before)
- [x] Zod robustness (safeParse at LLM boundary, 25 edge-case tests, graceful fallback)

### Portal Features
- [x] Voice-first onboarding (record → Whisper → LLM extract → review → save → auto-generate Vapi prompt → auto-provision agent)
- [x] Multi-step onboarding wizard (fallback)
- [x] Dashboard (call volume, job pipeline KPIs, revenue, AI weekly insight, What's Next card, invoice chase widget)
- [x] Jobs page with Quotes tab (Kanban + quote list, merged UX)
- [x] Job detail tabs (Overview / Money / Work) with swipe gestures
- [x] Smart Job Board (task checklists, trade templates, AI next-action, voice-to-tasks)
- [x] Custom job templates (save from job, apply to job, template picker modal)
- [x] Calendar (monthly grid, tap-to-view, job calendar)
- [x] Staff Roster (weekly schedule, @dnd-kit drag-and-drop, staff unavailability)
- [x] Staff management (CRUD, PIN login, GPS check-in/check-out, timesheets)
- [x] Invoices page (chase management, snooze, cancel, Xero CSV export)
- [x] Customers page (CRM list, job history, notes, bulk SMS)
- [x] AI Assistant (trade knowledge blocks, business context, tool-calling, voice input)
- [x] Compliance docs (SWMS, JSA, Safety Cert, Site Induction — LLM → PDF → S3)
- [x] Google Review automation (configurable delay, scheduled dispatch cron)
- [x] Price list (CRUD, CSV import, category grouping, AI injection)
- [x] Referral programme (unique link, referred count, reward status, admin toggle)
- [x] Multi-staff portal accounts (invite flow, admin/viewer roles, 5-member cap)
- [x] RBAC viewer lockdown (ViewerBanner + WriteGuard across all pages)
- [x] Subscription management (Stripe billing portal, plan display)
- [x] Settings (business profile, payment details, licence & insurance, Google Reviews, automation toggles)
- [x] Pull-to-refresh, offline indicator + mutation queue, haptic feedback
- [x] Session expiry warning banner (amber, dismissible, 48hr countdown, renew button)

### Public Pages
- [x] Customer job status page (/job/:token — timeline, photos, feedback, Pay Now, tradie branding)
- [x] Customer quote page (/quote/:token — accept/decline, PDF download)
- [x] SMS unsubscribe + email unsubscribe (public pages, opt-out compliance)

### Console (Admin)
- [x] CRM client management (list, detail, onboarding checklist, memory file editor)
- [x] Reporting dashboard (MRR, subscriber count, plan breakdown, churn risk, milestone tracker)
- [x] Invoice chasing overview
- [x] Referral management (feature flags, payout tracking)
- [x] Leads management

### Website (solvr.com.au)
- [x] Homepage (hero, problem, process, sectors, services, stats, FAQ, booking form)
- [x] Voice Agent product page (/voice-agent)
- [x] Pricing page (/pricing) with 14-day free trial messaging
- [x] Services page (/services)
- [x] AI Audit quiz (/ai-audit)
- [x] Blog (6 SEO articles)
- [x] 7 trade landing pages (plumbers, electricians, builders, carpenters, painters, HVAC, roofers)
- [x] 5 comparison pages (vs Tradify, ServiceM8, Fergus, simPRO, Buildxact)
- [x] Terms of Service, Privacy Policy
- [x] SiteFooter with correct ClearPath copyright + /pricing link

### Stripe Integration
- [x] Checkout sessions (3 plans: Solvr Quotes $49, Solvr Jobs $99, Solvr AI $199)
- [x] 14-day free trial on all plans
- [x] Annual pricing (2 months free)
- [x] Per-seat add-on ($5/mo)
- [x] Webhook handler (checkout.session.completed, subscription.deleted, trial_will_end, payment_intent.succeeded)
- [x] Stripe customer portal session
- [x] Subscription expired page (/subscription/expired)

### Automated Crons (Registered)
- [x] Quote follow-up (daily 9am AEST)
- [x] Invoice chasing (daily 9am AEST)
- [x] Appointment reminder (daily 5pm AEST)
- [x] Google review request dispatch (every 5 min)
- [x] Staff timesheet (daily 11:30pm)
- [x] Weekly timesheet email (Monday 7am AEST)
- [x] Weekly summary email (Friday 4pm AEST)
- [x] Onboarding email sequence (every 6 hours)
- [x] Session expiry warning (every 6 hours)
- [x] Licence expiry warning (daily 8am AEST)
- [x] Idle job nudge (daily 9am AEST)
- [x] SMS campaign dispatch (every minute)
- [x] Monthly call report (1st of month, 9am AEST)

### Security & Compliance
- [x] Rate limiting (staff PIN, portal login, forgot-password)
- [x] Helmet security headers
- [x] Admin procedure guards (adminProcedure)
- [x] IDOR guards on schedule creation
- [x] Staff PIN + push subscription stripped from API responses
- [x] Email + SMS unsubscribe compliance
- [x] Proprietary LICENSE (ClearPath AI Agency Pty Ltd)
- [x] Copyright headers on 89 source files
- [x] Terms of Service + Privacy Policy (Australian Privacy Act compliant)

### Testing & Quality
- [x] 283 vitest tests (30 test files)
- [x] Pipeline E2E integration test (call → quote → accept → job → complete → invoice → chase → paid)
- [x] Compliance doc integration tests (14 tests, all 4 doc types)
- [x] 0 TypeScript errors on clean build

### IP Protection
- [x] LICENSE file (ClearPath AI Agency Pty Ltd, all rights reserved)
- [x] Copyright headers on all source files
- [x] Trademark & IP Protection Guide (solvr-trademark-guide.md)
- [x] Footer copyright updated across all public pages

---

## In Progress

### Sprint 8 — Apple In-App Payments (Server-Side)
- [x] Add subscriptionSource enum (stripe/apple/manual) to voiceAgentSubscriptions schema
- [x] Add revenueCatId and appleOriginalTransactionId fields to schema
- [x] Push DB migration (0058_cloudy_cloak.sql)
- [x] Create RevenueCat API helper (server/lib/revenuecat.ts)
- [x] Create RevenueCat webhook endpoint (/api/revenuecat/webhook)
- [x] Handle INITIAL_PURCHASE, RENEWAL, CANCELLATION, BILLING_ISSUE events
- [x] Update unified subscription check to support both Stripe and Apple sources
- [ ] Add REVENUECAT_WEBHOOK_SECRET env variable
- [x] Write vitest tests for RevenueCat webhook handler (19 tests passing)
- [x] Write vitest tests for unified subscription check
- [x] Save checkpoint

### Sprint 8c — RevenueCat Web Billing (Replace Stripe Checkout)
- [x] Install @revenuecat/purchases-js
- [x] Add VITE_REVENUECAT_API_KEY env variable (test_fORkIqQnrexYiYNyklXwRRHpmlP)
- [x] Create RevenueCat client service (client/src/lib/revenuecat.ts)
- [x] Create useRevenueCat React hook (entitlements, customer info, purchase)
- [x] Create Paywall component using presentPaywall()
- [x] Update Pricing page to use RevenueCat purchase flow
- [x] Update portal subscription check (PortalSubscription.tsx, UpgradeButton, SubscriptionExpired)
- [x] Update server webhook to handle RC Web Billing events (new plan keys direct)
- [x] Map 6 products: Quotes Monthly/Yearly, Jobs Monthly/Yearly, AI Monthly/Yearly
- [x] Map 3 entitlements: solvr_quotes, solvr_jobs, solvr_ai
- [x] Add revenuecat_web to subscriptionSource enum
- [x] Add solvr_quotes/solvr_jobs/solvr_ai to plan enum + PLAN_FEATURES matrix
- [x] Push DB migrations (0059, 0060)
- [x] 0 TypeScript errors on clean build
- [x] Write vitest tests for RC integration (302 tests passing, 31 files)
- [x] Save checkpoint

### Sprint 8b — Apple In-App Payments (Capacitor/iOS — Claude Code)
- [ ] Create Apple subscription products in App Store Connect (matching RC products)
- [ ] Install RevenueCat Capacitor SDK
- [ ] Wire native purchase flow (replace isNativeApp() purchase-hide logic)
- [ ] Test sandbox purchases end-to-end
- [ ] Update APPLE_APP_STORE_SUBMISSION.md with IAP details

---

## Future Roadmap (Post-Launch)

These are planned features that are not blocking the current launch. They will be prioritised based on customer feedback and revenue impact.

### Sprint 3 — Subcontractor Management
- [x] Subcontractor profiles (name, trade, ABN, contact, rate)
- [x] Assign subbie to job from job card
- [x] Subbie magic-link email with read-only job card
- [x] Subbie timesheet (log hours against job)
- [x] Subbie invoice tracking (cost recorded against job)
- [x] Schema: subcontractors, subcontractor_assignments, subcontractor_timesheets tables
- [x] 14 DB helpers (CRUD, assignments, timesheets, magic token)
- [x] portalSubcontractors tRPC router (13 procedures)
- [x] PortalSubcontractors UI page (subbie list, add/edit dialog, assignment + timesheet modals)
- [x] Route + nav wired (/portal/subcontractors)
- [x] 13 vitest tests for subcontractor procedures
- [x] Subbie costs auto-feed into Job Costing report via jobCostItems

### Sprint 4 — Purchase Orders
- [x] Create PO from job (pulls materials from quote line items)
- [x] Supplier management (name, contact, account number)
- [x] Send PO as branded PDF email to supplier
- [x] Record actual cost when PO received
- [x] PO status: Draft → Sent → Acknowledged → Received → Cancelled

### Sprint 5 — Digital Forms & Certificates
- [x] Form builder (text, checkbox, signature, photo fields + textarea, number, date, select, heading, divider)
- [x] Pre-built templates: electrical cert, SWMS, gas compliance (system-seeded on first load)
- [x] Mobile-first form completion with customer signature capture (HTML5 canvas)
- [x] PDF generation from completed form, attached to job
- [x] Option to block invoice until required form is completed (Sprint 5b)

### Sprint 6 — Job Costing & Reporting Dashboard
- [x] Revenue dashboard (monthly revenue, outstanding, avg job value, conversion rate)
- [x] Quote conversion rate tracking
- [x] Job costing report (list, sorted by margin)
- [x] portalReporting tRPC router (3 procedures)
- [x] PortalReporting UI page (3 tabs: Revenue, Quote Conversion, Job Costing)
- [x] Route + nav wired (/portal/reporting)
- [x] 11 vitest tests for reporting procedures

### Sprint 6b — Reporting Enhancements
- [x] Date range picker on all 3 reporting tabs (custom start/end or preset months)
- [x] PDF export — branded report PDF uploaded to S3, download button on each tab
- [x] ReportPDF React-PDF component (revenue, quote conversion, job costing sections)
- [x] Updated DB helpers to accept optional startDate/endDate
- [x] Updated reporting test assertions for new 4-arg signatures

### Polish & QoL (Low Priority)
- [ ] Regenerate 6 Instagram posts with diamond circuit icon
- [ ] Notification preferences toggle in portal settings
- [ ] Default markup % per category on price list
- [ ] Quote list: tappable rows, always-visible total + action buttons on mobile

### Device Testing (Requires Physical Devices)
- [ ] Verify deep link handling on Android (solvr.com.au/portal/* paths)
- [ ] Confirm Android back button behaviour (navigate back, not exit)
- [ ] Verify Capacitor Android permissions in AndroidManifest.xml
- [ ] Confirm app does not use clipboard without user action (Play policy)

### SEO Fixes
- [x] Fix homepage title (document.title override to 45 chars, was 5 chars from VITE_APP_TITLE)
- [x] Fix meta description (115 chars, was 209 chars)
- [x] Reduce keywords from 9 to 5 focused terms

### Sprint 4 — Purchase Orders (Implementation)
- [x] Schema: suppliers, purchase_orders, purchase_order_items tables
- [x] DB helpers: 12 CRUD functions for suppliers, POs, PO items, create PO from job materials
- [x] portalPurchaseOrders tRPC router (12 procedures)
- [x] PurchaseOrderPDF React-PDF component (branded with logo, supplier details, line items)
- [x] Email PO PDF to supplier (sendToSupplier mutation)
- [x] PortalPurchaseOrders UI page (supplier list, PO creation, PO list, send to supplier)
- [x] Route + nav wired (/portal/purchase-orders)
- [x] 12 vitest tests for PO procedures

### Subbie Notification Email
- [x] Auto-send email with magic link when subbie is assigned to a job
- [x] Email includes job type, location, preferred date, and tradie's business name

### Dashboard KPIs
- [x] Embed mini revenue bar chart on PortalDashboard (6-month trailing)
- [x] Show key KPIs (outstanding invoices, quote conversion rate)
- [x] RevenueSnapshot component with responsive chart + metric cards

### PO Received Workflow
- [x] Auto-create jobCostItem when PO status changes to "received"
- [x] Pull line items from PO and sum into cost entry with category "materials"

### Supplier Portal
- [x] Add magicToken field to suppliers table
- [x] DB helper: getPurchaseOrderWithItemsByToken, acknowledgePurchaseOrder
- [x] Public tRPC procedures: viewPo (by token), acknowledgePo
- [x] SupplierPortal UI page (public, no auth required)
- [x] Route wired (/supplier-portal/:token)
- [x] Auto-generate magic token on supplier creation
- [x] Magic link included in PO email to supplier

### Sprint 5 — Digital Forms & Certificates
- [x] Schema: form_templates, form_submissions tables (JSON fields for flexible form structure)
- [x] Pre-built templates: Electrical Certificate, SWMS, Gas Compliance (system-seeded)
- [x] DB helpers: 10 CRUD functions for templates and submissions + seedSystemFormTemplates
- [x] portalForms tRPC router (10 procedures: templates CRUD, submissions CRUD, seed, PDF gen)
- [x] Form builder UI (add/edit fields: text, textarea, number, date, select, checkbox, signature, photo, heading, divider)
- [x] Form completion page (mobile-first, signature capture via HTML5 canvas, required field validation)
- [x] PDF generation from completed form (server-side, S3 upload, pdfUrl stored on submission)
- [x] Route + nav wired (/portal/forms, "Forms & Certs" in sidebar)
- [x] 12 vitest tests (DB helpers, CRUD lifecycle, system template seeding, idempotency)

### Sprint 5b — Forms Enhancements
- [x] Invoice blocking: add requiredFormTemplateIds JSON field to portal_jobs schema
- [x] Invoice blocking: checkJobFormCompliance DB helper + guard in generateInvoice + auto-invoice procedures
- [x] Invoice blocking: UI warning on job detail when required forms are incomplete (Forms tab compliance badge)
- [x] Forms tab on job detail page (list forms linked to job, start new form from job, compliance status)
- [x] Branded form PDF (React-PDF FormCertificatePDF component — navy header, logo, ABN, amber accent bar, footer)
- [x] Vitest tests: 7 new tests (checkJobFormCompliance, FormCertificatePDF renders valid PDF, invoice blocking, job-linked submissions)

### Sprint 5c — Forms Enhancements (Round 2)
- [x] Handover checklist template: 4th system-seeded template (30 fields — before/after photos, defects, warranty, dual sign-off)
- [x] Incremental seeding: existing clients get new templates without duplicating old ones
- [x] Form-to-job auto-link: jobId passed via URL param from job detail Forms tab, auto-opens template selector
- [x] Required forms config UI: settings panel in PortalSettings with job type autocomplete, template checkboxes, upsert/delete
- [x] Auto-populate requiredFormTemplateIds on job creation from job type rules
- [x] DB schema: job_type_form_requirements table + 7 DB helpers (CRUD, distinct job types, upsert)
- [x] 4 tRPC procedures: listFormRequirements, upsertFormRequirement, deleteFormRequirement, distinctJobTypes
- [x] Vitest tests: 7 new tests (sprint5c.test.ts + portal.test.ts mock fix)

### Sprint 5d — Forms Enhancements (Round 3)
- [x] Form versioning: templateSnapshot JSON field on form_submissions, snapshotted on creation
- [x] Form versioning: PDF generation + form rendering use snapshotted fields (fallback for legacy submissions)
- [x] Form versioning: getFormTemplate updated to accept optional clientId for scoping
- [x] Bulk form assignment: "Apply to existing jobs" checkbox in RequiredFormsConfigSection UI
- [x] Bulk form assignment: backfillJobTypeFormRequirements DB helper + wired to upsertFormRequirement procedure
- [x] Bulk form assignment: toast shows count of backfilled jobs on save
- [x] Customer-facing form completion: CustomerFormsSection on /job/:token status page
- [x] Customer-facing form completion: 3 public procedures (customerListJobForms, customerGetFormTemplate, customerSubmitForm)
- [x] Customer-facing form completion: full form filler modal with all field types + signature capture (canvas)
- [x] Customer-facing form completion: completed forms collapsible with PDF download links
- [x] Vitest tests: 12 new tests (sprint5d.test.ts — versioning, backfill, customer procedures, router integration)

### App Store Submission Prep
- [x] RevenueCat configured via API: 3 entitlements (solvr_quotes, solvr_jobs, solvr_ai), 6 products, 3 offerings with packages
- [x] PRODUCT_MAP updated with yearly aliases (solvr_*_yearly → solvr_*_annual)
- [x] REVENUECAT_CONFIG.md created with full configuration reference for Claude Code
- [x] APPLE_APP_STORE_SUBMISSION.md Section 5 updated for RevenueCat IAP (6 products, tier hierarchy, free trial, restore purchases)
- [x] seed-apple-upgrade.mjs updated with form template seeding + completed SWMS submission for Apple reviewer
- [x] Portal nav updated to include forms, purchase-orders, subcontractors pages

### Mobile Redesign — PortalAssistant
- [x] Chat messages full width with small padding (not narrow centered column)
- [x] Input area sticky at bottom with safe-area padding (env(safe-area-inset-bottom))
- [x] Suggested prompts as horizontal scroll chips, not grid
- [x] Font sizes readable on mobile (14px body, 12px metadata)
- [x] Streaming response area word-wrap for long text
- [x] Mobile sidebar as overlay drawer with backdrop (hidden on desktop)
- [x] Desktop sidebar still works as before
- [x] calc(100dvh - 64px) height for proper mobile viewport
- [x] 0 TypeScript errors maintained

### Mobile Fix — PortalPurchaseOrders
- [x] Table/grid overflows on mobile — switch to card-based layout at mobile breakpoints
- [x] Forms and modals full-width on mobile (w-[calc(100vw-2rem)] max-w-*)
- [x] Buttons full-width stacked on mobile (w-full sm:w-auto, flex-col-reverse sm:flex-row)
- [x] PO detail view stacks sections vertically on mobile (grid-cols-1 sm:grid-cols-2)
- [x] Add pb-24 to main scroll container for tab bar clearance
- [x] PO items: card list on mobile, table on desktop (sm:hidden / hidden sm:block)
- [x] Supplier cards: info stacked vertically, actions as full-width row
- [x] 0 TypeScript errors, 376 vitest tests passing

### Mobile Fix — PortalForms
- [x] Submissions table → card-based layout on mobile (sm:hidden table, mobile card list)
- [x] Form filler dialog → full-screen overlay on mobile (fixed inset-0 z-50)
- [x] Signature canvas → taller h-32 on mobile with finger-friendly dashed border
- [x] Template builder dialog → full-width on mobile (w-[calc(100vw-2rem)])
- [x] Form viewer dialog → full-width on mobile (w-[calc(100vw-2rem)])
- [x] Template selector dialog → full-width on mobile (w-[calc(100vw-2rem)])
- [x] All dialog footers → stacked buttons on mobile (flex-col-reverse sm:flex-row)
- [x] Add pb-24 to main container for tab bar clearance
- [x] Search full-width on mobile (sm:max-w-sm)
- [x] Tabs full-width on mobile (flex-1 sm:flex-none)
- [x] 0 TypeScript errors, 376 vitest tests passing

### Mobile Fix — PortalCompliance
- [x] Header stacks on mobile (flex-col sm:flex-row, full-width button)
- [x] Generate/Cancel buttons stack vertically on mobile (flex-col sm:flex-row)
- [x] DocPdfPanel stacks vertically on mobile (flex-col sm:flex-row)
- [x] Add pb-24 to main container for tab bar clearance
- [x] Remove max-w-3xl constraint on mobile (sm:max-w-3xl)
- [x] Doc type short labels on mobile for narrower cards
- [x] 0 TypeScript errors, 376 vitest tests passing

### Mobile Fix — PortalSubcontractors
- [x] Card-based layout on mobile (not table/wide flex)
- [x] Dialogs full-width on mobile (w-[calc(100vw-2rem)])
- [x] Buttons stacked on mobile (flex-col-reverse sm:flex-row)
- [x] pb-24 for tab bar clearance
- [x] 0 TypeScript errors, 376 vitest tests passing

### Mobile Fix — PortalSettings
- [x] Settings sections stack vertically on mobile (sm:max-w-xl)
- [x] Form inputs full-width on mobile
- [x] Save buttons full-width on mobile (w-full sm:w-auto)
- [x] pb-24 for tab bar clearance
- [x] Haptics wired into all save/delete actions

### Portal-wide max-w- audit
- [x] Grep all portal pages for max-w- constraints
- [x] Fixed 13 page-level containers (added sm: prefix)
- [x] Fixed 6 dialog containers (added w-[calc(100vw-2rem)])
- [x] Pages fixed: JobDetail, Jobs, Onboarding, Referral, Staff, Subscription, Reviews, QuoteSettings, Customers, Invoices, PriceList, QuoteDetail, Team

### Capacitor Haptic Feedback
- [x] Upgraded haptics.ts to use @capacitor/haptics (Taptic Engine) with Vibration API fallback
- [x] Added hapticSelection() for picker/scroll changes
- [x] Installed @capacitor/haptics + @capacitor/core packages
- [x] Wired haptics into all 22 portal pages with toast.success callbacks
- [x] hapticSuccess on saves/creates, hapticWarning on deletes
- [x] Pages: Forms, Compliance, PurchaseOrders, Settings, Customers, Invoices, PriceList, QuoteDetail, QuoteSettings, Referral, Reporting, Reviews, Schedule, Staff, StaffCheckIn, Subscription, Team, Assistant, Calendar, Calls, CustomerDetail, Dashboard

### Sprint 10 — iOS Smoke Test Fixes (21 April 2026)

#### CRITICAL — blocks feature completeness
- [x] #1 Customers DB — Bulk SMS overflow fixed (max-h-[85vh]), auto-upsert enhanced (email fallback + jobCount increment)
- [x] #2 Apple reviewer demo account broken — re-seed apple.review@solvr.com.au / AppleReview2026!
- [x] #3 Reports PDF — added granular error handling (data fetch / PDF render / S3 upload), frontend shows actual error message
- [x] #4 Invoice PDF total — fixed reporting unit mismatch (actualValue dollars vs cents), zero-total guard, frontend warning
- [x] #5 Quote PDF Accept link — generatePdf now saves pdfUrl to quote record, send procedure also persists pdfUrl

#### HIGH — UX issues on mobile
- [ ] #6 AI Assistant hides tab bar + no safe-area-inset-top + chips should be vertical stacked list
- [ ] #7 Forms page mobile UX still broken — full rework needed
- [ ] #8 PO delivery address presets — dropdown: job site / head office / warehouse / custom
- [ ] #9 Job detail active tab white-on-white — use amber or bold with underline
- [ ] #10 Inline edit fields auto-save on Enter key (PortalJobDetail)
- [ ] #11 Quote/job photos — multi-select file picker + before/after photo sections
- [ ] #12 Settings page collapsible sections
- [ ] #13 "Remember Me" / stay signed in 30 days
- [x] #14 Jobs page filter chips + filter persistence via localStorage (viewMode, search, stageFilter)
- [x] #15 Address autocomplete — Google Places AddressAutocomplete component wired into Add Job modal

#### MEDIUM — Infrastructure
- [x] #16 Maps links open native Maps app on Capacitor (openMaps utility, wired into JobDetail, StaffCheckin, StaffToday)
- [x] #17 Offline/error states — ErrorState component + retry buttons on Dashboard, Jobs, Calls, Customers pages
- [x] #18 Staff portal demo data — seed staff with hashed PINs, hourlyRate, licenceNumber + 8 job_schedule entries

#### Seed script
- [x] Update seed-apple-upgrade.mjs with staff PINs, hourlyRate, job_schedule entries
- [x] Update seed-demo.mjs with staff PINs, hourlyRate, job_schedule entries for Jay's account

### Sprint 10 batch 3 — CRITICAL fixes + seed + autocomplete (21 April 2026)
- [x] Run seed-apple-upgrade.mjs against live DB — staff PINs, hourlyRate, schedule entries, SWMS form all populated
- [x] #1 Customers DB — Bulk SMS overflow fixed, auto-upsert enhanced (email fallback + jobCount increment)
- [x] #3 Reports PDF — granular error handling (data fetch / PDF render / S3 upload), frontend shows actual error
- [x] #4 Invoice PDF total — fixed reporting unit mismatch, zero-total guard, frontend warning for missing values
- [x] #5 Quote PDF Accept link — generatePdf saves pdfUrl to DB, send procedure also persists pdfUrl
- [x] AddressAutocomplete wired into: Add Customer dialog, PO delivery address field
- 0 TypeScript errors, 376 vitest tests passing
