/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { useEffect, useState, useCallback } from "react";
import { WifiOff, Wifi, Loader2, ChevronDown, RotateCw, AlertTriangle } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getQueueCount,
  getQueue,
  dequeue,
  incrementAttempts,
  pruneStale,
  type QueuedMutation,
} from "@/lib/offlineQueue";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Map a tRPC procedure path to a tradie-readable label so the queued-actions
 * list says "Job updated" instead of "portal.updateJob". The full path is
 * used as the lookup key; falls back to a humanised generic for unmapped
 * procedures so the banner never shows raw camelCase to the user.
 */
const PROCEDURE_LABELS: Record<string, string> = {
  "portal.createJob": "Job created",
  "portal.updateJob": "Job updated",
  "portal.updateJobDetail": "Job details saved",
  "portal.deleteJob": "Job deleted",
  "portal.addJobCostItem": "Job cost added",
  "portal.deleteJobCostItem": "Job cost removed",
  "portal.recordJobPayment": "Payment recorded",
  "portal.completeJob": "Job marked complete",
  "portalCustomers.createCustomer": "Customer added",
  "portalCustomers.updateCustomer": "Customer updated",
  "portalCustomers.deleteCustomer": "Customer deleted",
  "portalCustomers.toggleSmsOptOut": "SMS preference changed",
  "portal.createCalendarEvent": "Event added to calendar",
  "portal.updateCalendarEvent": "Event updated",
  "portal.deleteCalendarEvent": "Event deleted",
  "jobTasks.create": "Task added",
  "jobTasks.update": "Task updated",
  "jobTasks.delete": "Task deleted",
  "quotes.update": "Quote updated",
  "quotes.send": "Quote sent",
  "invoiceChasing.markPaid": "Invoice marked paid",
  "invoiceChasing.snooze": "Invoice snoozed",
};

