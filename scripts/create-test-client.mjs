/**
 * One-off script: create test portal client for Jayden (jay.kowaider@hotmail.com)
 * - Creates CRM client record (full-managed package)
 * - Creates portal session with a magic link access token
 * - Activates ai-receptionist and quote-engine products (status: live)
 * - Sends the magic link email via Resend
 */
import { createRequire } from "module";
import { randomBytes } from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const require = createRequire(import.meta.url);

// ─── DB connection ────────────────────────────────────────────────────────────
import mysql from "mysql2/promise";
import { Resend } from "resend";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);
const resend = new Resend(RESEND_API_KEY);

const BASE_URL = "https://solvr.com.au";
const CLIENT_EMAIL = "jay.kowaider@hotmail.com";
const CLIENT_NAME = "Jayden Kowaider";
const BUSINESS_NAME = "Jayden's Test Business";

// ─── 1. Create CRM client ─────────────────────────────────────────────────────
console.log("Creating CRM client...");
const [clientResult] = await conn.execute(
  `INSERT INTO crm_clients 
    (contactName, contactEmail, contactPhone, businessName, tradeType, serviceArea, stage, \`package\`, mrr, source, isActive, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [
    CLIENT_NAME,
    CLIENT_EMAIL,
    "0400 000 000",
    BUSINESS_NAME,
    "General Services",
    "Sydney",
    "active",
    "full-managed",
    0,
    "other",
    1,
  ]
);
const clientId = clientResult.insertId;
console.log(`✅ CRM client created — ID: ${clientId}`);

// ─── 2. Create portal session ─────────────────────────────────────────────────
const accessToken = randomBytes(32).toString("hex");
console.log("Creating portal session...");
await conn.execute(
  `INSERT INTO portal_sessions (clientId, accessToken, isRevoked, lastEmailSentAt, createdAt)
   VALUES (?, ?, 0, NOW(), NOW())`,
  [clientId, accessToken]
);
console.log(`✅ Portal session created — token: ${accessToken.slice(0, 8)}...`);

// ─── 3. Activate ai-receptionist product ─────────────────────────────────────
console.log("Activating ai-receptionist product...");
await conn.execute(
  `INSERT INTO client_products (clientId, productType, status, monthlyValue, setupFee, liveAt, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [clientId, "ai-receptionist", "live", 19700, 0]
);
console.log("✅ ai-receptionist activated");

// ─── 4. Activate quote-engine product ────────────────────────────────────────
console.log("Activating quote-engine product...");
await conn.execute(
  `INSERT INTO client_products (clientId, productType, status, monthlyValue, setupFee, liveAt, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [clientId, "quote-engine", "live", 9700, 0]
);
console.log("✅ quote-engine activated");

// ─── 5. Send magic link email ─────────────────────────────────────────────────
const magicLink = `${BASE_URL}/portal/login?token=${accessToken}`;
console.log(`\nMagic link: ${magicLink}\n`);

console.log("Sending magic link email via Resend...");
const { data, error } = await resend.emails.send({
  from: "Solvr <noreply@solvr.com.au>",
  to: [CLIENT_EMAIL],
  subject: "Your Solvr Portal Access — Click to Log In",
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp" alt="Solvr" style="height: 40px;" />
      </div>
      <h1 style="color: #0F1F3D; font-size: 24px; font-weight: 700; margin-bottom: 8px;">Welcome to Your Solvr Portal</h1>
      <p style="color: #4A5568; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Hi ${CLIENT_NAME},<br><br>
        Your Solvr client portal is ready. Click the button below to log in and start testing your AI Receptionist and Voice-to-Quote Engine.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${magicLink}" style="background: #F5A623; color: #0F1F3D; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">
          Access My Portal →
        </a>
      </div>
      <p style="color: #718096; font-size: 14px; line-height: 1.6;">
        This link is unique to your account. Your session will remain active for 30 days.<br>
        If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 32px 0;" />
      <p style="color: #A0AEC0; font-size: 12px; text-align: center;">
        Solvr · AI tools for Australian businesses · <a href="https://solvr.com.au" style="color: #A0AEC0;">solvr.com.au</a>
      </p>
    </div>
  `,
});

if (error) {
  console.error("❌ Email failed:", error);
} else {
  console.log(`✅ Email sent — message ID: ${data?.id}`);
}

await conn.end();

console.log("\n─── Summary ───────────────────────────────");
console.log(`Client ID:    ${clientId}`);
console.log(`Email:        ${CLIENT_EMAIL}`);
console.log(`Package:      full-managed`);
console.log(`Products:     ai-receptionist (live), quote-engine (live)`);
console.log(`Magic link:   ${magicLink}`);
console.log("────────────────────────────────────────────\n");
