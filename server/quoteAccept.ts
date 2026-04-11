/**
 * Quote acceptance endpoint — public GET route.
 *
 * When a client clicks "Accept this Quote" in the PDF or email, they land on
 * /quote/:token (the React SPA page). That page also fires a lightweight
 * server-side call to this endpoint to record the acceptance:
 *
 *   GET /api/quotes/:token/accept
 *
 * Actions:
 *  1. Look up the quote by customerToken
 *  2. If status is already 'accepted' → return 200 (idempotent)
 *  3. Set status = 'accepted', respondedAt = now
 *  4. Fire a web push notification to the tradie
 *  5. Return { success: true, quoteNumber, jobTitle }
 */
import { Router } from "express";
import {
  getQuoteByToken,
  updateQuote,
  getCrmClientById,
} from "./db";
import { sendPushToClient } from "./pushNotifications";

export const quoteAcceptRouter = Router();

quoteAcceptRouter.get("/quotes/:token/accept", async (req, res) => {
  const { token } = req.params;

  if (!token || token.length < 16) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  try {
    const quote = await getQuoteByToken(token);

    if (!quote) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    // Idempotent — already accepted
    if (quote.status === "accepted") {
      res.json({
        success: true,
        alreadyAccepted: true,
        quoteNumber: quote.quoteNumber,
        jobTitle: quote.jobTitle,
      });
      return;
    }

    // Reject if the quote is in a terminal state that can't be accepted
    if (["declined", "expired", "cancelled"].includes(quote.status)) {
      res.status(409).json({
        error: `Quote cannot be accepted — current status is '${quote.status}'`,
        status: quote.status,
      });
      return;
    }

    // Flip status to accepted
    await updateQuote(quote.id, {
      status: "accepted",
      respondedAt: new Date(),
    });

    // Fire push notification to the tradie (best-effort — don't fail the response)
    try {
      const client = await getCrmClientById(quote.clientId);
      if (client) {
        const businessName = client.quoteTradingName || client.businessName || "Your business";
        await sendPushToClient(quote.clientId, {
          title: "Quote Accepted! 🎉",
          body: `${quote.customerName ?? "A client"} accepted ${quote.quoteNumber} — ${quote.jobTitle}`,
          url: `/portal/quotes`,
          icon: "/icon-192.png",
        });
        console.log(
          `[QuoteAccept] ${quote.quoteNumber} accepted by ${quote.customerName ?? "unknown"} — push sent to client ${client.id} (${businessName})`
        );
      }
    } catch (pushErr) {
      // Push failure should never block the acceptance response
      console.error("[QuoteAccept] Push notification failed:", pushErr);
    }

    res.json({
      success: true,
      alreadyAccepted: false,
      quoteNumber: quote.quoteNumber,
      jobTitle: quote.jobTitle,
    });
  } catch (err) {
    console.error("[QuoteAccept] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
