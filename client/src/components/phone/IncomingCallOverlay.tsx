/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * IncomingCallOverlay — full-screen in-app overlay shown when a call arrives
 * while the user is already in the foreground.
 *
 * CallKit handles the lock-screen / backgrounded-app ring on iOS;
 * this component handles the case where the user is already in the app.
 *
 * Renders only when useSolvrPhone().state === "incoming".
 * Returns null for all other states.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 7.1)
 */
import { useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useSolvrPhone } from "@/hooks/useSolvrPhone";

export function IncomingCallOverlay() {
  const { state, incoming, accept, reject } = useSolvrPhone();
  const [busy, setBusy] = useState(false);

  // Only render when an incoming call is waiting.
  if (state !== "incoming") return null;

  const displayName = incoming?.customerName ?? "Unknown caller";
  const displayNumber = incoming?.fromNumber ?? "";
  const hasContext =
    incoming != null &&
    (incoming.activeJob != null || incoming.openQuotes.length > 0);

  async function handleAccept() {
    if (busy) return;
    setBusy(true);
    try {
      await accept();
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (busy) return;
    setBusy(true);
    try {
      await reject();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between"
      style={{
        background: "linear-gradient(160deg, #0F1F3D 0%, #0B1629 60%, #0a1220 100%)",
        paddingTop: "env(safe-area-inset-top, 40px)",
        paddingBottom: "env(safe-area-inset-bottom, 32px)",
      }}
    >
      {/* ── Top section — label ─────────────────────────────────────── */}
      <div className="w-full flex flex-col items-center pt-12">
        <p
          className="text-sm font-medium tracking-widest uppercase"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Incoming call
        </p>
      </div>

      {/* ── Middle section — avatar + caller info + context ────────── */}
      <div className="flex flex-col items-center gap-4 px-8 w-full">
        {/* Animated phone icon */}
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 96,
            height: 96,
            background: "rgba(245,166,35,0.15)",
          }}
        >
          {/* Pulse rings */}
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: "rgba(245,166,35,0.12)", animationDuration: "1.4s" }}
          />
          <span
            className="absolute inset-[-10px] rounded-full animate-ping"
            style={{ background: "rgba(245,166,35,0.07)", animationDuration: "1.8s", animationDelay: "0.3s" }}
          />
          <Phone
            className="relative"
            style={{ width: 40, height: 40, color: "#F5A623" }}
          />
        </div>

        {/* Caller name */}
        <div className="text-center">
          <p
            className="text-3xl font-bold leading-tight"
            style={{ color: "#F5F5F0" }}
          >
            {displayName}
          </p>
          {displayNumber && (
            <p
              className="mt-1.5 text-lg font-medium"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {displayNumber}
            </p>
          )}
        </div>

        {/* Active context block — hidden when no job or quotes */}
        {hasContext && (
          <div
            className="w-full max-w-xs rounded-2xl px-5 py-4 mt-2"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <p
              className="text-[11px] uppercase tracking-widest font-semibold mb-2"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Active context
            </p>
            <ul className="space-y-1.5">
              {incoming?.activeJob && (
                <li
                  className="text-sm font-medium flex items-start gap-2"
                  style={{ color: "rgba(255,255,255,0.80)" }}
                >
                  <span style={{ color: "#F5A623" }}>•</span>
                  {incoming.activeJob.jobType
                    ? `${incoming.activeJob.jobType} (Job #${incoming.activeJob.id})`
                    : `Job #${incoming.activeJob.id}`}
                </li>
              )}
              {incoming?.openQuotes.map((q) => (
                <li
                  key={q.id}
                  className="text-sm font-medium flex items-start gap-2"
                  style={{ color: "rgba(255,255,255,0.80)" }}
                >
                  <span style={{ color: "#F5A623" }}>•</span>
                  Open quote: {q.quoteNumber || q.id}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Bottom section — decline + accept ──────────────────────── */}
      <div className="flex items-end justify-around w-full max-w-xs px-4 pb-4">
        {/* Decline */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleReject}
            disabled={busy}
            aria-label="Decline call"
            className="flex items-center justify-center rounded-full transition-opacity active:opacity-70 disabled:opacity-40"
            style={{
              width: 60,
              height: 60,
              minWidth: 60,
              minHeight: 60,
              background: "#EF4444",
            }}
          >
            <PhoneOff style={{ width: 26, height: 26, color: "#fff" }} />
          </button>
          <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
            Decline
          </p>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleAccept}
            disabled={busy}
            aria-label="Accept call"
            className="flex items-center justify-center rounded-full transition-opacity active:opacity-70 disabled:opacity-40"
            style={{
              width: 60,
              height: 60,
              minWidth: 60,
              minHeight: 60,
              background: "#22C55E",
            }}
          >
            <Phone style={{ width: 26, height: 26, color: "#fff" }} />
          </button>
          <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
            Accept
          </p>
        </div>
      </div>
    </div>
  );
}