function labelForProcedure(procedure: string): string {
  return (
    PROCEDURE_LABELS[procedure] ??
    // Fallback: humanise the procedure tail, e.g. "portal.foo.barBaz" → "Bar baz"
    procedure
      .split(".").pop()!
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, c => c.toUpperCase())
      .trim()
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

/**
 * Sticky offline banner that appears when connectivity drops or when there
 * are queued mutations waiting to sync. Tap to expand and see exactly what's
 * queued (in tradie-readable language). After a failed sync, surfaces a
 * Retry button so the user can re-attempt without waiting.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasFailures, setHasFailures] = useState(false);

  const utils = trpc.useUtils();

  const refreshQueue = useCallback(() => {
    setQueue(getQueue());
  }, []);

  // Poll queue every second when offline so the count stays live
  useEffect(() => {
    if (isOnline) return;
    refreshQueue();
    const interval = setInterval(refreshQueue, 1000);
    return () => clearInterval(interval);
  }, [isOnline, refreshQueue]);

  /**
   * Walk every queued mutation, replay through tRPC, dequeue on success,
   * incrementAttempts on failure. Stale items (≥5 attempts) are pruned
   * before each pass so we don't loop forever on a permanent failure.
   */
  const replayQueue = useCallback(async () => {
    const initial = getQueue();
    if (initial.length === 0) return;

    setIsReplaying(true);
    setHasFailures(false);
    let successCount = 0;
    let failCount = 0;

    const stale = pruneStale(5);
    if (stale.length > 0) failCount += stale.length;

    const remaining = getQueue();
    for (const item of remaining) {
      try {
        const parts = item.procedure.split(".");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let proc: any = (utils.client as any);
        for (const part of parts) proc = proc[part];
        if (proc && typeof proc.mutate === "function") {
          await proc.mutate(item.input);
          dequeue(item.id);
          successCount++;
        } else {
          incrementAttempts(item.id);
          failCount++;
        }
      } catch {
        incrementAttempts(item.id);
        failCount++;
      }
    }

    setIsReplaying(false);
    refreshQueue();

    if (successCount > 0) {
      toast.success(`Synced ${successCount} change${successCount > 1 ? "s" : ""}`);
      utils.portal.invalidate();
      utils.invoiceChasing.invalidate();
    }
    if (failCount > 0 && getQueueCount() > 0) {
      setHasFailures(true);
      toast.error(`${getQueueCount()} change${getQueueCount() > 1 ? "s" : ""} couldn't sync — tap the banner to retry.`);
    }
  }, [utils, refreshQueue]);

  // Auto-replay when reconnecting
  useEffect(() => {
    if (isOnline && getQueueCount() > 0) {
      setJustReconnected(true);
      replayQueue();
      const t = setTimeout(() => setJustReconnected(false), 3000);
      return () => clearTimeout(t);
    }
    if (isOnline) {
      setJustReconnected(false);
    }
  }, [isOnline, replayQueue]);

  // Initial queue load
  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const queueCount = queue.length;

  // Hide entirely when online with nothing to sync and no recent reconnect
  if (isOnline && !justReconnected && !isReplaying && queueCount === 0) return null;

  // ── State derivations ──────────────────────────────────────────────────
  const offline = !isOnline;
  const showFailureState = isOnline && hasFailures && queueCount > 0 && !isReplaying;

  let bg: string;
  let borderColor: string;
  let fg: string;
  if (showFailureState) {
    bg = "rgba(245,166,35,0.15)";
    borderColor = "rgba(245,166,35,0.35)";
    fg = "#F5A623";
  } else if (offline) {
    bg = "rgba(239,68,68,0.15)";
    borderColor = "rgba(239,68,68,0.3)";
    fg = "#ef4444";
  } else {
    bg = "rgba(34,197,94,0.15)";
    borderColor = "rgba(34,197,94,0.3)";
    fg = "#22c55e";
  }

  const canExpand = queueCount > 0;

  return (
    <div
      className="sticky top-0 z-50 transition-all duration-300"
      style={{ background: bg, borderBottom: `1px solid ${borderColor}`, color: fg }}
    >
      <button
        type="button"
        onClick={() => canExpand && setExpanded(e => !e)}
        disabled={!canExpand}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold"
        style={{ minHeight: 36, cursor: canExpand ? "pointer" : "default" }}
        aria-expanded={expanded}
      >
        {offline && (
          <>
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              You're offline — {queueCount === 0
                ? "your changes will save when you're back online"
                : `${queueCount} change${queueCount !== 1 ? "s" : ""} waiting to sync`}
            </span>
          </>
        )}
        {!offline && isReplaying && (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            <span>Syncing {queueCount} change{queueCount !== 1 ? "s" : ""}…</span>
          </>
        )}
        {!offline && !isReplaying && showFailureState && (
          <>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{queueCount} change{queueCount !== 1 ? "s" : ""} couldn't sync</span>
          </>
        )}
        {!offline && !isReplaying && !showFailureState && justReconnected && (
          <>
            <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Back online</span>
          </>
        )}
        {canExpand && (
          <ChevronDown
            className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        )}
      </button>

      {/* Expanded queue detail */}
      {expanded && canExpand && (
        <div className="px-4 pb-3 space-y-1.5" style={{ background: bg }}>
          <ul className="space-y-1 text-[11px]" style={{ color: fg }}>
            {queue.slice(0, 8).map(item => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <span className="font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {labelForProcedure(item.procedure)}
                </span>
                <span className="flex-shrink-0 text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {timeAgo(item.queuedAt)}
                  {item.attempts > 0 && ` · ${item.attempts} retr${item.attempts === 1 ? "y" : "ies"}`}
                </span>
              </li>
            ))}
            {queue.length > 8 && (
              <li className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                + {queue.length - 8} more
              </li>
            )}
          </ul>
          {/* Retry button visible when online (offline retry just queues failures back) */}
          {isOnline && !isReplaying && (
            <button
              type="button"
              onClick={() => { setHasFailures(false); replayQueue(); }}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold"
              style={{ background: fg, color: "#0F1F3D", minHeight: 36 }}
            >
              <RotateCw className="w-3 h-3" /> Retry now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
