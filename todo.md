# Solvr — Project TODO

> **Last updated:** 18 April 2026
> **Test count:** 283 vitest tests passing (30 test files) · 0 TypeScript errors
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
- [ ] Subcontractor profiles (name, trade, ABN, contact, rate)
- [ ] Assign subbie to job from job card
- [ ] Subbie magic-link email with read-only job card
- [ ] Subbie timesheet (log hours against job)
- [ ] Subbie invoice tracking (cost recorded against job)

### Sprint 4 — Purchase Orders
- [ ] Create PO from job (pulls materials from quote line items)
- [ ] Supplier management (name, contact, account number)
- [ ] Send PO as branded PDF email to supplier
- [ ] Record actual cost when PO received
- [ ] PO status: Draft → Sent → Received → Invoiced

### Sprint 5 — Digital Forms & Certificates
- [ ] Form builder (text, checkbox, signature, photo fields)
- [ ] Pre-built templates: electrical cert, SWMS, gas compliance, handover
- [ ] Mobile-first form completion with customer signature capture
- [ ] PDF generation from completed form, attached to job
- [ ] Option to block invoice until required form is completed

### Sprint 6 — Job Costing & Reporting Dashboard
- [ ] Revenue dashboard (monthly revenue, outstanding, avg job value, conversion rate)
- [ ] Quote conversion rate tracking
- [ ] Job costing report (list, sorted by margin)

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
