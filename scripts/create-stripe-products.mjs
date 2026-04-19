/**
 * create-stripe-products.mjs
 *
 * Creates all Solvr products and prices in the connected Stripe account,
 * then prints the new price IDs so stripeProducts.ts can be updated.
 *
 * Run: node scripts/create-stripe-products.mjs
 */

import Stripe from "stripe";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
} catch { /* rely on env */ }

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) { console.error("ERROR: STRIPE_SECRET_KEY not set."); process.exit(1); }

const stripe = new Stripe(stripeKey);

const PRODUCTS = [
  {
    key: "solvr_quotes",
    name: "Solvr Quotes",
    description: "AI-powered voice-to-quote for tradies. Record a quote by voice and get a professional PDF in minutes.",
    monthly: { amount: 4900, nickname: "Solvr Quotes Monthly" },
    annual:  { amount: 49000, nickname: "Solvr Quotes Annual" },
  },
  {
    key: "solvr_jobs",
    name: "Solvr Jobs",
    description: "Full job management — quotes, job cards, scheduling, and invoicing. Everything a tradie needs.",
    monthly: { amount: 9900, nickname: "Solvr Jobs Monthly" },
    annual:  { amount: 99000, nickname: "Solvr Jobs Annual" },
  },
  {
    key: "solvr_ai",
    name: "Solvr AI",
    description: "Full AI management — AI receptionist, voice quoting, jobs, calendar, and AI insights dashboard.",
    monthly: { amount: 19700, nickname: "Solvr AI Monthly" },
    annual:  { amount: 197000, nickname: "Solvr AI Annual" },
  },
];

// Add-on
const ADDONS = [
  {
    key: "quote_engine",
    name: "Quote Engine Add-On",
    description: "Standalone AI voice-to-quote add-on for existing Solvr subscribers.",
    monthly: { amount: 2900, nickname: "Quote Engine Monthly" },
  },
];

async function createProductWithPrices(def) {
  const product = await stripe.products.create({
    name: def.name,
    description: def.description,
    metadata: { solvr_plan_key: def.key },
  });

  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: def.monthly.amount,
    currency: "aud",
    recurring: { interval: "month" },
    nickname: def.monthly.nickname,
    metadata: { solvr_plan_key: def.key, billing_cycle: "monthly" },
  });

  let annual = null;
  if (def.annual) {
    annual = await stripe.prices.create({
      product: product.id,
      unit_amount: def.annual.amount,
      currency: "aud",
      recurring: { interval: "year" },
      nickname: def.annual.nickname,
      metadata: { solvr_plan_key: def.key, billing_cycle: "annual" },
    });
  }

  return { product, monthly, annual };
}

async function main() {
  const account = await stripe.account.retrieve();
  console.log(`Connected to Stripe account: ${account.id} (${account.business_profile?.name ?? account.email})\n`);

  const results = {};

  console.log("Creating main plan products...");
  for (const def of PRODUCTS) {
    const { product, monthly, annual } = await createProductWithPrices(def);
    results[def.key] = { productId: product.id, monthlyPriceId: monthly.id, annualPriceId: annual?.id };
    console.log(`  ✓ ${def.name}`);
    console.log(`      Product:  ${product.id}`);
    console.log(`      Monthly:  ${monthly.id}  ($${def.monthly.amount / 100}/mo AUD)`);
    if (annual) console.log(`      Annual:   ${annual.id}  ($${def.annual.amount / 100}/yr AUD)`);
  }

  console.log("\nCreating add-on products...");
  for (const def of ADDONS) {
    const { product, monthly } = await createProductWithPrices(def);
    results[def.key] = { productId: product.id, monthlyPriceId: monthly.id };
    console.log(`  ✓ ${def.name}`);
    console.log(`      Product:  ${product.id}`);
    console.log(`      Monthly:  ${monthly.id}  ($${def.monthly.amount / 100}/mo AUD)`);
  }

  console.log("\n\n══════════════════════════════════════════════════════════════");
  console.log("  UPDATE server/stripeProducts.ts with these new price IDs:");
  console.log("══════════════════════════════════════════════════════════════\n");
  console.log(JSON.stringify(results, null, 2));
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  Done! Now update stripeProducts.ts and re-run the portal");
  console.log("  configuration script: node scripts/configure-stripe-portal.mjs");
  console.log("══════════════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Failed:", err.message);
  process.exit(1);
});
