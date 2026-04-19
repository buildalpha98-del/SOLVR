/**
 * scheduledSmsCampaigns.ts — Cron job that dispatches pending scheduled SMS campaigns.
 *
 * Runs every 5 minutes. Picks up any sms_campaigns rows where:
 *   status = 'pending' AND scheduledAt IS NOT NULL AND scheduledAt <= NOW()
 *
 * For each due campaign, fetches the pending recipients and sends via Twilio,
 * then marks the campaign completed/failed.
 */
import cron from "node-cron";
import {
  getDueScheduledCampaigns,
  getSmsCampaignRecipients,
  updateSmsCampaignStatus,
  updateSmsCampaignRecipient,
} from "../db";
import { sendSms } from "../lib/sms";

export async function runScheduledSmsCampaignsCron(): Promise<void> {
  console.log("[ScheduledSMS] Checking for due campaigns…");
  const dueCampaigns = await getDueScheduledCampaigns();
  if (dueCampaigns.length === 0) {
    console.log("[ScheduledSMS] No due campaigns.");
    return;
  }
  console.log(`[ScheduledSMS] Found ${dueCampaigns.length} due campaign(s).`);

  for (const campaign of dueCampaigns) {
    console.log(`[ScheduledSMS] Dispatching campaign ${campaign.id}: "${campaign.name}"`);
    // Mark as sending so concurrent runs don't double-dispatch
    await updateSmsCampaignStatus(campaign.id, "sending");

    const recipients = await getSmsCampaignRecipients(campaign.id);
    let sentCount = 0;
    let failedCount = 0;

    for (const row of recipients) {
      if (row.status !== "pending") continue; // skip already-processed rows
      const result = await sendSms({ to: row.phone, body: campaign.message });
      if (result.success) {
        sentCount++;
        await updateSmsCampaignRecipient(row.id, {
          status: "sent",
          twilioSid: result.sid ?? undefined,
          sentAt: new Date(),
        });
      } else {
        failedCount++;
        await updateSmsCampaignRecipient(row.id, {
          status: "failed",
          errorMessage: result.error ?? "Unknown error",
        });
      }
    }

    const finalStatus = failedCount === recipients.length ? "failed" : "completed";
    await updateSmsCampaignStatus(campaign.id, finalStatus, { sentCount, failedCount });
    console.log(
      `[ScheduledSMS] Campaign ${campaign.id} done — sent: ${sentCount}, failed: ${failedCount}`,
    );
  }
}

export function scheduleSmsCampaignsCron(): void {
  // Every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    runScheduledSmsCampaignsCron().catch((err) =>
      console.error("[ScheduledSMSCron] Unhandled error:", err),
    );
  });
  console.log("[ScheduledSMS] Cron scheduled (every 5 minutes)");
}
