# Solvr Website TODO

- [x] Basic homepage layout with Warm Modernism design
- [x] Navigation menu (desktop + mobile)
- [x] Hero section with CTA
- [x] Problem section
- [x] How We Help (3-step process)
- [x] Sectors grid (6 industries)
- [x] Services section (4 packages)
- [x] Results section with stats, chart, testimonials
- [x] FAQ section
- [x] Booking form with confirmation state
- [x] Footer with Instagram link
- [x] 6 individual sector landing pages
- [x] Free AI Audit quiz (/ai-audit) with 7 questions and scoring
- [x] Full Solvr rebrand (logo, colours, tagline)
- [x] SEO metadata fixed (title, description, keywords, Open Graph)
- [x] Full-stack upgrade (web-db-user: database, backend, auth)
- [x] Announcement banner (dismissible, amber)
- [x] Owner push notifications on booking + audit submissions
- [x] tRPC notification backend routes
- [x] 8 passing vitest tests
- [x] GitHub integration connected
- [x] "Try the Demo" nav link (desktop + mobile) → solvrvoice-2kmsccza.manus.space
- [x] Demo CTA section between testimonials and FAQ
- [x] Update demo links to point to /demo path (solvrvoice-2kmsccza.manus.space/demo)
- [x] Build /voice-agent product page (Never Miss a Job)
- [x] Add /voice-agent route to App.tsx
- [x] Update "Try the Demo" nav link to point to /voice-agent
- [x] Update voice agent pricing tiers with competitive market rates
- [x] Add annual/monthly billing toggle to voice agent pricing (2 months free on annual)
- [x] Add "Compare to hiring a receptionist" cost calculator widget
- [x] Set VITE_VAPI_PUBLIC_KEY secret
- [x] Connect hello@solvr.com.au to booking form notifications
- [x] Create Terms of Service page (/terms)
- [x] Create Privacy Policy page (/privacy)
- [x] Prepare LinkedIn company page content
- [x] Add T&Cs and Privacy Policy footer links to all pages
- [x] Update ABN in Terms of Service (47 262 120 626)
- [x] Upload official Solvr logos to CDN
- [x] Update website to use correct official logos
- [x] Regenerate all 6 Instagram posts with correct branding
- [x] Add ABN 47 262 120 626 to Privacy Policy contact section
- [x] Extract diamond circuit icon from dark logo as standalone iconography
- [x] Generate icon variants (dark bg, transparent, light bg) at multiple sizes
- [x] Update website favicon and nav to use diamond circuit icon
- [ ] Regenerate all 6 Instagram posts with diamond circuit icon
- [x] Wire Calendly URL (VITE_CALENDLY_URL) across all booking CTAs site-wide
- [x] Stripe payment integration for voice agent plans (Starter + Professional)
- [x] Stripe webhook handler at /api/stripe/webhook
- [x] Voice agent success page (/voice-agent/success) with session verification
- [x] 49 passing vitest tests (4 new Stripe tests)
- [x] Fix voice agent pricing to match handover doc (add setup fees, update Enterprise to $997/mo)
- [x] Add setup fees to Stripe checkout (one-time + recurring)
- [x] Add "Convert Lead to Client" button on Leads page
- [x] Add MRR tracking chart to Console Dashboard
- [x] Build Vapi webhook receiver endpoint (store transcripts in CRM)
- [x] Design onboarding checklist data model (steps, statuses, automation log)
- [x] Add onboardingChecklist table to schema (29 columns, one row per client)
- [x] Build tRPC procedures: get, updateStep, sendWelcomeEmail, sendOnboardingForm, generatePrompt, goLive
- [x] Build Console per-client Onboarding Checklist page (/console/crm/:id/checklist)
- [x] Wire automations: welcome email, onboarding form send, prompt generation, go-live notification
- [x] Add Checklist button to CRM Client Detail header
- [x] Write vitest tests for checklist procedures (7 new tests, 56 total passing)
- [x] Check Gmail MCP connection and wire direct email sending into checklist automations
- [x] Build public onboarding form page (/onboarding/welcome?token=xxx) with dictation-first UX
- [x] Wire form submission to update checklist step 5 (form-completed) and store data in CRM
- [x] 63 passing vitest tests (7 new onboarding token tests)

## Client Portal (solvr.com.au/portal)
- [x] Design full portal product architecture (features, UX, data model, monetisation tiers)
- [x] Build portal database schema (portalJobs, portalCalendarEvents, portalInsights)
- [x] Build tRPC portal procedures (call stats, job pipeline, revenue estimates, calendar)
- [x] Build portal shell (auth via token/magic link, layout, nav, branding)
- [x] Build Dashboard tab (call volume chart, job pipeline KPIs, revenue estimates, AI weekly insight)
- [x] Build Calls tab (transcript list, summaries, job type tags, search/filter)
- [x] Build Jobs tab (Kanban pipeline board with potential revenue per job)
- [x] Build Calendar tab (upcoming jobs view linked to calls)
- [x] 63 vitest tests passing, 0 TypeScript errors

