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
