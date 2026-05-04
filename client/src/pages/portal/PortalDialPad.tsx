/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalDialPad — outbound-call dialler at /portal/phone/dial.
 *
 * Layout (top → bottom):
 *  1. Back button
 *  2. Search field (autofocus) — name OR digits
 *  3. Customer list — search results when typing, recent contacts when empty
 *  4. Number display + backspace
 *  5. 3×4 numeric keypad (1-9, *, 0, #)
 *  6. Big green Call button
 *
 * Behaviour:
 *  - Letters → debounced (200 ms) portalCustomers.search query
 *  - Digits → also appended to the number display below
 *  - Customer card tap → makeCall immediately (single-tap = confirm)
 *  - Keypad digit tap → appends to number display
 *  - Long-press 0 → appends "+"
 *  - Call button → makeCall(displayedNumber) → back to /portal/phone
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 7.4)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Phone, Delete, Search } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useSolvrPhone } from "@/hooks/useSolvrPhone";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if every character is a dial-legal symbol (digit, +, *, #, space, dash, paren). */
function isDialString(value: string): boolean {
  return /^[0-9+*#\s\-().]*$/.test(value);
}

/** Relative human-readable timestamp for "Last contact" label. */
function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? "" : "s"} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"} ago`;
}

// ── Keypad layout ─────────────────────────────────────────────────────────────

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

interface CustomerCardProps {
  name: string;
  phone: string | null;
  lastContact?: string | null;
  onDial: () => void;
}

function CustomerCard({ name, phone, lastContact, onDial }: CustomerCardProps) {
  return (
    <button
      onClick={onDial}
      aria-label={`Call ${name}${phone ? ` at ${phone}` : ""}`}
      className="w-full text-left rounded-2xl px-4 py-4 transition-opacity active:opacity-70"
      style={{
        minHeight: 72,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <p className="text-[15px] font-semibold" style={{ color: "#F5F5F0" }}>
        {name}
      </p>
      {phone && (
        <p className="mt-0.5 text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.50)" }}>
          {phone}
        </p>
      )}
      {lastContact && (
        <p className="mt-0.5 text-[12px]" style={{ color: "rgba(255,255,255,0.30)" }}>
          Last contact: {lastContact}
        </p>
      )}
    </button>
  );
}

// ── PortalDialPad ─────────────────────────────────────────────────────────────