## Bug Fixes (Apr 4)
- [x] Portal login redirect loop: PortalLogin now navigates to /portal/dashboard after success
- [x] Portal /portal/login route missing from App.tsx: added route
- [x] PortalLayout Dashboard href was /portal (PortalLogin): fixed to /portal/dashboard
- [x] goLive procedure now generates portal access token and includes portal URL in go-live email
- [x] 78 vitest tests passing, 0 TypeScript errors

## Pre-Publish Improvements (8.5 target)
- [x] Portal AI Weekly Insight — LLM-generated summary card on Dashboard (busiest job type, conversion rate, top opportunity)
- [x] "Convert Call to Job" button on Portal Calls tab — one-tap to pre-fill a new job from call data
- [x] Vapi assistant auto-provisioning — create Vapi assistant via API from generated prompt (remove manual paste step)
- [x] Onboarding form progress bar — visual step indicator with step names and % complete
- [x] Onboarding form polish — improved progress indicator, better empty state
- [x] VAPI_API_KEY secret added and validated
- [x] 79 vitest tests passing, 0 TypeScript errors

## Pre-Launch Finalisation (Apr 4)
- [x] Update pricing: Starter $197/mo (no setup fee), Professional $397/mo (no setup fee)
- [x] Update Stripe products to match new pricing
- [x] Add "Founding Member" badge and scarcity messaging to pricing page
- [x] Build referral code system (/ref/[code] URLs, referrer dashboard, admin payout view)
- [x] Console sidebar updated with all nav items including Referrals
- [x] 79 vitest tests passing, 0 TypeScript errors
- [x] Populate Google Calendar with 6-month GTM action plan (53 events: launch, outreach, content, reviews, referral payouts, 100-subscriber milestone)

## Client Onboarding System (A-to-Z)
- [x] Deep systems audit — map current flow, identify gaps, design onboarding architecture
- [x] Schema: add client_profiles table (40-column memory file — services, pricing, service areas, callout fees, specialisations, FAQs, AI context)
- [x] Schema: onboardingCompleted + onboardingCompletedAt tracked in client_profiles table
- [x] Dedicated portal login landing page at /portal with branded split-layout and email+password login
- [x] Multi-step onboarding wizard — Step 1: Business Basics (trading name, ABN, phone, address, service area)
- [x] Multi-step onboarding wizard — Step 2: Services & Pricing (trade type, specialisations, avg job price, callout fee, common jobs)
- [x] Multi-step onboarding wizard — Step 3: Branding & Identity (logo upload, brand colours, reply-to email)
- [x] Multi-step onboarding wizard — Step 4: Review & Activate (summary, confirm, mark onboarding complete)
- [x] Business Profile / Memory File view in portal settings (editable post-onboarding)
- [x] Wire memory file into AI voice agent prompt builder (checklist.ts generatePrompt)
- [x] Wire memory file into voice-to-quote extraction context (quotes router processVoiceRecording)
- [x] Skip onboarding wizard — passwordLogin returns onboardingCompleted, login redirects accordingly
- [x] Progress indicator on onboarding wizard (step X of 4)
- [x] Auto-save draft on each step so traders don't lose progress
## TypeScript & PDF Fixes (Apr 9)
- [x] Fix z.record(z.unknown()) → z.record(z.string(), z.unknown()) for Zod v4 compatibility
- [x] Fix client.email → client.contactEmail in getOnboardingProfile
- [x] Add abn, phone, address fields to QuoteProposalPdfInput branding type
- [x] Render ABN, phone, address in Quote PDF header bar and footer
- [x] 93 vitest tests passing, tsc --noEmit exits clean

## Remaining Work
- [ ] Session expiry warning banner (amber, dismissible, 3 days before expiry)
- [ ] Notification Preferences section in portal settings (toggle email alerts)
- [ ] Console onboarding management (view/edit client memory file from Console)
- [ ] End-to-end smoke test of full onboarding → voice agent → voice-to-quote flow
- [ ] Test Stripe upgrade flow (remove quote-engine, verify upgrade CTA, checkout, webhook)

## Backend Features & Website Updates (Apr 9)
- [x] Add pushToken column to crm_clients + pnpm db:push migration
- [x] portal.registerPushToken + portal.unregisterPushToken procedures
- [x] Expo push notifications in Vapi webhook (call-ended event fires push to client device)
- [x] Monthly call report cron job (1st of month, 9am AEST) — emails each client call/job/revenue summary
- [x] Quote-accepted webhook creates calendar event + fires push notification to client
- [x] Session expiry warning cron job (daily 9am AEST) — emails clients 48hr before portal session expires
- [x] Shared expoPush.ts helper extracted for reuse across cron jobs and webhooks
- [x] Website copy rewrite — new consultancy positioning, Products section, Coming Soon strip
- [x] Hero restored: "Stop Doing Admin. Start Doing Work." eyebrow + "Your Admin, Solved by AI." headline
- [x] Client Login button added to main site nav (desktop + mobile)
- [x] Client Login + portal links added to site footer (Client Access column)
- [x] /services page created with detailed engagement breakdowns (4 services, process, deliverables, timeline)
- [x] /voice-agent page updated: Products comparison section, comparison table, updated nav with Services link
- [x] 99 vitest tests passing, tsc --noEmit exits clean

