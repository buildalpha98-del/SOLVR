/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Xero integration helper. Wraps OAuth 2.0 (PKCE + offline access),
 * AES-256-GCM token encryption, and the small subset of the Xero
 * Accounting API we need for Sprint 3.1 (Contacts + Invoices).
 *
 * Why direct fetch instead of xero-node SDK:
 *   - The official SDK is large and frequently breaks across versions.
 *   - We only need 4 REST calls (token exchange, refresh, contact upsert,
 *     invoice create). Easier to debug.
 *
 * Token rotation: Xero rotates the REFRESH token on every refresh —
 * we must persist the new one or lose access on the next call.
 */
import crypto, { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { ENV } from "../_core/env";

// ─── Encryption (AES-256-GCM) ────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const raw = ENV.xeroTokenEncryptionKey;
  if (!raw) throw new Error("XERO_TOKEN_ENCRYPTION_KEY is not configured.");
  if (raw.length !== 64) {
    throw new Error("XERO_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(raw, "hex");
}

/**
 * Encrypt a string with AES-256-GCM. Output format:
 *   <iv (12 bytes hex)>.<authTag (16 bytes hex)>.<ciphertext (hex)>
 * One self-contained string we store in TEXT columns.
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${authTag.toString("hex")}.${ciphertext.toString("hex")}`;
}

export function decryptToken(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format.");
  const [ivHex, tagHex, ctHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export const XERO_SCOPES = ["offline_access", "accounting.transactions", "accounting.contacts"].join(" ");

export interface OAuthState {
  state: string;
  codeVerifier: string;
}

/**
 * Generate the PKCE code verifier + challenge AND a CSRF state. Caller
 * stores both in a short-lived cookie or session and replays them on
 * the callback. Verifier is 64 unreserved chars (RFC 7636).
 */
export function generateOAuthState(): { state: string; codeVerifier: string; codeChallenge: string } {
  const state = randomBytes(16).toString("hex");
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { state, codeVerifier, codeChallenge };
}

export function buildAuthorizeUrl(opts: { state: string; codeChallenge: string }): string {
  const u = new URL("https://login.xero.com/identity/connect/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", ENV.xeroClientId);
  u.searchParams.set("redirect_uri", ENV.xeroRedirectUri);
  u.searchParams.set("scope", XERO_SCOPES);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("code_challenge", opts.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

/**
 * Exchange an authorisation code for access+refresh tokens. Called from
 * the /api/xero/callback handler.
 */
export async function exchangeCodeForTokens(opts: { code: string; codeVerifier: string }): Promise<XeroTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: ENV.xeroRedirectUri,
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${ENV.xeroClientId}:${ENV.xeroClientSecret}`).toString("base64")}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return await res.json() as XeroTokenResponse;
}

/**
 * Refresh an access token. Xero rotates the refresh_token on every
 * call — caller MUST persist the new one or the next refresh fails.
 */
export async function refreshAccessToken(refreshToken: string): Promise<XeroTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${ENV.xeroClientId}:${ENV.xeroClientSecret}`).toString("base64")}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token refresh failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return await res.json() as XeroTokenResponse;
}

/**
 * Fetch the connected tenants. Returns an array — for v1 we use the
 * first one; v3 adds a tenant-picker.
 */
export interface XeroConnection {
  id: string;
  authEventId: string;
  tenantId: string;
  tenantType: string;
  tenantName: string;
}
export async function listConnections(accessToken: string): Promise<XeroConnection[]> {
  const res = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Xero /connections failed (${res.status})`);
  }
  return await res.json() as XeroConnection[];
}

// ─── Accounting API helpers ──────────────────────────────────────────────────

/**
 * Find or create a Xero Contact for a SOLVR customer. Idempotent — we
 * use AccountNumber = "solvr-cust-{phone-or-email}" as the natural key
 * so re-running this call returns the existing contact instead of
 * creating a duplicate.
 *
 * Returns the Contact's GUID for use in invoice creation.
 */
export async function upsertContact(opts: {
  accessToken: string;
  tenantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  accountNumber: string;
}): Promise<string> {
  // Try to find an existing contact by AccountNumber first
  const searchUrl = new URL("https://api.xero.com/api.xro/2.0/Contacts");
  searchUrl.searchParams.set("where", `AccountNumber=="${escapeXeroQuery(opts.accountNumber)}"`);
  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Xero-Tenant-Id": opts.tenantId,
      Accept: "application/json",
    },
  });
  if (!searchRes.ok) {
    throw new Error(`Xero contact search failed (${searchRes.status})`);
  }
  const searchJson = await searchRes.json() as { Contacts?: Array<{ ContactID: string }> };
  if (searchJson.Contacts && searchJson.Contacts.length > 0) {
    return searchJson.Contacts[0].ContactID;
  }

  // Create
  const body = {
    Contacts: [{
      Name: opts.name,
      AccountNumber: opts.accountNumber,
      ...(opts.email ? { EmailAddress: opts.email } : {}),
      ...(opts.phone ? {
        Phones: [{ PhoneType: "MOBILE", PhoneNumber: opts.phone }],
      } : {}),
    }],
  };
  const createRes = await fetch("https://api.xero.com/api.xro/2.0/Contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Xero-Tenant-Id": opts.tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Xero contact create failed (${createRes.status}): ${text.slice(0, 300)}`);
  }
  const createJson = await createRes.json() as { Contacts?: Array<{ ContactID: string }> };
  if (!createJson.Contacts?.[0]?.ContactID) {
    throw new Error("Xero contact create returned no ContactID");
  }
  return createJson.Contacts[0].ContactID;
}