export default function PortalDialPad() {
  const [, navigate] = useLocation();
  const { makeCall } = useSolvrPhone();

  // ── Controlled inputs ───────────────────────────────────────────────────────

  // The raw text the user typed in the search field.
  const [searchInput, setSearchInput] = useState("");

  // The number shown in the dialler display. Updated by keypad presses OR by
  // digit-only search input (they stay in sync when input is digits).
  const [dialNumber, setDialNumber] = useState("");

  // The debounced query sent to portalCustomers.search. Updated 200 ms after
  // searchInput changes, but ONLY for letter-based searches.
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);

  // Autofocus the search field on mount.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Debounce: when searchInput changes, schedule a 200 ms update to debouncedQuery.
  // If the input is pure digits, skip the search query (we dial instead).
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (!trimmed || isDialString(trimmed)) {
      setDebouncedQuery("");
      return;
    }
    const id = setTimeout(() => setDebouncedQuery(trimmed), 200);
    return () => clearTimeout(id);
  }, [searchInput]);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const searchQuery = trpc.portalCustomers.search.useQuery(
    { query: debouncedQuery, limit: 20 },
    {
      enabled: debouncedQuery.length > 0,
      retry: 2,
      staleTime: 30_000,
    },
  );

  const recentCallsQuery = trpc.phone.listCalls.useQuery(
    { limit: 50 },
    {
      retry: 2,
      staleTime: 30_000,
    },
  );

  // ── Derived display data ────────────────────────────────────────────────────

  // "Recent contacts" — unique customer phone numbers from the last 50 calls,
  // keeping only rows that have a customerPhone and de-duping by phone.
  const recentContacts = (() => {
    const items = recentCallsQuery.data?.items ?? [];
    const seen = new Set<string>();
    const contacts: Array<{ phone: string; calledAt: Date | string | null }> = [];
    for (const call of items) {
      const phone = call.customerPhone;
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      contacts.push({ phone, calledAt: call.calledAt });
      if (contacts.length >= 10) break;
    }
    return contacts;
  })();

  // Which list to show below the search field.
  const showSearchResults = debouncedQuery.length > 0;
  const searchResults = searchQuery.data ?? [];

  // ── Handlers ────────────────────────────────────────────────────────────────

  /** Called when the user types in the search field. */
  function handleSearchChange(value: string) {
    setSearchInput(value);
    // If the entire input is digit-legal, mirror it into the dial display.
    if (isDialString(value)) {
      setDialNumber(value.replace(/\s/g, ""));
    }
  }

  /** Dial a customer found in the search / recent list. */
  async function dialCustomer(phone: string, name: string) {
    toast(`Calling ${name}…`);
    try {
      await makeCall(phone);
    } catch (err) {
      toast.error((err instanceof Error ? err.message : null) ?? "Failed to start call");
      return;
    }
    navigate("/portal/phone");
  }

  /** Dial the raw number in the display field. */
  async function handleDial() {
    if (!dialNumber.trim()) return;
    toast(`Calling ${dialNumber.trim()}…`);
    try {
      await makeCall(dialNumber.trim());
    } catch (err) {
      toast.error((err instanceof Error ? err.message : null) ?? "Failed to start call");
      return;
    }
    navigate("/portal/phone");
  }

  /** Append a keypad symbol to the dial display (and sync search if appropriate). */
  function handleKeyPress(key: string) {
    setDialNumber((prev) => prev + key);
    // If the search field is empty or already contains only digits, mirror the keypad.
    if (!searchInput || isDialString(searchInput)) {
      setSearchInput((prev) => prev + key);
    }
  }

  /** Delete the last character from the dial display (and sync search field). */
  function handleBackspace() {
    setDialNumber((prev) => prev.slice(0, -1));
    if (!searchInput || isDialString(searchInput)) {
      setSearchInput((prev) => prev.slice(0, -1));
    }
  }

  // ── Long-press 0 → "+" ──────────────────────────────────────────────────────

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const handleKeyPointerDown = useCallback((key: string) => {
    if (key !== "0") {
      longFired.current = false;
      return;
    }
    longFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longFired.current = true;
      // Replace trailing "0" with "+" (long-press on 0 = international prefix)
      setDialNumber((prev) => (prev.endsWith("0") ? prev.slice(0, -1) + "+" : prev + "+"));
      if (!searchInput || isDialString(searchInput)) {
        setSearchInput((prev) => (prev.endsWith("0") ? prev.slice(0, -1) + "+" : prev + "+"));
      }
    }, 600);
  }, [searchInput]);

  const handleKeyPointerUp = useCallback((key: string) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longFired.current) {
      handleKeyPress(key);
    }
    longFired.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const canCall = dialNumber.replace(/[\s\-().]/g, "").length > 0;

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        background: "linear-gradient(160deg, #0F1F3D 0%, #0B1629 60%, #0a1220 100%)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 16px)",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ minHeight: 56 }}
      >
        <button
          onClick={() => navigate("/portal/phone")}
          aria-label="Back"
          className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
          style={{
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
            background: "rgba(255,255,255,0.08)",
          }}
        >
          <ArrowLeft style={{ width: 20, height: 20, color: "rgba(255,255,255,0.75)" }} />
        </button>
        <p
          className="text-[17px] font-semibold"
          style={{ color: "#F5F5F0" }}
        >
          New call
        </p>
      </div>

      {/* ── Search field ────────────────────────────────────────────────────── */}
      <div className="px-4 mt-1">
        <div
          className="flex items-center gap-3 rounded-2xl px-4"
          style={{
            height: 52,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <Search style={{ width: 18, height: 18, color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Search by name or number…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[15px]"
            style={{
              color: "#F5F5F0",
              caretColor: "#F5A623",
            }}
          />
          {searchInput.length > 0 && (
            <button
              onClick={() => { setSearchInput(""); setDialNumber(""); setDebouncedQuery(""); }}
              aria-label="Clear search"
              className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
              style={{ width: 24, height: 24, background: "rgba(255,255,255,0.12)" }}
            >
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1 }}>×</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Customer list (search results or recent contacts) ────────────────── */}
      <div className="px-4 mt-4 flex flex-col gap-2">
        {/* Section label */}
        <p
          className="text-[11px] font-semibold uppercase tracking-widest px-1"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          {showSearchResults ? "Search results" : "Recent contacts"}
        </p>

        {showSearchResults ? (
          <>
            {searchQuery.isLoading && (
              <p className="text-[13px] px-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                Searching…
              </p>
            )}
            {!searchQuery.isLoading && searchResults.length === 0 && (
              <p className="text-[13px] px-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                No customers found
              </p>
            )}
            {searchResults.map((customer) => (
              <CustomerCard
                key={customer.id}
                name={customer.name}
                phone={customer.phone ?? null}
                lastContact={customer.lastJobAt ? relativeTime(customer.lastJobAt) : undefined}
                onDial={() => {
                  if (!customer.phone) {
                    toast.error(`${customer.name} has no phone number on file`);
                    return;
                  }
                  void dialCustomer(customer.phone, customer.name);
                }}
              />
            ))}
          </>
        ) : (
          <>
            {recentCallsQuery.isLoading && (
              <p className="text-[13px] px-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                Loading recent contacts…
              </p>
            )}
            {!recentCallsQuery.isLoading && recentContacts.length === 0 && (
              <p className="text-[13px] px-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                No recent calls yet
              </p>
            )}
            {recentContacts.map((contact) => (
              <CustomerCard
                key={contact.phone}
                name={contact.phone}
                phone={null}
                lastContact={contact.calledAt ? relativeTime(contact.calledAt) : undefined}
                onDial={() => void dialCustomer(contact.phone, contact.phone)}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Dial display + backspace ─────────────────────────────────────────── */}
      <div className="px-4 mt-6">
        <p
          className="text-[12px] font-semibold uppercase tracking-widest mb-2 px-1"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          Or dial a number
        </p>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center rounded-2xl px-4"
            style={{
              height: 52,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <p
              className="text-[20px] font-semibold tabular-nums tracking-wide flex-1 truncate"
              style={{ color: dialNumber ? "#F5F5F0" : "rgba(255,255,255,0.25)" }}
            >
              {dialNumber || "Enter number"}
            </p>
          </div>
          <button
            onClick={handleBackspace}
            disabled={dialNumber.length === 0}
            aria-label="Backspace"
            className="flex items-center justify-center rounded-2xl transition-opacity active:opacity-70 disabled:opacity-30"
            style={{
              width: 52,
              height: 52,
              minWidth: 52,
              minHeight: 52,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <Delete style={{ width: 22, height: 22, color: "rgba(255,255,255,0.70)" }} />
          </button>
        </div>
      </div>

      {/* ── Numeric keypad ──────────────────────────────────────────────────── */}
      <div className="px-4 mt-4">
        <div className="flex flex-col gap-3 items-center">
          {KEYPAD_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-3 justify-center w-full">
              {row.map((key) => (
                <button
                  key={key}
                  aria-label={`Dial ${key}${key === "0" ? ", long-press for +" : ""}`}
                  onPointerDown={() => handleKeyPointerDown(key)}
                  onPointerUp={() => handleKeyPointerUp(key)}
                  onPointerLeave={() => {
                    if (longPressTimer.current) {
                      clearTimeout(longPressTimer.current);
                      longPressTimer.current = null;
                    }
                  }}
                  className="flex items-center justify-center rounded-full select-none transition-opacity active:opacity-60"
                  style={{
                    width: 72,
                    height: 72,
                    minWidth: 72,
                    minHeight: 72,
                    background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    fontSize: key === "*" || key === "#" ? 22 : 24,
                    fontWeight: 600,
                    color: "#F5F5F0",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    touchAction: "none",
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Call button ──────────────────────────────────────────────────────── */}
      <div className="px-8 mt-6">
        <button
          onClick={() => void handleDial()}
          disabled={!canCall}
          aria-label="Call"
          className="w-full flex items-center justify-center gap-3 rounded-full transition-opacity active:opacity-70 disabled:opacity-30"
          style={{
            height: 64,
            minHeight: 64,
            background: canCall ? "#22C55E" : "rgba(34,197,94,0.4)",
          }}
        >
          <Phone style={{ width: 24, height: 24, color: "#fff" }} />
          <span className="text-[18px] font-bold text-white">Call</span>
        </button>
      </div>
    </div>
  );
}