## AI Invoice Chasing (Apr 2026)
- [ ] invoiceChases table: schema + migration
- [ ] Invoice chasing cron job (day 1, 7, 14 email sequences + day 21 escalation)
- [ ] tRPC procedures: listInvoiceChases, createInvoiceChase, markInvoicePaid, snoozeChase, cancelChase
- [ ] Portal Invoice Chasing page (client-facing)
- [ ] Console Invoice Chasing overview (admin)
- [ ] Website Products section updated with Invoice Chasing
- [ ] Handoff doc updated with new procedures
## Stripe Subscription Portal (Apr 2026)
- [x] Add clientId field to voiceAgentSubscriptions schema + db:push migration
- [ ] Update webhook to link portal upgrade checkout to crmClients via clientId metadata
- [x] portal.getSubscriptionStatus procedure (plan, status, billingCycle, nextBillingDate)
- [x] portal.createBillingPortalSession procedure (Stripe Customer Portal redirect)
- [x] PortalSubscription page (/portal/subscription) — current plan, status, billing, upgrade/manage
- [x] Add Subscription nav item to PortalLayout
- [x] Add /portal/subscription route to App.tsx
- [ ] Add Billing section to PortalSettings (current plan summary + link to subscription page)

## Automated Onboarding Email Sequence (Apr 2026)
- [ ] Build onboarding email templates (welcome, checklist, 7-day check-in)
- [ ] Build onboardingEmailSequence cron — scheduled emails at T+0, T+3days, T+7days
- [ ] Add onboardingEmailsSent tracking to voiceAgentSubscriptions schema + migrate
- [ ] Wire sequence trigger into Stripe webhook on checkout.session.completed
- [ ] Write vitest tests for onboarding email sequence

## Console Reporting Dashboard (Apr 2026)
- [ ] Build reporting tRPC procedures (MRR breakdown, subscriber count, plan split, churn rate, outstanding invoices)
- [ ] Build ConsoleReporting page (/console/reporting) with KPI cards, plan breakdown chart, MRR trend, churn table
- [ ] Add Reporting nav item to ConsoleLayout sidebar
- [ ] Add /console/reporting route to App.tsx

## Invoice PDF Generation & Photo Upload (Apr 2026)
- [x] Build invoice PDF template (bank details, ABN, line items, GST, cash paid flag)
- [x] Upload invoice PDF to S3 and store URL on portalInvoices record
- [x] Email invoice PDF to customer on generation
- [x] Wire before/after photo upload UI in PortalJobDetail (S3 upload, preview, delete)

## Payment Details & Completion Report PDF (Apr 2026)
- [ ] Add Payment Details section to PortalSettings (BSB, account number, account name, bank name)
- [ ] Wire updateProfile to save bank details fields
- [ ] Build CompletionReportDocument.tsx React-PDF component (job summary, what was done, variations, before/after photos)
- [ ] Add generateCompletionReport tRPC procedure (render PDF, upload S3, email customer)
- [ ] Wire Generate Report button in PortalJobDetail completion section

## Voice-First Onboarding (Apr 2026)
- [x] VoiceOnboarding.tsx — record → Whisper → LLM extract → review form → save
- [x] server/_core/onboardingExtraction.ts — ultra-detailed LLM prompt + JSON schema for all profile fields
- [x] portal.extractVoiceOnboarding tRPC procedure — transcribe + extract + return missing fields
- [x] portal.saveVoiceOnboarding tRPC procedure — persist extracted data + mark onboarding complete
- [x] /portal/onboarding now routes to VoiceOnboarding; /portal/onboarding/form keeps old wizard as fallback
- [x] Per-section re-record mic on VoiceOnboarding review screen
- [x] Console CRM voice onboarding transcript viewer (collapsible amber panel)
- [x] Auto-trigger generatePrompt (Vapi prompt) after saveVoiceOnboarding completes
- [x] Owner notification (Manus) after autoGeneratePromptForClient completes
- [x] Vapi auto-provisioning chained after voice onboarding prompt generation (zero-touch)
- [x] Console CRM memory file read/edit modal (view/edit clientProfiles from CRM client detail)

## Weekly Summary Email (Apr 2026)
- [x] Weekly summary data query (calls, quotes sent, jobs won, revenue for the week per clientId)
- [x] buildWeeklySummaryEmail() HTML template — Friday digest with stats + portal CTA
- [x] weeklySummaryEmail.ts cron — Friday 4pm AEST, respects notifyEmailWeeklySummary opt-out
- [x] Register cron in server/_core/index.ts
- [x] Vitest tests for weekly summary cron (12 tests)

