/**
 * Quote Follow-Up Cron Job
 *
 * Runs every day at 9:00 AM AEST (23:00 UTC previous day).
 * For each sent quote that hasn't been responded to, sends automated follow-ups
 * and marks expired quotes.
 *
 * Sequence (hours/days since sentAt):
 *   48h   → Follow-up #1: "Just checking in" email
 *   5 days → Follow-up #2: "Still interested?" email + SMS
 *   Expiry → Mark quote as expired, notify tradie via push
 *
 * Cron expression: 0 23 * * * (11pm UTC = 9am AEST)
 */
import cron from "node-cron";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import { sendSms } from "../lib/sms";
import { sendExpoPush } from "../expoPush";
import { quotes, quoteFollowUps, crmClients, clientProfiles } from "../../drizzle/schema";
import { and, eq, lte, or, isNull, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Email templates ──────────────────────────────────────────────────────────

function buildFollowUpEmail(opts: {
  followUpCount: number;
  quoteNumber: string;
  customerName: string;
  businessName: string;
  jobTitle: string;
  totalAmount: string;
  validUntil: string | null;
  acceptUrl: string;
}): { subject: string; html: string } {
  const { followUpCount, quoteNumber, customerName, businessName, jobTitle, totalAmount, validUntil, acceptUrl } = opts;
  const formattedAmount = `$${parseFloat(totalAmount || "0").toFixed(2)}`;
  const expiryText = validUntil
    ? `This quote is valid until <strong>${new Date(validUntil).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</strong>.`
    : "This quote will expire soon.";

  if (followUpCount === 1) {
    return {
      subject: `Quick follow-up — Quote ${quoteNumber} from ${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <p>Hi ${customerName},</p>
          <p>Just checking in on the quote we sent you for <strong>${jobTitle}</strong>.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr style="background: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Quote Number</strong></td>
              <td style="padding: 12px; border: 1px solid #e0e0e0;">${quoteNumber}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Job</strong></td>
              <td style="padding: 12px; border: 1px solid #e0e0e0;">${jobTitle}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Total (inc. GST)</strong></td>
              <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>${formattedAmount}</strong></td>
            </tr>
          </table>
          <p>${expiryText}</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${acceptUrl}" style="background: #F5A623; color: #0F1F3D; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">View &amp; Accept Quote</a>
          </p>
          <p>If you have any questions or would like to discuss the scope, please reply to this email — we're happy to help.</p>
          <p>Kind regards,<br><strong>${businessName}</strong></p>
        </div>
      `,
    };
  }

  // followUpCount === 2 — "Still interested?" with urgency
  return {
    subject: `Your quote is expiring soon — ${quoteNumber} from ${businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #F5A623; color: #0F1F3D; padding: 16px; border-radius: 4px 4px 0 0; text-align: center;">
          <strong>⏰ Your quote is expiring soon</strong>
        </div>
        <div style="border: 2px solid #F5A623; padding: 24px;">
          <p>Hi ${customerName},</p>
          <p>We wanted to let you know that your quote for <strong>${jobTitle}</strong> is expiring soon.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr style="background: #fff8e6;">
              <td style="padding: 12px; border: 1px solid #F5A623;"><strong>Quote Number</strong></td>
              <td style="padding: 12px; border: 1px solid #F5A623;">${quoteNumber}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #F5A623;"><strong>Job</strong></td>
              <td style="padding: 12px; border: 1px solid #F5A623;">${jobTitle}</td>
            </tr>
            <tr style="background: #fff8e6;">
              <td style="padding: 12px; border: 1px solid #F5A623;"><strong>Total (inc. GST)</strong></td>
              <td style="padding: 12px; border: 1px solid #F5A623;"><strong>${formattedAmount}</strong></td>
            </tr>
          </table>
          <p>${expiryText}</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${acceptUrl}" style="background: #F5A623; color: #0F1F3D; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">Accept Quote Now</a>
          </p>
          <p>If you've decided not to proceed, no worries — just let us know and we'll close this off. Otherwise, we'd love to get started on your job.</p>
          <p>Kind regards,<br><strong>${businessName}</strong></p>
        </div>
      </div>
    `,
  };
}

function buildFollowUpSms(opts: {
  customerName: string;
  businessName: string;
  jobTitle: string;
  acceptUrl: string;
}): string {
  const { customerName, businessName, jobTitle, acceptUrl } = opts;
  return (
    `Hi ${customerName}, ${businessName} here. Your quote for ${jobTitle} is expiring soon. ` +
    `Accept online: ${acceptUrl}`
  );
}

// ─── Main cron function ───────────────────────────────────────────────────────

export async function runQuoteFollowUpCron(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[QuoteFollowUp] DB not available");
    return;
  }

  const now = new Date();
  console.log(`[QuoteFollowUp] Running at ${now.toISOString()}`);

  // ── Step 1: Mark expired quotes ──────────────────────────────────────────────
  const expiredQuotes = await db
    .select({ id: quotes.id, clientId: quotes.clientId, jobTitle: quotes.jobTitle, customerName: quotes.customerName, quoteNumber: quotes.quoteNumber })
    .from(quotes)
    .where(
      and(
        eq(quotes.status, "sent"),
        lte(quotes.validUntil, now),
      ),
    );

  for (const q of expiredQuotes) {
    await db.update(quotes).set({ status: "expired", updatedAt: now }).where(eq(quotes.id, q.id));
    // Stop any active follow-up sequence for this quote
    await db
      .update(quoteFollowUps)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(quoteFollowUps.quoteId, q.id), eq(quoteFollowUps.status, "active")));

    // Notify tradie via push
    const clientRow = await db.select({ pushToken: crmClients.pushToken }).from(crmClients).where(eq(crmClients.id, q.clientId)).limit(1);
    if (clientRow[0]?.pushToken) {
      await sendExpoPush({
        to: clientRow[0].pushToken,
        title: "Quote Expired",
        body: `Quote ${q.quoteNumber} for ${q.customerName ?? "customer"} has expired without a response.`,
        data: { type: "quote_expired", quoteId: q.id },
      });
    }
    console.log(`[QuoteFollowUp] Marked quote ${q.id} as expired`);
  }

  // ── Step 2: Enrol newly sent quotes into follow-up sequence ──────────────────
  // Find sent quotes that have no follow-up record yet and were sent > 24h ago
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sentQuotes = await db
    .select({ id: quotes.id, clientId: quotes.clientId, sentAt: quotes.sentAt })
    .from(quotes)
    .where(
      and(
        eq(quotes.status, "sent"),
        lte(quotes.sentAt, oneDayAgo),
      ),
    );

  const existingFollowUpIds = sentQuotes.length > 0
    ? (await db
        .select({ quoteId: quoteFollowUps.quoteId })
        .from(quoteFollowUps)
        .where(inArray(quoteFollowUps.quoteId, sentQuotes.map(q => q.id))))
        .map(r => r.quoteId)
    : [];

  const toEnrol = sentQuotes.filter(q => !existingFollowUpIds.includes(q.id));
  for (const q of toEnrol) {
    const twoDaysFromSent = new Date((q.sentAt ?? now).getTime() + 48 * 60 * 60 * 1000);
    await db.insert(quoteFollowUps).values({
      id: randomUUID(),
      clientId: q.clientId,
      quoteId: q.id,
      followUpCount: 0,
      nextFollowUpAt: twoDaysFromSent,
      status: "active",
    });
    console.log(`[QuoteFollowUp] Enrolled quote ${q.id} in follow-up sequence`);
  }

  // ── Step 3: Send due follow-ups ───────────────────────────────────────────────
  const dueFollowUps = await db
    .select({
      followUp: quoteFollowUps,
      quote: {
        id: quotes.id,
        quoteNumber: quotes.quoteNumber,
        jobTitle: quotes.jobTitle,
        customerName: quotes.customerName,
        customerEmail: quotes.customerEmail,
        customerPhone: quotes.customerPhone,
        totalAmount: quotes.totalAmount,
        validUntil: quotes.validUntil,
        customerToken: quotes.customerToken,
        status: quotes.status,
      },
      client: {
        id: crmClients.id,
        businessName: crmClients.businessName,
        pushToken: crmClients.pushToken,
      },
      profile: {
        tradingName: clientProfiles.tradingName,
        email: clientProfiles.email,
        phone: clientProfiles.phone,
      },
    })
    .from(quoteFollowUps)
    .leftJoin(quotes, eq(quoteFollowUps.quoteId, quotes.id))
    .leftJoin(crmClients, eq(quoteFollowUps.clientId, crmClients.id))
    .leftJoin(clientProfiles, eq(quoteFollowUps.clientId, clientProfiles.clientId))
    .where(
      and(
        eq(quoteFollowUps.status, "active"),
        lte(quoteFollowUps.nextFollowUpAt, now),
      ),
    );

  console.log(`[QuoteFollowUp] Found ${dueFollowUps.length} due follow-ups`);

  for (const row of dueFollowUps) {
    const { followUp, quote, client, profile } = row;
    if (!quote?.id || !client?.id) continue;
    // Skip if quote is no longer in sent status (accepted, declined, expired)
    if (quote.status !== "sent") {
      await db.update(quoteFollowUps).set({ status: "stopped", updatedAt: now }).where(eq(quoteFollowUps.id, followUp.id));
      continue;
    }

    const nextCount = followUp.followUpCount + 1;
    if (nextCount > 2) {
      // Sequence complete — stop
      await db.update(quoteFollowUps).set({ status: "stopped", updatedAt: now }).where(eq(quoteFollowUps.id, followUp.id));
      continue;
    }

    const businessName = profile?.tradingName ?? client.businessName ?? "Your Service Provider";
    const replyTo = profile?.email ?? undefined;
    const acceptUrl = `${process.env.QUOTE_PUBLIC_BASE_URL ?? "https://solvr.com.au"}/quote/${quote.customerToken}`;

    // ── Send email ──────────────────────────────────────────────────────────────
    if (quote.customerEmail) {
      const { subject, html } = buildFollowUpEmail({
        followUpCount: nextCount,
        quoteNumber: quote.quoteNumber,
        customerName: quote.customerName ?? "there",
        businessName,
        jobTitle: quote.jobTitle,
        totalAmount: quote.totalAmount ?? "0",
        validUntil: quote.validUntil ? String(quote.validUntil) : null,
        acceptUrl,
      });
      try {
        await sendEmail({ to: quote.customerEmail, subject, html, replyTo });
        console.log(`[QuoteFollowUp] Sent follow-up #${nextCount} email for quote ${quote.id}`);
      } catch (err) {
        console.error(`[QuoteFollowUp] Email failed for quote ${quote.id}:`, err);
      }
    }

    // ── Send SMS on follow-up #2 ────────────────────────────────────────────────
    if (nextCount === 2 && quote.customerPhone) {
      const smsBody = buildFollowUpSms({
        customerName: quote.customerName ?? "there",
        businessName,
        jobTitle: quote.jobTitle,
        acceptUrl,
      });
      try {
        await sendSms({ to: quote.customerPhone, body: smsBody });
        console.log(`[QuoteFollowUp] Sent follow-up SMS for quote ${quote.id}`);
      } catch (err) {
        console.error(`[QuoteFollowUp] SMS failed for quote ${quote.id}:`, err);
      }
    }

    // ── Push notification to tradie ─────────────────────────────────────────────
    if (client.pushToken) {
      await sendExpoPush({
        to: client.pushToken,
        title: `Follow-up sent — ${quote.quoteNumber}`,
        body: `Follow-up #${nextCount} sent to ${quote.customerName ?? "customer"} for ${quote.jobTitle}.`,
        data: { type: "quote_follow_up_sent", quoteId: quote.id },
      });
    }

    // ── Update follow-up record ─────────────────────────────────────────────────
    const nextFollowUpAt = nextCount === 1
      ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 more days for #2
      : null; // sequence ends after #2

    await db.update(quoteFollowUps).set({
      followUpCount: nextCount,
      lastFollowUpAt: now,
      nextFollowUpAt: nextFollowUpAt,
      status: nextCount >= 2 ? "stopped" : "active",
      updatedAt: now,
    }).where(eq(quoteFollowUps.id, followUp.id));
  }

  console.log(`[QuoteFollowUp] Cron complete`);
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function scheduleQuoteFollowUpCron(): void {
  // Run daily at 9am AEST (23:00 UTC)
  cron.schedule("0 23 * * *", async () => {
    try {
      await runQuoteFollowUpCron();
    } catch (err) {
      console.error("[QuoteFollowUp] Cron error:", err);
    }
  });
  console.log("[QuoteFollowUp] Cron scheduled — daily at 9am AEST");
}
