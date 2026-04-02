/* ============================================================
   DESIGN: Solvr Brand
   Terminal-style transcript feed — monospace, role-labelled
   AGENT = amber (#F5A623), CALLER = slate
   ============================================================ */

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/hooks/useVapi";

interface TranscriptFeedProps {
  entries: TranscriptEntry[];
  isActive: boolean;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function TranscriptFeed({ entries, isActive }: TranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  if (!isActive && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
        <div className="font-mono text-xs tracking-widest uppercase">
          // awaiting connection
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-slate-700 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Filter out entries that contain BOOKING_CONFIRMED JSON
  const visibleEntries = entries.map((e) => ({
    ...e,
    text: e.text.includes("BOOKING_CONFIRMED:")
      ? e.text.split("BOOKING_CONFIRMED:")[0].trim()
      : e.text,
  })).filter((e) => e.text.length > 0);

  return (
    <div className="flex flex-col gap-3 p-1">
      {visibleEntries.map((entry) => (
        <div
          key={entry.id}
          className="animate-fade-in-up"
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`font-mono text-[10px] font-bold tracking-widest uppercase ${
                entry.role === "assistant"
                  ? "text-[#F5A623]"
                  : "text-slate-400"
              }`}
            >
              {entry.role === "assistant" ? "AGENT" : "CALLER"}
            </span>
            <span className="font-mono text-[10px] text-slate-600">
              {formatTime(entry.timestamp)}
            </span>
            {!entry.isFinal && (
              <span className="font-mono text-[10px] text-slate-600 animate-pulse">
                ···
              </span>
            )}
          </div>
          <p
            className={`font-mono text-sm leading-relaxed ${
              entry.role === "assistant"
                ? "text-slate-200"
                : "text-slate-400"
            } ${!entry.isFinal ? "opacity-70" : ""}`}
          >
            {entry.text}
            {!entry.isFinal && (
              <span className="inline-block w-[2px] h-[14px] bg-[#F5A623] ml-1 animate-blink align-middle" />
            )}
          </p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