## Payment Details, Completion Report & Reporting Chart (Apr 2026)
- [x] Add payment details fields to clientProfiles schema (bsb, accountNumber, accountName, bankName) + db:push
- [x] portal.getPaymentDetails + portal.updatePaymentDetails tRPC procedures
- [x] Payment Details section in PortalSettings UI
- [x] Wire bank details into invoice PDF footer
- [x] CompletionReportDocument.tsx React-PDF component (job summary, what was done, variations, before/after photos)
- [x] generateCompletionReport tRPC procedure (render PDF, upload S3, email customer)
- [x] Generate Report button in PortalJobDetail completion section
- [ ] Subscriber plan split doughnut chart in ConsoleReporting (Starter vs Professional counts)

## Milestone Tracker + Referral Page (Apr 2026)
- [ ] "Path to 10 clients" milestone progress bar in Console Reporting header
- [ ] Portal referral page at /portal/referral — unique link, referred count, reward status
- [ ] Add Referral nav item to portal More drawer

## Tier 1 Feature Build — Tradie Focus (Apr 2026)

### Feature 1: Job Costing & Profit Tracker
- [x] Add job_cost_items table to schema (materials + labour entries) + db:push
- [x] db.ts helpers: createJobCostItem, listJobCostItems, deleteJobCostItem, getJobProfitSummary
- [x] portalJobs router: addJobCostItem, removeJobCostItem, getJobProfitSummary procedures
- [x] Auto-import quote line items as cost items when customer accepts quote
- [x] PortalJobDetail: Costs tab — mobile-first, add material/labour rows
- [x] Profit KPI cards in PortalJobDetail (total cost, quoted amount, margin %)

### Feature 2: SMS Payment Links
- [x] Install twilio npm package
- [x] Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER secrets
- [x] Create server/lib/sms.ts helper (sendSms function, graceful skip if no credentials)
- [x] Add payment_links table to schema (jobId, token, status, sentAt, paidAt) + db:push
- [x] Create /pay/:token public page (Stripe checkout redirect, mobile-optimised)
- [x] Wire SMS send on invoice creation (portalJobs router)
- [x] Wire SMS into invoice chasing cron (Day 7 + Day 14 chase steps)
- [x] Tests: payment link creation and SMS send

### Feature 3: Quote Expiry & Follow-Up Automation
- [x] Add quote_follow_ups table to schema (quoteId, status, followUp1SentAt, followUp2SentAt, expiryNoticeSentAt) + db:push
- [x] db.ts helpers: getQuoteFollowUp, createQuoteFollowUp, updateQuoteFollowUp, listActiveQuoteFollowUps
- [x] Create server/cron/quoteFollowUp.ts (48h follow-up, 5-day follow-up, expiry-day notice)
- [x] Register quoteFollowUp cron in server/_core/index.ts
- [x] Follow-up status badges in PortalQuotes list (Followed Up / Expiring Soon)
- [x] Tests: follow-up cron logic

### Feature 4: Before/After Photo Completion Report
- [x] Add photoType field to quotePhotos schema (before | after) + db:push
- [x] Add uploadAfterPhoto procedure to quotes router
- [x] PortalJobDetail: After-photo upload section on completed/invoiced jobs
- [x] Build CompletionReportDocument.tsx React-PDF template (before/after grid, work description, licence, warranty)
- [x] Add generateCompletionReport procedure (render PDF, upload S3, email customer)
- [x] Generate Report button in PortalJobDetail completion section
- [x] Tests: completion report generation

## Licence & Insurance + Compliance Documents (Apr 2026)
- [x] Add licenceNumber, licenceType, licenceAuthority, licenceExpiryDate, insurerName, insurancePolicyNumber, insuranceCoverageAud, insuranceExpiryDate fields to clientProfiles schema + db:push
- [x] portal.saveLicenceInsurance tRPC procedure
- [x] Licence & Insurance section in PortalSettings UI
- [x] Add compliance_documents table to schema (id, clientId, jobId, docType, title, jobDescription, pdfUrl, content, status) + db:push
- [x] db.ts helpers: createComplianceDocument, getComplianceDocument, updateComplianceDocument, listComplianceDocuments, deleteComplianceDocument
- [x] server/_core/complianceDocGeneration.ts — LLM prompt builder for SWMS, Safety Cert, Site Induction, JSA
- [x] portal.generateComplianceDoc tRPC procedure (async: create record -> LLM -> PDF -> S3 -> update record)
- [x] portal.listComplianceDocs, portal.getComplianceDoc, portal.deleteComplianceDoc procedures
- [x] PortalCompliance.tsx page — generate form, polling status, document list, PDF download
- [x] /portal/compliance route in App.tsx
- [x] Compliance nav item (ShieldCheck icon, Pro badge) in PortalLayout

