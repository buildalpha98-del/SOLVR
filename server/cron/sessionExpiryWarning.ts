/**
 * Session Expiry Warning Cron Job
 *
 * Runs every day at 9:00 AM AEST (11:00 PM UTC).
 * Finds portal clients whose sessionExpiresAt is within the next 48 hours
 * and sends them a warning email with a direct login link.
 *
 * This prevents clients getting locked out mid-workflow.
 */

import cron from "node-cron";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import { crmClients, portalSessions } from "../../drizzle/schema";
import { and, eq, gte, lte, isNotNull } from "drizzle-orm";

async function runSessionExpiryWarning(): Promise<void> {
  const db = await getDb();
  if (!db) { console.error("[Session Expiry] Database not available"); return; }
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  console.log("[Session Expiry] Checking for sessions expiring before", in48h.toISOString());

  // Find sessions expiring in the next 48 hours that haven't been revoked
  const expiringSessions = await db
    .select({
      sessionId: portalSessions.id,
      clientId: portalSessions.clientId,
      sessionExpiresAt: portalSessions.sessionExpiresAt,
      accessToken: portalSessions.accessToken,
    })
    .from(portalSessions)
    .where(
      and(
        eq(portalSessions.isRevoked, false),
        isNotNull(portalSessions.sessionExpiresAt),
        gte(portalSessions.sessionExpiresAt, now),
        lte(portalSessions.sessionExpiresAt, in48h),
      ),
    );

  console.log(`[Session Expiry] Found ${expiringSessions.length} expiring sessions`);

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

      const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#0F1F3D;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h1 style="color:#F5A623;margin:0;font-size:20px;">⚠️ Your portal session is expiring soon</h1>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;">Solvr Client Portal</p>
  </div>
  <div style="background:#f9f9f7;padding:24px 32px;border-radius:0 0 8px 8px;border:1px solid #e5e5e5;">
    <p>Hi ${client.businessName},</p>
    <p>Your Solvr portal session will expire in approximately <strong>${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}</strong> (${expiryLabel} AEST).</p>
    <p>After it expires, you'll need to contact us to get a new login link. To avoid any interruption, log in now to refresh your session:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${loginUrl}" style="background:#F5A623;color:#0F1F3D;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">Log In to Your Portal →</a>
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

      console.log(
        `[Session Expiry] Warning sent to ${client.contactEmail} (expires in ${hoursLeft}h)`,
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
 * Runs daily at 11:00 PM UTC = 9:00 AM AEST.
 */
export function registerSessionExpiryWarningCron(): void {
  cron.schedule("0 23 * * *", () => {
    runSessionExpiryWarning().catch((err) =>
      console.error("[Session Expiry] Unhandled error:", err),
    );
  });
  console.log("[Cron] Session expiry warning scheduled (daily 9am AEST)");
}

// Export for testing
export { runSessionExpiryWarning };
