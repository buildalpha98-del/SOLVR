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
const isNative = Capacitor.isNativePlatform();

const REWRITE_TARGET = "/portal/dashboard";

function capacitorRewriteUrl<T extends string | URL | null | undefined>(url: T): T {
  if (typeof url === "string" && (url === "/" || url === "")) {
    return REWRITE_TARGET as T;
  }
  if (url instanceof URL && (url.pathname === "/" || url.pathname === "")) {
    const rewritten = new URL(url);
    rewritten.pathname = REWRITE_TARGET;
    return rewritten as T;
  }
  return url;
}

if (isNative) {
  if (window.location.pathname === "/" || window.location.pathname === "") {
    window.history.replaceState(null, "", REWRITE_TARGET);
  }

  const origPushState = window.history.pushState.bind(window.history);
  const origReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = function (state, title, url) {
    return origPushState(state, title, capacitorRewriteUrl(url));
  };
  window.history.replaceState = function (state, title, url) {
    return origReplaceState(state, title, capacitorRewriteUrl(url));
  };

  (async () => {
    try {
      const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
      ]);
      await StatusBar.setStyle({ style: Style.Dark });
      await SplashScreen.hide({ fadeOutDuration: 300 });
    } catch (err) {
      console.warn("[capacitor bootstrap] StatusBar/SplashScreen setup skipped:", err);
    }
  })();

  // 4. Intercept all <a target="_blank"> clicks to open in-app browser
  //    instead of kicking to Safari (which loses app context).
  document.addEventListener("click", (e) => {
    const anchor = (e.target as HTMLElement).closest?.("a[target='_blank']") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.href;
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    e.preventDefault();
    import("@capacitor/browser").then(({ Browser }) => {
      Browser.open({ url: href });
    }).catch(() => {
      window.open(href, "_blank");
    });
  }, true);

  // 5. Initialise RevenueCat native SDK for Apple IAP.
  // Must be done early, before any paywall or entitlement check.
  // We initialise anonymously here — the hook will identify the user later.
  (async () => {
    try {
      const { configureRevenueCat } = await import("@/lib/revenuecat");
      await configureRevenueCat(); // anonymous until user logs in
      console.log("[capacitor bootstrap] RevenueCat native SDK initialised");
    } catch (err) {
      console.warn("[capacitor bootstrap] RevenueCat init skipped:", err);
    }
  })();
}

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