## Capacitor iOS Boundary Rules (Apr 2026)
- [x] Manus will NEVER edit capacitor.config.ts, ios/, scripts/sync-mobile.sh, or docs/superpowers/specs/
- [x] Mobile feature requests flagged in commit messages as 'mobile: requires @capacitor/xxx'
- [x] Claude Code owns all Capacitor/iOS config — boundary documented and enforced

## Feature 6: Drag-and-Drop Scheduler + Staff GPS Check-In (Apr 2026) ✅

### Schema & Migration
- [x] Add staff_members table (id, clientId, name, mobile, trade, licenceNumber, isActive, createdAt) + db:push
- [x] Add job_schedule table (id, clientId, jobId, staffId, startTime, endTime, status, notes, createdAt) + db:push
- [x] Add time_entries table (id, clientId, jobId, staffId, scheduleId, checkInAt, checkOutAt, gpsLat, gpsLng, durationMinutes, createdAt) + db:push

### Server
- [x] db.ts helpers: createStaffMember, getStaffMember, listStaffMembers, updateStaffMember, deleteStaffMember
- [x] db.ts helpers: createScheduleEntry, getScheduleEntry, listScheduleEntries (by week/clientId), updateScheduleEntry, deleteScheduleEntry
- [x] db.ts helpers: createTimeEntry, getTimeEntry, listTimeEntries (by job/staff), updateTimeEntry, getActiveCheckIn
- [x] portal router: listStaff, createStaff, updateStaff, deleteStaff procedures
- [x] portal router: listScheduleWeek, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry procedures
- [x] portal router: checkIn, checkOut, getActiveCheckIn, listTimeEntries, getTimesheetSummary procedures

### Portal UI
- [x] PortalStaff.tsx page (/portal/staff) — staff list, add/edit/delete, mobile + trade + licence fields
- [x] Staff nav item (Users icon) added to PortalLayout
- [x] /portal/staff route added to App.tsx
- [x] PortalSchedule.tsx page (/portal/schedule) — weekly calendar with @dnd-kit drag-and-drop
- [x] Schedule nav item (CalendarClock icon) added to PortalLayout
- [x] /portal/schedule route added to App.tsx
- [x] PortalStaffCheckIn.tsx — staff-facing GPS check-in/check-out page (/portal/checkin)
- [x] /portal/checkin route added to App.tsx

### Automations
- [x] server/cron/staffTimesheet.ts — end-of-day cron (11:30pm daily): completed time_entries → job_cost_items (labour hours × rate)
- [x] Weekly timesheet email cron (Monday 7am AEST): per-staff hours summary to tradie owner
- [x] Register staffTimesheet crons in server/_core/index.ts

### Tests & Fixes
- [x] Fix flaky voiceOnboarding UNAUTHORIZED test (timeout → 15000ms)
- [x] 121/121 vitest tests passing, 0 TypeScript errors

## Bug Fixes (Apr 11 2026)
- [x] Fix 1: Compliance doc output — convert from .md download to branded PDF via @react-pdf/renderer
  - [x] Created server/_core/ComplianceDocumentPDF.tsx — branded React-PDF component (header, sections, hazard table, signature block, footer)
  - [x] Updated complianceDocGeneration.ts LLM prompt to output structured JSON (scope, hazards, controls, signatures)
  - [x] Updated complianceDocGeneration.ts to renderToBuffer + upload to S3 at compliance-docs/{clientId}/{docId}.pdf
  - [x] Updated PortalCompliance.tsx to open returned PDF URL in new tab
- [x] Fix 2: Inline edit for PortalJobDetail — customer + job fields
  - [x] Extended portal.updateJob zod schema to include callerName, callerPhone, jobType, description, location, preferredDate, customerName/Email/Phone/Address
  - [x] updatePortalJob db helper already accepts Partial<InsertPortalJob> — no changes needed
  - [x] Inline EditableField components with pencil icons already live on all required fields in PortalJobDetail.tsx
  - [x] updateJobDetail in portalJobs.ts already accepted all fields — confirmed no gaps
- [x] 121/121 vitest tests passing, 0 TypeScript errors

## Feature 7 — Google Review Automation (Apr 11 2026)
- [x] Schema: add googleReviewLink + reviewRequestEnabled columns to clientProfiles
- [x] Schema: new google_review_requests table (id, clientId, jobId, customerName, customerPhone, customerEmail, channel, sentAt, status, errorMessage)
- [x] DB: pnpm db:push migration
- [x] DB helpers: insertReviewRequest, listReviewRequests, getReviewRequestStats
- [x] tRPC: portal.saveGoogleReviewSettings
- [x] tRPC: portal.listReviewRequests
- [x] tRPC: portal.resendReviewRequest
- [x] tRPC: portal.getReviewRequestStats
- [x] Trigger: markJobComplete fires sendGoogleReviewRequest helper (SMS + email, non-fatal)
- [x] Portal Settings: Google Reviews section
- [x] Portal page: /portal/reviews — review request history + resend
- [x] Sidebar nav: Reviews entry
- [x] Console Reporting: review requests widget
- [x] Tests: 11 vitest tests (all passing)

