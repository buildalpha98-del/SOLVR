/**
 * openUrl — platform-aware URL opener for Capacitor + Web.
 *
 * On iOS Capacitor: uses @capacitor/browser to open URLs in an in-app
 * Safari overlay (SFSafariViewController). The user sees the content
 * in a sheet and can dismiss it to return to the app — no context switch.
 *
 * On web: uses window.open("_blank") as normal.
 *
 * Use this instead of window.open() for:
 *   - S3 PDF URLs (invoices, quotes, compliance docs, reports)
 *   - External links (Google Business, Calendly)
 *   - Any URL that should open without leaving the app on iOS
 *
 * Do NOT use this for:
 *   - Internal routes (use wouter navigate() instead)
 *   - mailto: / tel: links (use <a href="mailto:..."> directly)
 */

import { isNativeApp } from "@/const";

export async function openUrl(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
    } catch {
      // Fallback if Browser plugin fails
      window.open(url, "_blank");
    }
  } else {
    window.open(url, "_blank");
  }
}
