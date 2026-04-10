import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://solvr.com.au/api/trpc";

/**
 * Why no manual cookie handling here:
 * On iOS, React Native's fetch uses NSURLSession, which handles cookies natively via
 * HTTPCookieStorage.sharedHTTPCookieStorage (persistent across app launches).
 * `Set-Cookie` headers are stripped from the JS-side response.headers before we can read
 * them, and NSURLSession auto-attaches stored cookies on subsequent requests to the same
 * origin as long as `credentials: "include"` is set.
 *
 * Manually setting the Cookie header from SecureStore actually made this WORSE:
 * we overrode NSURLSession's fresh cookie with a stale one from a prior test run.
 *
 * We keep a 15s timeout so hangs fail loudly.
 */
async function customFetch(
  url: RequestInfo | URL,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      ...options,
      credentials: "include",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export const trpc = createTRPCClient<any>({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      fetch: customFetch,
    }),
  ],
});
