/**
 * Staff Timesheet Cron Jobs
 *
 * 1. End-of-day hours → Job Costs (runs daily at 11:00 PM AEST / 13:00 UTC)
 *    - Finds all completed time_entries that haven't been converted to job cost items
 *    - Creates a job_cost_item for each (type: labour, description: "Staff labour — [name]")
 *    - Marks the time_entry as convertedToJobCost = true
 *
 * 2. Weekly Timesheet Email (runs every Monday at 7:00 AM AEST / 21:00 UTC Sunday)
 *    - For each client with staff members, generates a timesheet summary for the past week
 *    - Sends a summary email to the client's registered email address
 */
import cron from "node-cron";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import {
  timeEntries, staffMembers, portalJobs, jobCostItems,
  clientProfiles, crmClients,
} from "../../drizzle/schema";
import { and, eq, isNotNull, gte, lte, inArray } from "drizzle-orm";

// ─── End-of-day: convert time entries to job cost items ──────────────────────
async function convertTimeEntriesToJobCosts(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Find all completed (checked out) time entries not yet converted
    const unconverted = await db
      .select({
        id: timeEntries.id,
        clientId: timeEntries.clientId,
        jobId: timeEntries.jobId,
        staffId: timeEntries.staffId,
        checkInAt: timeEntries.checkInAt,
        checkOutAt: timeEntries.checkOutAt,
        durationMinutes: timeEntries.durationMinutes,
      })
      .from(timeEntries)
      .where(
        and(
          isNotNull(timeEntries.checkOutAt),
          eq(timeEntries.convertedToJobCost, false)
        )
      );

    if (unconverted.length === 0) return;

    // Get staff names for all unique staff IDs
    const staffIds = Array.from(new Set(unconverted.map(e => e.staffId)));
    const staffRows = await db
      .select({ id: staffMembers.id, name: staffMembers.name })
      .from(staffMembers)
      .where(inArray(staffMembers.id, staffIds));
    const staffMap = Object.fromEntries(staffRows.map(s => [s.id, s.name]));

    let converted = 0;
    for (const entry of unconverted) {
      if (!entry.checkOutAt || !entry.durationMinutes) continue;

      const hours = entry.durationMinutes / 60;
      const staffName = staffMap[entry.staffId] ?? `Staff #${entry.staffId}`;
      const checkInDate = new Date(entry.checkInAt).toLocaleDateString("en-AU", {
        day: "numeric", month: "short",
      });

      // Create job cost item (labour) — amountCents = 0 (tradie sets labour rate separately)
      await db.insert(jobCostItems).values({
        clientId: entry.clientId,
        jobId: entry.jobId,
        category: "labour",
        description: `${staffName} — ${checkInDate} (${hours.toFixed(1)}h)`,
        amountCents: 0,
        reference: `time_entry:${entry.id}`,
      });

      // Mark as converted
      await db
        .update(timeEntries)
        .set({ convertedToJobCost: true })
        .where(eq(timeEntries.id, entry.id));

      converted++;
    }

    if (converted > 0) {
      console.log(`[StaffTimesheet] Converted ${converted} time entries to job cost items.`);
    }
  } catch (err) {
    console.error("[StaffTimesheet] Error converting time entries:", err);
  }
}

