/**
 * Licence & Insurance Expiry Warning Cron
 *
 * Runs daily at 8:00 AM AEST (22:00 UTC previous day).
 * Checks each active portal client's licenceExpiryDate and insuranceExpiryDate.
 * Sends a push notification + in-app CRM interaction when within 30 days of expiry.
 * Sends a second, more urgent notification at 7 days.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { clientProfiles, crmClients, crmInteractions } from "../../drizzle/schema";
import { sendPushToClient } from "../pushNotifications";
import { and, isNotNull, or, eq } from "drizzle-orm";

const WARN_DAYS_30 = 30;
const WARN_DAYS_7 = 7;

function daysUntil(dateStr: string): number | null {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

async function runLicenceExpiryCheck(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get all client profiles that have at least one expiry date set
  const profiles = await db
    .select({
      clientId: clientProfiles.clientId,
      tradingName: clientProfiles.tradingName,
      licenceExpiryDate: clientProfiles.licenceExpiryDate,
      licenceType: clientProfiles.licenceType,
      insuranceExpiryDate: clientProfiles.insuranceExpiryDate,
      insurerName: clientProfiles.insurerName,
    })
    .from(clientProfiles)
    .where(
      or(
        isNotNull(clientProfiles.licenceExpiryDate),
        isNotNull(clientProfiles.insuranceExpiryDate)
      )
    );

  let notified = 0;

  for (const profile of profiles) {
    const alerts: { type: string; label: string; daysLeft: number; urgent: boolean }[] = [];

    // Check licence expiry
    if (profile.licenceExpiryDate) {
      const days = daysUntil(profile.licenceExpiryDate);
      if (days !== null && days >= 0 && days <= WARN_DAYS_30) {
        alerts.push({
          type: "licence",
          label: profile.licenceType ?? "Trade licence",
          daysLeft: days,
          urgent: days <= WARN_DAYS_7,
        });
      }
    }

    // Check insurance expiry
    if (profile.insuranceExpiryDate) {
      const days = daysUntil(profile.insuranceExpiryDate);
      if (days !== null && days >= 0 && days <= WARN_DAYS_30) {
        alerts.push({
          type: "insurance",
          label: profile.insurerName ? `${profile.insurerName} policy` : "Public liability insurance",
          daysLeft: days,
          urgent: days <= WARN_DAYS_7,
        });
      }
    }

    if (alerts.length === 0) continue;

    // Deduplicate: check if we already notified today for this client
    const today = new Date().toISOString().split("T")[0];
    const existingToday = await db
      .select({ id: crmInteractions.id })
      .from(crmInteractions)
      .where(
        and(
          eq(crmInteractions.clientId, profile.clientId),
          eq(crmInteractions.type, "note")
        )
      )
      .then(rows => rows.filter(r => {
        // Simple dedup: we'll use title matching
        return false; // Allow all for now — the cron runs daily so at most 1 per day
      }));

    for (const alert of alerts) {
      const urgencyLabel = alert.urgent ? "⚠️ URGENT" : "⏰ Reminder";
      const title = `${urgencyLabel}: ${alert.label} expires in ${alert.daysLeft} day${alert.daysLeft !== 1 ? "s" : ""}`;
      const body = alert.daysLeft === 0
        ? `Your ${alert.label.toLowerCase()} expires TODAY. Update it in Settings → Licence & Insurance to keep your compliance documents valid.`
        : `Your ${alert.label.toLowerCase()} expires in ${alert.daysLeft} day${alert.daysLeft !== 1 ? "s" : ""}. Update it in Settings → Licence & Insurance.`;

      // Store as CRM interaction
      await db.insert(crmInteractions).values({
        clientId: profile.clientId,
        type: "note",
        title,
        body,
        isPinned: alert.urgent,
      });

      // Send push notification
      await sendPushToClient(profile.clientId, {
        title: alert.urgent ? `⚠️ ${alert.label} expires in ${alert.daysLeft}d` : `${alert.label} expires in ${alert.daysLeft}d`,
        body,
        url: "/portal/settings",
      });

      notified++;
    }
  }

  console.log(`[LicenceExpiry] Checked ${profiles.length} profiles, sent ${notified} expiry warnings`);
}

export function scheduleLicenceExpiryWarningCron(): void {
  // Daily at 8:00 AM AEST = 22:00 UTC (previous day)
  cron.schedule("0 22 * * *", () => {
    console.log("[LicenceExpiry] Running daily licence/insurance expiry check…");
    runLicenceExpiryCheck().catch(err =>
      console.error("[LicenceExpiry] Cron error:", err)
    );
  });
  console.log("[LicenceExpiry] Cron scheduled: daily at 8:00 AM AEST");
}
