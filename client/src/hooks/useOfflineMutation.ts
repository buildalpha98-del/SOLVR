/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { useOnlineStatus } from "./useOnlineStatus";
import { enqueue } from "@/lib/offlineQueue";
import { toast } from "sonner";
import { hapticLight } from "@/lib/haptics";

/**
 * Returns a wrapper function that either calls the mutation directly (online)
 * or queues it for later replay (offline).
 *
 * Usage:
 *   const offlineAware = useOfflineMutation();
 *   // In your click handler:
 *   offlineAware("portal.updateJob", input, () => mutation.mutate(input));
 */
export function useOfflineMutation() {
  const isOnline = useOnlineStatus();

  return function offlineAwareMutate(
    /** tRPC procedure path for queue replay, e.g. "portal.updateJob" */
    procedure: string,
    /** The mutation input (must be JSON-serialisable) */
    input: unknown,
    /** The actual mutation call to execute when online */
    onlineFn: () => void
  ) {
    if (isOnline) {
      onlineFn();
    } else {
      enqueue(procedure, input);
      hapticLight();
      toast.info("Saved offline — will sync when you're back online", {
        icon: "📡",
        duration: 2000,
      });
    }
  };
}
