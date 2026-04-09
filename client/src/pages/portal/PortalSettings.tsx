/**
 * PortalSettings — client-facing settings page.
 * Currently contains: Change Password.
 * Future: notification preferences, branding, etc.
 */
import { useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function PortalSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const changePassword = trpc.portal.changePassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully.");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update password.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  }

  const newPasswordStrength = (() => {
    if (newPassword.length === 0) return null;
    if (newPassword.length < 8) return { label: "Too short", color: "#ef4444" };
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (score === 0) return { label: "Weak", color: "#f97316" };
    if (score === 1) return { label: "Fair", color: "#eab308" };
    if (score === 2) return { label: "Good", color: "#22c55e" };
    return { label: "Strong", color: "#16a34a" };
  })();

  return (
    <PortalLayout>
      <div className="max-w-xl">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Manage your account preferences and security.
          </p>
        </div>

        {/* Change Password card */}
        <div
          className="rounded-xl p-6"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(245,166,35,0.12)" }}
            >
              <KeyRound className="w-4 h-4" style={{ color: "#F5A623" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Change Password</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                Update your portal login password.
              </p>
            </div>
          </div>

          {success && (
            <div
              className="flex items-center gap-2 rounded-lg px-4 py-3 mb-5 text-sm font-medium"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80" }}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Password updated successfully. Use your new password next time you log in.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-white/70 text-sm">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="pr-10"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  onClick={() => setShowCurrent(!showCurrent)}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-white/70 text-sm">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pr-10"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  onClick={() => setShowNew(!showNew)}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength indicator */}
              {newPasswordStrength && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-1 w-8 rounded-full transition-colors"
                        style={{
                          background:
                            newPassword.length < 8
                              ? i === 1 ? "#ef4444" : "rgba(255,255,255,0.1)"
                              : i <= (["Weak","Fair","Good","Strong"].indexOf(newPasswordStrength.label) + 1)
                              ? newPasswordStrength.color
                              : "rgba(255,255,255,0.1)",
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: newPasswordStrength.color }}>
                    {newPasswordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm new password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-white/70 text-sm">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: confirmPassword && confirmPassword !== newPassword
                      ? "1px solid rgba(239,68,68,0.5)"
                      : confirmPassword && confirmPassword === newPassword
                      ? "1px solid rgba(34,197,94,0.4)"
                      : "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs" style={{ color: "#f87171" }}>Passwords do not match.</p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={
                  changePassword.isPending ||
                  !currentPassword ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                className="w-full font-semibold"
                style={{ background: "#F5A623", color: "#0F1F3D" }}
              >
                {changePassword.isPending ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </PortalLayout>
  );
}
