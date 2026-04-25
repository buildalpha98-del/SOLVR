/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Maintenance Schedule Cron (Sprint 4.2).
 *
 * Daily 9am AEST scan of customer_assets. For every active asset whose
 * nextServiceDueAt falls within LEAD_DAYS of today AND we haven't already
 * auto-created a job for this cycle, we:
 *   1. Insert a portal_jobs row in the "new_lead" stage with the customer
 *      details + asset metadata pre-filled.
 *   2. Mark customer_assets.lastAutoJobCreatedAt = now (idempotency).
 *   3. Mark customer_assets.lastJobId = the new job ID for back-reference.
 *   4. Push notification to the tradie summarising what landed.
 *
 * Why no auto-SMS to customers in v1: too easy to spam if asset data is
 * stale or the customer's already moved house. Tradie reviews the
 * auto-created jobs in their pipeline, then SMSes from inside the inbox
 * (Sprint 1.2). Auto-SMS is a v2 opt-in.
 *
 * Cron expression: 0 23 * * * (11pm UTC = 9am AEST)
 */
import cron from "node-cron";
import { getDb } from "../db";
import { sendExpoPush } from "../expoPush";
import { customerAssets, portalJobs, tradieCustomers, crmClients } from "../../drizzle/schema";
import { and, eq, lte, gte } from "drizzle-orm";
import { randomBytes } from "crypto";

