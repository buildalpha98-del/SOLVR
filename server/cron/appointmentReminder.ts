/**
 * Appointment Reminder SMS Cron
 *
 * Runs daily at 5pm AEST (7am UTC). Finds calendar events starting tomorrow
 * that have a customer phone number, and sends a reminder SMS via Twilio
 * with a link to the job status tracking page (if available).
 *
 * Uses reminderSentAt as an idempotency flag to avoid duplicate reminders.
 * Only sends for clients who have appointmentReminderEnabled = true.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { portalCalendarEvents, portalJobs, clientProfiles } from "../../drizzle/schema";
import { sendSms } from "../lib/sms";
import { eq, and, isNull, gte, lte } from "drizzle-orm";

/**
 * Core logic — exported for testing.
 */
export async function runAppointmentReminderCron(): Promise<{
  checked: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[AppointmentReminder] Database not available — skipping");
    return { checked: 0, sent: 0, skipped: 0, errors: 0 };
  }

  // Calculate tomorrow's window in AEST (UTC+10/+11 depending on DST)
  // We use a broad 24-hour window: tomorrow 00:00 AEST to tomorrow 23:59 AEST
  // Since we store timestamps in UTC, we need to offset.
  // AEST = UTC+10, AEDT = UTC+11. We use UTC+10 (conservative) to avoid missing events.
  const now = new Date();
  const aestOffset = 10 * 60 * 60 * 1000; // +10 hours in ms

  // "Tomorrow" in AEST
  const aestNow = new Date(now.getTime() + aestOffset);
  const tomorrowAest = new Date(aestNow);
  tomorrowAest.setDate(tomorrowAest.getDate() + 1);
  tomorrowAest.setHours(0, 0, 0, 0);
  const tomorrowEndAest = new Date(tomorrowAest);
  tomorrowEndAest.setHours(23, 59, 59, 999);

  // Convert back to UTC for DB query
  const tomorrowStartUtc = new Date(tomorrowAest.getTime() - aestOffset);
  const tomorrowEndUtc = new Date(tomorrowEndAest.getTime() - aestOffset);

  console.log(
    `[AppointmentReminder] Checking events between ${tomorrowStartUtc.toISOString()} and ${tomorrowEndUtc.toISOString()} (UTC)`,
  );

  // Find calendar events starting tomorrow that haven't had a reminder sent
  const events = await db
    .select({
      eventId: portalCalendarEvents.id,
      clientId: portalCalendarEvents.clientId,
      jobId: portalCalendarEvents.jobId,
      title: portalCalendarEvents.title,
      contactName: portalCalendarEvents.contactName,
      contactPhone: portalCalendarEvents.contactPhone,
      startAt: portalCalendarEvents.startAt,
      location: portalCalendarEvents.location,
    })
    .from(portalCalendarEvents)
    .where(
      and(
        gte(portalCalendarEvents.startAt, tomorrowStartUtc),
        lte(portalCalendarEvents.startAt, tomorrowEndUtc),
        isNull(portalCalendarEvents.reminderSentAt),
      ),
    );

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of events) {
    try {
      // Skip if no customer phone
      if (!event.contactPhone) {
        skipped++;
        continue;
      }

      // Check if the client has appointment reminders enabled
      const [profile] = await db
        .select({ appointmentReminderEnabled: clientProfiles.appointmentReminderEnabled })
        .from(clientProfiles)
        .where(eq(clientProfiles.clientId, event.clientId))
        .limit(1);

      if (!profile || !profile.appointmentReminderEnabled) {
        skipped++;
        continue;
      }

      // Build the SMS body
      const startTime = new Date(event.startAt).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Australia/Sydney",
      });
      const startDate = new Date(event.startAt).toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Australia/Sydney",
      });

      // Try to get the job's customer status token for a tracking link
      let trackingLink = "";
      if (event.jobId) {
        const [job] = await db
          .select({ customerStatusToken: portalJobs.customerStatusToken })
          .from(portalJobs)
          .where(eq(portalJobs.id, event.jobId))
          .limit(1);

        if (job?.customerStatusToken) {
          trackingLink = `\n\nTrack your job: https://solvr.com.au/job/${job.customerStatusToken}`;
        }
      }

      const customerName = event.contactName ? `Hi ${event.contactName.split(" ")[0]}, ` : "";
      const locationInfo = event.location ? ` at ${event.location}` : "";
      const body = `${customerName}Reminder: Your appointment "${event.title}" is scheduled for ${startDate} at ${startTime}${locationInfo}.${trackingLink}`;

      const result = await sendSms({
        to: event.contactPhone,
        body,
      });

      if (result.success) {
        // Mark reminder as sent (idempotency)
        await db
          .update(portalCalendarEvents)
          .set({ reminderSentAt: new Date() })
          .where(eq(portalCalendarEvents.id, event.eventId));
        sent++;
        console.log(
          `[AppointmentReminder] Sent to ${event.contactPhone} for event #${event.eventId} (${event.title})`,
        );
      } else {
        errors++;
        console.error(
          `[AppointmentReminder] Failed to send to ${event.contactPhone}: ${result.error}`,
        );
      }
    } catch (err) {
      errors++;
      console.error(`[AppointmentReminder] Error processing event #${event.eventId}:`, err);
    }
  }

  console.log(
    `[AppointmentReminder] Done — checked: ${events.length}, sent: ${sent}, skipped: ${skipped}, errors: ${errors}`,
  );
  return { checked: events.length, sent, skipped, errors };
}

/**
 * Register the cron — runs daily at 7:00 AM UTC = 5:00 PM AEST.
 */
export function scheduleAppointmentReminderCron(): void {
  cron.schedule("0 7 * * *", () => {
    runAppointmentReminderCron().catch((err) =>
      console.error("[AppointmentReminder] Unhandled error:", err),
    );
  });
  console.log("[AppointmentReminder] Cron scheduled — runs daily at 5pm AEST (7am UTC)");
}
