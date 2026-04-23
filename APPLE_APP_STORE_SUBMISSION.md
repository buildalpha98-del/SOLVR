# Solvr — Apple App Store Submission Guide

**App name:** Solvr — AI Receptionist  
**Bundle ID:** com.solvr.mobile  
**Version:** 1.0.0  
**Prepared:** April 2026

---

## 1. App Store Listing

### App Name (30 chars max)
```
Solvr — AI Receptionist
```

### Subtitle (30 chars max)
```
Quote & Job Tool for Tradies
```

### Keywords (100 chars max)
```
tradie,plumber,electrician,builder,AI,receptionist,quote,job,invoice,field service
```

### Description (4000 chars max)
```
Solvr gives Australian tradies a 24/7 AI receptionist that answers calls, books jobs, and sends quotes — so you never miss a lead again.

WHAT SOLVR DOES FOR YOU

📞 AI Receptionist
Your AI receptionist answers every inbound call, extracts the job details, and logs it straight to your dashboard. No more missed calls. No more voicemail tag.

📋 Voice-to-Quote Engine
Record a voice note on-site and Solvr turns it into a professional, itemised quote in seconds. Send it to the customer with one tap.

📅 Job Management
Track every lead from first call to invoice. New lead → Quoted → Booked → Completed. See everything in one clean dashboard.

🗓️ Calendar & Scheduling
Book jobs directly from the dashboard. Assign staff. See your week at a glance.

📊 AI Insights
Get weekly AI-generated summaries of your business performance — call volume, quote conversion, revenue trends.

✅ Compliance Documents
Generate SWMS, Site Induction checklists, Safety Certificates, and JSAs in seconds using AI. Stay compliant without the paperwork.

⭐ Google Review Requests
Automatically prompt happy customers to leave a Google review after job completion.

WHO IS SOLVR FOR?
Solvr is built for Australian trade businesses: plumbers, electricians, builders, carpenters, HVAC technicians, and other field service operators.

PRICING
Solvr is a subscription service. Plans start from $99/month. All new accounts include a 14-day free trial — no credit card required to start. See solvr.com.au/pricing for details.

PRIVACY
Solvr is operated by Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626). We comply with the Australian Privacy Act 1988. See solvr.com.au/privacy for our full Privacy Policy.
```

### Promotional Text (170 chars — shown above description, can be updated without new build)
```
Australia's first AI receptionist built for tradies. Answer every call, quote every job, win more work. Try free for 14 days.
```

### Support URL
```
https://solvr.com.au/support
```

### Marketing URL
```
https://solvr.com.au
```

### Privacy Policy URL
```
https://solvr.com.au/privacy
```

---

## 2. App Privacy (Nutrition Label)

Fill this in on App Store Connect under **App Privacy**.

### Data collected

> Source of truth for this table: `ios/App/App/PrivacyInfo.xcprivacy`. Any change here requires a matching change there, and vice versa — Apple cross-checks.

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|-----------|-----------|-----------------|-------------------|---------|
| Name | ✅ Yes | ✅ Yes | ❌ No | Customer records, quotes, invoices |
| Email address | ✅ Yes | ✅ Yes | ❌ No | Account login, notifications |
| Phone number | ✅ Yes | ✅ Yes | ❌ No | SMS notifications + customer contact records |
| Physical address | ✅ Yes | ✅ Yes | ❌ No | Job-site addresses on quotes and invoices |
| User ID | ✅ Yes | ✅ Yes | ❌ No | Authentication |
| Audio data (recordings) | ✅ Yes | ✅ Yes | ❌ No | Voice-to-quote transcription (recordings discarded after transcription) |
| Photos / videos | ✅ Yes | ✅ Yes | ❌ No | Quote / job / completion-report attachments |
| Precise location | ✅ Yes | ✅ Yes | ❌ No | Staff check-in/check-out GPS verification |
| Other user content | ✅ Yes | ✅ Yes | ❌ No | Quote line items, job notes, invoice text, form submissions, signatures |
| Customer support data | ✅ Yes | ✅ Yes | ❌ No | In-app support messages |
| Payment info | ❌ No | — | — | Handled by Apple IAP via RevenueCat (not stored locally) |
| Product interaction | ❌ No | — | — | No analytics SDK present |
| Crash data | ❌ No | — | — | No crash-reporting SDK present |
| Performance data | ❌ No | — | — | No performance-monitoring SDK present |
| Contacts | ❌ No | — | — | Not collected |
| Browsing history | ❌ No | — | — | Not collected |
| Search history | ❌ No | — | — | Not collected |

**Does your app use data for tracking?** ❌ No  
**Does your app collect data from third parties?** ❌ No

---

## 3. Reviewer Account

| Field | Value |
|-------|-------|
| Email | apple.review@solvr.com.au |
| Password | AppleReview2026! |
| Login URL | https://solvr.com.au/portal/login |
| Plan | Full-managed (all features unlocked) |

