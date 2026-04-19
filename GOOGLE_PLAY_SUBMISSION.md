# Solvr — Google Play Store Submission Guide

**App name:** Solvr — AI Receptionist for Tradies  
**Package ID:** au.com.solvr.app  
**Version:** 1.0.0  
**Prepared:** April 2026

---

## 1. Store Listing

### Short Description (80 chars max)
```
AI receptionist & quote engine for Australian tradies
```

### Full Description (4000 chars max)
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
Automatically prompt happy customers to leave a Google review after job completion. Build your reputation on autopilot.

WHO IS SOLVR FOR?
Solvr is built for Australian trade businesses: plumbers, electricians, builders, carpenters, HVAC technicians, and other field service operators who want to grow their business without growing their admin.

PRICING
Solvr is a subscription service. Plans start from $99/month. All new accounts include a 14-day free trial — no credit card required to start. See solvr.com.au/pricing for details.

PRIVACY
Solvr is operated by Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626). We comply with the Australian Privacy Act 1988. Call recordings are used solely to deliver the service. See solvr.com.au/privacy for our full Privacy Policy.
```

### App Category
**Primary:** Business  
**Secondary:** Productivity

### Content Rating
**PEGI / ESRB equivalent:** Everyone (no violence, no adult content, no gambling)  
**Target age group:** Adults (18+) — business professionals

### Tags / Keywords
```
tradie, plumber, electrician, builder, AI receptionist, quote, invoice, job management, field service, trade business, Australia
```

---

## 2. Data Safety Declaration

Fill this in on the Play Console under **App content → Data safety**.

### Data collected and shared

| Data type | Collected? | Shared? | Required? | Purpose |
|-----------|-----------|---------|-----------|---------|
| Name | ✅ Yes | ❌ No | Yes | Account creation, quote generation |
| Email address | ✅ Yes | ❌ No | Yes | Account login, notifications |
| Phone number | ✅ Yes | ❌ No | Yes | Account creation |
| User IDs | ✅ Yes | ❌ No | Yes | Authentication |
| Audio recordings | ✅ Yes | ❌ No | Yes | AI receptionist call transcription |
| Photos / files | ✅ Yes | ❌ No | No | Quote photo attachments (optional) |
| Push notification tokens | ✅ Yes | ❌ No | No | Job alerts (optional, user-controlled) |
| App interactions | ✅ Yes | ❌ No | Yes | Analytics, service improvement |
| Crash logs | ✅ Yes | ❌ No | Yes | Debugging |
| Payment info | ❌ No (Stripe handles) | ❌ No | — | Billing via Stripe (not stored locally) |
| Precise location | ❌ No | ❌ No | — | Not collected |
| Contacts | ❌ No | ❌ No | — | Not collected |

### Data handling answers

**Is all of the user data collected by your app encrypted in transit?**  
✅ Yes — all data is transmitted over HTTPS/TLS 1.2+

**Do you provide a way for users to request that their data is deleted?**  
✅ Yes — users can request deletion by emailing hello@solvr.com.au. We will delete all personal data within 30 days.

**Privacy policy URL:**  
`https://solvr.com.au/privacy`

---

## 3. App Content Declarations

### Ads
❌ No — Solvr does not display third-party advertisements.

### In-app purchases
✅ Yes — Solvr offers subscription plans. Billing is handled via Stripe (external payment processor). No in-app purchase API is used.  
**Note:** Because billing is handled via a web checkout (not Google Play Billing), you do NOT need to use Google Play Billing API. This is compliant for B2B SaaS apps that direct users to a web payment flow.

### Target audience
Adults only (18+). No content directed at children.

### Sensitive permissions
| Permission | Reason |
|-----------|--------|
| `INTERNET` | Required for all API calls |
| `RECEIVE_BOOT_COMPLETED` | Required for push notification scheduling |
| `POST_NOTIFICATIONS` (Android 13+) | Required for job alert push notifications |
| `CAMERA` (if quote photos enabled) | Optional — for uploading job site photos to quotes |
| `READ_EXTERNAL_STORAGE` / `READ_MEDIA_IMAGES` | Optional — for selecting photos from gallery |
| `RECORD_AUDIO` | Required for voice-to-quote recording feature |
| `VIBRATE` | Required for push notification vibration |

**Note:** `RECORD_AUDIO` requires a prominent disclosure in the app before first use. Ensure the voice-to-quote screen shows a clear "This app will record audio" message before the microphone is activated.

---

## 4. Reviewer Account

