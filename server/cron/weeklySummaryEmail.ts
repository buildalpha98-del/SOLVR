/**
 * Weekly Summary Email Cron
 *
 * Runs every Friday at 4:00 PM AEST (06:00 UTC).
 * Sends a digest email to each active portal client showing their week's activity:
 *   - Calls received (from crmInteractions type=call)
 *   - Quotes sent (quotes.status IN sent/accepted/declined, created this week)
 *   - Jobs won (quotes.status = accepted, this week)
 *   - Revenue won (sum of totalAmount on accepted quotes this week)
 *
 * Respects the notifyEmailWeeklySummary opt-out flag on clientProfiles.
 * Only sends to clients with an active or trialing voiceAgentSubscription.
 */

import cron from "node-cron";
import { getDb } from "../db";
import {
  crmClients,
  crmInteractions,
  quotes,
  clientProfiles,
  voiceAgentSubscriptions,
} from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { sendPushToClient } from "../pushNotifications";
import { and, eq, gte, inArray, isNotNull, or } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeeklyStats {
  callsReceived: number;
  quotesSent: number;
  jobsWon: number;
  revenueWon: number; // in dollars (AUD)
}

// ─── Data query ───────────────────────────────────────────────────────────────

export async function getWeeklyStatsForClient(
  db: Awaited<ReturnType<typeof getDb>>,
  clientId: number,
  weekStart: Date
): Promise<WeeklyStats> {
  if (!db) return { callsReceived: 0, quotesSent: 0, jobsWon: 0, revenueWon: 0 };

  // Calls received this week (crmInteractions type = "call")
  const callRows = await db
    .select({ id: crmInteractions.id })
    .from(crmInteractions)
    .where(
      and(
        eq(crmInteractions.clientId, clientId),
        eq(crmInteractions.type, "call"),
        gte(crmInteractions.createdAt, weekStart)
      )
    );

  // Quotes sent this week (any status except draft)
  const quoteRows = await db
    .select({ id: quotes.id, status: quotes.status, totalAmount: quotes.totalAmount })
    .from(quotes)
    .where(
      and(
        eq(quotes.clientId, clientId),
        inArray(quotes.status, ["sent", "accepted", "declined", "expired"]),
        gte(quotes.createdAt, weekStart)
      )
    );

  const jobsWon = quoteRows.filter((q) => q.status === "accepted");
  const revenueWon = jobsWon.reduce((sum, q) => {
    return sum + (q.totalAmount ? parseFloat(q.totalAmount) : 0);
  }, 0);

  return {
    callsReceived: callRows.length,
    quotesSent: quoteRows.length,
    jobsWon: jobsWon.length,
    revenueWon,
  };
}

// ─── Email template ───────────────────────────────────────────────────────────

