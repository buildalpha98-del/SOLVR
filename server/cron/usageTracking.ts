/**
 * Usage Tracking Cron — three daily operational jobs for Cloud Phone V2.
 *
 * Runs at 02:00 UTC (12:00 AEST) — low-traffic window for AU tradies.
 *
 *   1. rolloverBillingCycles  — reset inbound/outbound minute counters for
 *      any clientPhoneNumbers row whose billingCycleStart is 30+ days old.
 *
 *   2. purgeOldRecordings     — delete R2 objects + NULL recordingUrl for
 *      callLogs rows where recordingUrl IS NOT NULL and calledAt is 90+ days ago.
 *
 *   3. closeStaleInProgressCalls — flip status='in_progress' rows that are
 *      30+ min old to status='failed', setting endedAt to now. Recovers from
 *      dropped Twilio /status webhooks so the concurrent-call gate isn't
 *      permanently blocked.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 4.7)
 */

import cron from "node-cron";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { getDb } from "../db";
import { clientPhoneNumbers, callLogs } from "../../drizzle/schema";
import { storageDelete } from "../storage";

// ─── Job 1 ────────────────────────────────────────────────────────────────────

export async function rolloverBillingCycles(): Promise<{ rolled: number }> {
  const db = await getDb();
  if (!db) {
    console.error("[UsageTracking.rolloverBillingCycles] Database not available");
    return { rolled: 0 };
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({ id: clientPhoneNumbers.id })
    .from(clientPhoneNumbers)
    .where(lte(clientPhoneNumbers.billingCycleStart, cutoff));

  for (const row of candidates) {
    await db
      .update(clientPhoneNumbers)
      .set({
        inboundMinutesUsed: 0,
        outboundMinutesUsed: 0,
        billingCycleStart: new Date(),
      })
      .where(eq(clientPhoneNumbers.id, row.id));
  }

  console.log(
    `[UsageTracking.rolloverBillingCycles] reset ${candidates.length} cycles`
  );
  return { rolled: candidates.length };
}

// ─── Job 2 ────────────────────────────────────────────────────────────────────

export async function purgeOldRecordings(): Promise<{ purged: number }> {
  const db = await getDb();
  if (!db) {
    console.error("[UsageTracking.purgeOldRecordings] Database not available");
    return { purged: 0 };
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const stale = await db
    .select({
      id: callLogs.id,
      recordingUrl: callLogs.recordingUrl,
      clientId: callLogs.clientId,
    })
    .from(callLogs)
    .where(
      and(
        isNotNull(callLogs.recordingUrl),
        lte(callLogs.calledAt, cutoff)
      )
    );

  let purged = 0;

  for (const row of stale) {
    // The recording key pattern is written by Task 4.4 /recording handler:
    //   call-recordings/{clientId}/{callLogId}.mp3
    const key = `call-recordings/${row.clientId}/${row.id}.mp3`;

    try {
      await storageDelete(key);
    } catch (err) {
      console.error(
        `[UsageTracking.purgeOldRecordings] R2 delete failed for callLog=${row.id}`,
        err
      );
      // Continue — don't block the whole purge on one R2 failure
      continue;
    }

    await db
      .update(callLogs)
      .set({ recordingUrl: null })
      .where(eq(callLogs.id, row.id));

    purged++;
  }

  console.log(
    `[UsageTracking.purgeOldRecordings] purged ${purged}/${stale.length} recordings`
  );
  return { purged };
}

// ─── Job 3 ────────────────────────────────────────────────────────────────────

export async function closeStaleInProgressCalls(): Promise<{ closed: number }> {
  const db = await getDb();
  if (!db) {
    console.error("[UsageTracking.closeStaleInProgressCalls] Database not available");
    return { closed: 0 };
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

  const stale = await db
    .select({ id: callLogs.id })
    .from(callLogs)
    .where(
      and(
        eq(callLogs.status, "in_progress"),
        lte(callLogs.calledAt, cutoff)
      )
    );

  if (stale.length === 0) return { closed: 0 };

  await db
    .update(callLogs)
    .set({
      status: "failed",
      endedAt: new Date(),
    })
    .where(inArray(callLogs.id, stale.map((s) => s.id)));

  console.warn(
    `[UsageTracking.closeStaleInProgressCalls] closed ${stale.length} stale rows`
  );
  return { closed: stale.length };
}

// ─── Cron registration ───────────────────────────────────────────────────────

export function registerUsageTrackingCron(): void {
  cron.schedule("0 2 * * *", async () => {
    console.log("[UsageTracking] daily tick start");
    try {
      const r1 = await rolloverBillingCycles();
      const r2 = await purgeOldRecordings();
      const r3 = await closeStaleInProgressCalls();
      console.log("[UsageTracking] daily tick complete", { ...r1, ...r2, ...r3 });
    } catch (err) {
      console.error("[UsageTracking] daily tick failed", err);
    }
  });
  console.log("[UsageTracking] daily cron registered (02:00 UTC)");
}
