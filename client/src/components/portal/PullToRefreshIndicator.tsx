/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { RefreshCw } from "lucide-react";

interface Props {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

/**
 * Visual indicator for pull-to-refresh.
 * Shows a spinner that rotates based on pull distance,
 * then animates continuously during refresh.
 */
export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: Props) {
  if (pullDistance === 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const ready = progress >= 1 || isRefreshing;

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{
        height: isRefreshing ? 48 : pullDistance,
        transition: pullDistance === 0 ? "height 0.3s ease" : "none",
      }}
    >
      <div className="flex items-center gap-2">
        <RefreshCw
          className={`w-5 h-5 text-amber-400 ${isRefreshing ? "animate-spin" : ""}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
            opacity: Math.max(progress, 0.3),
            transition: "transform 0.1s ease",
          }}
        />
        <span
          className="text-xs font-medium"
          style={{
            color: ready ? "#F5A623" : "rgba(255,255,255,0.5)",
            opacity: progress,
          }}
        >
          {isRefreshing ? "Refreshing…" : ready ? "Release to refresh" : "Pull to refresh"}
        </span>
      </div>
    </div>
  );
}