export function buildWeeklySummaryEmail(
  firstName: string,
  businessName: string,
  stats: WeeklyStats,
  weekLabel: string // e.g. "7–11 Apr 2025"
): string {
  const { callsReceived, quotesSent, jobsWon, revenueWon } = stats;

  // Trend arrows / colour coding
  const hasActivity = callsReceived > 0 || quotesSent > 0 || jobsWon > 0;

  const revenueFormatted =
    revenueWon >= 1000
      ? `$${(revenueWon / 1000).toFixed(1)}k`
      : `$${revenueWon.toFixed(0)}`;

  const conversionRate =
    quotesSent > 0 ? Math.round((jobsWon / quotesSent) * 100) : null;

  const upgradeNudge = `
    <div style="background:#FFF8EC;border:1px solid #F5A623;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:700;color:#0F1F3D;font-size:14px;">⚡ Unlock more with Professional</p>
      <p style="margin:0 0 12px;color:#4A5568;font-size:13px;line-height:1.6;">
        Professional plan clients get full CRM integration, call transcript delivery, and a monthly prompt tuning session.
        Upgrade any time from your portal.
      </p>
      <a href="https://solvr.com.au/portal/subscription" style="display:inline-block;background:#F5A623;color:#0F1F3D;font-weight:700;font-size:13px;padding:10px 20px;border-radius:6px;text-decoration:none;">
        View Upgrade Options →
      </a>
    </div>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Solvr Weekly Summary</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0F1F3D;padding:32px 40px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp" alt="Solvr" height="36" style="display:block;margin:0 auto;" />
              <p style="margin:12px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Weekly Summary · ${weekLabel}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0F1F3D;">
                ${hasActivity ? `Great week, ${firstName} 🎉` : `Here's your week, ${firstName} 👋`}
              </h1>
              <p style="margin:0 0 28px;color:#718096;font-size:15px;line-height:1.6;">
                Here's how <strong>${businessName}</strong> performed this week with your AI Receptionist.
              </p>

              <!-- Stats grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="50%" style="padding:0 8px 16px 0;">
                    <div style="background:#F7FAFC;border-radius:10px;padding:20px;text-align:center;border:1px solid #E2E8F0;">
                      <div style="font-size:32px;font-weight:800;color:#0F1F3D;line-height:1;">${callsReceived}</div>
                      <div style="font-size:12px;color:#718096;margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Calls Received</div>
                    </div>
                  </td>
                  <td width="50%" style="padding:0 0 16px 8px;">
                    <div style="background:#F7FAFC;border-radius:10px;padding:20px;text-align:center;border:1px solid #E2E8F0;">
                      <div style="font-size:32px;font-weight:800;color:#0F1F3D;line-height:1;">${quotesSent}</div>
                      <div style="font-size:12px;color:#718096;margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Quotes Sent</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 8px 0 0;">
                    <div style="background:#F0FFF4;border-radius:10px;padding:20px;text-align:center;border:1px solid #C6F6D5;">
                      <div style="font-size:32px;font-weight:800;color:#276749;line-height:1;">${jobsWon}</div>
                      <div style="font-size:12px;color:#276749;margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Jobs Won</div>
                    </div>
                  </td>
                  <td width="50%" style="padding:0 0 0 8px;">
                    <div style="background:#FFFBEB;border-radius:10px;padding:20px;text-align:center;border:1px solid #FDE68A;">
                      <div style="font-size:32px;font-weight:800;color:#92400E;line-height:1;">${revenueFormatted}</div>
                      <div style="font-size:12px;color:#92400E;margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Revenue Won</div>
                    </div>
                  </td>
                </tr>
              </table>

              ${
                conversionRate !== null
                  ? `
              <!-- Conversion rate callout -->
              <div style="background:#EBF8FF;border-radius:8px;padding:16px 20px;margin-bottom:24px;border:1px solid #BEE3F8;">
                <p style="margin:0;color:#2C5282;font-size:14px;">
                  📊 Your quote conversion rate this week was <strong>${conversionRate}%</strong>${conversionRate >= 50 ? " — great work!" : ". Keep following up — most jobs are won on the second touch."}
                </p>
              </div>
              `
                  : ""
              }

              ${!hasActivity ? `
              <!-- No activity nudge -->
              <div style="background:#FFF5F5;border-radius:8px;padding:16px 20px;margin-bottom:24px;border:1px solid #FED7D7;">
                <p style="margin:0;color:#742A2A;font-size:14px;">
                  📞 No calls logged this week. Make sure your call forwarding is active — check your portal for setup instructions.
                </p>
              </div>
              ` : ""}

              <!-- CTA -->
              <div style="text-align:center;margin:0 0 24px;">
                <a href="https://solvr.com.au/portal/dashboard" style="display:inline-block;background:#F5A623;color:#0F1F3D;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
                  Open Your Portal →
                </a>
              </div>

              <p style="margin:0 0 24px;color:#A0AEC0;font-size:13px;text-align:center;">
                Questions or feedback? Reply to this email — Jayden reads every reply.
              </p>

              <!-- Unsubscribe -->
              <p style="margin:0;color:#CBD5E0;font-size:12px;text-align:center;">
                You're receiving this because you have weekly summaries enabled.
                <a href="https://solvr.com.au/portal/settings" style="color:#CBD5E0;">Manage preferences →</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F7FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
              <p style="margin:0;color:#A0AEC0;font-size:12px;">
                Solvr · ABN 47 262 120 626 ·
                <a href="https://solvr.com.au/privacy" style="color:#A0AEC0;">Privacy Policy</a> ·
                <a href="https://solvr.com.au/terms" style="color:#A0AEC0;">Terms</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── Cron runner ─────────────────────────────────────────────────────────────

export async function runWeeklySummaryEmail(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[WeeklySummary] No DB connection — skipping");
    return;
  }

  // Week window: last 7 days
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Week label: e.g. "5–11 Apr 2025"
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const weekLabel = `${fmt(weekStart)}–${fmt(now)} ${now.getFullYear()}`;

  // Fetch all active/trialing subscriptions with a linked clientId
  const activeSubs = await db
    .select({
      clientId: voiceAgentSubscriptions.clientId,
      email: voiceAgentSubscriptions.email,
      name: voiceAgentSubscriptions.name,
      plan: voiceAgentSubscriptions.plan,
    })
    .from(voiceAgentSubscriptions)
    .where(
      and(
        isNotNull(voiceAgentSubscriptions.clientId),
        or(
          eq(voiceAgentSubscriptions.status, "active"),
          eq(voiceAgentSubscriptions.status, "trialing")
        )
      )
    );

  if (activeSubs.length === 0) {
    console.log("[WeeklySummary] No active subscribers — skipping");
    return;
  }

  let sent = 0;
  let skipped = 0;

  for (const sub of activeSubs) {
    if (!sub.clientId) continue;

    try {
      // Check opt-out preference
      const [profile] = await db
        .select({ notifyEmailWeeklySummary: clientProfiles.notifyEmailWeeklySummary })
        .from(clientProfiles)
        .where(eq(clientProfiles.clientId, sub.clientId))
        .limit(1);

      if (profile && profile.notifyEmailWeeklySummary === false) {
        skipped++;
        continue;
      }

      // Get business name from crmClients
      const [client] = await db
        .select({ businessName: crmClients.businessName, contactEmail: crmClients.contactEmail })
        .from(crmClients)
        .where(eq(crmClients.id, sub.clientId))
        .limit(1);

      const recipientEmail = client?.contactEmail ?? sub.email;
      const businessName = client?.businessName ?? "your business";
      const firstName = sub.name?.split(" ")[0] ?? "there";

      // Build stats
      const stats = await getWeeklyStatsForClient(db, sub.clientId, weekStart);

      // Build and send email
      const html = buildWeeklySummaryEmail(firstName, businessName, stats, weekLabel);

      await sendEmail({
        to: recipientEmail,
        subject: `Your Solvr Weekly Summary — ${weekLabel}`,
        html,
      });

      // Also send a push notification with the headline stats
      const pushBody = `${stats.callsReceived} calls, ${stats.quotesSent} quotes, ${stats.jobsWon} jobs won, $${stats.revenueWon.toLocaleString()} revenue.`;
      await sendPushToClient(sub.clientId, {
        title: `Weekly summary`,
        body: pushBody,
        url: "/portal/dashboard",
      });

      sent++;
      console.log(`[WeeklySummary] Sent email + push to ${recipientEmail} (clientId=${sub.clientId})`);
    } catch (err) {
      console.error(`[WeeklySummary] Error for clientId=${sub.clientId}:`, err);
    }
  }

  console.log(`[WeeklySummary] Done — sent: ${sent}, skipped (opted out): ${skipped}`);
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

/**
 * Schedule: Friday 4:00 PM AEST = Friday 06:00 UTC
 * Cron: 0 6 * * 5
 */
export function scheduleWeeklySummaryEmail(): void {
  cron.schedule("0 6 * * 5", async () => {
    console.log("[WeeklySummary] Running Friday digest...");
    await runWeeklySummaryEmail();
  });
  console.log("[WeeklySummary] Scheduled (Fridays 4pm AEST)");
}
