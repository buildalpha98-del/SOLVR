/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalQuotes — Redirect to /portal/jobs?tab=quotes.
 * Quotes are now a tab inside the Jobs page.
 * This file exists to handle legacy links and bookmarks.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function PortalQuotes() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Preserve query params (e.g. ?record=1, ?prefill=1)
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "quotes");
    navigate(`/portal/jobs?${params.toString()}`, { replace: true });
  }, [navigate]);

  return null;
}