// ─── Weekly timesheet email ───────────────────────────────────────────────────
async function sendWeeklyTimesheetEmails(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Find all clients with staff members
    const clientsWithStaff = await db
      .selectDistinct({ clientId: staffMembers.clientId })
      .from(staffMembers)
      .where(eq(staffMembers.isActive, true));

    if (clientsWithStaff.length === 0) return;

    for (const { clientId } of clientsWithStaff) {
      try {
        // Get client profile + email
        const [profile] = await db
          .select({
            tradingName: clientProfiles.tradingName,
            businessName: crmClients.businessName,
            email: crmClients.contactEmail,
            name: crmClients.contactName,
          })
          .from(clientProfiles)
          .innerJoin(crmClients, eq(crmClients.id, clientProfiles.clientId))
          .where(eq(clientProfiles.clientId, clientId))
          .limit(1);

        if (!profile?.email) continue;
        const displayName = profile.tradingName ?? profile.businessName ?? "Your Business";

        // Get all time entries for this client in the past week
        const entries = await db
          .select({
            id: timeEntries.id,
            jobId: timeEntries.jobId,
            staffId: timeEntries.staffId,
            checkInAt: timeEntries.checkInAt,
            checkOutAt: timeEntries.checkOutAt,
            durationMinutes: timeEntries.durationMinutes,
          })
          .from(timeEntries)
          .where(
            and(
              eq(timeEntries.clientId, clientId),
              isNotNull(timeEntries.checkOutAt),
              gte(timeEntries.checkInAt, weekStart),
              lte(timeEntries.checkInAt, weekEnd)
            )
          );

        if (entries.length === 0) continue;

        // Get staff names
        const staffIds = Array.from(new Set(entries.map(e => e.staffId)));
        const staffRows = await db
          .select({ id: staffMembers.id, name: staffMembers.name })
          .from(staffMembers)
          .where(inArray(staffMembers.id, staffIds));
        const staffMap = Object.fromEntries(staffRows.map(s => [s.id, s.name]));
        // Build per-staff summary
        const staffSummary: Record<string, { name: string; totalMinutes: number; shifts: number }> = {};
        for (const entry of entries) {
          const name = staffMap[entry.staffId] ?? `Staff #${entry.staffId}`;
          if (!staffSummary[name]) staffSummary[name] = { name, totalMinutes: 0, shifts: 0 };
          staffSummary[name].totalMinutes += entry.durationMinutes ?? 0;
          staffSummary[name].shifts++;
        }

        const totalMinutes = entries.reduce((sum: number, e: typeof entries[0]) => sum + (e.durationMinutes ?? 0), 0);
        const totalHours = (totalMinutes / 60).toFixed(1);

        const weekStartFormatted = weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
        const weekEndFormatted = weekEnd.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

        const staffRows2 = Object.values(staffSummary)
          .sort((a, b) => b.totalMinutes - a.totalMinutes)
          .map(s => {
            const h = Math.floor(s.totalMinutes / 60);
            const m = s.totalMinutes % 60;
            const timeStr = h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}` : `${m}m`;
            return `<tr>
              <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">${s.name}</td>
              <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;">${s.shifts}</td>
              <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${timeStr}</td>
            </tr>`;
          })
          .join("");

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f8f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#0F1F3D;padding:32px 32px 24px;">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.5);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Weekly Timesheet</p>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${weekStartFormatted} – ${weekEndFormatted}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.6);font-size:14px;">${displayName}</p>
    </div>
    <!-- Summary -->
    <div style="padding:24px 32px 0;display:flex;gap:24px;">
      <div style="flex:1;background:#f8f8f6;border-radius:12px;padding:16px 20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:28px;font-weight:800;color:#0F1F3D;">${totalHours}h</p>
        <p style="margin:0;font-size:12px;color:#888;">Total Hours</p>
      </div>
      <div style="flex:1;background:#f8f8f6;border-radius:12px;padding:16px 20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:28px;font-weight:800;color:#0F1F3D;">${entries.length}</p>
        <p style="margin:0;font-size:12px;color:#888;">Shifts Completed</p>
      </div>
      <div style="flex:1;background:#f8f8f6;border-radius:12px;padding:16px 20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:28px;font-weight:800;color:#0F1F3D;">${Object.keys(staffSummary).length}</p>
        <p style="margin:0;font-size:12px;color:#888;">Staff Active</p>
      </div>
    </div>
    <!-- Table -->
    <div style="padding:24px 32px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:0.06em;">Staff Breakdown</p>
      <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #f0f0f0;">
        <thead>
          <tr style="background:#f8f8f6;">
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;">Staff Member</th>
            <th style="padding:10px 16px;text-align:center;font-size:12px;color:#888;font-weight:600;">Shifts</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;">Hours</th>
          </tr>
        </thead>
        <tbody>${staffRows2}</tbody>
      </table>
    </div>
    <!-- CTA -->
    <div style="padding:0 32px 32px;">
      <p style="margin:0 0 16px;font-size:13px;color:#888;">Hours have been automatically added to your job cost tracker. Log in to review and set labour rates.</p>
      <a href="https://solvr.com.au/portal/jobs" style="display:inline-block;background:#F5A623;color:#0F1F3D;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;">View Job Costs →</a>
    </div>
    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#bbb;">Solvr · solvr.com.au · Automated timesheet summary</p>
    </div>
  </div>
</body>
</html>`;

        await sendEmail({
          to: profile.email,
          subject: `Weekly Timesheet: ${weekStartFormatted} – ${weekEndFormatted} · ${totalHours}h total`,
          html,
        });

        console.log(`[StaffTimesheet] Sent weekly timesheet to ${profile.email} (${totalHours}h, ${entries.length} shifts)`);
      } catch (clientErr) {
        console.error(`[StaffTimesheet] Error processing client ${clientId}:`, clientErr);
      }
    }
  } catch (err) {
    console.error("[StaffTimesheet] Error sending weekly timesheets:", err);
  }
}

// ─── Register crons ───────────────────────────────────────────────────────────
export function scheduleStaffTimesheetCrons(): void {
  // End-of-day conversion: 11 PM AEST = 1 PM UTC (13:00)
  cron.schedule("0 13 * * *", async () => {
    console.log("[StaffTimesheet] Running end-of-day time entry conversion...");
    await convertTimeEntriesToJobCosts();
  });

  // Weekly timesheet email: Monday 7 AM AEST = Sunday 9 PM UTC (21:00)
  cron.schedule("0 21 * * 0", async () => {
    console.log("[StaffTimesheet] Sending weekly timesheet emails...");
    await sendWeeklyTimesheetEmails();
  });

  console.log("[StaffTimesheet] Crons registered: end-of-day conversion (1 PM UTC daily) + weekly email (9 PM UTC Sunday)");
}