### Notes for Apple Reviewer
```
Solvr is a B2B SaaS app for Australian trade businesses (plumbers, electricians,
builders, HVAC). Sign-in is required — there is no public browsing mode, which
is standard for a field-service-management tool tied to a specific business
account.

DEMO ACCOUNT
Email:    apple.review@solvr.com.au
Password: AppleReview2026!
URL:      opens at https://solvr.com.au/portal/login inside the in-app web view

This account is pre-seeded with a realistic plumbing business (Demo Plumbing &
Gas). All features are unlocked without requiring a paid subscription, so the
reviewer does not need sandbox IAP purchases to exercise the app.

WHAT TO TEST

1. Dashboard / Calls
   The Calls tab has pre-seeded call transcripts showing the output of the AI
   receptionist. Live inbound telephony is not active in the demo environment
   (it requires a provisioned carrier number), so the transcripts demonstrate
   the end state the reviewer would see in production.

2. Voice-to-Quote (primary AI differentiator)
   Quotes → New Quote → tap the microphone button → record a short spoken
   description of a job → the app transcribes the audio and generates a
   structured, line-itemised quote. Grant microphone permission when prompted
   (Apple's NSMicrophoneUsageDescription explains why).

3. Job Management
   Jobs tab shows a kanban-style pipeline (New Lead → Quoted → Booked →
   Completed). Drag or tap status chips to move jobs between states.

4. Compliance Documents (AI-generated)
   Forms tab can generate SWMS, Site Induction, Safety Certificate, and JSA
   forms using AI. Select a template and hit Generate.

5. Subscription Management
   Subscription tab shows the active demo plan. Reviewer can test:
   - "Change Plan" → opens the RevenueCat native paywall (StoreKit 2 sheet)
   - "Manage in Settings" → deep-links into iOS Settings → Subscriptions
     (Guideline 3.1.2)
   - "Restore Purchases" → triggers Purchases.restorePurchases()
     (Guideline 3.1.1)

PERMISSIONS THE APP REQUESTS
   - Microphone  — only when the user taps the voice-to-quote mic button
   - Camera      — only when the user attaches a photo to a quote/job
   - Photo Lib.  — only when the user picks an existing photo
   - Location    — only when a staff member checks in/out of a job site
   - Notifications — for inbound-call and booking-confirmation alerts

All permission prompts are gated behind explicit user actions — none are
requested at launch.

SIGN IN WITH APPLE
The app uses first-party email/password auth only. No third-party social login
(Google, Facebook, etc.) is offered, so Sign in with Apple is not required per
Guideline 4.8.

IN-APP PURCHASES
All subscriptions are auto-renewable Apple IAP through RevenueCat's Capacitor
SDK (StoreKit 2). The demo account is pre-provisioned with full access so the
reviewer doesn't need to run a sandbox purchase — but if desired, sandbox
purchases work normally from the Pricing page.

CONTACT
For questions during review: jayden@amanaoshc.com.au
```

---

## 4. Age Rating

Complete the age rating questionnaire with these answers:

| Question | Answer |
|----------|--------|
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Sexual content or nudity | None |
| Profanity or crude humour | None |
| Alcohol, tobacco, or drug use | None |
| Simulated gambling | None |
| Horror/fear themes | None |
| Mature/suggestive themes | None |
| Unrestricted web access | None |
| Gambling and contests | None |

**Result:** 4+ (suitable for all ages)

---

## 5. In-App Purchases

**Does the app have in-app purchases?** ✅ Yes — Auto-Renewable Subscriptions

**Subscription management:** RevenueCat (StoreKit 2 via Capacitor SDK)

### Subscription Group: Solvr Subscriptions

| Product ID | Display Name | Price (AUD) | Duration |
|---|---|---|---|
| solvr_quotes_monthly | Solvr Quotes — Monthly | $49.00 | 1 month |
| solvr_quotes_yearly | Solvr Quotes — Yearly | $490.00 | 1 year |
| solvr_jobs_monthly | Solvr Jobs — Monthly | $99.00 | 1 month |
| solvr_jobs_yearly | Solvr Jobs — Yearly | $990.00 | 1 year |
| solvr_ai_monthly | Solvr AI — Monthly | $199.00 | 1 month |
| solvr_ai_yearly | Solvr AI — Yearly | $1,990.00 | 1 year |

### Tier Hierarchy (higher tiers include all lower-tier features)

1. **Quotes** — Quotes, price list, customer database
2. **Jobs** — Everything in Quotes + job management, scheduling, invoicing, purchase orders
3. **AI** — Everything in Jobs + AI receptionist, voice-to-quote, AI insights, compliance docs

### Subscription Localisation (required for each product in ASC)

| Field | Value |
|---|---|
| Display Name | e.g. "Solvr Quotes — Monthly" |
| Description | e.g. "Create and send professional quotes. Includes customer database and price list." |

### Free Trial

