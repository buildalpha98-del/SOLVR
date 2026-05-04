/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalPhone — the Phone tab, Task 6.2 of Solvr Cloud Phone V2.
 *
 * Renders:
 * - Sticky cap banner (inbound-minute cap or past_due payment failure)
 * - Chronological call list grouped by Today / Yesterday / This Week / Earlier
 * - Per-card: direction, customer name, duration, intent badge, AI summary, time
 * - Empty state when no calls yet
 * - FAB (☎) → /portal/phone/dial (placeholder; DialPad built in Task 7.4)
 *
 * Tap any card → /portal/phone/<callLogId> (Task 6.3 builds the detail page).
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 6.2)
 * Spec: docs/specs/2026-04-27-solvr-cloud-phone-design.md § "JS layer / Phone tab"
 */
import { useMemo } from "react";
import { useLocation } from "wouter";
import { Loader2, Phone } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { ErrorState } from "@/components/portal/ErrorState";
import CallListCard from "@/components/phone/CallListCard";
import CapBanner from "@/components/phone/CapBanner";

// ─── Date grouping ─────────────────────────────────────────────────────────────

type Group = "Today" | "Yesterday" | "This Week" | "Earlier";

function getGroup(calledAt: Date | string): Group {
  const date = typeof calledAt === "string" ? new Date(calledAt) : calledAt;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - 6); // last 7 days including today

  const callDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (callDay.getTime() === today.getTime()) return "Today";
  if (callDay.getTime() === yesterday.getTime()) return "Yesterday";
  if (callDay.getTime() >= thisWeekStart.getTime()) return "This Week";
  return "Earlier";
}

const GROUP_ORDER: Group[] = ["Today", "Yesterday", "This Week", "Earlier"];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CallSkeleton() {
  return (
    <div
      className="rounded-xl px-4 py-3 min-h-[56px] animate-pulse"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-start gap-3">
        <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-1/3 rounded" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div className="h-3 w-2/3 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
        <div className="h-3 w-12 rounded flex-shrink-0 mt-0.5" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalPhone() {
  const [, navigate] = useLocation();

  // ── Data fetching (all hooks before any early return) ──────────────────────
  const {
    data: callsData,
    isLoading: callsLoading,
    error: callsError,
    refetch: refetchCalls,
  } = trpc.phone.listCalls.useQuery(
    { limit: 50 },
    { retry: 2, staleTime: 30_000 }
  );

  const {
    data: usageData,
    isLoading: usageLoading,
  } = trpc.phone.getUsage.useQuery(undefined, {
    retry: 2,
    staleTime: 30_000,
  });

  // ── Group calls by date ────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const items = callsData?.items ?? [];
    const map = new Map<Group, typeof items>();
    for (const call of items) {
      const g = getGroup(call.calledAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(call);
    }
    return map;
  }, [callsData]);

  const isLoading = callsLoading || usageLoading;
  const totalCalls = callsData?.total ?? 0;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <PortalLayout activeTab="phone">
      <div className="relative pb-24">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Phone</h1>
        </div>

        {/* ── Cap banner ──────────────────────────────────────────────────── */}
        {usageData?.hasNumber && (
          <CapBanner
            subscriptionStatus={usageData.subscriptionStatus}
            inboundMinutesUsed={usageData.inboundMinutesUsed}
            inboundCap={usageData.inboundCap}
            billingCycleStart={usageData.billingCycleStart}
          />
        )}

        {/* ── Error state ─────────────────────────────────────────────────── */}
        {callsError && !callsLoading && (
          <ErrorState
            error={callsError}
            onRetry={() => void refetchCalls()}
          />
        )}

        {/* ── Loading skeletons ────────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            <div className="h-4 w-16 rounded mb-2" style={{ background: "rgba(255,255,255,0.08)" }} />
            {[0, 1, 2].map((i) => <CallSkeleton key={i} />)}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!isLoading && !callsError && totalCalls === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(245,166,35,0.12)" }}
            >
              <Phone className="w-7 h-7" style={{ color: "#F5A623" }} />
            </div>
            <div>
              <p className="text-base font-semibold text-white/80">No calls yet</p>
              <p className="text-sm text-white/45 mt-1">
                Tap the dial button below to make your first call.
              </p>
            </div>
          </div>
        )}

        {/* ── Call list, grouped ───────────────────────────────────────────── */}
        {!isLoading && !callsError && totalCalls > 0 && (
          <div className="space-y-6">
            {GROUP_ORDER.filter((g) => grouped.has(g)).map((group) => {
              const calls = grouped.get(group)!;
              return (
                <section key={group}>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {group}
                  </p>
                  <div className="space-y-2">
                    {calls.map((call) => (
                      <CallListCard
                        key={call.id}
                        callLogId={call.id}
                        direction={call.direction}
                        customerName={null /* listCalls doesn't join customers — detail page does */}
                        customerPhone={call.customerPhone ?? null}
                        durationSeconds={call.durationSeconds ?? null}
                        aiIntent={call.aiIntent}
                        aiSummary={call.aiSummary ?? null}
                        calledAt={call.calledAt}
                        status={call.status}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* ── FAB — dial pad (Task 7.4 fills the actual dial pad) ─────────── */}
        <button
          className="fixed bottom-[80px] right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-xl z-30 transition-transform active:scale-95"
          style={{ background: "#F5A623" }}
          onClick={() => navigate("/portal/phone/dial")}
          aria-label="Open dial pad"
        >
          <Phone className="w-6 h-6" style={{ color: "#0F1F3D" }} />
        </button>
      </div>
    </PortalLayout>
  );
}
