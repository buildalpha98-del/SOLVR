/**
 * openMaps — opens a location in the native Maps app on Capacitor,
 * or falls back to Google Maps in a new tab on web.
 *
 * On iOS Capacitor, uses the `maps://` scheme which opens Apple Maps.
 * On web, opens Google Maps in a new tab.
 */
import { isNativeApp } from "@/const";

/**
 * Open a location in the best available maps app.
 * @param query - address string or "lat,lng" pair
 */
export function openMaps(query: string): void {
  const encoded = encodeURIComponent(query);

  if (isNativeApp()) {
    // iOS: maps:// scheme opens Apple Maps
    // If it fails (e.g. Android without handler), fall back to Google Maps
    const nativeUrl = `maps://?q=${encoded}`;
    const fallbackUrl = `https://www.google.com/maps?q=${encoded}`;

    // Try native first — if it doesn't open within 500ms, fall back
    const start = Date.now();
    window.location.href = nativeUrl;
    setTimeout(() => {
      if (Date.now() - start < 1500) {
        // Still here — native scheme didn't work, open Google Maps
        window.open(fallbackUrl, "_system");
      }
    }, 500);
  } else {
    window.open(`https://www.google.com/maps?q=${encoded}`, "_blank");
  }
}

/**
 * Open a lat/lng coordinate in maps.
 */
export function openMapsLatLng(lat: number, lng: number): void {
  openMaps(`${lat},${lng}`);
}
