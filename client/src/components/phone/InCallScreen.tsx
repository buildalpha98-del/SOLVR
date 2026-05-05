/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * InCallScreen — full-screen overlay shown while a call is connecting or connected.
 *
 * Renders only when useSolvrPhone().state === "connecting" | "connected".
 * Returns null for all other states.
 *
 * Layout:
 * - Header: customer name + live duration timer (MM:SS) or "Connecting…"
 * - Active context panel: open quote + active job (hidden when neither exists)
 * - Controls: Mute / Speaker / Keypad (60×60 each), sticky red End button
 *
 * Duration timer uses setInterval via useRef to avoid setState chains on
 * every tick — only the formatted string triggers a re-render.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 7.2)
 */
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Grid3X3, PhoneOff } from "lucide-react";
import { useSolvrPhone } from "@/hooks/useSolvrPhone";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Keypad placeholder modal ──────────────────────────────────────────────────

function KeypadModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
      />
      {/* Sheet */}
      <div
        className="relative w-full max-w-sm rounded-t-2xl px-6 py-8 flex flex-col items-center gap-4"
        style={{
          background: "#0F1F3D",
          border: "1px solid rgba(255,255,255,0.10)",
          paddingBottom: "env(safe-area-inset-bottom, 24px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="w-10 h-1 rounded-full"
          style={{ background: "rgba(255,255,255,0.2)" }}
        />
        <p
          className="text-base font-semibold"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          Keypad coming in V2.5
        </p>
        <p
          className="text-sm text-center"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          DTMF tone entry will be available in the next feature release.
        </p>
        <button
          onClick={onClose}
          className="mt-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity active:opacity-70"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Control button ────────────────────────────────────────────────────────────

interface ControlButtonProps {
  onPress: () => void;
  active?: boolean;
  activeBackground?: string;
  ariaLabel: string;
  label: string;
  children: React.ReactNode;
}

function ControlButton({ onPress, active, activeBackground, ariaLabel, label, children }: ControlButtonProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onPress}
        aria-label={ariaLabel}
        aria-pressed={active}
        className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
        style={{
          width: 60,
          height: 60,
          minWidth: 60,
          minHeight: 60,
          background: active && activeBackground ? activeBackground : "rgba(255,255,255,0.12)",
        }}
      >
        {children}
      </button>
      <p
        className="text-xs font-medium"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {label}
      </p>
    </div>
  );
}

// ── InCallScreen ──────────────────────────────────────────────────────────────