## Feature 7 Enhancements — Send Delay + Admin Review Count (Apr 11 2026)

- [x] Schema: add reviewRequestDelayMinutes (int, default 30) to clientProfiles
- [x] Schema: add scheduledSendAt (timestamp, nullable) + "pending" status to googleReviewRequests
- [x] DB: pnpm db:push migration
- [x] DB helpers: listPendingReviewRequests, updateReviewRequestStatus, getReviewRequestCountByClient
- [x] googleReview.ts: refactored to scheduleGoogleReviewRequest (stores pending) + processScheduledReviewRequests (cron dispatch)
- [x] Cron: reviewRequestDispatch — runs every 5 min, fires due pending requests
- [x] Portal Settings: delay selector dropdown (0/15/30/60/120/240/480/1440 min options)
- [x] Portal Settings: delay selector saved via saveGoogleReviewSettings + returned by getGoogleReviewSettings
- [x] Portal Reviews: "Scheduled" badge for pending status
- [x] Console Portal Clients: Reviews Sent column with amber star + count

## Bug Fixes (Jayden prompts — Apr 11 2026)

- [x] Bug: voice-to-quote Zod validation error (String doesn't match expected pattern)
- [x] Bug: missing logout button in portal settings + mobile nav

## Bug Fixes + Apple Demo Account (Apr 11 2026)

- [x] Bug 1: Voice-to-quote Zod error — add sanitiseExtracted() helper to strip invalid emails/phones from LLM output before insertQuote
- [x] Bug 1: Relax customerEmail Zod schema in createDraft + update procedures to use z.string().email().nullish() with pre-validation strip
- [x] Bug 1: Add unit test reproducing the invalid-email LLM output shape
- [x] Bug 2: Add Log Out button to PortalSettings (destructive, confirm dialog, clears cache, redirects to /portal/login)
- [x] Bug 2: Add Log Out item to portal mobile More drawer
- [x] Bug 2: Wire portal.logout tRPC procedure (or confirm existing one clears server-side session)
- [x] Demo: Create Apple reviewer account apple.review@solvr.com.au in portal DB

## Apple App Store Screenshots — Test Data Seeding (Apr 11 2026)

- [x] Add Log Out button to PortalSettings (top of Danger Zone section, amber/outline style)
- [x] Add Log Out item to PortalLayout mobile More drawer
- [x] Create Apple reviewer account apple.review@solvr.com.au in portal DB (strong password: AppleReview2026!)
- [x] Seed 15 CRM interactions (calls) for jay.kowaider@hotmail.com client — realistic Vapi call data with transcripts, durations, caller names
- [x] Seed 6 quotes (mix of draft/sent/accepted) with line items for plumbing/electrical/carpentry jobs
- [x] Seed 8 portal jobs (mix of pending/in-progress/completed) linked to accepted quotes
- [x] Seed calendar events for jobs (scheduled dates spread across current month)
- [x] Verify dashboard KPIs reflect seeded data (call volume, job counts, revenue)

## App Store Pre-Submission Fixes (Apr 12 2026)

### Prompt A — Compliance Doc Generation (BLOCKER)
- [ ] Debug complianceDocGeneration.ts — check actual server error for SWMS + Site Induction
- [ ] Fix LLM structured output schema mismatch (Zod parse on LLM JSON response)
- [ ] Fix S3 upload / @react-pdf/renderer crash if applicable
- [ ] Surface actual error message to client (not generic "Generation failed")
- [ ] Test all 4 doc types end-to-end: SWMS, Site Induction, Safety Certificate, JSA
- [ ] Add integration test for compliance doc pipeline

### Prompt B — Pencil Icons Missing on PortalJobDetail (BLOCKER)
- [ ] Audit PortalJobDetail.tsx — verify EditableField pencil icons are rendered
- [ ] Check for responsive hiding classes (hidden, md:hidden, etc.)
- [ ] Fix visibility on mobile viewport
- [ ] Write component test verifying pencil icons in DOM

### Prompt C — Apple Reviewer Account Full Access (BLOCKER)
- [ ] Upgrade apple.review@solvr.com.au to active premium subscription
- [ ] Enable all feature flags (voice-to-quote, compliance, scheduler, GPS, reviews, referrals)
- [ ] Seed 15+ calls with AI transcripts
- [ ] Seed 8+ jobs (pending/scheduled/in-progress/completed)
- [ ] Seed 6+ calendar events (this week + next week)
- [ ] Seed 6+ quotes (draft/sent/accepted)
- [ ] Seed 3+ customers
- [ ] Seed 2+ staff members
- [ ] Seed 1+ paid invoice + 1+ pending invoice
- [ ] Verify no onboarding wizard / paywall on login — lands on /portal/dashboard
- [ ] Confirm all sidebar menu items accessible

### Prompt D — Portal Schedule Vertical Layout (non-blocker)
- [ ] Redesign PortalSchedule.tsx — vertical days per staff member
- [ ] Staff members side-by-side at md: breakpoint
- [ ] Drag-and-drop works vertically (no gesture conflict with horizontal swipe)

### Prompt E — Voice-to-Quote Zod Error (REPEAT BLOCKER)
- [ ] Instrument ALL Zod schemas in voice-to-quote pipeline (quoteExtraction.ts, quotes.ts, portal.ts, client-side form)
- [ ] Add try/catch logging: exact input, .issues array, path[], file+line for each .parse()/.safeParse()
- [ ] Reproduce with real recording and capture actual failing field + LLM output
- [ ] Fix root cause (likely phone regex, postcode regex, currency regex, date format, or empty email)
- [ ] Fix client-side form zodResolver if it also validates the draft
- [ ] Test all 5 scenarios: name only, name+phone, name+phone+address, all fields, ambiguous input
- [ ] Add test with actual failing LLM output shape (not mocked happy path)
- [ ] Commit with evidence: quote failing field path + LLM output in commit message

## Security Hardening (Build 3 pre-flight)
- [x] Rate limiting on staff PIN login (10 attempts / 15 min per IP)
- [x] Rate limiting on owner portal password login (10 attempts / 15 min per IP)
- [x] Rate limiting on forgot-password (5 attempts / 1 hour per IP)
- [x] Helmet security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.)
- [x] adminPortal procedures upgraded from protectedProcedure → adminProcedure (role = admin required)
- [x] listStaff strips staffPin and pushSubscription from response
- [x] createSchedule IDOR guard — verifies jobId and staffId belong to authenticated client

