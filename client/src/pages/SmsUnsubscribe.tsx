/**
 * SmsUnsubscribe — public page, no auth required.
 * Accessed via /sms/unsubscribe?token=<hex>
 *
 * Calls trpc.portalCustomers.smsUnsubscribe to mark the customer as opted out.
 * Shows a clean confirmation or error state.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Loader2, MessageSquareOff } from "lucide-react";

export default function SmsUnsubscribe() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [done, setDone] = useState(false);
  const [alreadyOptedOut, setAlreadyOptedOut] = useState(false);
  const [name, setName] = useState<string | null>(null);

  const unsubscribeMutation = trpc.portalCustomers.smsUnsubscribe.useMutation({
    onSuccess: (data) => {
      setName(data.name);
      setAlreadyOptedOut(data.alreadyOptedOut);
      setDone(true);
    },
  });

  useEffect(() => {
    if (!token) return;
    unsubscribeMutation.mutate({ token });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#0A1628" }}
    >
      {/* Logo / brand */}
      <div className="mb-8 text-center">
        <div
          className="inline-flex items-center gap-2 text-xl font-bold"
          style={{ color: "#F5A623" }}
        >
          <MessageSquareOff className="w-6 h-6" />
          <span>Solvr</span>
        </div>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
          SMS Preferences
        </p>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* No token */}
        {!token && (
          <>
            <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#f87171" }} />
            <h1 className="text-lg font-bold text-white mb-2">Invalid Link</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              This unsubscribe link is missing a token. Please use the link from your SMS message.
            </p>
          </>
        )}

        {/* Loading */}
        {token && unsubscribeMutation.isPending && (
          <>
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: "#F5A623" }} />
            <h1 className="text-lg font-bold text-white mb-2">Processing…</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Updating your SMS preferences.
            </p>
          </>
        )}

        {/* Error */}
        {token && unsubscribeMutation.isError && (
          <>
            <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#f87171" }} />
            <h1 className="text-lg font-bold text-white mb-2">Link Not Found</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              {unsubscribeMutation.error?.message ?? "This unsubscribe link is invalid or has expired."}
            </p>
          </>
        )}

        {/* Success */}
        {done && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#4ade80" }} />
            <h1 className="text-lg font-bold text-white mb-2">
              {alreadyOptedOut ? "Already Unsubscribed" : "You're Unsubscribed"}
            </h1>
            <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
              {name ? (
                <>
                  <span className="font-semibold text-white">{name}</span>,{" "}
                </>
              ) : null}
              {alreadyOptedOut
                ? "You were already opted out of SMS marketing from this business."
                : "You will no longer receive bulk SMS messages from this business."}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              You may still receive transactional messages (e.g. job confirmations) if you have an active booking.
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
        Powered by Solvr · solvr.com.au
      </p>
    </div>
  );
}
