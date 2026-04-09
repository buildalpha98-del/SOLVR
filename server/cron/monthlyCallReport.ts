/**
 * Monthly Call Report Cron Job
 *
 * Runs at 8:00 AM AEST on the 1st of every month.
 * For each active portal client, sends an email summarising:
 *   - Total inbound calls handled by the AI receptionist
 *   - New jobs created from calls
 *   - Jobs converted to booked/completed
 *   - Estimated pipeline value
 *   - Quotes sent and accepted
 *
 * Cron expression: 0 8 1 * * (8am on the 1st — node-cron uses UTC so we use 22:00 UTC = 8am AEST)
 */

import cron from "node-cron";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import {
  crmClients,
  crmInteractions,
  portalJobs,
  portalSessions,
  quotes,
} from "../../drizzle/schema";
import { and, eq, gte, lt, count, sum, sql } from "drizzle-orm";

async function buildMonthlyReport(
  clientId: number,
  year: number,
  month: number, // 0-indexed
): Promise<{
  totalCalls: number;
  newJobs: number;
  bookedJobs: number;
  completedJobs: number;
  pipelineValue: number;
  quotesSent: number;
  quotesAccepted: number;
  acceptedValue: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  // Calls (type = 'call') in the period
  const callRows = await db!
    .select({ n: count() })
    .from(crmInteractions)
    .where(
      and(
        eq(crmInteractions.clientId, clientId),
        eq(crmInteractions.type, "call"),
        gte(crmInteractions.createdAt, start),
        lt(crmInteractions.createdAt, end),
      ),
    );
  const totalCalls = Number(callRows[0]?.n ?? 0);

  // Jobs created in the period
  const jobRows = await db!
    .select({
      n: count(),
      stage: portalJobs.stage,
      pipeline: sum(portalJobs.estimatedValue),
    })
    .from(portalJobs)
    .where(
      and(
        eq(portalJobs.clientId, clientId),
        gte(portalJobs.createdAt, start),
        lt(portalJobs.createdAt, end),
      ),
    )
    .groupBy(portalJobs.stage);

  let newJobs = 0;
  let bookedJobs = 0;
  let completedJobs = 0;
  let pipelineValue = 0;
  for (const row of jobRows) {
    const n = Number(row.n);
    newJobs += n;
    if (row.stage === "booked") bookedJobs += n;
    if (row.stage === "completed") completedJobs += n;
    pipelineValue += Number(row.pipeline ?? 0);
  }

  // Quotes in the period
  const quoteRows = await db!
    .select({
      n: count(),
      status: quotes.status,
      total: sum(quotes.totalAmount),
    })
    .from(quotes)
    .where(
      and(
        eq(quotes.clientId, clientId),
        gte(quotes.createdAt, start),
        lt(quotes.createdAt, end),
      ),
    )
    .groupBy(quotes.status);

  let quotesSent = 0;
  let quotesAccepted = 0;
  let acceptedValue = 0;
  for (const row of quoteRows) {
    const n = Number(row.n);
    if (row.status === "sent" || row.status === "accepted") quotesSent += n;
    if (row.status === "accepted") {
      quotesAccepted += n;
      acceptedValue += Number(row.total ?? 0);
    }
  }

  return {
    totalCalls,
    newJobs,
    bookedJobs,
    completedJobs,
    pipelineValue,
    quotesSent,
    quotesAccepted,
    acceptedValue,
  };
}

