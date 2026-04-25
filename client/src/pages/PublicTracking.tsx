/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * /track/:token — public-facing customer page that shows the tradie's
 * live position + ETA on a map. No auth — token IS the access.
 *
 * Polls every 15s while the session is active. Stops polling once the
 * tradie marks arrived / cancels / it expires. Light theme so it
 * matches the look of a customer-facing email rather than the dark
 * portal.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { loadMapScript } from "@/components/Map";
import { Loader2, MapPin, Clock, CheckCircle2, AlertTriangle, Navigation } from "lucide-react";

const POLL_INTERVAL_ACTIVE_MS = 15_000;

export default function PublicTracking() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const { data: mapsKey } = trpc.tracking.getMapsKey.useQuery(undefined, { staleTime: Infinity });
  const { data: status, error, isLoading } = trpc.tracking.getPublicStatus.useQuery(
    { token },
    {
      enabled: !!token,
      // Only poll while still active — once arrived/expired/cancelled we
      // freeze the view rather than burn API calls forever.
      refetchInterval: (q) => {
        const s = q.state.data?.status;
        return s === "active" ? POLL_INTERVAL_ACTIVE_MS : false;
      },
      retry: 2,
    },
  );

  if (isLoading) {
    return <CenteredMessage><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} /></CenteredMessage>;
  }
  if (error || !status) {
    return (
      <CenteredMessage>
        <AlertTriangle className="w-10 h-10 mb-3" style={{ color: "#ef4444" }} />
        <p className="text-base font-semibold text-gray-900">Tracking link not available</p>
        <p className="text-sm mt-1 text-gray-500 max-w-xs text-center">
          {error?.message ?? "This link may have expired or already been completed."}
        </p>
      </CenteredMessage>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8FAFC" }}>
      {/* Header */}
      <header className="px-5 py-4 bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Live tracking</p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">
            {status.tradieFirstName ? `${status.tradieFirstName} from ` : ""}
            {status.businessName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {status.customerName ? `Hi ${status.customerName.split(" ")[0]} —` : "Hello —"} we're on the way.
          </p>
        </div>
      </header>

      {/* Status banner */}
      <div className="max-w-md mx-auto w-full px-5 pt-4">
        <StatusBanner status={status.status} etaMinutes={status.etaMinutes} positionUpdatedAt={status.positionUpdatedAt} arrivedAt={status.arrivedAt} />
      </div>

      {/* Map */}
      <div className="flex-1 max-w-md mx-auto w-full px-5 py-4">
        <TrackingMap
          mapsKey={mapsKey?.key ?? null}
          tradieLat={status.tradieLat}
          tradieLng={status.tradieLng}
          destLat={status.destLat}
          destLng={status.destLng}
        />
        {status.destAddress && (
          <p className="text-xs text-gray-500 mt-3 text-center">
            <MapPin className="inline w-3 h-3 mr-1 -mt-0.5" />
            {status.destAddress}
          </p>
        )}
      </div>

      {/* Footer */}
      <footer className="px-5 py-4 text-center border-t border-gray-200">
        <p className="text-[11px] text-gray-400">
          Powered by <a href="https://solvr.com.au" className="font-semibold text-gray-500">SOLVR</a>
        </p>
      </footer>
    </div>
  );
}

function StatusBanner({ status, etaMinutes, positionUpdatedAt, arrivedAt }: {
  status: string;
  etaMinutes: number | null;
  positionUpdatedAt: Date | string | null;
  arrivedAt: Date | string | null;
}) {
  if (status === "arrived") {
    return (
      <Banner bg="#dcfce7" border="#86efac" color="#166534" icon={<CheckCircle2 className="w-5 h-5" style={{ color: "#22c55e" }} />}>
        <p className="text-sm font-bold">We've arrived!</p>
        {arrivedAt && (
          <p className="text-xs mt-0.5">
            {new Date(arrivedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </p>
        )}
      </Banner>
    );
  }
  if (status === "expired" || status === "cancelled" || status === "completed") {
    return (
      <Banner bg="#f3f4f6" border="#d1d5db" color="#4b5563" icon={<AlertTriangle className="w-5 h-5" style={{ color: "#9ca3af" }} />}>
        <p className="text-sm font-bold">
          {status === "completed" ? "Job complete" : status === "cancelled" ? "Tracking ended" : "Tracking link expired"}
        </p>
        <p className="text-xs mt-0.5">If you need to get in touch, please call us directly.</p>
      </Banner>
    );
  }
  // Active
  const etaText = etaMinutes === null || etaMinutes === undefined
    ? "Calculating…"
    : etaMinutes < 1
      ? "Less than 1 minute"
      : `${etaMinutes} minute${etaMinutes === 1 ? "" : "s"}`;
  const lastUpdate = positionUpdatedAt ? new Date(positionUpdatedAt) : null;
  return (
    <Banner bg="#fef3c7" border="#fcd34d" color="#92400e" icon={<Navigation className="w-5 h-5 animate-pulse" style={{ color: "#F5A623" }} />}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#a16207" }}>ETA</p>
          <p className="text-2xl font-bold" style={{ color: "#92400e" }}>{etaText}</p>
        </div>
        {lastUpdate && (
          <p className="text-[11px] text-right" style={{ color: "#a16207" }}>
            <Clock className="inline w-2.5 h-2.5 mr-0.5 -mt-0.5" />
            Updated {agoLabel(lastUpdate)}
          </p>
        )}
      </div>
    </Banner>
  );
}

function Banner({ bg, border, color, icon, children }: { bg: string; border: string; color: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3 flex items-start gap-3"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: "#F8FAFC" }}>
      {children}
    </div>
  );
}

// ─── Map ────────────────────────────────────────────────────────────────────

function TrackingMap({ mapsKey, tradieLat, tradieLng, destLat, destLng }: {
  mapsKey: string | null;
  tradieLat: number | null;
  tradieLng: number | null;
  destLat: number | null;
  destLng: number | null;
}) {
  // destLat/Lng are NOT NULL in the schema but the JSON-coerced type is
  // permissive. Bail out gracefully if anything is missing.
  if (destLat === null || destLng === null) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 p-6 text-center">
        <MapPin className="w-8 h-8 mx-auto text-gray-300" />
        <p className="text-sm text-gray-500 mt-2">Destination not available.</p>
      </div>
    );
  }
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const tradieMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const destMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [ready, setReady] = useState(false);

  // Load + create map once mapsKey is ready (it's the public referrer-restricted
  // browser key so we just inject it into the script tag).
  useEffect(() => {
    if (!mapsKey || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      // Inject the key into a window-scoped global the loader picks up. The
      // existing loader in components/Map.tsx reads VITE_GOOGLE_MAPS_API_KEY
      // at build time — for the public page we don't have that bundle scope,
      // so we set it manually before loading.
      if (!window.google?.maps && !document.querySelector("script[data-solvr-gmaps]")) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&v=weekly&libraries=marker,geocoding,geometry`;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.dataset.solvrGmaps = "1";
        await new Promise<void>((res) => {
          script.onload = () => res();
          document.head.appendChild(script);
        });
      } else {
        await loadMapScript();
      }
      if (cancelled || !containerRef.current) return;
      mapRef.current = new window.google.maps.Map(containerRef.current, {
        zoom: 13,
        center: { lat: destLat, lng: destLng },
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        clickableIcons: false,
        mapId: "DEMO_MAP_ID",
      });
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [mapsKey, destLat, destLng]);

  // Update markers whenever positions change
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    // Destination marker (the customer's house)
    if (!destMarkerRef.current) {
      const pin = new window.google.maps.marker.PinElement({
        background: "#ef4444", borderColor: "#fff", glyphColor: "#fff",
      });
      destMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map, position: { lat: destLat, lng: destLng }, title: "Destination", content: pin.element,
      });
    }

    // Tradie marker (the live one)
    if (tradieLat !== null && tradieLng !== null) {
      if (!tradieMarkerRef.current) {
        const pin = new window.google.maps.marker.PinElement({
          background: "#F5A623", borderColor: "#fff", glyphColor: "#0F1F3D", glyph: "🚐",
        });
        tradieMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          map, position: { lat: tradieLat, lng: tradieLng }, title: "On the way", content: pin.element,
        });
      } else {
        tradieMarkerRef.current.position = { lat: tradieLat, lng: tradieLng };
      }
      // Fit bounds to include both
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: destLat, lng: destLng });
      bounds.extend({ lat: tradieLat, lng: tradieLng });
      map.fitBounds(bounds, 80);
    }
  }, [ready, tradieLat, tradieLng, destLat, destLng]);

  if (!mapsKey) {
    // Fallback when the API key isn't configured — shouldn't happen in prod
    // but be defensive so the customer still sees something useful.
    return (
      <div className="rounded-xl bg-white border border-gray-200 p-6 text-center">
        <MapPin className="w-8 h-8 mx-auto text-gray-300" />
        <p className="text-sm text-gray-500 mt-2">Map unavailable. Check the ETA above for arrival time.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ height: 360, background: "#e5e7eb" }}
    />
  );
}

function agoLabel(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}