/** Days of lead time — fire the auto-job 14 days before the service is due. */
const LEAD_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Format a YYYY-MM-DD date for human-readable copy. */
function formatHumanDate(yyyymmdd: string): string {
  return new Date(yyyymmdd).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Build the portal_jobs description from the asset metadata. Tradie sees
 * this on the job card so we cram in everything useful.
 */
function buildJobDescription(asset: {
  label: string;
  assetType: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  nextServiceDueAt: string | null;
  lastServicedAt: string | null;
  notes: string | null;
}): string {
  const parts: string[] = [];
  parts.push(`Auto-scheduled service for ${asset.label}`);
  if (asset.make || asset.model) {
    parts.push(`Equipment: ${[asset.make, asset.model].filter(Boolean).join(" ")}`);
  }
  if (asset.serialNumber) parts.push(`Serial: ${asset.serialNumber}`);
  if (asset.nextServiceDueAt) parts.push(`Service due: ${formatHumanDate(asset.nextServiceDueAt)}`);
  if (asset.lastServicedAt) parts.push(`Last serviced: ${formatHumanDate(asset.lastServicedAt)}`);
  if (asset.notes) parts.push(`\nNotes:\n${asset.notes}`);
  parts.push(`\n— Auto-created by SOLVR maintenance scheduler. Open the customer page to see the asset register.`);
  return parts.join("\n");
}

export async function runMaintenanceScheduleCron(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[MaintenanceSchedule] DB not available");
    return;
  }

  const now = new Date();
  const cutoffDate = new Date(now.getTime() + LEAD_DAYS * DAY_MS);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  console.log(`[MaintenanceSchedule] Running at ${now.toISOString()} — scanning assets due ≤ ${cutoffStr}`);

  // Find active assets with a nextServiceDueAt within the lead window AND
  // we haven't already auto-created a job this cycle. Cycle reset detection:
  // if lastServicedAt > lastAutoJobCreatedAt, the tradie did the service so
  // we're in a new cycle and the gate should re-arm.
  //
  // We can't express that easily in a single SQL where, so we filter in TS.
  const candidates = await db
    .select({
      asset: customerAssets,
      customer: {
        id: tradieCustomers.id,
        name: tradieCustomers.name,
        phone: tradieCustomers.phone,
        email: tradieCustomers.email,
        address: tradieCustomers.address,
      },
    })
    .from(customerAssets)
    .leftJoin(tradieCustomers, eq(customerAssets.customerId, tradieCustomers.id))
    .where(and(
      eq(customerAssets.status, "active"),
      lte(customerAssets.nextServiceDueAt, cutoffStr),
      gte(customerAssets.nextServiceDueAt, todayStr), // don't fire for already-overdue jobs the tradie ignored
    ));

  console.log(`[MaintenanceSchedule] ${candidates.length} candidate(s) within ${LEAD_DAYS}-day window`);

  // Group results by clientId for the per-tradie push summary
  const byClient = new Map<number, Array<typeof candidates[number]>>();
  let createdCount = 0;
  let skippedCount = 0;

  for (const row of candidates) {
    const a = row.asset;
    if (!row.customer?.id) {
      skippedCount++;
      continue;
    }

    // Idempotency: skip if we already fired for this cycle.
    // "this cycle" = the auto-job-created timestamp is later than the last
    // service. If the tradie services the asset, lastServicedAt jumps
    // forward via markServiced and the gate re-arms.
    if (a.lastAutoJobCreatedAt) {
      const fired = new Date(a.lastAutoJobCreatedAt).getTime();
      const serviced = a.lastServicedAt ? new Date(a.lastServicedAt).getTime() : 0;
      if (fired >= serviced) {
        skippedCount++;
        continue;
      }
    }

    try {
      // Create the portal_jobs row
      const customerStatusToken = randomBytes(32).toString("hex");
      const insert = await db.insert(portalJobs).values({
        clientId: a.clientId,
        callerName: "SOLVR maintenance scheduler",
        callerPhone: row.customer.phone ?? null,
        jobType: `Service: ${a.label}`,
        description: buildJobDescription(a),
        location: row.customer.address ?? null,
        stage: "new_lead",
        preferredDate: a.nextServiceDueAt ?? undefined,
        customerName: row.customer.name,
        customerEmail: row.customer.email ?? null,
        customerPhone: row.customer.phone ?? null,
        customerAddress: row.customer.address ?? null,
        customerStatusToken,
      });
      const newJobId = (insert as unknown as { insertId: number }).insertId
        ?? ((insert as unknown as Array<{ insertId: number }>)[0]?.insertId);

      // Mark the asset as fired-for-this-cycle + back-link the job
      await db.update(customerAssets)
        .set({
          lastAutoJobCreatedAt: now,
          lastJobId: typeof newJobId === "number" ? newJobId : a.lastJobId,
        })
        .where(eq(customerAssets.id, a.id));

      console.log(`[MaintenanceSchedule] Created job for asset ${a.id} (${a.label}) — clientId=${a.clientId}, customerId=${row.customer.id}`);

      // Group for push notification roll-up
      const list = byClient.get(a.clientId) ?? [];
      list.push(row);
      byClient.set(a.clientId, list);
      createdCount++;
    } catch (err) {
      console.error(`[MaintenanceSchedule] Failed to create job for asset ${a.id}:`, err);
    }
  }

  // Send a single rolled-up push per tradie ("3 services due — Smith HWS,
  // Jones split, Bob's gate motor")
  for (const [clientId, list] of Array.from(byClient.entries())) {
    try {
      const clientRow = await db
        .select({ pushToken: crmClients.pushToken })
        .from(crmClients)
        .where(eq(crmClients.id, clientId))
        .limit(1);
      const pushToken = clientRow[0]?.pushToken;
      if (!pushToken) continue;

      const labels = list.slice(0, 3).map((r: typeof candidates[number]) => r.asset.label).join(", ");
      const body = list.length === 1
        ? `${labels} is due for service. Open Jobs to schedule.`
        : `${list.length} services due — ${labels}${list.length > 3 ? "…" : ""}. Open Jobs to schedule.`;

      await sendExpoPush({
        to: pushToken,
        title: `🔧 Service${list.length === 1 ? "" : "s"} due`,
        body,
        sound: "default",
        priority: "high",
        data: { type: "maintenance_due", assetCount: list.length },
      });
    } catch (err) {
      console.error(`[MaintenanceSchedule] Push failed for client ${clientId}:`, err);
    }
  }

  console.log(`[MaintenanceSchedule] Cron complete — created ${createdCount}, skipped ${skippedCount}, ${byClient.size} tradie(s) notified`);
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function scheduleMaintenanceCron(): void {
  // Run daily at 9am AEST (23:00 UTC)
  cron.schedule("0 23 * * *", async () => {
    try {
      await runMaintenanceScheduleCron();
    } catch (err) {
      console.error("[MaintenanceSchedule] Cron error:", err);
    }
  });
  console.log("[MaintenanceSchedule] Cron scheduled — daily at 9am AEST");
}