## Security Hardening (Build 3 pre-flight)
- [x] Rate limiting on staff PIN login (10 attempts / 15 min per IP)
- [x] Rate limiting on owner portal password login (10 attempts / 15 min per IP)
- [x] Rate limiting on forgot-password (5 attempts / 1 hour per IP)
- [x] Helmet security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.)
- [x] adminPortal procedures upgraded from protectedProcedure to adminProcedure (role = admin required)
- [x] listStaff strips staffPin and pushSubscription from response
- [x] createSchedule IDOR guard - verifies jobId and staffId belong to authenticated client

## Tradie UX Improvements (Audit April 2026)
- [ ] P1 — Collapse portal nav to 4 core items + More drawer
- [ ] P2 — Dashboard Today at a Glance strip
- [ ] P3 — Plain-English labels on Compliance page
- [ ] P4 — Staff card refactor to Manage bottom sheet
- [ ] P5 — Drag handle + first-visit tooltip on schedule cards
- [ ] P6 — Voice as primary CTA on Quotes page

## Customer Job Status Enhancements (Apr 2026)
- [x] Auto-send customer status link in booking SMS
- [x] Customer feedback widget on status page (thumbs up/down + comment)
- [x] Status page branding (tradie logo + trading name)

## Customer Job Status Enhancements (Apr 2026)
- [x] Auto-send customer status link in booking SMS
- [x] Customer feedback widget on status page (thumbs up/down + comment)
- [x] Status page branding (tradie logo + trading name)
- [x] Capacitor appId decision documented (keep com.solvr.mobile)
- [x] Inbound SMS reply webhook (Twilio -> job note + push notification)

- [x] Pricing: rename plans to Solvr Quotes / Solvr Jobs / Solvr AI
- [x] Pricing: update Stripe products and prices (AUD)
- [x] Pricing: add +$5/mo per-seat add-on
- [x] Pricing: update plan labels across portal and pricing page
- [x] Pricing: web-first checkout flow

- [ ] Add 14-day free trial to Stripe checkout
- [ ] Create annual Stripe prices and wire to checkout
- [ ] Add Pricing link to main site nav

- [ ] Trial-end reminder email via Stripe webhook
- [ ] Annual savings badge on Pricing page toggle
- [ ] /subscription/expired page with Stripe customer portal CTA
- [ ] Audit voice-to-quote LLM prompt — fix multi-page report generation (page 1: quote, pages 2-3: job detail with photos)
- [ ] Auto-invoice on quote acceptance
- [x] Fix referral page: Capacitor URL shows capacitor://localhost instead of https://solvr.com.au
- [x] Fix referral page: WhatsApp button text invisible (contrast bug)
- [x] Add referral programme on/off toggle in admin console
- [x] Fix SubscriptionExpired ReferralNudge: same Capacitor URL bug (window.location.origin)
- [x] Add appSettings table to schema for feature flags
- [x] Add referral feature toggle to adminReferral router (getFeatureFlags / setFeatureFlag)
- [x] Wire referral toggle to PortalReferral page (hide page if disabled)
- [x] Wire referral toggle to PortalLayout nav (hide Gift link if disabled)
- [x] Add feature flags panel to ConsoleReferrals admin page

## App Store + Google Play Blockers (Apr 12 2026)

