/**
 * Portal Login — magic-link exchange page.
 * Clients land here via /portal/login?token=xxx from their go-live email.
 * Exchanges the access token for a session cookie, then redirects to /portal.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

export default function PortalLogin() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const loginMutation = trpc.portal.login.useMutation({
    onSuccess: () => {
      setStatus("success");
      setTimeout(() => navigate("/portal/dashboard"), 1200);
    },
    onError: (err) => {
      setStatus("error");
      setErrorMsg(err.message || "This link is invalid or has expired. Please contact Solvr support.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("No access token found. Please use the link from your go-live email.");
      return;
    }
    loginMutation.mutate({ token });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F1F3D" }}>
      <div className="text-center max-w-sm px-6">
        <img src={LOGO} alt="Solvr" className="h-10 mx-auto mb-8 opacity-90" />

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-400" />
            <p className="text-white/70 text-sm">Verifying your access link…</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <ShieldCheck className="w-10 h-10 mx-auto text-green-400" />
            <p className="text-white font-medium">Access confirmed — taking you to your portal.</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <AlertCircle className="w-10 h-10 mx-auto text-red-400" />
            <p className="text-white font-medium">Link invalid</p>
            <p className="text-white/60 text-sm">{errorMsg}</p>
            <a
              href="mailto:hello@solvr.com.au"
              className="inline-block mt-4 text-amber-400 text-sm underline"
            >
              Contact Solvr support
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
