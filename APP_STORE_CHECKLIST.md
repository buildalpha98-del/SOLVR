# Solvr — App Store Connect Submission Checklist

**App:** Solvr — AI Receptionist  
**Bundle ID:** `com.solvr.mobile` *(code-of-record — matches Xcode project and `capacitor.config.ts`)*
**Version:** 1.0.0  
**Prepared:** 19 April 2026 · last revised 24 April 2026  
**Entity:** Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626)

This document is the single source of truth for everything required to submit Solvr v1.0.0 to the Apple App Store. Each section maps directly to a tab or field in App Store Connect. Items marked with a status column indicate whether the asset or information is ready, needs to be created, or requires a manual action in App Store Connect.

---

## 1. App Store Connect Account & Legal

These items must be in place before you can create the app listing.

| Item | Status | Detail |
|------|--------|--------|
| Apple Developer Program membership | **Verify** | Must be enrolled under Elevate Kids Holdings Pty Ltd (or ClearPath AI Agency Pty Ltd if that's the trading entity). $149 AUD/year. |
| D-U-N-S Number | **Verify** | Required for organisation enrolment. Check at [https://developer.apple.com/enroll/duns-lookup/](https://developer.apple.com/enroll/duns-lookup/). |
| Paid Applications Agreement | **Verify** | Must be signed in App Store Connect → Agreements, Tax, and Banking before IAP products can be submitted. |
| Bank account for payments | **Verify** | Australian bank account linked in App Store Connect for subscription revenue payouts. |
| Tax forms (W-8BEN-E) | **Verify** | Required for non-US entities. Complete in App Store Connect → Agreements, Tax, and Banking. |

---

## 2. App Identity & Metadata

Enter these in **App Store Connect → App Information** and **Version Information**.

### 2.1 Basic Information

| Field | Value | Max Length | Status |
|-------|-------|-----------|--------|
| App Name | `Solvr — AI Receptionist` | 30 chars | **Ready** |
| Subtitle | `Quote & Job Tool for Tradies` | 30 chars | **Ready** |
| Bundle ID | `com.solvr.mobile` | — | **Ready** |
| SKU | `solvr-ai-receptionist` | — | **Ready** |
| Primary Category | Business | — | **Enter in ASC** |
| Secondary Category | Productivity | — | **Enter in ASC** |
| Content Rights | Does not contain third-party content | — | **Enter in ASC** |

### 2.2 Keywords

Enter in **App Store Connect → Version Information → Keywords** (comma-separated, 100 chars max).

```
tradie,plumber,electrician,builder,AI,receptionist,quote,job,invoice,field service
```

**Status:** Ready (98 characters)

### 2.3 Description

Enter in **App Store Connect → Version Information → Description** (4,000 chars max).

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
Solvr is a subscription service. Plans start from $49/month. All new accounts include a 14-day free trial — no credit card required to start. See solvr.com.au/pricing for details.

PRIVACY
Solvr is operated by Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626). We comply with the Australian Privacy Act 1988. See solvr.com.au/privacy for our full Privacy Policy.
```

**Status:** Ready

### 2.4 Promotional Text

Enter in **App Store Connect → Version Information → Promotional Text** (170 chars, editable without new build).

```
Australia's first AI receptionist built for tradies. Answer every call, quote every job, win more work. Try free for 14 days.
```

**Status:** Ready (126 characters)

### 2.5 URLs

| Field | URL | Status |
|-------|-----|--------|
| Support URL | `https://solvr.com.au/support` | **Ready** — page exists |
| Marketing URL | `https://solvr.com.au` | **Ready** |
| Privacy Policy URL | `https://solvr.com.au/privacy` | **Ready** — page exists |

### 2.6 Version Release Notes

Enter in **App Store Connect → Version Information → What's New in This Version**.

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

**Status:** Ready

---

## 3. Visual Assets (Screenshots & App Icon)

Upload in **App Store Connect → Version Information → App Previews and Screenshots**.

### 3.1 App Icon

| Requirement | Specification | Status |
|-------------|--------------|--------|
| Size | 1024 x 1024 px | **CREATE** |
| Format | PNG, no alpha channel, no rounded corners (Apple applies mask) | **CREATE** |
| Upload location | ASC → App Information → App Icon | **CREATE** |

The icon should use the Solvr brand (navy #0F1F3D background, amber #F5A623 accent, white "S" mark or phone icon). Export from the existing logo assets.

### 3.2 iPhone Screenshots (Required)

Apple requires screenshots for the **6.7-inch display** (iPhone 15 Pro Max / 16 Pro Max). Minimum 3, maximum 10.

| # | Screen | Recommended Content | Size | Status |
|---|--------|-------------------|------|--------|
| 1 | Dashboard | Overview with calls, jobs, revenue stats | 1290 x 2796 px | **CREATE** |
| 2 | Calls | AI receptionist call log with transcripts | 1290 x 2796 px | **CREATE** |
| 3 | Quotes | Quote detail view with line items | 1290 x 2796 px | **CREATE** |
| 4 | Jobs | Job management board (kanban or list view) | 1290 x 2796 px | **CREATE** |
| 5 | Calendar | Weekly calendar with booked jobs | 1290 x 2796 px | **CREATE** |
| 6 | Forms | SWMS or Electrical Certificate form | 1290 x 2796 px | **CREATE** |

All screenshots should use the Apple reviewer demo account data (Demo Plumbing & Gas). Screenshots can include device frames and marketing text overlays — use a tool like Fastlane Frameit or Screenshots.pro.

### 3.3 iPad Screenshots (If Supporting iPad)

| Requirement | Specification | Status |
|-------------|--------------|--------|
| Size (12.9" display) | 2048 x 2732 px | **CREATE if iPad supported** |
| Minimum count | 3 | — |

If the Capacitor build targets iPad, these are mandatory. If iPad is excluded from the build target, skip this section.

### 3.4 App Preview Video (Optional but Recommended)

| Requirement | Specification | Status |
|-------------|--------------|--------|
| Duration | 15–30 seconds | **Optional** |
| Format | H.264, .mov or .mp4 | — |
| Size | Same as screenshot dimensions | — |

A 20-second walkthrough showing: incoming call → AI transcript → voice-to-quote → send quote would be highly effective for conversion.

---

## 4. App Review Information

Enter in **App Store Connect → Version Information → App Review Information**.

### 4.1 Reviewer Account

| Field | Value | Status |
|-------|-------|--------|
| Sign-in required | Yes | **Enter in ASC** |
| Username | `apple.review@solvr.com.au` | **Ready** |
| Password | `AppleReview2026!` | **Ready** |

### 4.2 Reviewer Notes

Paste the **Notes for Apple Reviewer** block from `APPLE_APP_STORE_SUBMISSION.md §3 Reviewer Account` into the Notes field. The canonical copy lives there so we don't maintain two versions of the reviewer-facing text.

**Status:** Ready

### 4.3 Contact Information

| Field | Value | Status |
|-------|-------|--------|
| First Name | Jayden | **Enter in ASC** |
| Last Name | Kowaider | **Enter in ASC** |
| Phone | *(your mobile)* | **Enter in ASC** |
| Email | *(your email)* | **Enter in ASC** |

### 4.4 Demo Data Seeding (Run Before Submission)

The Apple reviewer account must be populated with test data before submitting. Run these commands against the **production database**:

```bash
cd /path/to/solvr
node server/seed-demo.mjs
node server/seed-apple-upgrade.mjs
```

**Status:** Scripts ready — **run against prod before submitting**

---

## 5. App Privacy (Data Nutrition Labels)

Complete in **App Store Connect → App Privacy**.

### 5.1 Data Collection Declarations

> **Source of truth:** `ios/App/App/PrivacyInfo.xcprivacy` (bundled in the IPA).
> If this table and the privacy manifest diverge, Apple rejects the build.
> Update both together.

| Data Type | Collected? | Linked to User? | Used for Tracking? | Purpose |
|-----------|-----------|-----------------|-------------------|---------|
| Name | Yes | Yes | No | Customer records, quotes, invoices |
| Email address | Yes | Yes | No | Account login, notifications |
| Phone number | Yes | Yes | No | SMS notifications + customer contact records |
| Physical address | Yes | Yes | No | Job-site addresses on quotes and invoices |
| User ID | Yes | Yes | No | Authentication |
| Audio data | Yes | Yes | No | Voice-to-quote transcription (recordings discarded after transcription) |
| Photos / videos | Yes | Yes | No | Quote / job / completion-report attachments |
| Precise location | Yes | Yes | No | Staff check-in/check-out GPS verification |
| Other user content | Yes | Yes | No | Quote line items, job notes, invoice text, form submissions, digital signatures |
| Customer support data | Yes | Yes | No | In-app support messages |
| Payment info | No | — | — | Handled by Apple IAP via RevenueCat — not stored locally |
| Product interaction | No | — | — | No analytics SDK present |
| Crash data | No | — | — | No crash-reporting SDK present |
| Performance data | No | — | — | No performance-monitoring SDK present |
| Contacts | No | — | — | Not collected |
| Browsing history | No | — | — | Not collected |
| Search history | No | — | — | Not collected |

**Cross-check before submit:** open `ios/App/App/PrivacyInfo.xcprivacy` and confirm every `Yes` row in the table above has a matching `NSPrivacyCollectedDataType*` entry. Precise location and Physical address are the two most likely to drift — both are declared.

### 5.2 Summary Answers

| Question | Answer |
|----------|--------|
| Does your app use data for tracking? | No |
| Does your app collect data from third parties? | No |

**Status:** Ready — **enter in ASC**

---

## 6. Age Rating

Complete the questionnaire in **App Store Connect → App Information → Age Rating**.

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

**Expected result:** 4+ (suitable for all ages)

**Status:** Ready — **complete questionnaire in ASC**

---

## 7. In-App Purchases (Auto-Renewable Subscriptions)

Configure in **App Store Connect → Subscriptions**.

### 7.1 Subscription Group

Create one subscription group called **"Solvr Subscriptions"** containing all 6 products.

### 7.2 Products to Create

| Product ID | Display Name | Price (AUD) | Duration | Free Trial | Status |
|------------|-------------|-------------|----------|-----------|--------|
| `solvr_quotes_monthly` | Solvr Quotes — Monthly | $49.00 | 1 month | 14 days | **CREATE in ASC** |
| `solvr_quotes_yearly` | Solvr Quotes — Yearly | $490.00 | 1 year | 14 days | **CREATE in ASC** |
| `solvr_jobs_monthly` | Solvr Jobs — Monthly | $99.00 | 1 month | 14 days | **CREATE in ASC** |
| `solvr_jobs_yearly` | Solvr Jobs — Yearly | $990.00 | 1 year | 14 days | **CREATE in ASC** |
| `solvr_ai_monthly` | Solvr AI — Monthly | $199.00 | 1 month | 14 days | **CREATE in ASC** |
| `solvr_ai_yearly` | Solvr AI — Yearly | $1,990.00 | 1 year | 14 days | **CREATE in ASC** |

### 7.3 Subscription Descriptions (Required per Product)

Each product needs a localised display name and description in ASC.

| Product | Description |
|---------|------------|
| Solvr Quotes — Monthly | Create and send professional quotes. Includes customer database and price list. Billed monthly. |
| Solvr Quotes — Yearly | Create and send professional quotes. Includes customer database and price list. Save 17% with annual billing. |
| Solvr Jobs — Monthly | Full job management from lead to invoice. Includes everything in Quotes plus scheduling, invoicing, and purchase orders. Billed monthly. |
| Solvr Jobs — Yearly | Full job management from lead to invoice. Includes everything in Quotes plus scheduling, invoicing, and purchase orders. Save 17% with annual billing. |
| Solvr AI — Monthly | AI-powered business automation. Includes everything in Jobs plus AI receptionist, voice-to-quote, AI insights, and compliance documents. Billed monthly. |
| Solvr AI — Yearly | AI-powered business automation. Includes everything in Jobs plus AI receptionist, voice-to-quote, AI insights, and compliance documents. Save 17% with annual billing. |

### 7.4 Tier Hierarchy

Higher tiers include all features from lower tiers:

1. **Quotes** — Quotes, price list, customer database
2. **Jobs** — Everything in Quotes + job management, scheduling, invoicing, purchase orders
3. **AI** — Everything in Jobs + AI receptionist, voice-to-quote, AI insights, compliance docs

### 7.5 RevenueCat Configuration

| Item | Status |
|------|--------|
| RevenueCat project created (`solvr`) | **Done** |
| 3 entitlements created (solvr_quotes, solvr_jobs, solvr_ai) | **Done** |
| 6 products created with correct identifiers | **Done** |
| 3 offerings created (solvr_quotes, solvr_jobs, solvr_ai) | **Done** |
| Products attached to entitlements | **Done** |
| Products attached to packages | **Done** |
| Replace Test Store app with real Apple App Store app | **DO after ASC app is created** |
| Set App Store Shared Secret in RevenueCat | **DO after ASC app is created** |
| Set RevenueCat webhook URL in ASC Server Notifications V2 | **DO after ASC app is created** |

### 7.6 App-Side Requirements (Apple Guidelines 3.1.1 / 3.1.2)

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| "Restore Purchases" button | `client/src/pages/portal/PortalSubscription.tsx` — native-app branch + no-subscription branch. Calls `Purchases.restorePurchases()` via RevenueCat Capacitor SDK. | **Done** |
| Link to Apple subscription management | `client/src/pages/portal/PortalSubscription.tsx` — "Manage in Settings" button in native-app branch. Uses `window.location.href = "itms-apps://apps.apple.com/account/subscriptions"` (not `openUrl` — `itms-apps://` is a native URL scheme that SFSafariViewController cannot handle). Also present in `PortalSettings.tsx`. | **Done** |
| Clear pricing display before purchase | Pricing page shows all tiers with prices | **Verify in build** |
| Terms of service link | In subscription screen footer | **Verify in build** |

---

## 8. Build Configuration (Xcode / Capacitor)

These are set in the Xcode project or Capacitor config before building the .ipa.

### 8.1 Info.plist Values

| Key | Value | Status |
|-----|-------|--------|
| `CFBundleDisplayName` | Solvr | **Set in Capacitor config** |
| `CFBundleShortVersionString` | 1.0.0 | **Set in Capacitor config** |
| `CFBundleVersion` | 1 | **Set in Capacitor config** |
| `NSMicrophoneUsageDescription` | *(specific — see Info.plist)* | **Done** |
| `NSCameraUsageDescription` | *(specific — see Info.plist)* | **Done** |
| `NSPhotoLibraryUsageDescription` | *(specific — see Info.plist)* | **Done** |
| `NSPhotoLibraryAddUsageDescription` | *(specific — see Info.plist)* | **Done** |
| `NSLocationWhenInUseUsageDescription` | *(specific — see Info.plist)* | **Done** |
| `ITSAppUsesNonExemptEncryption` | `false` | **Done** |

### 8.1a Privacy Manifest (PrivacyInfo.xcprivacy) — MANDATORY since May 2024

The app-level privacy manifest lives at `ios/App/App/PrivacyInfo.xcprivacy` and declares:

- `NSPrivacyTracking: false` (no cross-app/website tracking, no IDFA use)
- 10 `NSPrivacyCollectedDataTypes` entries (see §5.1 — must match ASC nutrition label)
- 4 `NSPrivacyAccessedAPITypes` with reason codes: UserDefaults `CA92.1`, File timestamp `C617.1`, Disk space `E174.1`, System boot time `35F9.1`

**Manual Xcode step (one-time, required):** the file exists on disk but must be registered with the App target via Xcode, otherwise it is not embedded in the IPA.

1. Open `ios/App/App.xcworkspace` in Xcode
2. Project Navigator → right-click the **App** group → **Add Files to "App"…**
3. Select `ios/App/App/PrivacyInfo.xcprivacy`
4. In the dialog: **uncheck** "Copy items if needed", **check** the **App** target, click **Add**
5. Commit the resulting `project.pbxproj` change (it will add a `PBXFileReference` + membership entry)

To verify the manifest is inside the built IPA before upload:

```bash
unzip -l path/to/App.ipa | grep PrivacyInfo.xcprivacy
# → should list one entry under Payload/App.app/
```

Embedded SDKs (RevenueCat, Capacitor plugins) ship their own privacy manifests — Xcode merges them at archive time. If we add a new SDK that touches a tracked API, Xcode merges its manifest automatically.

### 8.2 Entitlements & Capabilities

| Capability | Required? | Reason | Status |
|-----------|-----------|--------|--------|
| Push Notifications | Yes | Job alerts and booking confirmations | **Enable in Xcode** |
| In-App Purchase | Yes | Subscription handling via StoreKit 2 | **Enable in Xcode** |
| Microphone | Yes | Voice-to-Quote recording | **Handled via Info.plist** |
| Camera | Optional | Quote photo attachments | **Handled via Info.plist** |
| Photo Library | Optional | Quote photo attachments | **Handled via Info.plist** |
| Background App Refresh | Optional | Push notification delivery | **Enable if needed** |

### 8.3 Build Requirements

| Item | Specification | Status |
|------|--------------|--------|
| Minimum iOS version | 15.0 | **Set in Capacitor config** |
| Signing certificate | Apple Distribution (not Development) | **Create in Apple Developer Portal** |
| Provisioning profile | App Store Distribution profile for `com.solvr.mobile` | **Create in Apple Developer Portal** |
| Archive & upload | Via Xcode → Product → Archive → Distribute App → App Store Connect | **Do at build time** |

---

## 9. Environments & Secrets

### 9.1 Production Environment

| Secret / Config | Where to Set | Status |
|----------------|-------------|--------|
| `REVENUECAT_WEBHOOK_SECRET` | Manus Settings → Secrets | **MISSING — get from RevenueCat Dashboard → Webhooks** |
| RevenueCat Apple Public API Key | Capacitor app config (client-side) | **Get from RevenueCat after linking ASC app** |
| App Store Shared Secret | RevenueCat Dashboard → Apps → Apple | **Get from ASC after creating app** |
| APNS certificate or key | Apple Developer Portal → Keys | **Create for push notifications** |

### 9.2 Seed Scripts (Run Before Submission)

| Script | Purpose | Command |
|--------|---------|---------|
| `seed-demo.mjs` | Creates Apple reviewer account + base demo data | `node server/seed-demo.mjs` |
| `seed-apple-upgrade.mjs` | Upgrades to full-managed plan + comprehensive test data | `node server/seed-apple-upgrade.mjs` |

---

## 10. Common Rejection Risks

These are the most likely rejection reasons for Solvr and how each is mitigated.

| Guideline | Risk | Mitigation | Status |
|-----------|------|-----------|--------|
| 2.1 App Completeness | App crashes or broken features | 376 tests passing, all features functional | **Mitigated** |
| 3.1.1 In-App Purchase | Subscription without IAP | RevenueCat/StoreKit 2 implemented | **Mitigated** |
| 3.1.2 Subscriptions | Missing restore button or management link | Both implemented in pricing/settings screens | **Verify in build** |
| 4.0 Design | Poor UI or non-native feel | Responsive design, Capacitor native bridge | **Mitigated** |
| 4.2.2 Minimum Functionality | App is just a website wrapper | Native push, microphone, camera, IAP | **Mitigated** |
| 5.1.1 Data Collection | No privacy policy | Privacy policy at solvr.com.au/privacy | **Mitigated** |
| 5.1.2 Data Use | Audio recording without disclosure | NSMicrophoneUsageDescription set | **Mitigated** |
| 2.3.3 Accurate Metadata | Misleading screenshots | Screenshots use real demo data | **Ensure at screenshot time** |

---

## 11. Submission Sequence (Step-by-Step)

Follow this order to avoid blockers.

| Step | Action | Depends On |
|------|--------|-----------|
| 1 | Verify Apple Developer Program enrolment (organisation account) | D-U-N-S number |
| 2 | Sign Paid Applications Agreement in ASC | Step 1 |
| 3 | Create app record in App Store Connect (`com.solvr.mobile`) | Step 1 |
| 4 | Create subscription group "Solvr Subscriptions" in ASC | Step 3 |
| 5 | Create 6 subscription products with pricing and 14-day trials | Step 4 |
| 6 | Link ASC app to RevenueCat (replace Test Store app) | Step 3 |
| 7 | Set App Store Shared Secret in RevenueCat | Step 3 |
| 8 | Get RevenueCat Apple Public API Key for Capacitor config | Step 6 |
| 9 | Install RevenueCat Capacitor SDK in Claude Code | Step 8 |
| 10 | Wire native purchase flow + restore purchases + management link | Step 9 |
| 11 | Create APNS key in Apple Developer Portal | Step 1 |
| 12 | Create Distribution certificate + provisioning profile | Step 1 |
| 13 | Build .ipa with production signing (Xcode Archive) | Steps 10, 12 |
| 14 | Test on physical device (sandbox purchases, push, microphone) | Step 13 |
| 15 | Take screenshots from physical device or simulator | Step 14 |
| 16 | Export 1024x1024 app icon PNG (no alpha) | — |
| 17 | Run seed scripts against production DB | — |
| 18 | Enter all metadata in ASC (description, keywords, URLs, etc.) | Step 3 |
| 19 | Complete App Privacy questionnaire | Step 3 |
| 20 | Complete Age Rating questionnaire | Step 3 |
| 21 | Enter reviewer account credentials and notes | Step 17 |
| 22 | Upload screenshots and app icon | Steps 15, 16 |
| 23 | Upload .ipa build via Xcode or Transporter | Step 13 |
| 24 | Select build in ASC version, attach IAP products | Steps 5, 23 |
| 25 | Submit for review | All above |

---

## 12. Post-Submission

| Item | Detail |
|------|--------|
| Review time | Typically 24–48 hours for first submission |
| Rejection response | Reply directly in Resolution Centre with fixes |
| Expedited review | Available at [https://developer.apple.com/contact/app-store/](https://developer.apple.com/contact/app-store/) for critical fixes |
| Version 1.0.1 prep | Fix any reviewer feedback, increment `CFBundleVersion` to 2 |