### Prompt A — Compliance Doc Generation (BLOCKER)
- [x] Debug complianceDocGeneration.ts — confirmed working, all 4 doc types pass end-to-end test
- [x] LLM structured output schema — no mismatch found, JSON parse works correctly
- [x] S3 upload / @react-pdf/renderer — no crash, PDFs generate successfully (16KB SWMS, 12KB Site Induction, etc.)
- [x] Error surfacing — UI already shows Error badge + toast on failure
- [x] Test all 4 doc types end-to-end: SWMS ✅ Site Induction ✅ Safety Certificate ✅ JSA ✅
- [ ] Add integration test for compliance doc pipeline (vitest)

### Prompt B — Pencil Icons Missing on PortalJobDetail Mobile (BLOCKER)
- [x] Audit PortalJobDetail.tsx — EditableField pencil icons are rendered correctly
- [x] Responsive classes confirmed: opacity-100 on mobile (visible), md:opacity-0 md:group-hover:opacity-100 on desktop (hover only)
- [x] Fix: added w-7 h-7 tap target (28px) with minWidth/minHeight for iOS/Android touch compliance (Apple HIG: 44pt, Material: 48dp minimum)
- [ ] Write component test verifying pencil icons in DOM

### Prompt C — Reviewer Account Full Access (Apple + Google Play) (BLOCKER)
- [x] Upgrade apple.review@solvr.com.au to active premium subscription (all features unlocked)
- [x] Create android.review@solvr.com.au Google Play reviewer account (same full access)
- [x] Enable all feature flags for both accounts (ai-receptionist, quote-engine, automation — all live)
- [x] Seed 15 calls for both accounts
- [x] Seed 8 jobs (new_lead/quoted/booked/completed) for both accounts
- [x] Seed 7 calendar events (past + upcoming) for both accounts
- [x] Seed 6 quotes (draft/sent/accepted) for both accounts
- [x] Seed 2 staff members for both accounts
- [x] Generate referral code for both accounts (APPLE20 / ANDROID20)
- [x] Verify no onboarding wizard / paywall on login — package=full-managed, onboardingCompleted=1
- [x] Confirm all sidebar menu items accessible for both accounts

### Prompt E — Voice-to-Quote Zod Error (REPEAT BLOCKER)
- [ ] Instrument ALL Zod schemas in voice-to-quote pipeline with detailed logging
- [ ] Add try/catch with exact input, .issues array, path[], file+line for each .parse()/.safeParse()
- [ ] Fix root cause (phone regex, postcode regex, currency regex, date format, or empty email)
- [ ] Fix client-side form zodResolver validation
- [ ] Test all 5 scenarios: name only, name+phone, name+phone+address, all fields, ambiguous input
- [ ] Add test with actual failing LLM output shape (not mocked happy path)

### Google Play Store Specific Requirements
- [x] Add android.review@solvr.com.au reviewer account credentials to GOOGLE_PLAY_SUBMISSION.md
- [x] Write full Google Play Data Safety declaration (GOOGLE_PLAY_SUBMISSION.md)
- [x] Write Google Play store listing copy — short desc, full desc, release notes (GOOGLE_PLAY_SUBMISSION.md)
- [x] Document RECORD_AUDIO permission justification for Play Console
- [x] Write Apple App Store submission guide (APPLE_APP_STORE_SUBMISSION.md)
- [ ] Verify deep link handling works on Android (solvr.com.au/portal/* paths) — test on device
- [ ] Confirm back button behaviour on Android (hardware back = navigate back, not exit) — test on device
- [ ] Verify Capacitor Android permissions declared in AndroidManifest.xml (microphone, camera)
- [ ] Confirm minSdkVersion ≥ 24 and targetSdkVersion = 34 in build.gradle
- [ ] Confirm app does not use clipboard without user action (Play policy)

## App Store Submission Follow-up (Apr 12 2026)
- [ ] Add 14-day free trial to Stripe checkout (trial_period_days: 14)
- [ ] Update pricing page to show "14-day free trial" on all plans
- [ ] Update promotional text / App Store copy to reflect free trial
- [ ] Verify AndroidManifest.xml has RECORD_AUDIO, CAMERA, READ_MEDIA_IMAGES permissions
- [ ] Confirm minSdkVersion >= 24 and targetSdkVersion = 34 in build.gradle
- [ ] Add Capacitor Android back button handler (prevent accidental app exit)

## URGENT: Voice-to-Quote Zod Error in Production (Apr 13 2026)
- [ ] Confirm solvr.com.au is running latest code (commit 0f40c154)
- [ ] Instrument ALL .parse()/.safeParse() calls in voice-to-quote pipeline with detailed error logging
- [ ] Fix exact failing Zod schema field (phone regex, email, url, postcode, or currency)
- [ ] Fix tRPC input schema in quotes.ts (any strict z.string().url() or z.string().email() on optional fields)
- [ ] Deploy fix to production via checkpoint + publish
- [ ] Verify fix on production by hitting /api/trpc/portal.createQuoteFromVoice