/**
 * Create an invoice in Xero. Returns the new InvoiceID.
 *
 * For v1 we send a single line item for the full amount — no GST split,
 * no per-quote-line breakdown. The TaxType "OUTPUT" tells Xero this is
 * GST-on-income at the standard 10% AU rate. Status defaults to DRAFT
 * (safer); tradie can flip to AUTHORISED in Settings.
 */
export async function createInvoice(opts: {
  accessToken: string;
  tenantId: string;
  contactId: string;
  invoiceNumber: string;
  description: string;
  amountIncGst: number;
  issueDate: Date;
  dueDate: Date;
  status: "DRAFT" | "AUTHORISED";
}): Promise<string> {
  // Xero wants ex-GST line amounts when LineAmountTypes is "Exclusive"
  const exGst = +(opts.amountIncGst / 1.1).toFixed(2);
  const body = {
    Invoices: [{
      Type: "ACCREC",
      Contact: { ContactID: opts.contactId },
      InvoiceNumber: opts.invoiceNumber,
      Date: opts.issueDate.toISOString().slice(0, 10),
      DueDate: opts.dueDate.toISOString().slice(0, 10),
      LineAmountTypes: "Exclusive",
      LineItems: [{
        Description: opts.description,
        Quantity: 1,
        UnitAmount: exGst,
        AccountCode: "200", // Default Sales account — same as the CSV export uses
        TaxType: "OUTPUT",
      }],
      Status: opts.status,
    }],
  };
  const res = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Xero-Tenant-Id": opts.tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero invoice create failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json() as { Invoices?: Array<{ InvoiceID: string }> };
  if (!json.Invoices?.[0]?.InvoiceID) {
    throw new Error("Xero invoice create returned no InvoiceID");
  }
  return json.Invoices[0].InvoiceID;
}

/** Whether the Xero feature is available — false if env vars are missing. */
export function isXeroConfigured(): boolean {
  return Boolean(
    ENV.xeroClientId &&
    ENV.xeroClientSecret &&
    ENV.xeroRedirectUri &&
    ENV.xeroTokenEncryptionKey,
  );
}

/** Xero where-clause string escape — basic but covers our use. */
function escapeXeroQuery(s: string): string {
  return s.replace(/"/g, '\\"');
}