export function InCallScreen() {
  const { state, incoming, activeCall, mute, speaker, hangUp } = useSolvrPhone();

  // Local UI state
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);

  // Live duration — stored in a ref so setInterval doesn't cause stale closure
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync displayed seconds from activeCall.durationSeconds when connected
  useEffect(() => {
    if (state === "connected" && activeCall != null) {
      // Seed with whatever the hook already has (for re-renders mid-call)
      setDisplaySeconds(activeCall.durationSeconds);

      const id = setInterval(() => {
        setDisplaySeconds((prev) => prev + 1);
      }, 1000);
      intervalRef.current = id;

      return () => clearInterval(id);
    } else {
      // Not connected — clear any running timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplaySeconds(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Reset controls when a new call begins
  useEffect(() => {
    if (state === "connecting" || state === "connected") {
      setMuted(false);
      setSpeakerOn(false);
      setKeypadOpen(false);
    }
  }, [state]);

  // Only render during an active call
  if (state !== "connecting" && state !== "connected") return null;

  // Derived display values
  const displayName = incoming?.customerName ?? "Unknown caller";
  const displayNumber = incoming?.fromNumber ?? "";

  const hasContext =
    incoming != null &&
    (incoming.activeJob != null || incoming.openQuotes.length > 0);

  const firstQuote = incoming?.openQuotes[0] ?? null;

  const statusLine =
    state === "connecting"
      ? "Connecting…"
      : formatDuration(displaySeconds);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleMute() {
    const next = !muted;
    setMuted(next);
    try {
      await mute(next);
    } catch {
      // Revert on error
      setMuted(!next);
    }
  }

  async function handleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    try {
      await speaker(next);
    } catch {
      // Revert on error
      setSpeakerOn(!next);
    }
  }

  async function handleHangUp() {
    try {
      await hangUp();
    } catch {
      // Error toast handled in the hook
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-between"
        style={{
          background: "linear-gradient(160deg, #0F1F3D 0%, #0B1629 60%, #0a1220 100%)",
          paddingTop: "env(safe-area-inset-top, 40px)",
          paddingBottom: "env(safe-area-inset-bottom, 32px)",
        }}
      >
        {/* ── Top label ─────────────────────────────────────────────────── */}
        <div className="w-full flex flex-col items-center pt-12">
          <p
            className="text-sm font-medium tracking-widest uppercase"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {state === "connecting" ? "Connecting" : "On call"}
          </p>
        </div>

        {/* ── Middle — caller info + context ────────────────────────────── */}
        <div className="flex flex-col items-center gap-4 px-8 w-full">
          {/* Name */}
          <p
            className="text-4xl font-bold text-center leading-tight"
            style={{ color: "#F5F5F0" }}
          >
            {displayName}
          </p>

          {/* Status / duration */}
          <p
            className="text-2xl font-semibold tabular-nums"
            style={{ color: state === "connecting" ? "rgba(255,255,255,0.45)" : "#F5A623" }}
          >
            {statusLine}
          </p>

          {/* Phone number */}
          {displayNumber && (
            <p
              className="text-base font-medium"
              style={{ color: "rgba(255,255,255,0.50)" }}
            >
              {displayNumber}
            </p>
          )}

          {/* Active context block */}
          {hasContext && (
            <div
              className="w-full max-w-xs rounded-2xl px-5 py-4 mt-2"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <p
                className="text-[11px] uppercase tracking-widest font-semibold mb-3"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Active context
              </p>
              <ul className="space-y-2">
                {firstQuote && (
                  <li
                    className="text-sm font-medium flex items-start gap-2"
                    style={{ color: "rgba(255,255,255,0.80)" }}
                  >
                    <span style={{ color: "#F5A623" }}>📋</span>
                    Open quote: {firstQuote.quoteNumber || firstQuote.id}
                    {firstQuote.totalCents > 0 && ` (${formatCents(firstQuote.totalCents)})`}
                  </li>
                )}
                {incoming?.activeJob && (
                  <li
                    className="text-sm font-medium flex items-start gap-2"
                    style={{ color: "rgba(255,255,255,0.80)" }}
                  >
                    <span style={{ color: "#F5A623" }}>🔨</span>
                    {incoming.activeJob.jobType
                      ? `Active job: ${incoming.activeJob.jobType} (#${incoming.activeJob.id})`
                      : `Active job: #${incoming.activeJob.id}`}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="w-full max-w-xs px-4 flex flex-col items-center gap-8">
          {/* Row: Mute / Speaker / Keypad */}
          <div className="flex items-end justify-around w-full">
            <ControlButton
              onPress={handleMute}
              active={muted}
              activeBackground="rgba(245,166,35,0.25)"
              ariaLabel={muted ? "Unmute" : "Mute"}
              label={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <MicOff style={{ width: 26, height: 26, color: "#F5A623" }} />
              ) : (
                <Mic style={{ width: 26, height: 26, color: "#fff" }} />
              )}
            </ControlButton>

            <ControlButton
              onPress={handleSpeaker}
              active={speakerOn}
              activeBackground="rgba(245,166,35,0.25)"
              ariaLabel={speakerOn ? "Earpiece" : "Speaker"}
              label={speakerOn ? "Earpiece" : "Speaker"}
            >
              {speakerOn ? (
                <Volume2 style={{ width: 26, height: 26, color: "#F5A623" }} />
              ) : (
                <VolumeX style={{ width: 26, height: 26, color: "#fff" }} />
              )}
            </ControlButton>

            <ControlButton
              onPress={() => setKeypadOpen(true)}
              ariaLabel="Keypad"
              label="Keypad"
            >
              <Grid3X3 style={{ width: 26, height: 26, color: "#fff" }} />
            </ControlButton>
          </div>

          {/* End call button */}
          <button
            onClick={handleHangUp}
            aria-label="End call"
            className="flex items-center justify-center gap-2 w-full rounded-full transition-opacity active:opacity-70"
            style={{
              height: 60,
              minHeight: 60,
              background: "#EF4444",
            }}
          >
            <PhoneOff style={{ width: 22, height: 22, color: "#fff" }} />
            <span className="text-base font-semibold text-white">End</span>
          </button>
        </div>
      </div>

      {/* Keypad placeholder modal — rendered above InCallScreen (z-[110]) */}
      {keypadOpen && <KeypadModal onClose={() => setKeypadOpen(false)} />}
    </>
  );
}
