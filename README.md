# SOLVR — AI-Powered Business Management for Australian Tradies

> **Entity:** ClearPath AI Agency Pty Ltd (ABN 47 262 120 626), trading as Solvr
> **Domain:** [solvr.com.au](https://solvr.com.au)
> **Status:** Production (iOS App Store submission in progress)
> **Last updated:** 20 April 2026

---

## Overview

Solvr is a full-stack SaaS platform that gives Australian tradespeople an AI-powered receptionist, automated quoting, job management, invoicing, and compliance — all from their phone. A single voice call from a customer triggers an end-to-end pipeline: the AI receptionist answers, extracts job details via Whisper + LLM, generates a branded quote PDF, emails it to the customer, and — once accepted — creates a job, calendar entry, and CRM record automatically. Invoices are generated on job completion, chased on a configurable schedule, and paid via SMS payment links through Stripe.

The platform is built as a React 19 + Express 4 + tRPC 11 monorepo backed by MySQL (TiDB) with Drizzle ORM, deployed on Manus hosting with a Capacitor iOS wrapper for the App Store. The codebase spans approximately **97,000 lines of TypeScript** across 60 database tables, 68 migrations, 25 tRPC routers, 33 portal pages, 13 automated cron jobs, and 376 vitest tests.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Wouter, TanStack Query |
| Backend | Express 4, tRPC 11, Superjson, Node.js 22 |
| Database | MySQL (TiDB Serverless), Drizzle ORM, 60 tables, 68 migrations |
| AI / LLM | Vapi (voice agent), OpenAI Whisper (transcription), Claude / GPT (extraction, compliance docs, assistant) |
| Payments | Stripe (web checkout, webhooks, billing portal), RevenueCat (iOS IAP, web billing) |
| Communications | Twilio (SMS), Resend (email), Web Push (notifications) |
| Storage | AWS S3 (PDFs, photos, voice recordings) |
| PDF Generation | React-PDF (quotes, invoices, POs, forms, compliance docs, reports) |
| Mobile | Capacitor (iOS), @capacitor/haptics, safe-area-inset support |
| Auth | Manus OAuth, JWT sessions, portal PIN login (staff) |
| Testing | Vitest (376 tests, 38 files), TypeScript strict mode (0 errors) |
| CI / Hosting | Manus platform, GitHub sync, custom domain (solvr.com.au) |

---

## Architecture

```
client/                          → React 19 SPA (Vite)
  src/pages/portal/              → 33 portal pages (tradie dashboard)
  src/pages/                     → Public website + admin console
  src/components/                → Shared UI (shadcn/ui)
  src/lib/                       → tRPC client, haptics, RevenueCat
server/
  routers/                       → 25 tRPC routers
  cron/                          → 13 automated cron jobs
  lib/                           → Twilio, Resend, RevenueCat, PDF helpers
  _core/                         → Framework plumbing (OAuth, LLM, S3, maps)
drizzle/
  schema.ts                      → 60 MySQL tables (2,051 lines)
  migrations/                    → 68 sequential migrations
shared/                          → Types, constants, error codes
```

---

## Core Pipeline: Voice → Quote → Job → Invoice → Payment

The primary value proposition is a fully automated pipeline that converts an inbound phone call into revenue with minimal tradie intervention.

**Step 1 — AI Receptionist (Vapi).** A customer calls the tradie's business number. Vapi answers with a custom prompt generated during onboarding, collects job details (type, location, urgency, contact info), and posts the transcript to our webhook. The tradie receives a push notification immediately.

**Step 2 — Voice-to-Quote Extraction.** The webhook sends the transcript through Whisper for clean text, then through an LLM with the tradie's price list injected as context. The LLM extracts structured line items (description, quantity, unit price) and customer details. Zod safeParse validates the output at the LLM boundary with graceful fallback for malformed responses.

**Step 3 — Quote PDF & Email.** A branded React-PDF quote is generated with the tradie's logo, ABN, GST calculations, bank details, and translated column headers (for multilingual support). The PDF is uploaded to S3 and emailed to the customer with a CTA button linking to a public quote page (`/quote/:token`).

**Step 4 — Quote Follow-Up Automation.** A daily cron (9am AEST) sends a follow-up email on day 3 if the quote is still pending, and auto-expires quotes on day 14 with a final notification.

**Step 5 — Customer Accepts → Job Created.** When the customer clicks "Accept" on the public quote page, the system automatically creates a job (status: booked), a calendar entry, and upserts the customer into the CRM. The tradie is notified via push.

**Step 6 — Job Management.** The tradie manages jobs on a Kanban board (new_lead → quoted → booked → in_progress → completed → invoiced → paid) with swipe gestures on mobile. Each job has three tabs (Overview / Money / Work) with task checklists, trade-specific templates, AI next-action suggestions, and voice-to-tasks.

**Step 7 — Auto-Invoice on Completion.** When a job is marked complete, the system checks form compliance (if required forms are configured), generates a branded invoice PDF, uploads it to S3, emails it to the customer, and sends an SMS payment link via Twilio.

**Step 8 — Invoice Chasing.** A daily cron sends escalating reminders: email on day 1, email + SMS on day 7, email + SMS on day 14, and an escalation notification to the tradie on day 21. Tradies can snooze or cancel chasing per invoice.

**Step 9 — Payment.** The customer pays via the SMS payment link (`/pay/:token`), which opens a Stripe checkout session. On successful payment, the webhook updates the invoice and job status to "paid".

---

## Shipped Sprints

### Sprint 1 — Core Pipeline & Portal Foundation

The foundational sprint delivered the entire voice-to-payment pipeline described above, plus the tradie portal with voice-first onboarding (record a 2-minute description of your business → Whisper transcription → LLM extraction → review → save → auto-generate Vapi prompt → auto-provision agent). A multi-step onboarding wizard serves as fallback for tradies who prefer typing. The portal dashboard shows call volume, job pipeline KPIs, revenue metrics, an AI-generated weekly insight, a "What's Next" action card, and an invoice chase widget.

### Sprint 2 — Staff, Calendar & Customers

This sprint added staff management with PIN login, GPS check-in/check-out, and automated timesheets. The calendar renders a monthly grid with tap-to-view job details. The staff roster uses @dnd-kit for drag-and-drop weekly scheduling with unavailability management. The customers page provides a full CRM with job history, notes, and bulk SMS campaigns. A weekly timesheet email goes out every Monday at 7am AEST, and a weekly summary email fires every Friday at 4pm AEST.

### Sprint 3 — Subcontractor Management

Subcontractor profiles store name, trade, ABN, contact details, and hourly rate. Tradies assign subbies to jobs from the job card, triggering an automatic email with a magic link to a read-only job card. Subbies log hours against jobs via their portal, and subbie invoices are tracked as cost items that auto-feed into the job costing report. The system includes 14 DB helpers, 13 tRPC procedures, and 13 vitest tests.

### Sprint 4 — Purchase Orders & Supplier Portal

Purchase orders can be created directly from a job (pulling materials from quote line items) or from scratch. Supplier management stores name, contact, and account number. POs are generated as branded PDFs and emailed to suppliers with a magic link to a public supplier portal where they can view and acknowledge the PO. When a PO status changes to "received", the system auto-creates a job cost item with the actual cost, feeding into the job costing report. PO statuses track through Draft → Sent → Acknowledged → Received → Cancelled.

### Sprint 5 — Digital Forms & Certificates (5a–5d)

A full form builder supports 10 field types (text, textarea, number, date, select, checkbox, signature, photo, heading, divider) with 4 system-seeded templates: Electrical Certificate, SWMS, Gas Compliance, and Handover Checklist. Forms are completed on mobile with HTML5 canvas signature capture and generate branded PDFs uploaded to S3.

**Sprint 5b** added invoice blocking — tradies can configure required forms per job type, and the system blocks invoice generation until all required forms are completed. A compliance badge appears on the job detail Forms tab.

**Sprint 5c** introduced the required forms configuration UI in settings (job type autocomplete, template checkboxes, bulk assignment to existing jobs), incremental template seeding for existing clients, and form-to-job auto-linking from the job detail page.

**Sprint 5d** delivered form versioning (template snapshots on submission creation so PDF generation uses the fields as they were at submission time), bulk form assignment with backfill counts, and customer-facing form completion on the public job status page (`/job/:token`) with full form filler modal and signature capture.

### Sprint 6 — Job Costing & Reporting Dashboard (6a–6b)

The reporting dashboard has three tabs: Revenue (monthly revenue, outstanding invoices, average job value, conversion rate), Quote Conversion (acceptance rates over time), and Job Costing (list sorted by margin, pulling from quote revenue, PO costs, subbie costs, and manual cost items).

**Sprint 6b** added date range pickers on all three tabs (custom start/end or preset months) and PDF export — a branded React-PDF report uploaded to S3 with a download button on each tab.

### Sprint 7 — AI Assistant, Compliance Docs & Google Reviews

The AI Assistant provides trade-specific knowledge blocks, business context injection, tool-calling capabilities, and voice input. It runs as a full chat interface with streaming responses and suggested prompts.

Compliance document generation supports SWMS, JSA, Safety Certificates, and Site Induction checklists — the LLM generates the document from a job description and site address, producing a PDF uploaded to S3.

Google Review automation sends configurable-delay review request emails/SMS after job completion, dispatched by a cron running every 5 minutes.

### Sprint 8 — Payments & App Store Prep (8a–8c)

**Sprint 8a** (Stripe) delivered checkout sessions for three plans (Solvr Quotes $49/mo, Solvr Jobs $99/mo, Solvr AI $199/mo) with 14-day free trials, annual pricing (2 months free), per-seat add-ons ($5/mo), webhook handling (checkout.session.completed, subscription.deleted, trial_will_end, payment_intent.succeeded), and a Stripe customer portal session.

**Sprint 8b** (RevenueCat server-side) added a subscriptionSource enum (stripe/apple/manual/revenuecat_web), RevenueCat webhook endpoint handling INITIAL_PURCHASE, RENEWAL, CANCELLATION, and BILLING_ISSUE events, and a unified subscription check supporting both Stripe and Apple sources.

**Sprint 8c** (RevenueCat web billing) replaced the Stripe checkout flow with RevenueCat's presentPaywall(), mapping 6 products (Quotes/Jobs/AI monthly and yearly) to 3 entitlements (solvr_quotes, solvr_jobs, solvr_ai). The pricing page, portal subscription check, and upgrade flows all use RevenueCat natively.

### Sprint 9 — Mobile-First Redesign & Haptic Feedback

A comprehensive mobile audit across all 33 portal pages ensured every screen works at 375px (iPhone SE) viewport width. Key changes included card-based layouts replacing tables on mobile, full-screen form filler overlays, full-width dialogs and stacked buttons, `pb-24` for tab bar clearance, `env(safe-area-inset-bottom)` for iPhone home indicator, and horizontal-scroll prompt chips in the AI assistant.

A global `max-w-` audit fixed 13 page-level containers and 6 dialog containers that clipped on mobile viewports.

Capacitor haptic feedback was wired into all 22 portal pages using `@capacitor/haptics` (native Taptic Engine on iOS, Vibration API fallback on Android/web) — `hapticSuccess` on saves/creates, `hapticWarning` on deletes, and `hapticSelection` for picker changes.

---

## Automated Cron Jobs (13 Registered)

| Cron | Schedule | Description |
|---|---|---|
| Quote Follow-Up | Daily 9am AEST | Day 3 follow-up email, day 14 auto-expiry |
| Invoice Chasing | Daily 9am AEST | Escalating reminders (day 1/7/14 email+SMS, day 21 escalation) |
| Appointment Reminder | Daily 5pm AEST | SMS reminder 24 hours before scheduled jobs |
| Google Review Dispatch | Every 5 min | Sends queued review request emails/SMS |
| Staff Timesheet | Daily 11:30pm | Auto-closes open time entries |
| Weekly Timesheet Email | Monday 7am AEST | Timesheet summary to business owner |
| Weekly Summary Email | Friday 4pm AEST | Business performance summary |
| Onboarding Email Sequence | Every 6 hours | Drip campaign for new signups |
| Session Expiry Warning | Every 6 hours | Amber banner with 48hr countdown + renew button |
| Licence Expiry Warning | Daily 8am AEST | Alerts tradies when licences/insurance are expiring |
| Idle Job Nudge | Daily 9am AEST | Nudges tradies about jobs with no activity |
| SMS Campaign Dispatch | Every minute | Sends queued bulk SMS campaigns |
| Monthly Call Report | 1st of month, 9am AEST | AI-generated monthly call analysis |
| Late Check-In Alert | Every 5 min | Alerts when staff haven't checked in 15min after shift start |

---

## Public Pages

The marketing website at [solvr.com.au](https://solvr.com.au) includes a homepage with hero, problem statement, process overview, sector cards, services, statistics, FAQ, and a booking form. Additional pages include the Voice Agent product page (`/voice-agent`), pricing page (`/pricing`) with 14-day free trial messaging, services page (`/services`), and an AI Audit quiz (`/ai-audit`).

Seven trade-specific landing pages target plumbers, electricians, builders, carpenters, painters, HVAC technicians, and roofers. Five comparison pages position Solvr against Tradify, ServiceM8, Fergus, simPRO, and Buildxact. Six SEO blog articles provide trade-specific content. Terms of Service and Privacy Policy pages comply with the Australian Privacy Act.

Three customer-facing public pages support the core pipeline: the job status page (`/job/:token`) with timeline, photos, feedback, payment, and customer form completion; the quote page (`/quote/:token`) with accept/decline and PDF download; and the supplier portal (`/supplier-portal/:token`) for PO viewing and acknowledgement. SMS and email unsubscribe pages ensure opt-out compliance.

---

## Admin Console

The internal admin console provides CRM client management (list, detail, onboarding checklist, memory file editor), a reporting dashboard (MRR, subscriber count, plan breakdown, churn risk, milestone tracker), invoice chasing overview, referral management (feature flags, payout tracking), and leads management.

---

## Security & Compliance

The application enforces rate limiting on staff PIN login, portal login, and forgot-password endpoints. Helmet security headers are applied to all responses. Admin-only operations are gated behind `adminProcedure` guards, and IDOR guards protect schedule creation. Staff PINs and push subscriptions are stripped from API responses. Email and SMS communications include unsubscribe links for opt-out compliance. All 89 source files carry copyright headers for ClearPath AI Agency Pty Ltd, and a proprietary LICENSE file protects the codebase. Terms of Service and Privacy Policy comply with the Australian Privacy Act.

---

## Testing

The test suite comprises **376 vitest tests across 38 test files** with 0 TypeScript errors on clean build. Coverage includes a full pipeline E2E integration test (call → quote → accept → job → complete → invoice → chase → paid), compliance document integration tests (14 tests across all 4 document types), RevenueCat webhook handler tests (19 tests), form CRUD lifecycle tests, subcontractor procedure tests, purchase order procedure tests, reporting procedure tests, and router registration tests.

---

## Database Schema (60 Tables)

The schema is organised into logical domains:

**Users & Auth:** users, portal_sessions, portal_team_members, staff_members, staff_sessions, staff_availability

**CRM & Customers:** crm_clients, crm_interactions, crm_tags, client_tags, pipeline_deals, client_products, client_profiles, tradie_customers, client_onboardings, onboarding_checklists

**Quotes & Invoices:** quotes, quote_line_items, quote_photos, quote_voice_recordings, quote_follow_ups, invoice_chases, payment_links

**Jobs & Scheduling:** portal_jobs, portal_calendar_events, job_schedule, job_progress_payments, job_photos, job_feedback, job_cost_items, job_tasks, job_templates, job_type_form_requirements

**Staff & Time:** time_entries, staff_availability, staff_sessions

**Subcontractors:** subcontractors, subcontractor_assignments, subcontractor_timesheets

**Purchase Orders:** suppliers, purchase_orders, purchase_order_items

**Forms & Compliance:** form_templates, form_submissions, compliance_documents

**Communications:** sms_campaigns, sms_campaign_recipients, sms_templates, push_subscriptions, google_review_requests

**Subscriptions & Billing:** voice_agent_subscriptions

**Referrals:** referral_partners, referral_conversions, client_referrals, referral_blast_logs

**System:** ai_insights, tasks, saved_prompts, strategy_call_leads, app_settings, price_list_items, portal_chat_messages

---

## Environment Variables

The application requires the following environment variables, all managed through the Manus platform:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL |
| `STRIPE_SECRET_KEY` | Stripe server-side API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe client-side key |
| `RESEND_API_KEY` | Email delivery (Resend) |
| `VAPI_API_KEY` | Voice agent provisioning |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push notifications |
| `VITE_REVENUECAT_API_KEY` | RevenueCat client-side key |
| `VITE_CALENDLY_URL` | Booking link |
| `BUILT_IN_FORGE_API_KEY` | LLM, S3, and notification APIs |

---

## IP Protection

All source code is proprietary to ClearPath AI Agency Pty Ltd. The repository includes a proprietary LICENSE file, copyright headers on all source files, and a Trademark & IP Protection Guide (`solvr-trademark-guide.md`). SOLVR is a trademark of ClearPath AI Agency Pty Ltd.

---

## Development

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start dev server
pnpm dev

# Run tests
pnpm test

# Type check
npx tsc --noEmit
```

---

## Licence

Copyright (c) 2025–2026 ClearPath AI Agency Pty Ltd. All rights reserved.
Unauthorised copying, modification, or distribution of this software is strictly prohibited.
See [LICENSE](./LICENSE) for details.
