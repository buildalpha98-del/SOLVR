/**
 * Portal Login — branded landing page + email/password auth for Solvr portal clients.
 *
 * Split layout:
 *   Left: Value prop, trust signals, features overview
 *   Right: Login form (email + password)
 *
 * Also handles legacy magic-link tokens via ?token= query param.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldCheck, AlertCircle, Eye, EyeOff, Phone, FileText, BarChart3, Clock, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isNativeApp } from "@/const";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

const FEATURES = [
  { icon: Phone, title: "AI Receptionist", desc: "Never miss a call — your AI answers 24/7 and books jobs automatically." },
  { icon: FileText, title: "Voice-to-Quote", desc: "Describe the job out loud, get a professional quote in seconds." },
  { icon: BarChart3, title: "Performance Dashboard", desc: "Track calls, jobs, and revenue at a glance." },
  { icon: Clock, title: "Save 10+ Hours/Week", desc: "Automate admin so you can focus on the tools." },
];

export default function PortalLogin() {
  const [mode, setMode] = useState<"form" | "magic-link-pending" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);

  // Referral code lookup
  const referralQuery = trpc.portal.lookupReferralCode.useQuery(
    { code: refCode! },
    { enabled: !!refCode }
  );

  // Legacy magic-link exchange
  const loginMutation = trpc.portal.login.useMutation({
    onSuccess: (data) => {
      setMode("success");
      const dest = (data as any).onboardingCompleted ? "/portal/dashboard" : "/portal/onboarding";
      setTimeout(() => { window.location.href = dest; }, 1200);
    },
    onError: (err) => {
      setMode("error");
      setErrorMsg(err.message || "This link is invalid or has expired.");
    },
  });

  // Password login
  const passwordLoginMutation = trpc.portal.passwordLogin.useMutation({
    onSuccess: (data) => {
      setMode("success");
      const dest = data.onboardingCompleted ? "/portal/dashboard" : "/portal/onboarding";
      setTimeout(() => { window.location.href = dest; }, 1000);
    },
    onError: (err) => {
      setIsSubmitting(false);
      setErrorMsg(err.message || "Incorrect email or password.");
    },
  });

  // On mount: check for legacy magic-link token + referral code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const ref = params.get("ref");
    if (token) {
      setMode("magic-link-pending");
      loginMutation.mutate({ token });
    }
    if (ref) setRefCode(ref);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    setErrorMsg("");
    passwordLoginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#0F1F3D" }}>
      {/* Left panel — value prop (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-16"
        style={{ background: "linear-gradient(135deg, #0F1F3D 0%, #1A3358 100%)" }}>
        <div>
          <img src={LOGO} alt="Solvr" className="h-8 opacity-90" />
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-white text-3xl xl:text-4xl font-bold leading-tight">
              Your AI-powered<br />business command centre.
            </h1>
            <p className="text-white/50 text-base mt-4 max-w-md">
              Everything you need to run your business smarter — AI receptionist,
              instant quoting, job tracking, and performance insights. All in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <f.icon className="w-5 h-5 mb-2" style={{ color: "#F5A623" }} />
                <h3 className="text-white text-sm font-semibold mb-1">{f.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-white text-2xl font-bold" style={{ color: "#F5A623" }}>10+</div>
            <div className="text-white/40 text-xs">hrs saved/week</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-white text-2xl font-bold" style={{ color: "#F5A623" }}>24/7</div>
            <div className="text-white/40 text-xs">call answering</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-white text-2xl font-bold" style={{ color: "#F5A623" }}>30s</div>
            <div className="text-white/40 text-xs">voice-to-quote</div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Referral banner */}
          {refCode && referralQuery.data && (
            <div
              className="mb-6 p-4 rounded-xl flex items-start gap-3"
              style={{ background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.25)" }}
            >
              <Gift className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "#F5A623" }} />
              <div>
                <p className="text-white text-sm font-semibold">
                  {referralQuery.data.businessName} invited you to Solvr
                </p>
                <p className="text-white/60 text-xs mt-0.5">
                  Sign up today and your referrer gets 20% off their next month. Welcome aboard!
                </p>
              </div>
            </div>
          )}
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
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
              <p className="text-white font-medium">Welcome back — loading your portal.</p>
            </div>
          )}

          {/* Error (magic link) */}
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
                <h1 className="text-white text-2xl font-bold">Welcome back</h1>
                <p className="text-white/50 text-sm mt-1">Sign in to your client portal</p>
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
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-amber-400/50 h-11"
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
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-amber-400/50 pr-10 h-11"
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
                className="w-full font-semibold text-sm h-11 cursor-pointer"
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

              {/* Tip for time-poor users */}
              <div className="mt-8 p-4 rounded-xl text-center" style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.1)" }}>
                {isNativeApp() ? (
                  <>
                    <p className="text-white/40 text-xs">
                      New to Solvr? Subscribe at solvr.com.au on your browser, then log in here.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-white/40 text-xs">
                      First time here? Your Solvr team will set up your account and send you your login details.
                    </p>
                    <a
                      href="https://solvr.com.au"
                      className="text-amber-400/70 hover:text-amber-400 text-xs transition-colors mt-1 inline-block"
                    >
                      Learn more about Solvr →
                    </a>
                  </>
                )}
              </div>
            </form>
          )}

          <p className="text-center text-white/20 text-xs mt-10">
            Powered by{" "}
            <a href="https://solvr.com.au" className="hover:text-white/40 transition-colors">Solvr</a>
          </p>
          <div className="flex justify-center gap-4 mt-3">
            <a
              href="https://solvr.com.au/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/20 hover:text-white/40 text-xs transition-colors"
            >
              Privacy Policy
            </a>
            <span className="text-white/10 text-xs">·</span>
            <a
              href="https://solvr.com.au/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/20 hover:text-white/40 text-xs transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