function buildReportHtml(
  businessName: string,
  monthLabel: string,
  stats: Awaited<ReturnType<typeof buildMonthlyReport>>,
): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#0F1F3D;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h1 style="color:#F5A623;margin:0;font-size:22px;">Monthly AI Report</h1>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;">${businessName} · ${monthLabel}</p>
  </div>
  <div style="background:#f9f9f7;padding:24px 32px;border-radius:0 0 8px 8px;border:1px solid #e5e5e5;">

    <h2 style="font-size:16px;color:#0F1F3D;margin-top:0;">📞 AI Receptionist</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr style="background:#fff;border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;color:#555;">Calls handled by AI</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#0F1F3D;">${stats.totalCalls}</td>
      </tr>
      <tr style="background:#fff;border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;color:#555;">New jobs created from calls</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#0F1F3D;">${stats.newJobs}</td>
      </tr>
      <tr style="background:#fff;border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;color:#555;">Jobs booked</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#16A34A;">${stats.bookedJobs}</td>
      </tr>
      <tr style="background:#fff;">
        <td style="padding:10px 12px;color:#555;">Jobs completed</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#16A34A;">${stats.completedJobs}</td>
      </tr>
    </table>

    <h2 style="font-size:16px;color:#0F1F3D;">💰 Pipeline & Quotes</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr style="background:#fff;border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;color:#555;">Estimated pipeline value</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#0F1F3D;">$${fmt(stats.pipelineValue)}</td>
      </tr>
      <tr style="background:#fff;border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;color:#555;">Quotes sent</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#0F1F3D;">${stats.quotesSent}</td>
      </tr>
      <tr style="background:#fff;border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;color:#555;">Quotes accepted</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#16A34A;">${stats.quotesAccepted}</td>
      </tr>
      <tr style="background:#fff;">
        <td style="padding:10px 12px;color:#555;">Accepted quote value</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#16A34A;">$${fmt(stats.acceptedValue)}</td>
      </tr>
    </table>

    <div style="text-align:center;margin-top:24px;">
      <a href="https://solvr.com.au/portal/dashboard" style="background:#F5A623;color:#0F1F3D;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">View Your Dashboard →</a>
    </div>

    <p style="color:#9CA3AF;font-size:12px;margin-top:32px;text-align:center;">
      Powered by Solvr · <a href="https://solvr.com.au" style="color:#9CA3AF;">solvr.com.au</a>
    </p>
  </div>
</div>`;
}

async function runMonthlyCallReport(): Promise<void> {
  const db = await getDb();
  const now = new Date();
  // Report covers the previous calendar month
  const reportMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const monthLabel = new Date(reportYear, reportMonth, 1).toLocaleString("en-AU", {
    month: "long",
    year: "numeric",
  });

  console.log(`[Monthly Report] Running for ${monthLabel}...`);

  // Get all active portal clients (have a non-revoked session)
  const db2 = await getDb();
  if (!db2) { console.error("[Monthly Report] Database not available"); return; }
  const activeSessions = await db2
    .select({
      clientId: portalSessions.clientId,
    })
    .from(portalSessions)
    .where(eq(portalSessions.isRevoked, false));

  const uniqueClientIds = Array.from(new Set(activeSessions.map((s) => s.clientId)));
  console.log(`[Monthly Report] Sending to ${uniqueClientIds.length} clients`);

  for (const clientId of uniqueClientIds) {
    try {
      const db3 = await getDb();
      if (!db3) continue;
      const clientRows = await db3
        .select()
        .from(crmClients)
        .where(eq(crmClients.id, clientId))
        .limit(1);
      const client = clientRows[0];
      if (!client) continue;

      const stats = await buildMonthlyReport(clientId, reportYear, reportMonth);

      // Only send if there was any activity
      if (
        stats.totalCalls === 0 &&
        stats.newJobs === 0 &&
        stats.quotesSent === 0
      ) {
        console.log(
          `[Monthly Report] No activity for client ${clientId} — skipping`,
        );
        continue;
      }

      const html = buildReportHtml(client.businessName, monthLabel, stats);

      await sendEmail({
        to: client.contactEmail,
        subject: `Your Solvr Monthly Report — ${monthLabel}`,
        html,
        fromName: "Solvr",
      });

      console.log(
        `[Monthly Report] Sent to ${client.contactEmail} (client ${clientId})`,
      );
    } catch (err) {
      console.error(
        `[Monthly Report] Error processing client ${clientId}:`,
        err,
      );
    }
  }

  console.log(`[Monthly Report] Done for ${monthLabel}`);
}

/**
 * Register the monthly call report cron job.
 * Runs at 10:00 PM UTC on the 1st of every month = 8:00 AM AEST.
 */
export function registerMonthlyCallReportCron(): void {
  // "0 22 1 * *" = 10pm UTC on the 1st = 8am AEST
  cron.schedule("0 22 1 * *", () => {
    runMonthlyCallReport().catch((err) =>
      console.error("[Monthly Report] Unhandled error:", err),
    );
  });
  console.log("[Cron] Monthly call report scheduled (1st of month, 8am AEST)");
}

// Export for testing
export { runMonthlyCallReport };
