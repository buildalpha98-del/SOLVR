/**
 * PortalSettings — client-facing settings page.
 * Sections: Business Profile, Change Password.
 */
import { useState, useEffect } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  KeyRound, Eye, EyeOff, CheckCircle2, Building2, Save, Loader2,
} from "lucide-react";
import MemoryFileSection from "./MemoryFileSection";
import { toast } from "sonner";

// ─── Shared input style ──────────────────────────────────────────────────────
const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
};

// ─── Section card wrapper ────────────────────────────────────────────────────
function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(245,166,35,0.12)" }}
        >
          <Icon className="w-4 h-4" style={{ color: "#F5A623" }} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function PortalSettings() {
  // ─── Business Profile state ──────────────────────────────────────────────
  const profileQuery = trpc.portal.getBusinessProfile.useQuery();
  const updateProfile = trpc.portal.updateBusinessProfile.useMutation({
    onSuccess: () => {
      toast.success("Business profile saved.");
      profileQuery.refetch();
    },
    onError: (err) => toast.error(err.message ?? "Failed to save profile."),
  });

  const [profile, setProfile] = useState({
    tradingName: "",
    abn: "",
    phone: "",
    address: "",
    replyToEmail: "",
    paymentTerms: "",
    gstRate: "10.00",
    validityDays: 30,
    defaultNotes: "",
  });
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (profileQuery.data && !profileLoaded) {
      setProfile({
        tradingName: profileQuery.data.tradingName ?? "",
        abn: profileQuery.data.abn ?? "",
        phone: profileQuery.data.phone ?? "",
        address: profileQuery.data.address ?? "",
        replyToEmail: profileQuery.data.replyToEmail ?? "",
        paymentTerms: profileQuery.data.paymentTerms ?? "",
        gstRate: profileQuery.data.gstRate ?? "10.00",
        validityDays: profileQuery.data.validityDays ?? 30,
        defaultNotes: profileQuery.data.defaultNotes ?? "",
      });
      setProfileLoaded(true);
    }
  }, [profileQuery.data, profileLoaded]);

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate(profile);
  }

  function updateField(field: keyof typeof profile, value: string | number) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  // ─── Change Password state ──────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  const changePassword = trpc.portal.changePassword.useMutation({
    onSuccess: () => {
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully.");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update password."),
  });

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwSuccess(false);
    if (newPassword.length < 8) { toast.error("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match."); return; }
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

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <PortalLayout>
      <div className="max-w-xl">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Manage your business details, quote defaults, and account security.
          </p>
        </div>

        {/* ── Business Profile ─────────────────────────────────────────── */}
        <SectionCard
          icon={Building2}
          title="Business Profile"
          subtitle="These details appear on your quotes and invoices."
        >
          {profileQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
            </div>
          ) : (
            <form onSubmit={handleProfileSave} className="space-y-4">
              {/* Row 1: Trading Name + ABN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Trading Name</Label>
                  <Input
                    placeholder="e.g. Smith's Plumbing"
                    value={profile.tradingName}
                    onChange={(e) => updateField("tradingName", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">ABN</Label>
                  <Input
                    placeholder="e.g. 12 345 678 901"
                    value={profile.abn}
                    onChange={(e) => updateField("abn", e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Row 2: Phone + Reply-to Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Business Phone</Label>
                  <Input
                    placeholder="e.g. 0412 345 678"
                    value={profile.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Reply-to Email</Label>
                  <Input
                    type="email"
                    placeholder="e.g. quotes@yourbusiness.com.au"
                    value={profile.replyToEmail}
                    onChange={(e) => updateField("replyToEmail", e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Row 3: Address (full width) */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Business Address</Label>
                <Input
                  placeholder="e.g. 42 George St, Parramatta NSW 2150"
                  value={profile.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Row 4: GST Rate + Quote Validity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">GST Rate (%)</Label>
                  <Input
                    placeholder="10.00"
                    value={profile.gstRate}
                    onChange={(e) => updateField("gstRate", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Quote Validity (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={profile.validityDays}
                    onChange={(e) => updateField("validityDays", parseInt(e.target.value) || 30)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Row 5: Payment Terms */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Payment Terms</Label>
                <Input
                  placeholder="e.g. Payment due within 14 days of invoice."
                  value={profile.paymentTerms}
                  onChange={(e) => updateField("paymentTerms", e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Row 6: Default Notes */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Default Quote Notes</Label>
                <Textarea
                  placeholder="Notes or terms that appear at the bottom of every quote..."
                  value={profile.defaultNotes}
                  onChange={(e) => updateField("defaultNotes", e.target.value)}
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: "vertical" as const,
                  }}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="font-semibold"
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                >
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Business Profile
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </SectionCard>

        {/* ── AI Memory File ─────────────────────────────────────────── */}
        <MemoryFileSection />

        {/* ── Change Password ──────────────────────────────────────────── */}
        <SectionCard
          icon={KeyRound}
          title="Change Password"
          subtitle="Update your portal login password."
        >
          {pwSuccess && (
            <div
              className="flex items-center gap-2 rounded-lg px-4 py-3 mb-5 text-sm font-medium"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80" }}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Password updated successfully. Use your new password next time you log in.
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-white/70 text-sm">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="pr-10"
                  style={inputStyle}
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
              <Label htmlFor="newPassword" className="text-white/70 text-sm">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pr-10"
                  style={inputStyle}
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
              <Label htmlFor="confirmPassword" className="text-white/70 text-sm">Confirm New Password</Label>
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
                    ...inputStyle,
                    border: confirmPassword && confirmPassword !== newPassword
                      ? "1px solid rgba(239,68,68,0.5)"
                      : confirmPassword && confirmPassword === newPassword
                      ? "1px solid rgba(34,197,94,0.4)"
                      : "1px solid rgba(255,255,255,0.12)",
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
        </SectionCard>
      </div>
    </PortalLayout>
  );
}
