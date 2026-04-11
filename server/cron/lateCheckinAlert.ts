/**
 * Late Check-in Alert Cron
 *
 * Runs every 5 minutes. Finds schedule entries that started more than 15 minutes
 * ago with no matching check-in, and fires a push notification to the portal
 * client (owner) so they can follow up before the job is delayed.
 *
 * Uses notificationSentAt as a "late alert sent" flag to avoid duplicate alerts.
 */
import cron from "node-cron";
import { listScheduleEntriesForLateCheckin, updateScheduleEntry } from "../db";
import { sendPushToClient } from "../pushNotifications";
import { getCrmClientById } from "../db";

const LATE_THRESHOLD_MINUTES = 15;

async function checkLateCheckins(): Promise<void> {
  try {
    const lateEntries = await listScheduleEntriesForLateCheckin(LATE_THRESHOLD_MINUTES);
    if (lateEntries.length === 0) return;

    for (const entry of lateEntries) {
      try {
        // Skip if we already sent a late alert for this entry
        // We repurpose notificationSentAt — if it's set AND the entry started before it,
        // it means the assignment notification was sent. We use a separate check:
        // if notificationSentAt is more than LATE_THRESHOLD_MINUTES after startTime,
        // that means we already sent the late alert.
        if (entry.notificationSentAt) {
          const alertSentAt = new Date(entry.notificationSentAt).getTime();
          const startedAt = new Date(entry.startTime).getTime();
          if (alertSentAt > startedAt + LATE_THRESHOLD_MINUTES * 60 * 1000) {
            // Late alert already sent for this entry
            continue;
          }
        }

        const staffName = entry.staffName ?? `Staff #${entry.staffId}`;
        const startTime = new Date(entry.startTime).toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        const startDate = new Date(entry.startTime).toLocaleDateString("en-AU", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });

        // Get the portal client's push subscription
        const client = await getCrmClientById(entry.clientId);
        if (!client) continue;

        // Send push notification to the owner
        await sendPushToClient(entry.clientId, {
          title: `⚠️ ${staffName} hasn't checked in`,
          body: `Scheduled for ${startDate} at ${startTime} — ${LATE_THRESHOLD_MINUTES} minutes late. Tap to view.`,
          url: `/portal/schedule`,
        });

        {
          // Mark notificationSentAt to now (after startTime + threshold) so we don't re-alert
          await updateScheduleEntry(entry.id, {
            notificationSentAt: new Date(),
          });
          console.log(`[LateCheckin] Alert sent for ${staffName} (entry #${entry.id}, client #${entry.clientId})`);
        }
      } catch (entryErr) {
        console.error(`[LateCheckin] Error processing entry #${entry.id}:`, entryErr);
      }
    }
  } catch (err) {
    console.error("[LateCheckin] Error checking late check-ins:", err);
  }
}

export function scheduleLateCheckinAlertCron(): void {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    await checkLateCheckins();
  });
  console.log("[LateCheckin] Cron scheduled — runs every 5 minutes");
}
