/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Calls — AI-handled call list.
 *
 * AI-wedge UX: every call surfaces its LLM summary inline and "Convert to job"
 * is a one-tap 44pt chip. Default filter is "Needs action" (calls without a
 * confirmed booking) so tradies land on the actionable pile, not the archive.
 */
import { useCallback, useMemo, useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Phone, Search, Loader2, Sparkles } from "lucide-react";
import { ErrorState } from "@/components/portal/ErrorState";
import CallCard, { type CallCardData } from "@/components/portal/CallCard";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/portal/PullToRefreshIndicator";

type Filter = "needs-action" | "all";

export default function PortalCalls() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("needs-action");

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(
      (window as unknown as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer,
    );
    (window as unknown as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer =
      setTimeout(() => setDebouncedSearch(val), 300);
  };

  const { data, isLoading, error: callsError, refetch: refetchCalls } =
    trpc.portal.listCalls.useQuery(
      { search: debouncedSearch || undefined, limit: 50, offset: 0 },
      { staleTime: 30_000, retry: 2 },
    );

  const { data: me } = trpc.portal.me.useQuery(undefined, {
    staleTime: 30_000,
    retry: 2,
  });
  const canCreateJobs = me?.features?.includes("jobs") ?? false;

  const allCalls = (data?.calls ?? []) as CallCardData[];
  const needsActionCount = useMemo(
    () => allCalls.filter((c) => !(c.body?.includes("BOOKING_CONFIRMED:") ?? false)).length,
    [allCalls],
  );

  const visibleCalls =
    filter === "needs-action"
      ? allCalls.filter(
          (c) => !(c.body?.includes("BOOKING_CONFIRMED:") ?? false),
        )
      : allCalls;

  // Pull-to-refresh
  const handlePullRefresh = useCallback(async () => {
    await refetchCalls();
  }, [refetchCalls]);
  const { containerRef: ptrContainerRef, pullDistance, isRefreshing: isPullRefreshing } = usePullToRefresh({
    onRefresh: handlePullRefresh,
  });

  return (
    <PortalLayout activeTab="calls">
      <div ref={ptrContainerRef} style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPullRefreshing} />
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">Calls</h1>
            <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#F5A623" }} />
              Handled by your AI receptionist — every call summarised automatically.
            </p>
          </div>
          {data && (
            <span className="text-sm flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>
              {data.total} total
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div
          className="inline-flex p-1 rounded-xl"
          style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            type="button"
            onClick={() => setFilter("needs-action")}
            className="flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold transition-all"
            style={{
              minHeight: "44px",
              background: filter === "needs-action" ? "#F5A623" : "transparent",
              color: filter === "needs-action" ? "#0F1F3D" : "rgba(255,255,255,0.6)",
            }}
          >
            Needs action
            {needsActionCount > 0 && (
              <span
                className="px-1.5 rounded-full text-[10px] font-bold"
                style={{
                  background: filter === "needs-action" ? "rgba(15,31,61,0.2)" : "rgba(245,166,35,0.15)",
                  color: filter === "needs-action" ? "#0F1F3D" : "#F5A623",
                }}
              >
                {needsActionCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="px-4 rounded-lg text-xs font-semibold transition-all"
            style={{
              minHeight: "44px",
              background: filter === "all" ? "#F5A623" : "transparent",
              color: filter === "all" ? "#0F1F3D" : "rgba(255,255,255,0.6)",
            }}
          >
            All calls
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "rgba(255,255,255,0.3)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search calls, callers, job types…"
            className="w-full pl-9 pr-4 rounded-xl text-sm outline-none"
            style={{
              minHeight: "44px",
              background: "#0F1F3D",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
            }}
          />
        </div>

        {/* Call list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F5A623" }} />
          </div>
        ) : callsError ? (
          <ErrorState error={callsError} onRetry={() => refetchCalls()} />
        ) : visibleCalls.length === 0 ? (
          <div className="text-center py-16">
            <Phone
              className="w-12 h-12 mx-auto mb-4 opacity-20"
              style={{ color: "rgba(255,255,255,0.3)" }}
            />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {search
                ? "No calls match your search."
                : filter === "needs-action"
                ? "Nothing to action right now — every call has a confirmed booking."
                : "No calls yet — they'll appear here once your AI receptionist goes live."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleCalls.map((call) => (
              <CallCard key={call.id} call={call} canCreateJobs={canCreateJobs} />
            ))}
          </div>
        )}
      </div>
      </div>
    </PortalLayout>
  );
}
