/**
 * AI Invoice Chasing Cron Job
 *
 * Runs every day at 9:00 AM AEST (23:00 UTC previous day).
 * For each active invoice chase, checks if a chase email is due and sends it.
 *
 * Chase sequence (days since dueDate):
 *   Day 1  → Friendly reminder ("just checking in")
 *   Day 7  → Follow-up ("still outstanding")
 *   Day 14 → Final notice ("urgent action required")
 *   Day 21 → Escalation flag (no email — owner is notified to call)
 *
 * Cron expression: 0 23 * * * (11pm UTC = 9am AEST)
 */
import cron from "node-cron";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import { notifyOwner } from "../_core/notification";
import { sendExpoPush } from "../expoPush";
import { invoiceChases, crmClients, clientProfiles } from "../../drizzle/schema";
import { and, eq, lte, isNotNull, or, isNull } from "drizzle-orm";

// ─── Email templates ──────────────────────────────────────────────────────────

function buildChaseEmail(opts: {
  chaseCount: number; // 1, 2, or 3
  invoiceNumber: string;
  customerName: string;
  businessName: string;
  businessEmail: string;
  amountDue: string;
  dueDate: string;
  description?: string | null;
}): { subject: string; html: string } {
  const { chaseCount, invoiceNumber, customerName, businessName, businessEmail, amountDue, dueDate, description } = opts;
  const formattedAmount = `$${parseFloat(amountDue).toFixed(2)}`;
  const formattedDue = new Date(dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  if (chaseCount === 1) {
    return {
      subject: `Friendly reminder — Invoice ${invoiceNumber} from ${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <p>Hi ${customerName},</p>
          <p>Just a friendly reminder that Invoice <strong>${invoiceNumber}</strong> from <strong>${businessName}</strong> is now due.</p>
          ${description ? `<p><strong>Job:</strong> ${description}</p>` : ""}
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr style="background: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Invoice Number</strong></td>
              <td style="padding: 12px; border: 1px solid #e0e0e0;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Amount Due</strong></td>
              <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>${formattedAmount} (inc. GST)</strong></td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Due Date</strong></td>
              <td style="padding: 12px; border: 1px solid #e0e0e0;">${formattedDue}</td>
            </tr>
          </table>
          <p>If you've already arranged payment, please disregard this message. Otherwise, please process payment at your earliest convenience.</p>
          <p>If you have any questions, please don't hesitate to reply to this email.</p>
          <p>Kind regards,<br><strong>${businessName}</strong></p>
        </div>
      `,
    };
  }

  if (chaseCount === 2) {
    return {
      subject: `Follow-up — Invoice ${invoiceNumber} still outstanding`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <p>Hi ${customerName},</p>
          <p>We're following up on Invoice <strong>${invoiceNumber}</strong> from <strong>${businessName}</strong>, which remains unpaid.</p>
          ${description ? `<p><strong>Job:</strong> ${description}</p>` : ""}
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr style="background: #fff3cd;">
              <td style="padding: 12px; border: 1px solid #ffc107;"><strong>Invoice Number</strong></td>
              <td style="padding: 12px; border: 1px solid #ffc107;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ffc107;"><strong>Amount Due</strong></td>
              <td style="padding: 12px; border: 1px solid #ffc107;"><strong>${formattedAmount} (inc. GST)</strong></td>
            </tr>
            <tr style="background: #fff3cd;">
              <td style="padding: 12px; border: 1px solid #ffc107;"><strong>Original Due Date</strong></td>
              <td style="padding: 12px; border: 1px solid #ffc107;">${formattedDue}</td>
            </tr>
          </table>
          <p>We understand things get busy — if you're experiencing any difficulty, please reply to this email so we can work something out.</p>
          <p>Otherwise, we'd appreciate payment as soon as possible.</p>
          <p>Kind regards,<br><strong>${businessName}</strong></p>
        </div>
      `,
    };
  }

  // chaseCount === 3 — final notice
  return {
    subject: `URGENT: Final notice — Invoice ${invoiceNumber} requires immediate payment`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #dc3545; color: white; padding: 16px; border-radius: 4px 4px 0 0; text-align: center;">
          <strong>⚠️ FINAL NOTICE</strong>
        </div>
        <div style="border: 2px solid #dc3545; padding: 24px;">
          <p>Hi ${customerName},</p>
          <p>This is a final notice regarding Invoice <strong>${invoiceNumber}</strong> from <strong>${businessName}</strong>.</p>
          <p>Despite previous reminders, this invoice remains unpaid. If payment is not received within <strong>7 days</strong>, we may need to refer this matter for further action.</p>
          ${description ? `<p><strong>Job:</strong> ${description}</p>` : ""}
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr style="background: #f8d7da;">
              <td style="padding: 12px; border: 1px solid #dc3545;"><strong>Invoice Number</strong></td>
              <td style="padding: 12px; border: 1px solid #dc3545;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #dc3545;"><strong>Amount Due</strong></td>
              <td style="padding: 12px; border: 1px solid #dc3545;"><strong style="color: #dc3545;">${formattedAmount} (inc. GST)</strong></td>
            </tr>
            <tr style="background: #f8d7da;">
              <td style="padding: 12px; border: 1px solid #dc3545;"><strong>Original Due Date</strong></td>
              <td style="padding: 12px; border: 1px solid #dc3545;">${formattedDue}</td>
            </tr>
          </table>
          <p>To avoid further action, please arrange payment immediately or contact us to discuss a payment arrangement.</p>
          <p>Regards,<br><strong>${businessName}</strong></p>
        </div>
      </div>
    `,
  };
}

// ─── Main cron function ───────────────────────────────────────────────────────

export async function runInvoiceChasingCron(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[InvoiceChasing] DB not available");
    return;
  }

  const now = new Date();
  console.log(`[InvoiceChasing] Running at ${now.toISOString()}`);

  // Fetch all active chases where nextChaseAt is due (or snooze has expired)
  const dueChases = await db
    .select({
      chase: invoiceChases,
      client: {
        id: crmClients.id,
        businessName: crmClients.businessName,
        contactEmail: crmClients.contactEmail,
        pushToken: crmClients.pushToken,
      },
      profile: {
        replyToEmail: clientProfiles.email,
        tradingName: clientProfiles.tradingName,
      },
    })
    .from(invoiceChases)
    .leftJoin(crmClients, eq(invoiceChases.clientId, crmClients.id))
    .leftJoin(clientProfiles, eq(invoiceChases.clientId, clientProfiles.clientId))
    .where(
      and(
        eq(invoiceChases.status, "active"),
        lte(invoiceChases.nextChaseAt, now),
        or(
          isNull(invoiceChases.snoozeUntil),
          lte(invoiceChases.snoozeUntil, now),
        ),
      ),
    );

  console.log(`[InvoiceChasing] Found ${dueChases.length} due chases`);

  for (const row of dueChases) {
    const { chase, client, profile } = row;
    if (!client?.id) continue;

    const daysSinceDue = Math.floor(
      (now.getTime() - new Date(chase.dueDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    // Day 21+ → escalate (no email, notify owner)
    if (daysSinceDue >= 21 && chase.chaseCount >= 3) {
      await db
        .update(invoiceChases)
        .set({
          status: "escalated",
          nextChaseAt: null,
          updatedAt: now,
        })
        .where(eq(invoiceChases.id, chase.id));

      const businessName = profile?.tradingName ?? client.businessName ?? "Unknown Business";
      await notifyOwner({
        title: `⚠️ Invoice Escalated — ${businessName}`,
        content: `Invoice ${chase.invoiceNumber} for ${chase.customerName} (${chase.customerEmail}) — $${chase.amountDue} — is now 21+ days overdue. Manual follow-up required.\n\nClient: ${businessName}`,
      });

      // Push notification to the Solvr client
      if (client.pushToken) {
        await sendExpoPush({
          to: client.pushToken,
          title: "Invoice Escalated",
          body: `${chase.invoiceNumber} — $${chase.amountDue} — 21+ days overdue. Time to call ${chase.customerName}.`,
          data: { type: "invoice_escalated", chaseId: chase.id },
        });
      }

      console.log(`[InvoiceChasing] Escalated chase ${chase.id} for client ${client.id}`);
      continue;
    }

    // Send the next chase email
    const nextChaseCount = chase.chaseCount + 1;
    if (nextChaseCount > 3) continue; // sequence complete

    const businessName = profile?.tradingName ?? client.businessName ?? "Your Service Provider";
    const replyTo = profile?.replyToEmail ?? client.contactEmail ?? undefined; // replyToEmail maps to clientProfiles.email

    const { subject, html } = buildChaseEmail({
      chaseCount: nextChaseCount,
      invoiceNumber: chase.invoiceNumber,
      customerName: chase.customerName,
      businessName,
      businessEmail: replyTo ?? "noreply@solvr.com.au",
      amountDue: chase.amountDue,
      dueDate: typeof chase.dueDate === 'string' ? chase.dueDate : (chase.dueDate as Date).toISOString().split('T')[0],
      description: chase.description,
    });
    const result = await sendEmail({
      to: chase.customerEmail,
      subject,
      html,
      fromName: businessName,
      replyTo,
    });

    if (!result.success) {
      console.error(`[InvoiceChasing] Failed to send chase email for ${chase.id}: ${result.error}`);
      continue;
    }

    // Calculate next chase date: day 1 → day 7 (+6 days), day 7 → day 14 (+7 days), day 14 → day 21 (+7 days)
    const daysUntilNext = nextChaseCount === 1 ? 6 : 7;
    const nextChaseAt = new Date(now.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
    const isLastChase = nextChaseCount === 3;

    await db
      .update(invoiceChases)
      .set({
        chaseCount: nextChaseCount,
        lastChasedAt: now,
        nextChaseAt: isLastChase ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : nextChaseAt,
        status: "active",
        snoozeUntil: null,
        updatedAt: now,
      })
      .where(eq(invoiceChases.id, chase.id));

    // Push notification to the Solvr client confirming chase sent
    if (client.pushToken) {
      await sendExpoPush({
        to: client.pushToken,
        title: `Chase Email Sent — ${chase.invoiceNumber}`,
        body: `Reminder #${nextChaseCount} sent to ${chase.customerName} for $${chase.amountDue}.`,
        data: { type: "invoice_chase_sent", chaseId: chase.id },
      });
    }

    console.log(`[InvoiceChasing] Sent chase #${nextChaseCount} for invoice ${chase.invoiceNumber} (${chase.id})`);
  }

  console.log("[InvoiceChasing] Cron complete");
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export function scheduleInvoiceChasingCron(): void {
  // 11pm UTC = 9am AEST
  cron.schedule("0 23 * * *", () => {
    runInvoiceChasingCron().catch((err) =>
      console.error("[InvoiceChasingCron] Unhandled error:", err),
    );
  });
  console.log("[InvoiceChasing] Cron scheduled (daily 9am AEST)");
}
