/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { useRef, useEffect, useCallback, useState } from "react";

interface PullToRefreshOptions {
  /** Async function to call on pull-to-refresh */
  onRefresh: () => Promise<void>;
  /** Pull distance (px) required to trigger refresh. Default 80 */
  threshold?: number;
  /** Max pull distance (px). Default 120 */
  maxPull?: number;
  /** Whether pull-to-refresh is enabled. Default true */
  enabled?: boolean;
}

interface PullToRefreshReturn {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Current pull distance (0 when not pulling) */
  pullDistance: number;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Props to spread on the pull indicator wrapper */
  indicatorStyle: React.CSSProperties;
}

/**
 * Native-feeling pull-to-refresh for mobile web apps.
 * Attach `containerRef` to the scrollable container.
 * Only activates when scrolled to the top (scrollTop <= 0).
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  enabled = true,
}: PullToRefreshOptions): PullToRefreshReturn {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track touch state without re-renders
  const touchState = useRef({
    startY: 0,
    pulling: false,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch {
      // silently fail — the query error handling will surface issues
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      // Only start pull if scrolled to top
      if (el!.scrollTop > 0) return;
      touchState.current.startY = e.touches[0].clientY;
      touchState.current.pulling = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!touchState.current.pulling) return;
      const deltaY = e.touches[0].clientY - touchState.current.startY;

      // Only pull downward
      if (deltaY <= 0) {
        setPullDistance(0);
        return;
      }

      // Dampen the pull (rubber-band feel)
      const dampened = Math.min(deltaY * 0.5, maxPull);
      setPullDistance(dampened);

      // Prevent native scroll while pulling
      if (dampened > 10) {
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      if (!touchState.current.pulling) return;
      touchState.current.pulling = false;

      if (pullDistance >= threshold && !isRefreshing) {
        handleRefresh();
      } else {
        setPullDistance(0);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, threshold, maxPull, pullDistance, isRefreshing, handleRefresh]);

  const indicatorStyle: React.CSSProperties = {
    transform: `translateY(${pullDistance}px)`,
    transition: pullDistance === 0 && !isRefreshing ? "transform 0.3s ease" : "none",
  };

  return { containerRef, pullDistance, isRefreshing, indicatorStyle };
}
