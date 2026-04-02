/* ============================================================
   DESIGN: Solvr Brand
   Job Card — slides in when booking is confirmed
   Amber border, navy card, urgency badge
   ============================================================ */

import { CheckCircle, Clock, MapPin, Phone, Wrench, AlertTriangle, Zap } from "lucide-react";
import type { JobBooking } from "@/hooks/useVapi";

interface JobCardProps {
  booking: JobBooking;
}

const URGENCY_CONFIG = {
  routine: {
    label: "ROUTINE",
    color: "text-slate-400 border-slate-600",
    bg: "bg-slate-800/50",
    icon: Clock,
  },
  urgent: {
    label: "URGENT",
    color: "text-amber-400 border-amber-700",
    bg: "bg-amber-950/40",
    icon: AlertTriangle,
  },
  emergency: {
    label: "EMERGENCY",
    color: "text-red-400 border-red-700",
    bg: "bg-red-950/40",
    icon: Zap,
  },
};

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function JobCard({ booking }: JobCardProps) {
  const urgency = URGENCY_CONFIG[booking.urgency] || URGENCY_CONFIG.routine;
  const UrgencyIcon = urgency.icon;

  return (
    <div className="animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse" />
        <span className="font-mono text-[10px] text-[#F5A623] tracking-widest uppercase font-bold">
          Job Captured
        </span>
        <span className="font-mono text-[10px] text-slate-600 ml-auto">
          {formatTime(booking.bookedAt)}
        </span>
      </div>

      {/* Card */}
      <div className="border border-[#F5A623]/40 rounded-lg bg-[#F5A623]/5 p-4 glow-amber">
        {/* Urgency badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[10px] font-bold tracking-widest uppercase mb-4 ${urgency.color} ${urgency.bg}`}>
          <UrgencyIcon size={10} />
          {urgency.label}
        </div>

        {/* Job details grid */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded bg-[#0A1628] border border-[#F5A623]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Wrench size={13} className="text-[#F5A623]" />
            </div>
            <div>
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Job Type</div>
              <div className="text-sm font-semibold text-white">{booking.jobType}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded bg-[#0A1628] border border-[#F5A623]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Phone size={13} className="text-[#F5A623]" />
            </div>
            <div>
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Caller</div>
              <div className="text-sm font-semibold text-white">{booking.callerName}</div>
              <div className="font-mono text-xs text-slate-400">{booking.phone}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded bg-[#0A1628] border border-[#F5A623]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin size={13} className="text-[#F5A623]" />
            </div>
            <div>
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Location</div>
              <div className="text-sm font-semibold text-white">{booking.address}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded bg-[#0A1628] border border-[#F5A623]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock size={13} className="text-[#F5A623]" />
            </div>
            <div>
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Preferred Time</div>
              <div className="text-sm font-semibold text-white">{booking.preferredTime}</div>
            </div>
          </div>

          {booking.notes && (
            <div className="pt-2 border-t border-slate-800">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider mb-1">Notes</div>
              <div className="font-mono text-xs text-slate-400 leading-relaxed">{booking.notes}</div>
            </div>
          )}
        </div>

        {/* Confirmation footer */}
        <div className="mt-4 pt-3 border-t border-[#F5A623]/20 flex items-center gap-2">
          <CheckCircle size={14} className="text-[#F5A623]" />
          <span className="font-mono text-[11px] text-[#F5A623]">
            SMS confirmation queued
          </span>
        </div>
      </div>

      {/* SMS preview */}
      <div className="mt-3 border border-slate-700 rounded-lg bg-[#0A1628]/80 p-3">
        <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider mb-2">
          SMS Preview → {booking.phone}
        </div>
        <p className="font-mono text-xs text-slate-300 leading-relaxed">
          Hi {booking.callerName}, Jake's Plumbing here — we've got your job logged for {booking.preferredTime}. Jake will call to confirm. Reply STOP to opt out.
        </p>
      </div>
    </div>
  );
}
