/**
 * Session Expiry Warning Cron Job
 *
 * Runs every 6 hours (0:00, 6:00, 12:00, 18:00 UTC) so the 48h warning window
 * is accurate to within 6 hours regardless of when a session was created.
 * Finds portal clients whose sessionExpiresAt is within the next 48 hours
 * and sends them a warning email with a direct login link.
 *
 * Guard: expiryWarningSentAt is written back after each successful send.
 * The query excludes sessions where a warning was already sent in the last 24h,
 * preventing duplicate emails on repeated cron runs.
 *
 * This prevents clients getting locked out mid-workflow.
 */

import cron from "node-cron";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import { crmClients, portalSessions } from "../../drizzle/schema";
import { and, eq, gte, lte, isNotNull, or, isNull } from "drizzle-orm";

async function runSessionExpiryWarning(): Promise<void> {
  const db = await getDb();
  if (!db) { console.error("[Session Expiry] Database not available"); return; }
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  // Only re-send if the last warning was sent more than 24 hours ago (or never)
  const warnCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log("[Session Expiry] Checking for sessions expiring before", in48h.toISOString());

  // Find sessions expiring in the next 48 hours that:
  // - are not revoked
  // - have not yet had a warning sent, OR the last warning was sent >24h ago
  const expiringSessions = await db
    .select({
      sessionId: portalSessions.id,
      clientId: portalSessions.clientId,
      sessionExpiresAt: portalSessions.sessionExpiresAt,
      accessToken: portalSessions.accessToken,
      expiryWarningSentAt: portalSessions.expiryWarningSentAt,
    })
    .from(portalSessions)
    .where(
      and(
        eq(portalSessions.isRevoked, false),
        isNotNull(portalSessions.sessionExpiresAt),
        gte(portalSessions.sessionExpiresAt, now),
        lte(portalSessions.sessionExpiresAt, in48h),
        // Guard: only process if no warning sent yet, or last warning was >24h ago
        or(
          isNull(portalSessions.expiryWarningSentAt),
          lte(portalSessions.expiryWarningSentAt, warnCutoff),
        ),
      ),
    );

  console.log(`[Session Expiry] Found ${expiringSessions.length} sessions needing warning`);

  for (const session of expiringSessions) {
    try {
      const clientRows = await db!
        .select()
        .from(crmClients)
        .where(eq(crmClients.id, session.clientId))
        .limit(1);
      const client = clientRows[0];
      if (!client) continue;

      const expiresAt = session.sessionExpiresAt!;
      const hoursLeft = Math.round(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60),
      );
      const expiryLabel = expiresAt.toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
        dateStyle: "medium",
        timeStyle: "short",
      });

      // Direct login link using the magic access token
      const loginUrl = `https://solvr.com.au/portal?token=${session.accessToken}`;

      const urgencyColour = hoursLeft <= 4 ? "#EF4444" : "#F5A623";
      const urgencyText = hoursLeft <= 4
        ? `⚠️ URGENT — Your portal session expires in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}`
        : `⚠️ Your portal session expires in ${hoursLeft} hours`;

      const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#0F1F3D;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h1 style="color:${urgencyColour};margin:0;font-size:20px;">${urgencyText}</h1>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;">Solvr Client Portal</p>
  </div>
  <div style="background:#f9f9f7;padding:24px 32px;border-radius:0 0 8px 8px;border:1px solid #e5e5e5;">
    <p>Hi ${client.businessName},</p>
    <p>Your Solvr portal session will expire in approximately <strong>${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}</strong> (${expiryLabel} AEST).</p>
    <p>After it expires, you'll need to contact us to get a new login link. To avoid any interruption, log in now to refresh your session:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${loginUrl}" style="background:${urgencyColour};color:#0F1F3D;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">Log In to Your Portal →</a>
    </div>
    <p style="color:#6B7280;font-size:13px;">If you have any trouble accessing your portal, reply to this email and we'll sort it out straight away.</p>
    <p style="color:#9CA3AF;font-size:12px;margin-top:32px;text-align:center;">
      Powered by Solvr · <a href="https://solvr.com.au" style="color:#9CA3AF;">solvr.com.au</a>
    </p>
  </div>
</div>`;

      await sendEmail({
        to: client.contactEmail,
        subject: `⚠️ Your Solvr portal session expires in ${hoursLeft} hours`,
        html,
        fromName: "Solvr",
      });

      // ── Guard: write back the sent timestamp so this session is skipped next run ──
      await db!
        .update(portalSessions)
        .set({ expiryWarningSentAt: now })
        .where(eq(portalSessions.id, session.sessionId));

      console.log(
        `[Session Expiry] Warning sent to ${client.contactEmail} (expires in ${hoursLeft}h) — guard written`,
      );
    } catch (err) {
      console.error(
        `[Session Expiry] Error processing client ${session.clientId}:`,
        err,
      );
    }
  }

  console.log("[Session Expiry] Done");
}

/**
 * Register the session expiry warning cron job.
 * Runs every 6 hours (0:00, 6:00, 12:00, 18:00 UTC) for accurate 48h window coverage.
 */
export function registerSessionExpiryWarningCron(): void {
  cron.schedule("0 0,6,12,18 * * *", () => {
    runSessionExpiryWarning().catch((err) =>
      console.error("[Session Expiry] Unhandled error:", err),
    );
  });
  console.log("[Cron] Session expiry warning scheduled (every 6 hours)");
}

// Export for testing
export { runSessionExpiryWarning };
