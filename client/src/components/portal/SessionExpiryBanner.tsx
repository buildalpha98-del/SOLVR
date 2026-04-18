/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * SessionExpiryBanner
 *
 * Displays a sticky amber warning banner at the top of the portal when the
 * client's session is expiring within 48 hours. The banner shows how many
 * hours remain and provides a "Renew session" button that navigates to the
 * portal login page so the client can re-authenticate.
 *
 * Usage: render inside PortalLayout, above the main content area.
 */
import { useState, useEffect } from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";

interface SessionExpiryBannerProps {
  sessionExpiresAt: Date | string | null | undefined;
}

export function SessionExpiryBanner({ sessionExpiresAt }: SessionExpiryBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const expiresAt = new Date(sessionExpiresAt);

    function update() {
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      setHoursLeft(diffMs / (1000 * 60 * 60));
    }

    update();
    const interval = setInterval(update, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  // Only show if within 48 hours of expiry and not dismissed
  if (dismissed || hoursLeft === null || hoursLeft > 48 || hoursLeft <= 0) return null;

  const isUrgent = hoursLeft < 4;
  const accentColor = isUrgent ? "#f87171" : "#F5A623";
  const bgColor = isUrgent ? "rgba(239,68,68,0.15)" : "rgba(245,166,35,0.12)";
  const borderColor = isUrgent ? "rgba(239,68,68,0.3)" : "rgba(245,166,35,0.3)";
  const btnBg = isUrgent ? "rgba(239,68,68,0.2)" : "rgba(245,166,35,0.2)";
  const btnBorder = isUrgent ? "rgba(239,68,68,0.4)" : "rgba(245,166,35,0.4)";

  const hoursDisplay =
    hoursLeft < 1
      ? "less than 1 hour"
      : hoursLeft < 2
      ? "about 1 hour"
      : `${Math.floor(hoursLeft)} hours`;

  return (
    <div
      className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
      style={{ background: bgColor, borderBottom: `1px solid ${borderColor}` }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
        <span style={{ color: accentColor }}>
          Your session expires in <strong>{hoursDisplay}</strong>. Renew now to avoid being logged out.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => { window.location.href = "/portal/login?renew=1"; }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: btnBg, color: accentColor, border: `1px solid ${btnBorder}` }}
        >
          <RefreshCw className="w-3 h-3" />
          Renew session
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: accentColor }}
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
