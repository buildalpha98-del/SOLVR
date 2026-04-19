# RevenueCat Configuration Reference

**Project:** solvr (proj9e04a1ff)
**App:** Test Store (appcfafea6316) — will be replaced with Apple App Store app after ASC setup

## Entitlements (Tiered — higher tiers include lower)

| Entitlement | ID | Grants Access To |
|---|---|---|
| solvr_quotes | entl1e29692aa9 | Quotes features |
| solvr_jobs | entl02475d3513 | Jobs + Quotes features |
| solvr_ai | entlde84ed44a5 | AI + Jobs + Quotes features |

## Products

| Display Name | Store Identifier | Product ID | Duration |
|---|---|---|---|
| Solvr Quotes Monthly | solvr_quotes_monthly | prod9fc745fa7e | P1M |
| Solvr Quotes Yearly | solvr_quotes_yearly | prodbd0f4bcf73 | P1Y |
| Solvr Jobs Monthly | solvr_jobs_monthly | prodeea7d9ee0d | P1M |
| Solvr Jobs Yearly | solvr_jobs_yearly | prod739338cb9b | P1Y |
| Solvr AI Monthly | solvr_ai_monthly | prod7afdbaa6c2 | P1M |
| Solvr AI Yearly | solvr_ai_yearly | prod43d8c2877a | P1Y |

## Entitlement to Product Mapping

- **solvr_quotes**: All 6 products (any subscription grants quotes access)
- **solvr_jobs**: Jobs Monthly, Jobs Yearly, AI Monthly, AI Yearly
- **solvr_ai**: AI Monthly, AI Yearly only

## Offerings

| Offering | ID | Lookup Key | Packages |
|---|---|---|---|
| Solvr Quotes | ofrng678c40ae78 | solvr_quotes | quotes_monthly, quotes_yearly |
| Solvr Jobs | ofrngaa5a8fae72 | solvr_jobs | jobs_monthly, jobs_yearly |
| Solvr AI | ofrng039ae94822 | solvr_ai | ai_monthly, ai_yearly |
| Default (legacy) | ofrngfe55e17419 | default | $rc_monthly, $rc_annual, $rc_lifetime |

## Packages

| Package | ID | Offering | Product Attached |
|---|---|---|---|
| Quotes Monthly | pkgee320caed13 | solvr_quotes | solvr_quotes_monthly |
| Quotes Yearly | pkge5569a1ac47 | solvr_quotes | solvr_quotes_yearly |
| Jobs Monthly | pkge6994e5e589 | solvr_jobs | solvr_jobs_monthly |
| Jobs Yearly | pkge9871a8f312 | solvr_jobs | solvr_jobs_yearly |
| AI Monthly | pkge6bde1c56d3 | solvr_ai | solvr_ai_monthly |
| AI Yearly | pkge5fc91e809e | solvr_ai | solvr_ai_yearly |

## Pricing (AUD)

| Tier | Monthly | Yearly (save ~17%) |
|---|---|---|
| Quotes | $49/mo | $490/yr |
| Jobs | $99/mo | $990/yr |
| AI | $199/mo | $1,990/yr |

## Apple App Store Connect Setup Required

1. Create 6 subscription products in ASC with matching identifiers
2. Create a subscription group "Solvr Subscriptions"
3. Add all 6 products to the group
4. Set pricing in AUD (Apple will auto-convert to other currencies)
5. Link ASC app to RevenueCat project (replace Test Store app)
6. Set App Store Shared Secret in RevenueCat > Project > Apps > Apple

## Capacitor/iOS Integration (Claude Code)

```typescript
// Install RevenueCat Capacitor SDK
// npm install @revenuecat/purchases-capacitor

import Purchases from '@revenuecat/purchases-capacitor';

// Configure on app launch
await Purchases.configure({
  apiKey: 'YOUR_APPLE_PUBLIC_API_KEY', // from RevenueCat Dashboard
});

// Fetch offerings
const offerings = await Purchases.getOfferings();
const quotesOffering = offerings.all['solvr_quotes'];
const jobsOffering = offerings.all['solvr_jobs'];
const aiOffering = offerings.all['solvr_ai'];

// Purchase
const { customerInfo } = await Purchases.purchasePackage({
  aPackage: quotesOffering.availablePackages[0], // monthly
});

// Check entitlements
const hasQuotes = customerInfo.entitlements.active['solvr_quotes'] !== undefined;
const hasJobs = customerInfo.entitlements.active['solvr_jobs'] !== undefined;
const hasAI = customerInfo.entitlements.active['solvr_ai'] !== undefined;
```
