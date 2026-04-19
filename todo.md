# Solvr — Project TODO

> **Last updated:** 19 April 2026
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