All plans include a **14-day free trial** (configured in App Store Connect per product, not in RevenueCat).

### Restore Purchases

The app includes a "Restore Purchases" button on the subscription screen (required by Apple). This calls `Purchases.restorePurchases()` via the RevenueCat SDK.

### Subscription Management Link

The app includes a **"Manage in Settings"** button on the subscription screen (Apple Guideline 3.1.2). It navigates directly to the iOS native subscription-management screen using the `itms-apps://` URL scheme — `itms-apps://apps.apple.com/account/subscriptions` — which opens the Settings → Apple ID → Subscriptions pane without leaving the user in Safari first. Also surfaced from Portal Settings.

Implementation detail: the button uses `window.location.href` rather than Capacitor's `Browser.open` / `openUrl`, because SFSafariViewController cannot handle the `itms-apps://` scheme — the OS has to route it natively.

---

## 6. Required Entitlements / Capabilities

| Capability | Required? | Reason |
|-----------|-----------|--------|
| Push Notifications | ✅ Yes | Job alerts and booking confirmations |
| Microphone | ✅ Yes | Voice-to-Quote recording feature |
| Camera | Optional | Quote photo attachments |
| Photo Library | Optional | Quote photo attachments |
| Background App Refresh | Optional | Push notification delivery |

### NSUsageDescription strings (Info.plist)

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Solvr uses your microphone to record voice notes for the Voice-to-Quote feature. Your recording is transcribed to generate a professional quote.</string>

<key>NSCameraUsageDescription</key>
<string>Solvr uses your camera to take photos of job sites, which can be attached to quotes.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Solvr accesses your photo library so you can attach job site photos to quotes.</string>
```

---

## 7. Pre-Launch Checklist

- [ ] App icon 1024×1024 PNG uploaded (no alpha channel)
- [ ] Minimum 3 iPhone screenshots (6.7" display) uploaded
- [ ] Minimum 3 iPad screenshots uploaded (if iPad supported)
- [ ] App name, subtitle, keywords entered
- [ ] Description and promotional text entered
- [ ] Support URL entered: `https://solvr.com.au/support`
- [ ] Privacy policy URL entered: `https://solvr.com.au/privacy`
- [ ] App Privacy nutrition label completed (see Section 2)
- [ ] Age rating questionnaire completed (result: 4+)
- [ ] Reviewer account credentials entered in "App Review Information"
- [ ] Reviewer notes entered (see Section 3)
- [ ] NSMicrophoneUsageDescription in Info.plist
- [ ] NSCameraUsageDescription in Info.plist (if camera used)
- [ ] NSPhotoLibraryUsageDescription in Info.plist (if photo library used)
- [ ] Push notification entitlement configured
- [ ] In-App Purchase products created in App Store Connect (6 auto-renewable subscriptions)
- [ ] Subscription group "Solvr Subscriptions" created with all 6 products
- [ ] Free trial period (14 days) configured per product in ASC
- [ ] RevenueCat Apple app linked (replace Test Store app with real ASC app)
- [ ] App Store Shared Secret set in RevenueCat > Project > Apps > Apple
- [ ] "Restore Purchases" button visible on subscription screen
- [ ] Link to Apple subscription management page in settings
- [ ] App built with production certificate and provisioning profile
- [ ] `CFBundleShortVersionString` = "1.0.0" in Info.plist
- [ ] `CFBundleVersion` = "1" in Info.plist
- [ ] Minimum iOS version ≥ 15.0 confirmed

---

## 8. Version Release Notes

### Version 1.0.0
```
🚀 Solvr is here — the AI receptionist and quote engine built for Australian tradies.

🎁 14-day free trial — no credit card required.

• AI Receptionist: Never miss a call again
• Voice-to-Quote: Professional quotes from a voice note
• Job Management: Track every lead to invoice
• Calendar & Scheduling: Book jobs from your phone
• Compliance Docs: SWMS, Site Inductions, Safety Certificates
• Google Reviews: Automate your reputation building

Built for plumbers, electricians, builders, and all Australian trades.
```

---

## 9. Common Rejection Reasons to Avoid

| Risk | Mitigation |
|------|-----------|
| **2.1 App Completeness** — app crashes or has broken features | Compliance doc generation tested ✅, all 4 types working |
| **4.0 Design** — poor UI | Responsive design, tested on iPhone 14 Pro and iPad |
| **5.1.1 Data Collection** — no privacy policy | Privacy policy at solvr.com.au/privacy ✅ |
| **5.1.2 Data Use** — audio recording without disclosure | NSMicrophoneUsageDescription set ✅ |
| **3.1.1 In-App Purchase** — subscription without IAP | IAP implemented via RevenueCat/StoreKit 2 ✅ |
| **2.3.3 Accurate Metadata** — misleading screenshots | Screenshots show real app UI with demo data |
| **4.2.2 Minimum Functionality** — app is just a website | App has native push notifications, microphone, camera |
