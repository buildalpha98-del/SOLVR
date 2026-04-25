/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Today — map view of today's jobs/events with route ordering.
 *
 * Sources merged into the timeline:
 *   - Calendar events with startAt today and a location string
 *   - Portal jobs with preferredDate === today (covers tradies who don't use calendar)
 *
 * Geocoding: client-side via google.maps.Geocoder. Cached in component
 * state so a re-render of the page doesn't re-bill the API.
 *
 * Route order:
 *   - "time" (default) — chronological by startAt / preferredDate
 *   - "route" — nearest-neighbour traversal from the tradie's current
 *     GPS position. Uses geometry.spherical haversine — not driving
 *     distance, but adequate for "which is closest first?"
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { loadMapScript } from "@/components/Map";
import { MapPin, Clock, Phone, Loader2, Navigation, ListOrdered, AlertCircle, Briefcase } from "lucide-react";
import { ErrorState } from "@/components/portal/ErrorState";

interface TodayItem {
  /** "event:{id}" or "job:{id}" — unique across types */
  key: string;
  /** Canonical link target on tap */
  href: string;
  title: string;
  /** Geocodable address string */
  location: string;
  /** When the work is scheduled — Date for events, midnight for jobs without time */
  startAt: Date;
  /** True when startAt is a placeholder (job has preferredDate but no time) */
  hasSpecificTime: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  /** Marker colour — taken from event.color, or a job-default amber */
  color: string;
  /** Source — for badge */
  type: "event" | "job";
}

const COLOR_HEX: Record<string, string> = {
  amber: "#F5A623",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  green: "#4ade80",
  red: "#ef4444",
  gray: "#6b7280",
};
function colorHex(c: string) { return COLOR_HEX[c] ?? "#F5A623"; }

/** YYYY-MM-DD for the local "today" — matches portal_jobs.preferredDate format. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PortalToday() {
  const [, navigate] = useLocation();

  const eventsQuery = trpc.portal.listCalendarEvents.useQuery(undefined, {
    staleTime: 60_000, retry: 2,
  });
  const jobsQuery = trpc.portal.listJobs.useQuery(undefined, {
    staleTime: 60_000, retry: 2,
  });

  // Merge today's events + today's pending jobs into a single ordered list.
  const items = useMemo<TodayItem[]>(() => {
    const today = todayISO();
    const out: TodayItem[] = [];

    for (const ev of eventsQuery.data ?? []) {
      const start = new Date(ev.startAt);
      if (start.toISOString().slice(0, 10) !== today) continue;
      if (!ev.location?.trim()) continue;
      out.push({
        key: `event:${ev.id}`,
        href: ev.jobId ? `/portal/jobs/${ev.jobId}` : `/portal/calendar`,
        title: ev.title,
        location: ev.location,
        startAt: start,
        hasSpecificTime: true,
        customerName: ev.contactName ?? null,
        customerPhone: ev.contactPhone ?? null,
        color: ev.color ?? "amber",
        type: "event",
      });
    }

    // De-dup: if a calendar event already references jobId X, skip the job's own item.
    const eventJobIds = new Set(
      (eventsQuery.data ?? []).filter(e => e.jobId !== null && e.jobId !== undefined).map(e => e.jobId),
    );
    for (const job of jobsQuery.data ?? []) {
      if (job.preferredDate !== today) continue;
      if (eventJobIds.has(job.id)) continue;
      const addr = job.customerAddress ?? job.location;
      if (!addr?.trim()) continue;
      // No specific time on jobs — set 8am sentinel so they sort early but
      // we render "All day" instead of a clock time.
      const fakeStart = new Date(`${today}T08:00:00`);
      out.push({
        key: `job:${job.id}`,
        href: `/portal/jobs/${job.id}`,
        title: job.jobType ?? "Job",
        location: addr,
        startAt: fakeStart,
        hasSpecificTime: false,
        customerName: job.customerName ?? job.callerName ?? null,
        customerPhone: job.customerPhone ?? job.callerPhone ?? null,
        color: "amber",
        type: "job",
      });
    }

    return out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [eventsQuery.data, jobsQuery.data]);

  return (
    <PortalLayout activeTab="today">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Today</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <Link href="/portal/calendar">
            <a className="text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
              See full calendar
            </a>
          </Link>
        </div>

        {(eventsQuery.isLoading || jobsQuery.isLoading) ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
          </div>
        ) : eventsQuery.error || jobsQuery.error ? (
          <ErrorState
            error={eventsQuery.error ?? jobsQuery.error!}
            onRetry={() => { eventsQuery.refetch(); jobsQuery.refetch(); }}
          />
        ) : items.length === 0 ? (
          <EmptyToday />
        ) : (
          <TodayMap items={items} onSelect={(it) => navigate(it.href)} />
        )}
      </div>
    </PortalLayout>
  );
}

function EmptyToday() {
  return (
    <div className="text-center py-16 rounded-xl space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <MapPin className="w-10 h-10 mx-auto" style={{ color: "rgba(255,255,255,0.2)" }} />
      <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>Nothing on today's run</p>
      <p className="text-xs max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
        Calendar events and jobs with today's preferred date will appear here on a map, sorted by time or route distance.
      </p>
      <Link href="/portal/calendar">
        <a className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg mt-2" style={{ background: "#F5A623", color: "#0F1F3D" }}>
          Add an event
        </a>
      </Link>
    </div>
  );
}

// ─── Map + ordered list ─────────────────────────────────────────────────────

function TodayMap({ items, onSelect }: { items: TodayItem[]; onSelect: (item: TodayItem) => void }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  // marker objects so we can clear them between renders
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [geocodeCache, setGeocodeCache] = useState<Record<string, google.maps.LatLngLiteral | null>>({});
  const [userPosition, setUserPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [orderMode, setOrderMode] = useState<"time" | "route">("time");
  const [geocodingDone, setGeocodingDone] = useState(false);

  // ── 1. Load Google Maps script + create map ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadMapScript();
      if (cancelled || !mapContainerRef.current) return;
      mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
        zoom: 11,
        // Default to Sydney CBD until we have real markers; getBounds() recenters once geocoding lands.
        center: { lat: -33.8688, lng: 151.2093 },
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        clickableIcons: false,
        mapId: "DEMO_MAP_ID",
      });
      setMapReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── 2. Geocode every item's address (cached) ───────────────────────────────
  useEffect(() => {
    if (!mapReady || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const geocoder = new window.google.maps.Geocoder();
      const next = { ...geocodeCache };
      for (const it of items) {
        if (next[it.location] !== undefined) continue;
        try {
          const res = await geocoder.geocode({ address: it.location });
          if (cancelled) return;
          if (res.results?.[0]?.geometry?.location) {
            const loc = res.results[0].geometry.location;
            next[it.location] = { lat: loc.lat(), lng: loc.lng() };
          } else {
            next[it.location] = null;
          }
        } catch {
          next[it.location] = null;
        }
      }
      if (!cancelled) {
        setGeocodeCache(next);
        setGeocodingDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [mapReady, items]);

  // ── 3. Try to get user GPS once (for route ordering) ───────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      // Silent fail — route ordering just won't be available
      () => {},
      { timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // ── 4. Compute the ordered list of items based on orderMode ────────────────
  const orderedItems = useMemo(() => {
    if (orderMode === "time" || !userPosition) return items;
    // Nearest-neighbour traversal from user's GPS via spherical Haversine.
    const remaining = items.filter(it => geocodeCache[it.location]);
    if (remaining.length <= 1) return items;
    const out: TodayItem[] = [];
    let current: google.maps.LatLngLiteral = userPosition;
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const target = geocodeCache[remaining[i].location];
        if (!target) continue;
        const d = distanceMeters(current, target);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      out.push(next);
      const nextLoc = geocodeCache[next.location];
      if (nextLoc) current = nextLoc;
    }
    // Append items that failed to geocode at the end (so they're not lost)
    for (const it of items) {
      if (!out.includes(it) && !geocodeCache[it.location]) out.push(it);
    }
    return out;
  }, [items, orderMode, userPosition, geocodeCache]);

  // ── 5. Render markers + polyline whenever order or geocode cache changes ───
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Clear existing
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const points: google.maps.LatLngLiteral[] = [];
    orderedItems.forEach((it, idx) => {
      const pos = geocodeCache[it.location];
      if (!pos) return;
      const pin = new window.google.maps.marker.PinElement({
        background: colorHex(it.color),
        borderColor: "#0F1F3D",
        glyph: String(idx + 1),
        glyphColor: "#0F1F3D",
        scale: 1.15,
      });
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        title: `${idx + 1}. ${it.title}`,
        content: pin.element,
      });
      marker.addListener("click", () => onSelect(it));
      markersRef.current.push(marker);
      points.push(pos);
    });

    // Polyline connecting markers in order
    if (points.length >= 2) {
      polylineRef.current = new window.google.maps.Polyline({
        path: userPosition ? [userPosition, ...points] : points,
        strokeColor: "#F5A623",
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map,
      });
    }

    // User marker
    if (userMarkerRef.current) { userMarkerRef.current.map = null; }
    if (userPosition) {
      const userPin = new window.google.maps.marker.PinElement({
        background: "#3b82f6",
        borderColor: "#fff",
        glyph: "•",
        glyphColor: "#fff",
        scale: 0.9,
      });
      userMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: userPosition,
        title: "You",
        content: userPin.element,
      });
    }

    // Fit bounds to all markers + user
    if (points.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach(p => bounds.extend(p));
      if (userPosition) bounds.extend(userPosition);
      map.fitBounds(bounds, 64);
    }
  }, [mapReady, orderedItems, geocodeCache, userPosition, onSelect]);

  // Items that failed to geocode — surface at the bottom so the tradie knows
  const ungeocoded = orderedItems.filter(it => geocodingDone && geocodeCache[it.location] === null);
  const geocoded = orderedItems.filter(it => geocodeCache[it.location]);

  return (
    <div className="space-y-4">
      {/* Map */}
      <div
        ref={mapContainerRef}
        className="w-full rounded-xl overflow-hidden"
        style={{ height: 320, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      />

      {/* Order toggle */}
      {items.length >= 2 && (
        <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.25)" }}>
          <OrderTab active={orderMode === "time"} onClick={() => setOrderMode("time")} icon={<Clock className="w-3.5 h-3.5" />} label="By time" />
          <OrderTab
            active={orderMode === "route"}
            onClick={() => setOrderMode("route")}
            disabled={!userPosition}
            icon={<Navigation className="w-3.5 h-3.5" />}
            label={userPosition ? "Best route" : "Best route (allow location)"}
          />
        </div>
      )}

      {/* Ordered list */}
      <ol className="space-y-2">
        {geocoded.map((it, idx) => (
          <ItemRow key={it.key} item={it} index={idx + 1} onClick={() => onSelect(it)} />
        ))}
      </ol>

      {/* Ungeocoded fallback */}
      {ungeocoded.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
            <AlertCircle className="inline w-3 h-3 mr-1 -mt-0.5" /> Couldn't pin these on the map
          </p>
          {ungeocoded.map(it => (
            <ItemRow key={it.key} item={it} index={null} onClick={() => onSelect(it)} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderTab({ active, onClick, icon, label, disabled }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all disabled:opacity-50"
      style={{
        background: active ? "rgba(245,166,35,0.18)" : "transparent",
        color: active ? "#F5A623" : "rgba(255,255,255,0.55)",
        border: active ? "1px solid rgba(245,166,35,0.35)" : "1px solid transparent",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon} {label}
    </button>
  );
}

function ItemRow({ item, index, onClick }: { item: TodayItem; index: number | null; onClick: () => void }) {
  const time = item.hasSpecificTime
    ? item.startAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "All day";
  const phoneClean = item.customerPhone?.replace(/[^\d+]/g, "");
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {index !== null ? (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: colorHex(item.color), color: "#0F1F3D" }}
          >
            {index}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ListOrdered className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{item.title}</p>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
              {item.type === "job" ? <Briefcase className="inline w-2.5 h-2.5" /> : null} {item.type}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
            {time}{item.customerName && ` · ${item.customerName}`}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
            <MapPin className="inline w-3 h-3 mr-0.5 -mt-0.5" />
            {item.location}
          </p>
        </div>
        {/* Tap-to-call sidekick — preserves the row click target */}
        {phoneClean && (
          <a
            href={`tel:${phoneClean}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
            style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
            aria-label={`Call ${item.customerName ?? "customer"}`}
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
      </button>
    </li>
  );
}

/** Haversine distance in metres. Faster than waiting on Google geometry library to load. */
function distanceMeters(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const dφ = ((b.lat - a.lat) * Math.PI) / 180;
  const dλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
