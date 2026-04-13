import { Capacitor } from "@capacitor/core";
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl, getSolvrOrigin } from "./const";
import "./index.css";

// ─── Capacitor bootstrap ─────────────────────────────────────────────────────
// When running inside the native iOS shell, the WKWebView loads the SPA from
// `capacitor://localhost/` — which in our SPA routes to the marketing landing
// page. Tradies installed the app to use the portal, not read marketing copy,
// so redirect `/` → `/portal` before React mounts.
//
// Also, the default tRPC client uses the relative `/api/trpc` URL which works
// fine for same-origin browser requests but fails in Capacitor because the
// webview origin (`capacitor://localhost`) is not `solvr.com.au`. When native,
// point the tRPC client at the absolute backend URL. CORS on solvr.com.au
// allows `capacitor://localhost` (see Unit 0 of the migration spec).
const isNative = Capacitor.isNativePlatform();

// Rewrite any navigation to `/` into `/portal/dashboard` when running in Capacitor.
// `/` in the SPA maps to the marketing landing page (the public solvr.com.au home),
// which is not relevant inside the mobile app — the mobile app is portal-only.
//
// This catches three cases:
//   1. Initial launch with pathname `/` (webview boot)
//   2. wouter/react-router setLocation("/") calls (these use history.pushState under the hood)
//   3. Any other in-SPA navigation that lands on `/`
//
// Known callers of setLocation("/") in the SPA:
//   - client/src/pages/NotFound.tsx "Go Home" button — the reason this patch exists
const REWRITE_TARGET = "/portal/dashboard";

function capacitorRewriteUrl<T extends string | URL | null | undefined>(url: T): T {
  if (typeof url === "string" && (url === "/" || url === "")) {
    return REWRITE_TARGET as T;
  }
  // URL objects with pathname "/" also need rewriting (wouter passes strings, but safety net)
  if (url instanceof URL && (url.pathname === "/" || url.pathname === "")) {
    const rewritten = new URL(url);
    rewritten.pathname = REWRITE_TARGET;
    return rewritten as T;
  }
  return url;
}

if (isNative) {
  // 1. Handle initial load — webview boots at capacitor://localhost/
  if (window.location.pathname === "/" || window.location.pathname === "") {
    window.history.replaceState(null, "", REWRITE_TARGET);
  }

  // 2. Patch history.pushState / replaceState so SPA navigation to `/` is intercepted
  const origPushState = window.history.pushState.bind(window.history);
  const origReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = function (state, title, url) {
    return origPushState(state, title, capacitorRewriteUrl(url));
  };
  window.history.replaceState = function (state, title, url) {
    return origReplaceState(state, title, capacitorRewriteUrl(url));
  };

  // 3. Native UI polish — dark status bar + hide splash once SPA is ready.
  // These imports are dynamic so browser builds don't pay the bundle cost.
  (async () => {
    try {
      const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
      ]);
      // Dark navy theme — status bar text should be light (Style.Dark = dark background, light text)
      await StatusBar.setStyle({ style: Style.Dark });
      // Fade the splash out 300ms after JS is ready. Capacitor keeps the splash
      // visible while the webview loads the SPA bundle; we only hide once React
      // has mounted and the root bundle is parsed.
      await SplashScreen.hide({ fadeOutDuration: 300 });
    } catch (err) {
      // Native UI polish is best-effort — never let it block the app from starting
      console.warn("[capacitor bootstrap] StatusBar/SplashScreen setup skipped:", err);
    }
  })();
}

// getSolvrOrigin() returns "https://solvr.com.au" on Capacitor (where
// window.location.origin is "capacitor://localhost") and window.location.origin
// on web. This replaces our old API_BASE_URL constant and is also used by all
// raw fetch() calls across the codebase (upload-audio, upload-photo, Stripe
// checkout, etc.) — see client/src/const.ts.

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getSolvrOrigin()}/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
