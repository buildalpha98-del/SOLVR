/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * StaffCard — mobile-first card for a staff row in the Labour Costs breakdown.
 * Replaces the 4-column table grid on mobile. Tap to expand per-staff detail.
 */
import { useState } from "react";
import { Wrench, ChevronDown, ChevronUp } from "lucide-react";

type StaffCardProps = {
  staffName: string;
  trade: string | null;
  hourlyRate: string | null;
  totalHours: number;
  entryCount: number;
  labourCost: number | null;
};

export default function StaffCard({
  staffName,
  trade,
  hourlyRate,
  totalHours,
  entryCount,
  labourCost,
}: StaffCardProps) {
  const [expanded, setExpanded] = useState(false);
  const initial = staffName.charAt(0).toUpperCase();

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full min-h-11 flex items-center gap-3 p-4 text-left transition-colors"
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
          style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
        >
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{staffName}</p>
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {trade ? (
              <>
                <Wrench className="w-3 h-3" /> {trade}
              </>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.3)" }}>No trade set</span>
            )}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          {labourCost != null ? (
            <p className="text-base font-bold" style={{ color: "#F5A623" }}>
              ${labourCost.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          ) : (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>—</p>
          )}
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            {totalHours.toFixed(1)} hrs
          </p>
        </div>

        <div className="flex-shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
          )}
        </div>
      </button>

      {expanded && (
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.12)" }}
        >
          <div className="flex justify-between py-1.5 text-sm">
            <span style={{ color: "rgba(255,255,255,0.5)" }}>Hours worked</span>
            <span className="text-white font-semibold">{totalHours.toFixed(2)} hrs</span>
          </div>
          <div
            className="flex justify-between py-1.5 text-sm border-t"
            style={{ borderColor: "rgba(255,255,255,0.04)" }}
          >
            <span style={{ color: "rgba(255,255,255,0.5)" }}>Check-ins</span>
            <span className="text-white font-semibold">{entryCount}</span>
          </div>
          <div
            className="flex justify-between py-1.5 text-sm border-t"
            style={{ borderColor: "rgba(255,255,255,0.04)" }}
          >
            <span style={{ color: "rgba(255,255,255,0.5)" }}>Hourly rate</span>
            {hourlyRate ? (
              <span className="text-white font-semibold">${hourlyRate}/hr</span>
            ) : (
              <span className="font-semibold" style={{ color: "rgba(245,166,35,0.7)" }}>
                Not set
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
