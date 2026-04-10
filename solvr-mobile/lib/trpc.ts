import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { getStoredCookie, storeSessionCookie } from "./cookieStore";
import superjson from "superjson";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://solvr.com.au/api/trpc";

async function customFetch(
  url: RequestInfo | URL,
  options?: RequestInit
): Promise<Response> {
  const cookie = await getStoredCookie();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (cookie) {
    headers["Cookie"] = cookie;
  }

  // Add 15s timeout so hangs fail loudly instead of silently
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });

    // Debug: log what iOS actually exposes in response headers.
    // React Native on iOS often strips Set-Cookie because NSURLSession handles cookies natively.
    if (__DEV__ || process.env.EXPO_PUBLIC_DEBUG === "true") {
      const setCookie = response.headers.get("set-cookie");
      console.log(
        "[trpc fetch]",
        typeof url === "string" ? url.slice(0, 80) : "",
        "status=",
        response.status,
        "set-cookie=",
        setCookie ?? "NULL"
      );
    }

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      await storeSessionCookie(setCookie);
    }

    return response;
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
