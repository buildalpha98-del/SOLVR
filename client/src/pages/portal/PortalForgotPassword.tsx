/**
 * Portal Forgot Password — sends a password reset email.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

export default function PortalForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const forgotMutation = trpc.portal.forgotPassword.useMutation({
    onSuccess: () => {
      setSent(true);
      setIsSubmitting(false);
    },
    onError: (err) => {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    setErrorMsg("");
    forgotMutation.mutate({ email });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0F1F3D" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={LOGO} alt="Solvr" className="h-10 mx-auto opacity-90" />
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-400" />
            <h2 className="text-white font-semibold text-lg">Check your email</h2>
            <p className="text-white/60 text-sm">
              If an account exists for <strong className="text-white/80">{email}</strong>, you'll receive a password reset link within a few minutes.
            </p>
            <a
              href="/portal/login"
              className="inline-flex items-center gap-1.5 text-amber-400 text-sm hover:text-amber-300 transition-colors mt-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-6">
              <h1 className="text-white text-xl font-semibold">Reset your password</h1>
              <p className="text-white/50 text-sm mt-1">
                Enter your email and we'll send you a reset link.
              </p>
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

            <Button
              type="submit"
              disabled={isSubmitting || !email}
              className="w-full font-semibold text-sm h-11"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</>
              ) : (
                "Send reset link"
              )}
            </Button>

            <div className="text-center">
              <a
                href="/portal/login"
                className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/60 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
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
