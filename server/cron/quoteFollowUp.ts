/**
 * Quote Follow-Up Cron Job
 *
 * Runs every day at 9:00 AM AEST (23:00 UTC previous day).
 * For each sent quote that hasn't been responded to, sends automated
 * follow-ups (email + SMS) and marks expired quotes.
 *
 * Sequence (days since sentAt — Sprint 2.2 spec):
 *   Day 3  → Follow-up #1: "Just checking in" email + SMS
 *   Day 7  → Follow-up #2: "Still interested?" email + SMS
 *   Day 14 → Follow-up #3: "Last chance" email + SMS
 *   validUntil expiry → Mark quote as expired, notify tradie
 *
 * SMS goes through sendSmsAndLog so it appears in the threaded inbox
 * tagged sentBy='system' — tradie sees exactly what auto-fired and
 * can monitor replies in one place.
 *
 * Cron expression: 0 23 * * * (11pm UTC = 9am AEST)
 */
import cron from "node-cron";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import { sendSmsAndLog } from "../lib/sms";
import { sendExpoPush } from "../expoPush";
import { quotes, quoteFollowUps, crmClients, clientProfiles } from "../../drizzle/schema";
import { and, eq, lte, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// ── Sequence timing (days from sentAt) ───────────────────────────────────────
const FOLLOW_UP_DAYS = [3, 7, 14] as const;
const MAX_FOLLOW_UPS = FOLLOW_UP_DAYS.length;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Look up sentAt for a quote — used by the follow-up scheduler so each
 * step's nextFollowUpAt is anchored to the original send time, not to
 * the cron run that just executed step N.
 */
async function getQuoteSentAt(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  quoteId: string,
): Promise<Date | null> {
  const rows = await db.select({ sentAt: quotes.sentAt }).from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  return rows[0]?.sentAt ?? null;
}

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

  // Map followUpCount → (subject, lead headline, opening line, urgency tone)
  const stages: Record<number, { subject: string; headline: string | null; opening: string; closing: string }> = {
    1: {
      subject: `Quick follow-up — Quote ${quoteNumber} from ${businessName}`,
      headline: null,
      opening: `Just checking in on the quote we sent you for <strong>${jobTitle}</strong>.`,
      closing: `If you have any questions or would like to discuss the scope, please reply to this email — we're happy to help.`,
    },
    2: {
      subject: `Still interested? — Quote ${quoteNumber} from ${businessName}`,
      headline: null,
      opening: `We wanted to follow up on your quote for <strong>${jobTitle}</strong> — still keen to go ahead?`,
      closing: `Happy to adjust scope or pricing if something's not quite right. Just hit reply.`,
    },
    3: {
      subject: `Last chance — Quote ${quoteNumber} from ${businessName}`,
      headline: "⏰ Last chance — your quote is about to expire",
      opening: `Final follow-up — your quote for <strong>${jobTitle}</strong> expires soon.`,
      closing: `If you've decided not to proceed, no worries — just let us know and we'll close this off. Otherwise, we'd love to get started on your job.`,
    },
  };
  const stage = stages[followUpCount] ?? stages[1];
  const isUrgent = followUpCount >= 3;
  const tableBg = isUrgent ? "#fff8e6" : "#f5f5f5";
  const tableBorder = isUrgent ? "#F5A623" : "#e0e0e0";

  return {
    subject: stage.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        ${stage.headline ? `
        <div style="background: #F5A623; color: #0F1F3D; padding: 16px; border-radius: 4px 4px 0 0; text-align: center;">
          <strong>${stage.headline}</strong>
        </div>` : ""}
        <div style="${isUrgent ? "border: 2px solid #F5A623; padding: 24px;" : ""}">
          <p>Hi ${customerName},</p>
          <p>${stage.opening}</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr style="background: ${tableBg};">
              <td style="padding: 12px; border: 1px solid ${tableBorder};"><strong>Quote Number</strong></td>
              <td style="padding: 12px; border: 1px solid ${tableBorder};">${quoteNumber}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid ${tableBorder};"><strong>Job</strong></td>
              <td style="padding: 12px; border: 1px solid ${tableBorder};">${jobTitle}</td>
            </tr>
            <tr style="background: ${tableBg};">
              <td style="padding: 12px; border: 1px solid ${tableBorder};"><strong>Total (inc. GST)</strong></td>
              <td style="padding: 12px; border: 1px solid ${tableBorder};"><strong>${formattedAmount}</strong></td>
            </tr>
          </table>
          <p>${expiryText}</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${acceptUrl}" style="background: #F5A623; color: #0F1F3D; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">${isUrgent ? "Accept Quote Now" : "View &amp; Accept Quote"}</a>
          </p>
          <p>${stage.closing}</p>
          <p>Kind regards,<br><strong>${businessName}</strong></p>
        </div>
      </div>
    `,
  };
}

function buildFollowUpSms(opts: {
  followUpCount: number;
  customerName: string;
  businessName: string;
  jobTitle: string;
  acceptUrl: string;
}): string {
  const { followUpCount, customerName, businessName, jobTitle, acceptUrl } = opts;
  const firstName = customerName.split(" ")[0];
  if (followUpCount === 1) {
    return `Hi ${firstName}, ${businessName} here — just checking in on the quote for ${jobTitle}. View/accept: ${acceptUrl}`;
  }
  if (followUpCount === 2) {
    return `Hi ${firstName}, still interested in your ${jobTitle} quote? Happy to chat if anything needs adjusting: ${acceptUrl}`;
  }
  // followUpCount === 3 — last chance
  return `Hi ${firstName}, last reminder — your ${jobTitle} quote is expiring soon. Accept: ${acceptUrl}`;
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

  // ── Step 2: Enrol newly sent quotes into follow-up sequence ──────────────
  // Find sent quotes that have no follow-up record yet. Enrol everything
  // that's still "sent" — the cron picks up the first follow-up only when
  // nextFollowUpAt arrives (sentAt + 3 days), so there's no "blast a fresh
  // quote" risk.
  const sentQuotes = await db
    .select({ id: quotes.id, clientId: quotes.clientId, sentAt: quotes.sentAt })
    .from(quotes)
    .where(eq(quotes.status, "sent"));

  const existingFollowUpIds = sentQuotes.length > 0
    ? (await db
        .select({ quoteId: quoteFollowUps.quoteId })
        .from(quoteFollowUps)
        .where(inArray(quoteFollowUps.quoteId, sentQuotes.map(q => q.id))))
        .map(r => r.quoteId)
    : [];

  const toEnrol = sentQuotes.filter(q => !existingFollowUpIds.includes(q.id));
  for (const q of toEnrol) {
    const firstFollowUpAt = new Date((q.sentAt ?? now).getTime() + FOLLOW_UP_DAYS[0] * DAY_MS);
    await db.insert(quoteFollowUps).values({
      id: randomUUID(),
      clientId: q.clientId,
      quoteId: q.id,
      followUpCount: 0,
      nextFollowUpAt: firstFollowUpAt,
      status: "active",
    });
    console.log(`[QuoteFollowUp] Enrolled quote ${q.id} in follow-up sequence (first nudge: ${firstFollowUpAt.toISOString()})`);
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
    if (nextCount > MAX_FOLLOW_UPS) {
      // Sequence complete — stop
      await db.update(quoteFollowUps).set({ status: "stopped", updatedAt: now }).where(eq(quoteFollowUps.id, followUp.id));
      continue;
    }

    const businessName = profile?.tradingName ?? client.businessName ?? "Your Service Provider";
    const replyTo = profile?.email ?? undefined;
    const acceptUrl = `${process.env.QUOTE_PUBLIC_BASE_URL ?? "https://solvr.com.au"}/quote/${quote.customerToken}`;

    // ── Send email ──────────────────────────────────────────────────────────
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

    // ── Send SMS on EVERY follow-up step via the threaded inbox path ─────────
    // sendSmsAndLog routes the message into sms_conversations so the tradie
    // sees the auto-fired SMS in the inbox alongside customer replies.
    if (quote.customerPhone) {
      const smsBody = buildFollowUpSms({
        followUpCount: nextCount,
        customerName: quote.customerName ?? "there",
        businessName,
        jobTitle: quote.jobTitle,
        acceptUrl,
      });
      try {
        await sendSmsAndLog({
          to: quote.customerPhone,
          body: smsBody,
          clientId: client.id,
          customerName: quote.customerName ?? null,
          sentBy: "system",
          relatedQuoteId: quote.id,
        });
        console.log(`[QuoteFollowUp] Sent follow-up #${nextCount} SMS for quote ${quote.id}`);
      } catch (err) {
        console.error(`[QuoteFollowUp] SMS failed for quote ${quote.id}:`, err);
      }
    }

    // ── Push notification to tradie ─────────────────────────────────────────
    if (client.pushToken) {
      await sendExpoPush({
        to: client.pushToken,
        title: `Follow-up sent — ${quote.quoteNumber}`,
        body: `Follow-up #${nextCount}/${MAX_FOLLOW_UPS} sent to ${quote.customerName ?? "customer"} for ${quote.jobTitle}.`,
        data: { type: "quote_follow_up_sent", quoteId: quote.id },
      });
    }

    // ── Update follow-up record ─────────────────────────────────────────────
    // Schedule next follow-up based on the absolute day-X-from-sentAt
    // schedule, not "now + N days" — keeps the cadence stable even if a
    // cron run is delayed.
    const sentAt = quote.id ? (await getQuoteSentAt(db, quote.id)) ?? now : now;
    const isLastStep = nextCount >= MAX_FOLLOW_UPS;
    const nextFollowUpAt = isLastStep
      ? null
      : new Date(sentAt.getTime() + FOLLOW_UP_DAYS[nextCount] * DAY_MS);

    await db.update(quoteFollowUps).set({
      followUpCount: nextCount,
      lastFollowUpAt: now,
      nextFollowUpAt: nextFollowUpAt,
      status: isLastStep ? "stopped" : "active",
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
