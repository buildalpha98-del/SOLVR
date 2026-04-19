# Solvr — Apple App Store Submission Guide

**App name:** Solvr — AI Receptionist  
**Bundle ID:** au.com.solvr.app  
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

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|-----------|-----------|-----------------|-------------------|---------|
| Name | ✅ Yes | ✅ Yes | ❌ No | Account creation |
| Email address | ✅ Yes | ✅ Yes | ❌ No | Account login, notifications |
| Phone number | ✅ Yes | ✅ Yes | ❌ No | Account creation |
| User ID | ✅ Yes | ✅ Yes | ❌ No | Authentication |
| Audio data (recordings) | ✅ Yes | ✅ Yes | ❌ No | AI receptionist transcription |
| Photos / videos | ✅ Yes | ✅ Yes | ❌ No | Quote photo attachments (optional) |
| Customer support data | ✅ Yes | ✅ Yes | ❌ No | Support requests |
| Product interaction | ✅ Yes | ✅ Yes | ❌ No | Analytics, service improvement |
| Crash data | ✅ Yes | ❌ No | ❌ No | Debugging |
| Performance data | ✅ Yes | ❌ No | ❌ No | App performance monitoring |
| Payment info | ❌ No | — | — | Handled by Apple IAP via RevenueCat (not stored locally) |
| Precise location | ❌ No | — | — | Not collected |
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
This is a B2B SaaS application for Australian trade businesses. The app requires 
an account to use — there is no public browsing mode.

Demo account credentials:
Email: apple.review@solvr.com.au
Password: AppleReview2026!

This account has been pre-loaded with realistic demo data for a plumbing business 
(Demo Plumbing & Gas). All features are unlocked and accessible without requiring 
a paid subscription.

The AI Receptionist feature (voice call handling) requires a live telephony 
integration which is not active in the demo environment. To demonstrate this 
feature, please view the pre-seeded call transcripts in the Calls section, which 
show the output of the AI receptionist processing real inbound calls.

The Voice-to-Quote feature requires microphone access. Please grant microphone 
permission when prompted to test this feature.

Subscriptions are handled via Apple In-App Purchase (auto-renewable subscriptions 
managed through RevenueCat/StoreKit 2). The reviewer account has all features 
unlocked without requiring an active subscription.

To test the subscription flow, navigate to the Pricing page from the dashboard 
sidebar. The app uses RevenueCat's Capacitor SDK for purchase handling.

The app includes a "Restore Purchases" button and a link to Apple's subscription 
management page, as required by App Store guidelines.
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

The app includes a link to Apple's subscription management page (`https://apps.apple.com/account/subscriptions`) in the account/settings section (required by Apple).

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
