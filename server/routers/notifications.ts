import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";

// ─── Booking Form Submission ─────────────────────────────────────────────────
const bookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  business: z.string().optional(),
  sector: z.string().min(1, "Industry is required"),
  message: z.string().optional(),
});

// ─── AI Audit Submission ─────────────────────────────────────────────────────
const auditSchema = z.object({
  email: z.string().email("Valid email required"),
  name: z.string().optional(),
  industry: z.string(),
  tier: z.string(), // "High", "Medium", "Low"
  score: z.number(),
  topWins: z.array(z.string()),
  quickWin: z.string(),
  roiEstimate: z.string(),
});

export const notificationsRouter = router({
  /**
   * Called when a visitor submits the booking form.
   * 1. Notifies the owner via Manus push notification
   * 2. Returns a success flag (email confirmation is handled client-side via toast)
   */
  submitBooking: publicProcedure
    .input(bookingSchema)
    .mutation(async ({ input }) => {
      const content = [
        `Name: ${input.name}`,
        `Email: ${input.email}`,
        `Business: ${input.business || "Not provided"}`,
        `Industry: ${input.sector}`,
        input.message ? `Message: ${input.message}` : null,
        ``,
        `Submitted at: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} AEST`,
      ]
        .filter(Boolean)
        .join("\n");

      const notified = await notifyOwner({
        title: `🎉 New Booking Request — ${input.name} (${input.sector})`,
        content,
      });

      return { success: true, notified };
    }),

  /**
   * Called when a visitor completes the AI Audit and submits their email.
   * 1. Notifies the owner via Manus push notification
   * 2. Returns success flag
   */
  submitAudit: publicProcedure
    .input(auditSchema)
    .mutation(async ({ input }) => {
      const content = [
        `Email: ${input.email}`,
        input.name ? `Name: ${input.name}` : null,
        `Industry: ${input.industry}`,
        `AI Readiness Tier: ${input.tier}`,
        `Score: ${input.score}/100`,
        ``,
        `Top AI Wins:`,
        ...input.topWins.map((w) => `  • ${w}`),
        ``,
        `Quick Win Recommendation: ${input.quickWin}`,
        `90-Day ROI Estimate: ${input.roiEstimate}`,
        ``,
        `Submitted at: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} AEST`,
      ]
        .filter(Boolean)
        .join("\n");

      const notified = await notifyOwner({
        title: `✦ AI Audit Completed — ${input.email} (${input.tier} Opportunity)`,
        content,
      });

      return { success: true, notified };
    }),
});
