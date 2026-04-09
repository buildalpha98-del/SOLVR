/**
 * Portal Reset Password — validates the reset token and sets a new password.
 * Reached via /portal/reset-password?token=xxx from the reset email.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

export default function PortalResetPassword() {
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setErrorMsg("No reset token found. Please request a new password reset link.");
    } else {
      setToken(t);
    }
  }, []);

  const resetMutation = trpc.portal.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setIsSubmitting(false);
      // Redirect to login after 2s
      setTimeout(() => { window.location.href = "/portal/login"; }, 2500);
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to reset password. Please request a new link.");
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    resetMutation.mutate({ token, newPassword });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0F1F3D" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={LOGO} alt="Solvr" className="h-10 mx-auto opacity-90" />
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-400" />
            <h2 className="text-white font-semibold text-lg">Password updated</h2>
            <p className="text-white/60 text-sm">Taking you back to sign in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-6">
              <h1 className="text-white text-xl font-semibold">Set a new password</h1>
              <p className="text-white/50 text-sm mt-1">Choose a password that's at least 8 characters.</p>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-sm">{errorMsg}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-white/70 text-sm">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting || !token}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/70 text-sm">Confirm password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
                disabled={isSubmitting || !token}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-amber-400/50"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !token || !newPassword || !confirmPassword}
              className="w-full font-semibold text-sm h-11"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating…</>
              ) : (
                "Update password"
              )}
            </Button>
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
