/**
 * configure-stripe-portal.mjs
 *
 * One-off script to configure the Stripe Customer Portal to allow
 * self-serve plan upgrades and downgrades between the three Solvr plans.
 *
 * Run: node scripts/configure-stripe-portal.mjs
 *
 * Requires STRIPE_SECRET_KEY in environment (or .env file).
 */

import Stripe from "stripe";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env manually
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, "../.env");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // .env not found — rely on environment variables already set
}

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error("ERROR: STRIPE_SECRET_KEY not set.");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);

// ── Solvr plan price IDs (acct_1TKS1TIJ0SuqQaYD — hello@solvr.com.au) ──────────
const MONTHLY_PRICE_IDS = [
  "price_1TLZ8NIJ0SuqQaYDJCmDIAo0", // Solvr Quotes — $49/mo
  "price_1TLZ8QIJ0SuqQaYDvlcScmt1", // Solvr Jobs   — $99/mo
  "price_1TLZ8TIJ0SuqQaYDfV2OUp1k", // Solvr AI     — $197/mo
];

const ANNUAL_PRICE_IDS = [
  "price_1TLZ8OIJ0SuqQaYDRRPenciX", // Solvr Quotes — $490/yr
  "price_1TLZ8RIJ0SuqQaYD6BLAZ6uW", // Solvr Jobs   — $990/yr
  "price_1TLZ8UIJ0SuqQaYDLY5RfcfE", // Solvr AI     — $1970/yr
];

async function main() {
  console.log("Configuring Stripe Customer Portal...\n");

  // Resolve product IDs from prices (required by portal API)
  const allPriceIds = [...MONTHLY_PRICE_IDS, ...ANNUAL_PRICE_IDS];
  const resolvedPrices = [];

  for (const priceId of allPriceIds) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      resolvedPrices.push({ priceId, productId: price.product });
      console.log(`  ✓ ${priceId} → product ${price.product}`);
    } catch (err) {
      console.warn(`  ⚠ Skipping ${priceId} — not found in this Stripe account (${err.message})`);
    }
  }

  if (resolvedPrices.length === 0) {
    console.error("\nERROR: No valid prices found. Check that the price IDs match your Stripe account.");
    process.exit(1);
  }

  // Group prices by product for the portal products array
  const byProduct = new Map();
  for (const { priceId, productId } of resolvedPrices) {
    if (!byProduct.has(productId)) byProduct.set(productId, []);
    byProduct.get(productId).push(priceId);
  }

  const productsConfig = Array.from(byProduct.entries()).map(([product, prices]) => ({
    product,
    prices,
  }));

  console.log(`\nBuilt products config for ${productsConfig.length} product(s):`);
  for (const p of productsConfig) {
    console.log(`  ${p.product}: [${p.prices.join(", ")}]`);
  }

  const portalConfig = {
    business_profile: {
      headline: "Manage your Solvr subscription",
      privacy_policy_url: "https://solvr.com.au/privacy",
      terms_of_service_url: "https://solvr.com.au/terms",
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["email", "name", "phone"],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: [
            "too_expensive",
            "missing_features",
            "switched_service",
            "unused",
            "other",
          ],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: productsConfig,
      },
    },
    default_return_url: "https://solvr.com.au/portal/subscription",
  };

  // Update existing active config or create new one
  const configs = await stripe.billingPortal.configurations.list({ limit: 10 });
  const existing = configs.data.find(c => c.active);

  let result;
  if (existing) {
    console.log(`\nUpdating existing portal configuration: ${existing.id}`);
    result = await stripe.billingPortal.configurations.update(existing.id, portalConfig);
  } else {
    console.log("\nCreating new portal configuration...");
    result = await stripe.billingPortal.configurations.create(portalConfig);
  }

  console.log("\n✅ Portal configured successfully!");
  console.log(`   Configuration ID: ${result.id}`);
  console.log(`   Active: ${result.active}`);
  console.log(`   Subscription updates enabled: ${result.features.subscription_update?.enabled}`);
  console.log(`   Products registered: ${productsConfig.length}`);
  console.log("\nClients can now upgrade/downgrade between Solvr plans via /portal/subscription.");
}

main().catch(err => {
  console.error("\nFailed to configure portal:", err.message);
  if (err.raw) console.error("Stripe error:", JSON.stringify(err.raw, null, 2));
  process.exit(1);
});
