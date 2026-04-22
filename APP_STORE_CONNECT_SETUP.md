# App Store Connect — Subscription Product Setup Guide

**Last updated:** 22 April 2026

This document provides step-by-step instructions for creating the 6 subscription products in App Store Connect (ASC) that match the RevenueCat product IDs documented in `REVENUECAT_CONFIG.md`.

---

## Prerequisites

1. An active Apple Developer Program membership ($149 AUD/year)
2. An app created in App Store Connect (bundle ID must match `capacitor.config.ts`)
3. A completed "Agreements, Tax, and Banking" setup for Paid Apps in ASC
4. RevenueCat project `solvr (proj9e04a1ff)` ready to link

---

## Step 1: Create the Subscription Group

1. Open [App Store Connect](https://appstoreconnect.apple.com) → Your App → **Subscriptions**
2. Click **Create Subscription Group**
3. Name: **Solvr Subscriptions**
4. Reference Name: `solvr_subscriptions`

> All 6 products go into this single group. Apple allows users to upgrade/downgrade within a group without being double-charged.

---

## Step 2: Create the 6 Subscription Products

Create each product inside the **Solvr Subscriptions** group. The **Product ID** must match exactly — RevenueCat uses these identifiers to reconcile purchases.

| # | Reference Name | Product ID (Store Identifier) | Duration | Price (AUD) |
|---|---|---|---|---|
| 1 | Solvr Quotes Monthly | `solvr_quotes_monthly` | 1 Month | $49.99 |
| 2 | Solvr Quotes Yearly | `solvr_quotes_yearly` | 1 Year | $489.99 |
| 3 | Solvr Jobs Monthly | `solvr_jobs_monthly` | 1 Month | $99.99 |
| 4 | Solvr Jobs Yearly | `solvr_jobs_yearly` | 1 Year | $989.99 |
| 5 | Solvr AI Monthly | `solvr_ai_monthly` | 1 Month | $199.99 |
| 6 | Solvr AI Yearly | `solvr_ai_yearly` | 1 Year | $1,989.99 |

> **Note on pricing:** Apple requires prices from their price tier grid. The prices above are the closest tiers to $49/$490/$99/$990/$199/$1,990. Apple will auto-generate prices for all other currencies.

### For each product:

1. Click **Create Subscription** inside the Solvr Subscriptions group
2. Enter the **Reference Name** and **Product ID** exactly as shown above
3. Set the **Subscription Duration** (1 Month or 1 Year)
4. Click **Set a Subscription Price** → choose Australia (AUD) as the base → select the price tier
5. Under **Subscription Pricing**, confirm the AUD amount
6. Add **Localisation** (at minimum, English (Australia)):
   - Display Name: e.g. "Solvr Quotes — Monthly"
   - Description: e.g. "AI-powered quoting tools for Australian tradies. Includes smart quotes, client management, and automated follow-ups."

---

## Step 3: Set Subscription Ranking (Upgrade/Downgrade Order)

Within the **Solvr Subscriptions** group, set the ranking from highest to lowest:

1. `solvr_ai_yearly` (highest)
2. `solvr_ai_monthly`
3. `solvr_jobs_yearly`
4. `solvr_jobs_monthly`
5. `solvr_quotes_yearly`
6. `solvr_quotes_monthly` (lowest)

This ranking determines upgrade/downgrade behaviour:
- Moving **up** the list = upgrade (immediate, prorated)
- Moving **down** the list = downgrade (takes effect at next renewal)

---

## Step 4: Configure Offer Codes (Optional)

For promotional campaigns, create Offer Codes:
- Go to each subscription → **Offer Codes**
- Create a custom code (e.g., `LAUNCH50` for 50% off first month)
- These can be distributed via marketing campaigns

---

## Step 5: Link to RevenueCat

1. In ASC → Your App → **App Information** → copy the **Apple App ID** (numeric)
2. In RevenueCat Dashboard → Project Settings → Apps
3. Click **+ New App** → select **Apple App Store**
4. Enter the Apple App ID and Bundle ID
5. This replaces the current "Test Store" app (`appcfafea6316`)
6. Go to **Apps** → your Apple app → **App Store Connect API** section
7. Enter the **App Store Connect Shared Secret**:
   - In ASC → Your App → **App Information** → **App-Specific Shared Secret** → Generate
   - Copy and paste into RevenueCat

---

## Step 6: Configure Server Notifications (S2S)

1. In ASC → Your App → **App Information** → **App Store Server Notifications**
2. Set the **Production URL** to: `https://api.revenuecat.com/v1/subscribers/apple`
3. Set **Version** to: Version 2
4. This ensures RevenueCat receives real-time subscription status updates

---

## Step 7: Sandbox Testing

Before submitting for review:

1. Create a **Sandbox Tester** account in ASC → Users and Access → Sandbox → Testers
2. On a physical iOS device, sign out of your real Apple ID in Settings → App Store
3. Sign in with the sandbox tester account
4. Open the Solvr app and attempt a purchase — sandbox purchases are free
5. Verify the purchase appears in RevenueCat Dashboard → Customers

---

## Verification Checklist

- [ ] All 6 products created with exact Product IDs matching `REVENUECAT_CONFIG.md`
- [ ] All products in a single subscription group ("Solvr Subscriptions")
- [ ] Ranking set correctly (AI > Jobs > Quotes, Yearly > Monthly)
- [ ] Prices set in AUD with auto-generated international prices
- [ ] Localisations added (English Australia at minimum)
- [ ] RevenueCat linked with Apple App ID and Shared Secret
- [ ] S2S notifications configured (Version 2)
- [ ] Sandbox purchase tested successfully
- [ ] RevenueCat Dashboard shows sandbox transaction

---

## Product ID Quick Reference

```
solvr_quotes_monthly   →  $49.99/mo   →  entitlement: solvr_quotes
solvr_quotes_yearly    →  $489.99/yr  →  entitlement: solvr_quotes
solvr_jobs_monthly     →  $99.99/mo   →  entitlement: solvr_jobs
solvr_jobs_yearly      →  $989.99/yr  →  entitlement: solvr_jobs
solvr_ai_monthly       →  $199.99/mo  →  entitlement: solvr_ai
solvr_ai_yearly        →  $1,989.99/yr →  entitlement: solvr_ai
```
