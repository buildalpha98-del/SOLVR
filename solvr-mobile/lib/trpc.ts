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

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    await storeSessionCookie(setCookie);
  }

  return response;
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
