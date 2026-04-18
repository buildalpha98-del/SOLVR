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
