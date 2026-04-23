/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * JobDetailActionsMenu — overflow menu for tertiary job actions.
 *
 * Keeps the primary action bar uncluttered by moving secondary options
 * (Copy customer link, future Archive/Delete) into a discrete dropdown
 * triggered by a 44×44pt tap target.
 *
 * Implementation: inline-styled button + fixed dropdown panel. Does not
 * depend on shadcn DropdownMenu so the visual language matches the rest
 * of the portal (navy surface, amber accent).
 */
import { useEffect, useRef, useState } from "react";
import { MoreVertical, Check } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

export type JobDetailAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  /** When true, item renders in red (e.g. destructive). */
  destructive?: boolean;
  /** When true, item is disabled. */
  disabled?: boolean;
  /** Optional helper shown under the label. */
  description?: string;
};

export function JobDetailActionsMenu({
  actions,
  ariaLabel = "Job actions",
}: {
  actions: JobDetailAction[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          hapticLight();
          setOpen((v) => !v);
        }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px] transition-colors active:opacity-80"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.8)",
        }}
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="absolute right-0 top-full mt-1 z-40 w-60 rounded-xl overflow-hidden shadow-lg"
          style={{
            background: "#0F1F3D",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {actions.map((action) => {
            const justCopied = copiedKey === action.key;
            const colorPrimary = action.destructive
              ? "#ef4444"
              : justCopied
                ? "#22c55e"
                : "rgba(255,255,255,0.9)";
            const colorSecondary = action.destructive
              ? "rgba(239,68,68,0.6)"
              : "rgba(255,255,255,0.45)";
            return (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  if (action.disabled) return;
                  action.onSelect();
                  hapticLight();
                  // If this is a copy-like action, show a quick confirmation
                  if (action.key.startsWith("copy")) {
                    setCopiedKey(action.key);
                    setTimeout(() => setCopiedKey(null), 1200);
                  } else {
                    setOpen(false);
                  }
                }}
                className="w-full flex items-start gap-3 px-3 py-3 text-left min-h-[44px] transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: colorPrimary }}
                >
                  {justCopied ? <Check className="w-4 h-4" /> : action.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className="block text-sm font-medium truncate"
                    style={{ color: colorPrimary }}
                  >
                    {justCopied ? "Copied!" : action.label}
                  </span>
                  {action.description && !justCopied && (
                    <span
                      className="block text-[11px] mt-0.5 truncate"
                      style={{ color: colorSecondary }}
                    >
                      {action.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
