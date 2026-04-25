/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * "On My Way" — tradie-side button + active-session panel.
 *
 * Three states:
 *   1. No active session: button "Send 'On My Way' SMS"
 *   2. Active session: live panel with ETA, last update, "I've arrived"
 *      button, "Cancel" link, and a copy-link affordance.
 *   3. Loading / error
 *
 * Geolocation: navigator.geolocation.getCurrentPosition for the start
 * burst, then a setInterval(getCurrentPosition, 30s) while the panel is
 * mounted and the session is active. We also use Distance Matrix
 * client-side (Google Maps JS SDK) to compute the ETA so the SMS copy
 * shows real driving time, not Haversine-as-the-crow-flies.
 *
 * Failure modes handled inline:
 *   - Geolocation denied            → button disabled with explainer
 *   - Job has no customer phone     → button disabled with explainer
 *   - Job has no geocodable address → button disabled with explainer
 *   - Distance Matrix call fails    → fall back to Haversine + 50km/h
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { loadMapScript } from "@/components/Map";
import { Navigation, Loader2, MapPin, AlertCircle, CheckCircle2, Phone, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { WriteGuard } from "@/components/portal/ViewerBanner";

interface Props {
  jobId: number;
  customerAddress: string | null | undefined;
  customerPhone: string | null | undefined;
  customerName: string | null | undefined;
}

type GeoCoord = { lat: number; lng: number };

const POSITION_PUSH_INTERVAL_MS = 30_000;

export function OnMyWayPanel({ jobId, customerAddress, customerPhone, customerName }: Props) {
  const utils = trpc.useUtils();
  const { data: status, refetch: refetchStatus } = trpc.tracking.getStatus.useQuery(
    { jobId },
    { staleTime: 15_000, retry: 2, refetchInterval: 30_000 },
  );

  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startJourney = trpc.tracking.startJourney.useMutation({
    onSuccess: (res) => {
      hapticSuccess();
      toast.success(res.resumed ? "Resumed your journey." : "On-the-way SMS sent.");
      refetchStatus();
      utils.smsConversations.list.invalidate(); // SMS shows up in inbox
    },
    onError: (err) => {
      hapticWarning();
      toast.error(err.message ?? "Couldn't start the journey.");
    },
  });

  const updatePosition = trpc.tracking.updatePosition.useMutation();
  const markArrived = trpc.tracking.markArrived.useMutation({
    onSuccess: () => {
      hapticSuccess();
      toast.success("Marked as arrived.");
      refetchStatus();
    },
    onError: (err) => toast.error(err.message ?? "Couldn't update."),
  });
  const cancel = trpc.tracking.cancel.useMutation({
    onSuccess: () => {
      toast.success("Tracking cancelled.");
      refetchStatus();
    },
    onError: (err) => toast.error(err.message ?? "Couldn't cancel."),
  });

  const isActive = status?.active === true;
  const token = isActive ? status.token : null;
  const trackingUrl = token ? `${window.location.origin}/track/${token}` : null;

  // ── Position push loop (active sessions only) ──────────────────────────
  const posIntervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isActive || !token) {
      if (posIntervalRef.current !== null) {
        clearInterval(posIntervalRef.current);
        posIntervalRef.current = null;
      }
      return;
    }

    async function pushOnce() {
      try {
        const coord = await getCurrentCoord();
        if (!coord) return;
        // Get destination + recompute ETA each push so the customer page
        // updates accurately as the tradie moves through traffic.
        const dest = await geocodeAddress(customerAddress ?? "");
        if (!dest) return;
        const eta = await computeEta(coord, dest);
        await updatePosition.mutateAsync({
          token: token!,
          tradieLat: coord.lat,
          tradieLng: coord.lng,
          etaMinutes: eta,
        });
      } catch {
        // Silent — next tick will retry. Don't show toasts every 30s.
      }
    }

    pushOnce();
    posIntervalRef.current = window.setInterval(pushOnce, POSITION_PUSH_INTERVAL_MS);
    return () => {
      if (posIntervalRef.current !== null) clearInterval(posIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token, customerAddress]);

  // ── Start journey button handler ────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!customerAddress?.trim()) {
      toast.error("Add a customer address first — we need it to compute the ETA.");
      return;
    }
    if (!customerPhone?.trim()) {
      toast.error("Add a customer phone number first — that's where the SMS goes.");
      return;
    }
    setBusy(true);
    setGeoError(null);
    try {
      const coord = await getCurrentCoord();
      if (!coord) {
        setGeoError("Couldn't read your location. Allow location access in browser settings and try again.");
        setBusy(false);
        return;
      }
      const dest = await geocodeAddress(customerAddress);
      if (!dest) {
        toast.error(`Couldn't pin "${customerAddress}" on the map. Check the address spelling.`);
        setBusy(false);
        return;
      }
      const eta = await computeEta(coord, dest);
      await startJourney.mutateAsync({
        jobId,
        destLat: dest.lat,
        destLng: dest.lng,
        destAddress: customerAddress,
        tradieLat: coord.lat,
        tradieLng: coord.lng,
        etaMinutes: eta,
        origin: window.location.origin,
      });
    } finally {
      setBusy(false);
    }
  }, [jobId, customerAddress, customerPhone, startJourney]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (!isActive) {
    const blocker = !customerAddress?.trim()
      ? "Add a customer address first."
      : !customerPhone?.trim()
        ? "Add a customer phone first."
        : null;
    return (
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.18)" }}
      >
        <WriteGuard>
          <button
            type="button"
            onClick={handleStart}
            disabled={busy || !!blocker}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: "#4ade80", color: "#0F1F3D", minHeight: 48 }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            {busy ? "Sending…" : "Send \"On My Way\" SMS"}
          </button>
        </WriteGuard>
        {blocker && (
          <p className="text-[11px] text-center" style={{ color: "rgba(239,68,68,0.8)" }}>
            <AlertCircle className="inline w-3 h-3 mr-1 -mt-0.5" /> {blocker}
          </p>
        )}
        {!blocker && (
          <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
            Texts {customerName ?? "the customer"} a live tracking link with ETA.
          </p>
        )}
        {geoError && (
          <p className="text-[11px] text-center" style={{ color: "rgba(239,68,68,0.8)" }}>
            <AlertCircle className="inline w-3 h-3 mr-1 -mt-0.5" /> {geoError}
          </p>
        )}
      </div>
    );
  }

  // Active session
  const eta = status.etaMinutes;
  const lastUpdate = status.positionUpdatedAt ? new Date(status.positionUpdatedAt) : null;
  const lastUpdateAgo = lastUpdate ? agoLabel(lastUpdate) : "—";

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#4ade80" }}>
            On the way to {customerName ?? "the customer"}
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {eta === null || eta === undefined ? "—" : eta < 1 ? "<1 min" : `${eta} min${eta === 1 ? "" : "s"}`}
          </p>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            ETA · updated {lastUpdateAgo}
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: "rgba(74,222,128,0.18)", color: "#4ade80" }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ade80" }} />
          Live
        </div>
      </div>

      {/* Tracking URL row */}
      {trackingUrl && (
        <div
          className="flex items-center gap-2 px-2 py-2 rounded-lg"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
          <span className="text-[11px] truncate flex-1" style={{ color: "rgba(255,255,255,0.7)" }}>
            {trackingUrl}
          </span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(trackingUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center justify-center w-7 h-7 rounded flex-shrink-0"
            style={{ color: copied ? "#4ade80" : "rgba(255,255,255,0.5)" }}
            aria-label="Copy tracking URL"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Action row */}
      <WriteGuard>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => token && markArrived.mutate({ token })}
            disabled={markArrived.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-semibold"
            style={{ background: "#4ade80", color: "#0F1F3D", minHeight: 44 }}
          >
            {markArrived.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            I've arrived
          </button>
          <button
            type="button"
            onClick={() => {
              if (token && window.confirm("Cancel tracking? The customer's link will stop updating.")) {
                cancel.mutate({ token });
              }
            }}
            disabled={cancel.isPending}
            className="flex items-center justify-center px-4 rounded-lg text-sm font-semibold"
            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", minHeight: 44 }}
            aria-label="Cancel tracking"
          >
            <X className="w-4 h-4" />
          </button>
          {customerPhone && (
            <a
              href={`tel:${customerPhone.replace(/[^\d+]/g, "")}`}
              className="flex items-center justify-center px-4 rounded-lg text-sm font-semibold"
              style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", minHeight: 44 }}
              aria-label={`Call ${customerName ?? "customer"}`}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      </WriteGuard>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Promise wrapper around navigator.geolocation. Resolves to null on denial. */
function getCurrentCoord(): Promise<GeoCoord | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** Geocode an address client-side. Loads the maps script lazily. */
async function geocodeAddress(address: string): Promise<GeoCoord | null> {
  if (!address.trim()) return null;
  await loadMapScript();
  try {
    const geocoder = new window.google.maps.Geocoder();
    const res = await geocoder.geocode({ address });
    const loc = res.results?.[0]?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat(), lng: loc.lng() };
  } catch {
    return null;
  }
}

/**
 * Compute driving ETA in minutes. Tries Distance Matrix first (real
 * driving time) and falls back to Haversine + 50 km/h average urban
 * speed if the API fails. Returns 0 if both fail.
 */
async function computeEta(from: GeoCoord, to: GeoCoord): Promise<number> {
  await loadMapScript();
  try {
    const svc = new window.google.maps.DistanceMatrixService();
    const res = await svc.getDistanceMatrix({
      origins: [from],
      destinations: [to],
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      },
    });
    const el = res.rows?.[0]?.elements?.[0];
    if (el && el.status === "OK") {
      const seconds = el.duration_in_traffic?.value ?? el.duration?.value ?? 0;
      return Math.max(0, Math.round(seconds / 60));
    }
  } catch {
    // fall through
  }
  // Fallback: Haversine + 50 km/h
  const distKm = haversineKm(from, to);
  return Math.max(1, Math.round((distKm / 50) * 60));
}

function haversineKm(a: GeoCoord, b: GeoCoord): number {
  const R = 6371;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const dφ = ((b.lat - a.lat) * Math.PI) / 180;
  const dλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function agoLabel(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}
