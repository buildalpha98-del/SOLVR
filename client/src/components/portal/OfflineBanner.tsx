/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { useEffect, useState, useCallback } from "react";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getQueueCount, getQueue, dequeue, incrementAttempts, pruneStale } from "@/lib/offlineQueue";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Sticky offline banner that appears when connectivity drops.
 * Shows queued mutation count and auto-replays when back online.
 *
 * Place this inside PortalLayout so it's visible on every portal page.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  const utils = trpc.useUtils();

  // Poll queue count every second when offline
  useEffect(() => {
    if (isOnline) return;
    const interval = setInterval(() => {
      setQueueCount(getQueueCount());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // Auto-replay when coming back online
  const replayQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    setIsReplaying(true);
    let successCount = 0;
    let failCount = 0;

    // Prune items that have been retried too many times
    const stale = pruneStale(5);
    if (stale.length > 0) {
      failCount += stale.length;
    }

    const remaining = getQueue();
    for (const item of remaining) {
      try {
        // Use the tRPC client to replay the mutation
        // We need to resolve the procedure path dynamically
        const parts = item.procedure.split(".");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let proc: any = (utils.client as any);
        for (const part of parts) {
          proc = proc[part];
        }
        if (proc && typeof proc.mutate === "function") {
          await proc.mutate(item.input);
          dequeue(item.id);
          successCount++;
        } else {
          // Can't find the procedure — increment attempts
          incrementAttempts(item.id);
          failCount++;
        }
      } catch {
        incrementAttempts(item.id);
        failCount++;
      }
    }

    setIsReplaying(false);
    setQueueCount(getQueueCount());

    if (successCount > 0) {
      toast.success(`Synced ${successCount} queued action${successCount > 1 ? "s" : ""}`);
      // Invalidate all portal queries to refresh data
      utils.portal.invalidate();
      utils.invoiceChasing.invalidate();
    }
    if (failCount > 0 && getQueueCount() > 0) {
      toast.error(`${getQueueCount()} action${getQueueCount() > 1 ? "s" : ""} failed to sync — will retry`);
    }
  }, [utils]);

  // Detect reconnection and trigger replay
  useEffect(() => {
    if (isOnline && getQueueCount() > 0) {
      setJustReconnected(true);
      replayQueue();
      // Clear reconnected state after 3 seconds
      const timeout = setTimeout(() => setJustReconnected(false), 3000);
      return () => clearTimeout(timeout);
    }
    if (isOnline) {
      setJustReconnected(false);
    }
  }, [isOnline, replayQueue]);

  // Update queue count on mount
  useEffect(() => {
    setQueueCount(getQueueCount());
  }, []);

  // Don't show anything if online and no reconnection animation
  if (isOnline && !justReconnected && !isReplaying) return null;

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold transition-all duration-300"
      style={{
        background: isOnline ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        borderBottom: isOnline
          ? "1px solid rgba(34,197,94,0.3)"
          : "1px solid rgba(239,68,68,0.3)",
        color: isOnline ? "#22c55e" : "#ef4444",
      }}
    >
      {isOnline ? (
        <>
          {isReplaying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing {queueCount} queued action{queueCount !== 1 ? "s" : ""}…</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>Back online</span>
            </>
          )}
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>
            You're offline
            {queueCount > 0 && (
              <> · {queueCount} action{queueCount !== 1 ? "s" : ""} queued</>
            )}
          </span>
        </>
      )}
    </div>
  );
}
