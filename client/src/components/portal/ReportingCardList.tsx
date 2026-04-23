/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { CheckCircle, AlertTriangle } from "lucide-react";

const GREEN = "#22c55e";
const AMBER = "#F5A623";
const RED = "#ef4444";

export type ReportingJob = {
  jobId: number | string;
  jobTitle: string;
  customerName: string | null;
  revenue: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
};

export function MarginBadge({ pct }: { pct: number }) {
  const good = pct >= 30;
  const ok = pct >= 0 && pct < 30;
  const color = good ? GREEN : ok ? AMBER : RED;
  const bg = good ? "rgba(34,197,94,0.1)" : ok ? "rgba(245,166,35,0.1)" : "rgba(239,68,68,0.1)";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: bg, color }}
    >
      {pct >= 0 ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {pct}%
    </span>
  );
}

export default function ReportingCardList({ jobs }: { jobs: ReportingJob[] }) {
  return (
    <div>
      {jobs.map((job, i) => (
        <div
          key={job.jobId}
          className="p-4 space-y-2"
          style={i < jobs.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.04)" } : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{job.jobTitle}</p>
              {job.customerName && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {job.customerName}
                </p>
              )}
            </div>
            <MarginBadge pct={job.marginPercent} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              In: <span className="text-white font-medium">${job.revenue.toLocaleString()}</span>
            </span>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              Costs: <span className="text-white font-medium">${job.totalCost.toLocaleString()}</span>
            </span>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              Made:{" "}
              <span className="font-semibold" style={{ color: job.margin >= 0 ? GREEN : RED }}>
                ${job.margin.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
