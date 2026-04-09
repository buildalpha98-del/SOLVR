/**
 * Portal Login — email + password authentication for Solvr portal clients.
 *
 * Two modes:
 *   1. /portal/login                 → email + password form (default)
 *   2. /portal/login?token=xxx       → legacy magic-link exchange (backward compat)
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

export default function PortalLogin() {
  const [mode, setMode] = useState<"form" | "magic-link-pending" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Legacy magic-link exchange
  const loginMutation = trpc.portal.login.useMutation({
    onSuccess: () => {
      setMode("success");
      setTimeout(() => { window.location.href = "/portal/dashboard"; }, 1200);
    },
    onError: (err) => {
      setMode("error");
      setErrorMsg(err.message || "This link is invalid or has expired.");
    },
  });

  // Password login
  const passwordLoginMutation = trpc.portal.passwordLogin.useMutation({
    onSuccess: () => {
      setMode("success");
      setTimeout(() => { window.location.href = "/portal/dashboard"; }, 1000);
    },
    onError: (err) => {
      setIsSubmitting(false);
      setErrorMsg(err.message || "Incorrect email or password.");
    },
  });

  // On mount: check for legacy magic-link token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setMode("magic-link-pending");
      loginMutation.mutate({ token });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    setErrorMsg("");
    passwordLoginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0F1F3D" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={LOGO} alt="Solvr" className="h-10 mx-auto opacity-90" />
        </div>

        {/* Magic link pending */}
        {mode === "magic-link-pending" && (
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-400" />
            <p className="text-white/70 text-sm">Verifying your access link…</p>
          </div>
        )}

        {/* Success */}
        {mode === "success" && (
          <div className="text-center space-y-4">
            <ShieldCheck className="w-10 h-10 mx-auto text-green-400" />
            <p className="text-white font-medium">Access confirmed — taking you to your portal.</p>
          </div>
        )}

        {/* Error (magic link only) */}
        {mode === "error" && (
          <div className="text-center space-y-6">
            <AlertCircle className="w-10 h-10 mx-auto text-red-400" />
            <p className="text-white font-medium">Link invalid</p>
            <p className="text-white/60 text-sm">{errorMsg}</p>
            <button
              onClick={() => { setMode("form"); setErrorMsg(""); }}
              className="text-amber-400 text-sm underline"
            >
              Log in with email &amp; password instead
            </button>
          </div>
        )}

        {/* Password login form */}
        {mode === "form" && (
          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <div className="text-center mb-6">
              <h1 className="text-white text-xl font-semibold">Client Portal</h1>
              <p className="text-white/50 text-sm mt-1">Sign in to your Solvr portal</p>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-sm">{errorMsg}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70 text-sm">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isSubmitting}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-amber-400/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-amber-400/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full font-semibold text-sm h-11"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in…</>
              ) : (
                "Sign in"
              )}
            </Button>

            <div className="text-center">
              <a
                href="/portal/forgot-password"
                className="text-amber-400/70 hover:text-amber-400 text-sm transition-colors"
              >
                Forgot your password?
              </a>
            </div>
          </form>
        )}

        <p className="text-center text-white/20 text-xs mt-10">
          Powered by{" "}
          <a href="https://solvr.com.au" className="hover:text-white/40 transition-colors">Solvr</a>
        </p>
      </div>
    </div>
  );
}
