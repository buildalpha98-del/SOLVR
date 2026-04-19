/**
 * Idle Job Nudge Cron
 *
 * Runs daily at 8:00 AM AEST (22:00 UTC previous day).
 * Finds jobs that have been in "new_lead" stage for 5+ days with no quote sent.
 * Sends a push notification nudging the tradie to quote or act on the lead.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { portalJobs, crmClients } from "../../drizzle/schema";
import { sendPushToClient } from "../pushNotifications";
import { and, eq, lte, isNull, sql } from "drizzle-orm";

const IDLE_DAYS = 5;

async function runIdleJobNudge(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - IDLE_DAYS);

  // Find all jobs in "new_lead" stage created more than 5 days ago
  const idleJobs = await db
    .select({
      id: portalJobs.id,
      clientId: portalJobs.clientId,
      jobType: portalJobs.jobType,
      customerName: portalJobs.customerName,
      callerName: portalJobs.callerName,
      createdAt: portalJobs.createdAt,
    })
    .from(portalJobs)
    .where(
      and(
        eq(portalJobs.stage, "new_lead"),
        lte(portalJobs.createdAt, cutoff)
      )
    );

  if (idleJobs.length === 0) {
    console.log("[IdleJobNudge] No idle leads found");
    return;
  }

  // Group by clientId
  const byClient = new Map<number, typeof idleJobs>();
  for (const job of idleJobs) {
    const arr = byClient.get(job.clientId) ?? [];
    arr.push(job);
    byClient.set(job.clientId, arr);
  }

  let notified = 0;

  for (const [clientId, jobs] of Array.from(byClient.entries())) {
    const count = jobs.length;
    const names = jobs
      .slice(0, 3)
      .map((j: typeof idleJobs[number]) => j.customerName ?? j.callerName ?? j.jobType ?? "Unnamed lead")
      .join(", ");

    const title = count === 1
      ? `📋 1 lead hasn't been quoted yet`
      : `📋 ${count} leads haven't been quoted yet`;

    const body = count === 1
      ? `"${names}" has been sitting in New Leads for ${IDLE_DAYS}+ days. Tap to create a quote.`
      : `${names}${count > 3 ? ` and ${count - 3} more` : ""} — all waiting ${IDLE_DAYS}+ days. Tap to view your pipeline.`;

    await sendPushToClient(clientId, {
      title,
      body,
      url: "/portal/jobs",
    });

    notified++;
  }

  console.log(`[IdleJobNudge] Nudged ${notified} clients about ${idleJobs.length} idle leads`);
}

export function scheduleIdleJobNudgeCron(): void {
  // Daily at 8:00 AM AEST = 22:00 UTC (previous day), offset by 5 min from licence check
  cron.schedule("5 22 * * *", () => {
    console.log("[IdleJobNudge] Running daily idle lead nudge…");
    runIdleJobNudge().catch(err =>
      console.error("[IdleJobNudge] Cron error:", err)
    );
  });
  console.log("[IdleJobNudge] Cron scheduled: daily at 8:05 AM AEST");
}
