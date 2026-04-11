/**
 * Cron: Review Request Dispatch
 *
 * Runs every 5 minutes. Finds all google_review_requests rows with
 * status = 'pending' and scheduledSendAt <= now, then dispatches them.
 */
import { processScheduledReviewRequests } from "../googleReview";

let running = false;

export function scheduleReviewRequestDispatchCron(): void {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const tick = async () => {
    if (running) return; // prevent overlap
    running = true;
    try {
      await processScheduledReviewRequests();
    } catch (err) {
      console.error("[ReviewRequestCron] Unexpected error:", err);
    } finally {
      running = false;
    }
  };

  // Run once on startup (catches any requests that were pending before restart)
  setTimeout(tick, 15_000);

  // Then every 5 minutes
  setInterval(tick, INTERVAL_MS);
  console.log("[ReviewRequestCron] Scheduled — runs every 5 minutes");
}