| Field | Value |
|-------|-------|
| Email | android.review@solvr.com.au |
| Password | AndroidReview2026! |
| Login URL | https://solvr.com.au/portal/login |
| Plan | Full-managed (all features unlocked) |

### What the reviewer will see
- **Dashboard:** 15 recent calls, job stats, AI insights
- **Calls:** 15 inbound calls with AI-extracted summaries
- **Quotes:** 6 quotes (draft, sent, accepted) with line items
- **Jobs:** 8 jobs across all pipeline stages
- **Calendar:** 7 upcoming and past events
- **Compliance:** Generate SWMS, Site Induction, Safety Certificate, JSA
- **Reviews:** Google review request history
- **Staff:** 2 staff members (Jake Thompson, Sam Wilson)
- **Settings:** Full profile, branding, notification preferences

### Reviewer notes to include in submission
```
Demo account credentials:
Email: android.review@solvr.com.au
Password: AndroidReview2026!

This account has been pre-loaded with realistic demo data for a plumbing business 
(Demo Plumbing & Gas). All features are unlocked and accessible without requiring 
a paid subscription.

The AI Receptionist feature (voice call handling) requires a live Vapi integration 
which is not active in the demo environment. To demonstrate this feature, please 
view the pre-seeded call transcripts in the Calls section, which show the output 
of the AI receptionist processing real inbound calls.

The Voice-to-Quote feature requires microphone access. Please grant microphone 
permission when prompted to test this feature.
```

---

## 5. App Store Assets Required

### Screenshots (required sizes for Google Play)
- **Phone:** 1080 × 1920px (portrait) — minimum 2, maximum 8
- **7-inch tablet:** 1200 × 1920px — optional but recommended
- **10-inch tablet:** 1600 × 2560px — optional

### Feature Graphic
- **Size:** 1024 × 500px
- **Format:** PNG or JPEG
- **Content:** App logo + tagline on dark background

### App Icon
- **Size:** 512 × 512px
- **Format:** PNG (32-bit, with alpha)
- **Content:** Solvr logo mark

---

## 6. Pre-Launch Checklist

Before submitting to Google Play:

- [ ] App icon 512×512 PNG uploaded
- [ ] Feature graphic 1024×500 PNG uploaded
- [ ] Minimum 2 phone screenshots uploaded
- [ ] Short description (80 chars) entered
- [ ] Full description (4000 chars) entered
- [ ] Privacy policy URL entered: `https://solvr.com.au/privacy`
- [ ] Data safety form completed (see Section 2 above)
- [ ] Content rating questionnaire completed (result: Everyone)
- [ ] Target audience set to Adults 18+
- [ ] Reviewer account credentials entered in "App access" section
- [ ] `RECORD_AUDIO` permission declaration added with justification
- [ ] In-app purchases declared (Stripe external checkout)
- [ ] Release notes written for version 1.0.0
- [ ] App signed with production keystore
- [ ] `minSdkVersion` ≥ 24 (Android 7.0) confirmed in build.gradle
- [ ] `targetSdkVersion` = 34 (Android 14) confirmed in build.gradle

---

## 7. Release Notes (What's New)

### Version 1.0.0
```
🚀 Solvr is here — the AI receptionist and quote engine built for Australian tradies.

🎁 14-day free trial — no credit card required.

• AI Receptionist: Never miss a call again. Your AI answers, extracts job details, and logs everything to your dashboard.
• Voice-to-Quote: Record a voice note on-site and get a professional quote in seconds.
• Job Management: Track every lead from first call to invoice.
• Calendar & Scheduling: Book jobs and assign staff from your phone.
• Compliance Docs: Generate SWMS, Site Inductions, and Safety Certificates instantly.
• Google Reviews: Automatically request reviews from happy customers.

Built for plumbers, electricians, builders, and all Australian trades.
```

---

## 8. Google Play Policy Compliance Notes

### Microphone (RECORD_AUDIO)
The app uses the microphone exclusively for the Voice-to-Quote feature, where the tradie records a voice note describing a job. The recording is transcribed by AI to generate a quote. A prominent disclosure is shown before first use. Recordings are not used for advertising or shared with third parties.

### Call Logs
The app does NOT access the device's call log. Inbound calls are handled by the Vapi AI platform (a third-party telephony service) — the app only displays the transcribed results, not raw call data.

### Background Location
The app does NOT use background location. No location data is collected.

### Sensitive Data
All sensitive data (call recordings, business information) is stored on Solvr's servers (AWS S3 + MySQL via Neon), encrypted at rest and in transit. Data is not sold or shared with third parties for advertising.
