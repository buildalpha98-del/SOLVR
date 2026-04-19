import { openUrl } from "@/lib/openUrl";
/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalSettings — client-facing settings page.
 * Sections: Business Profile, Change Password.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { getSolvrOrigin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  KeyRound, Eye, EyeOff, CheckCircle2, Building2, Save, Loader2, CreditCard, Trash2, AlertTriangle,
  Bell, ExternalLink, RefreshCw, ShieldCheck, LogOut, Zap, ClipboardList, Plus, X,
} from "lucide-react";
import MemoryFileSection from "./MemoryFileSection";
import GoogleReviewSection from "./GoogleReviewSection";
import { toast } from "sonner";
import { usePortalRole } from "@/hooks/usePortalRole";
import { ViewerBanner } from "@/components/portal/ViewerBanner";

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
  const [, navigate] = useLocation();
  const { canWrite } = usePortalRole();

  // ─── Logout ──────────────────────────────────────────────────────────────
  const logoutMutation = trpc.portal.logout.useMutation({
    onSuccess: () => {
      toast.success("Logged out successfully.");
      navigate("/portal");
    },
    onError: () => {
      // Clear locally even if server call fails
      navigate("/portal");
    },
  });

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

  // ─── Payment / bank details state ────────────────────────────────────────
  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    bankAccountName: "",
    bankBsb: "",
    bankAccountNumber: "",
  });
  const [bankLoaded, setBankLoaded] = useState(false);
  const updateBankDetails = trpc.portal.updateBusinessProfile.useMutation({
    onSuccess: () => toast.success("Payment details saved."),
    onError: (err) => toast.error(err.message ?? "Failed to save payment details."),
  });

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
    if (profileQuery.data && !bankLoaded) {
      setBankDetails({
        bankName: (profileQuery.data as any).bankName ?? "",
        bankAccountName: (profileQuery.data as any).bankAccountName ?? "",
        bankBsb: (profileQuery.data as any).bankBsb ?? "",
        bankAccountNumber: (profileQuery.data as any).bankAccountNumber ?? "",
      });
      setBankLoaded(true);
    }
  }, [profileQuery.data, profileLoaded, bankLoaded]);

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

        {!canWrite && <ViewerBanner />}

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
                  disabled={updateProfile.isPending || !canWrite}
                  className="font-semibold"
                  style={{ background: canWrite ? "#F5A623" : "rgba(245,166,35,0.3)", color: "#0F1F3D" }}
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

        {/* ── Payment Details ─────────────────────────────────────────── */}
        <SectionCard
          icon={CreditCard}
          title="Payment Details"
          subtitle="Your bank details appear on invoices so customers know where to pay."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateBankDetails.mutate(bankDetails);
            }}
            className="space-y-4"
          >
            {/* Row 1: Bank Name + Account Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Bank Name</Label>
                <Input
                  placeholder="e.g. Commonwealth Bank"
                  value={bankDetails.bankName}
                  onChange={(e) => setBankDetails((p) => ({ ...p, bankName: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Account Name</Label>
                <Input
                  placeholder="e.g. Smith's Plumbing Pty Ltd"
                  value={bankDetails.bankAccountName}
                  onChange={(e) => setBankDetails((p) => ({ ...p, bankAccountName: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Row 2: BSB + Account Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">BSB</Label>
                <Input
                  placeholder="e.g. 062-000"
                  value={bankDetails.bankBsb}
                  onChange={(e) => setBankDetails((p) => ({ ...p, bankBsb: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Account Number</Label>
                <Input
                  placeholder="e.g. 12345678"
                  value={bankDetails.bankAccountNumber}
                  onChange={(e) => setBankDetails((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              These details are printed on every invoice PDF under the payment instructions section.
            </p>

            <div className="pt-1">
              <Button
                type="submit"
                disabled={updateBankDetails.isPending || !canWrite}
                className="font-semibold"
                style={{ background: canWrite ? "#F5A623" : "rgba(245,166,35,0.3)", color: "#0F1F3D" }}
              >
                {updateBankDetails.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Save Payment Details</>
                )}
              </Button>
            </div>
          </form>
        </SectionCard>

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
                  !canWrite ||
                  !currentPassword ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                className="w-full font-semibold"
                style={{ background: canWrite ? "#F5A623" : "rgba(245,166,35,0.3)", color: "#0F1F3D" }}
              >
                {changePassword.isPending ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </SectionCard>

        {/* ─── Licence & Insurance ──────────────────────────────────────────── */}
        <LicenceInsuranceSection />

        {/* ─── Billing ──────────────────────────────────────────────────────────── */}
        <BillingSection />

        {/* ─── Google Reviews ───────────────────────────────────────────────────── */}
        <GoogleReviewSection />

        {/* ─── Required Forms per Job Type ──────────────────────────────────── */}
        <RequiredFormsConfigSection />

        {/* ─── Automation ──────────────────────────────────────────────────────── */}
        <AutomationSection />

        {/* ─── Notifications ────────────────────────────────────────────────────── */}
        <NotificationsSection />

        {/* ─── Log Out ──────────────────────────────────────────────────────────── */}
        <SectionCard
          icon={LogOut}
          title="Log Out"
          subtitle="Sign out of your Solvr portal on this device."
        >
          <Button
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-400 font-semibold"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging out...</>
            ) : (
              <><LogOut className="w-4 h-4 mr-2" />Log Out</>  
            )}
          </Button>
        </SectionCard>

        {/* ─── Delete Account ───────────────────────────────────────────────────── */}
        <DeleteAccountSection />
      </div>
    </PortalLayout>
  );
}

// // ─── Licence & Insurance Section ─────────────────────────────────────────
function LicenceInsuranceSection() {
  const profileQuery = trpc.portal.getBusinessProfile.useQuery();
  const saveMutation = trpc.portal.saveLicenceInsurance.useMutation({
    onSuccess: () => {
      toast.success("Licence & insurance details saved.");
      profileQuery.refetch();
    },
    onError: (err) => toast.error(err.message ?? "Failed to save."),
  });

  const [form, setForm] = useState({
    licenceNumber: "",
    licenceType: "",
    licenceAuthority: "",
    licenceExpiryDate: "",
    abn: "",
    insurerName: "",
    insurancePolicyNumber: "",
    insuranceCoverageAud: "",
    insuranceExpiryDate: "",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = profileQuery.data as any;
    if (d && !loaded) {
      setForm({
        licenceNumber: d.licenceNumber ?? "",
        licenceType: d.licenceType ?? "",
        licenceAuthority: d.licenceAuthority ?? "",
        licenceExpiryDate: d.licenceExpiryDate ?? "",
        abn: d.abn ?? "",
        insurerName: d.insurerName ?? "",
        insurancePolicyNumber: d.insurancePolicyNumber ?? "",
        insuranceCoverageAud: d.insuranceCoverageAud ? String(d.insuranceCoverageAud) : "",
        insuranceExpiryDate: d.insuranceExpiryDate ?? "",
      });
      setLoaded(true);
    }
  }, [profileQuery.data, loaded]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      licenceNumber: form.licenceNumber || undefined,
      licenceType: form.licenceType || undefined,
      licenceAuthority: form.licenceAuthority || undefined,
      licenceExpiryDate: form.licenceExpiryDate || undefined,
      abn: form.abn || undefined,
      insurerName: form.insurerName || undefined,
      insurancePolicyNumber: form.insurancePolicyNumber || undefined,
      insuranceCoverageAud: form.insuranceCoverageAud ? parseInt(form.insuranceCoverageAud, 10) : undefined,
      insuranceExpiryDate: form.insuranceExpiryDate || undefined,
    });
  }

  return (
    <SectionCard
      icon={ShieldCheck}
      title="Licence & Insurance"
      subtitle="Used on compliance documents (SWMS, safety certs) and quotes."
    >
      {profileQuery.isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Licence */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contractor Licence</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Licence Number</Label>
                <Input
                  placeholder="e.g. 123456C"
                  value={form.licenceNumber}
                  onChange={(e) => setForm(p => ({ ...p, licenceNumber: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Licence Type / Class</Label>
                <Input
                  placeholder="e.g. Unrestricted Electrical"
                  value={form.licenceType}
                  onChange={(e) => setForm(p => ({ ...p, licenceType: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Issuing Authority</Label>
                <Input
                  placeholder="e.g. NSW Fair Trading"
                  value={form.licenceAuthority}
                  onChange={(e) => setForm(p => ({ ...p, licenceAuthority: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Expiry Date</Label>
                <Input
                  type="date"
                  value={form.licenceExpiryDate}
                  onChange={(e) => setForm(p => ({ ...p, licenceExpiryDate: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-xs font-semibold mb-3 mt-3" style={{ color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Public Liability Insurance</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Insurer Name</Label>
                <Input
                  placeholder="e.g. CGU Insurance"
                  value={form.insurerName}
                  onChange={(e) => setForm(p => ({ ...p, insurerName: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Policy Number</Label>
                <Input
                  placeholder="e.g. PLI-2024-00123"
                  value={form.insurancePolicyNumber}
                  onChange={(e) => setForm(p => ({ ...p, insurancePolicyNumber: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Coverage Amount (AUD)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 20000000"
                  value={form.insuranceCoverageAud}
                  onChange={(e) => setForm(p => ({ ...p, insuranceCoverageAud: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Insurance Expiry Date</Label>
                <Input
                  type="date"
                  value={form.insuranceExpiryDate}
                  onChange={(e) => setForm(p => ({ ...p, insuranceExpiryDate: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full font-semibold"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {saveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Licence & Insurance</>
              )}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

// ─── Billing Section ──────────────────────────────────────────────
function BillingSection() {
  const { data: sub, isLoading } = trpc.portal.getSubscriptionStatus.useQuery(undefined, {
    staleTime: 30_000,
  });
  const billingPortal = trpc.portal.createBillingPortalSession.useMutation({
    onSuccess: ({ url }) => {
      openUrl(url);
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not open billing portal.");
    },
  });

  const planLabel = (() => {
    const p = sub?.plan as string | undefined;
    if (p === "solvr_ai" || p === "starter") return "Solvr AI";
    if (p === "solvr_jobs") return "Solvr Jobs";
    if (p === "solvr_quotes") return "Solvr Quotes";
    if (p === "professional") return "Solvr AI (Legacy)";
    return "Setup";
  })();
  const cycleLabel = sub?.billingCycle === "annual" ? "Annual" : "Monthly";
  const statusLabel = sub?.status === "active" ? "Active" : sub?.status === "trialing" ? "Trial" : sub?.status ?? "Unknown";
  const statusColor = sub?.status === "active" ? "#4ade80" : sub?.status === "trialing" ? "#F5A623" : "#f87171";

  const nextBilling = sub?.nextBillingDate
    ? new Date(sub.nextBillingDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const trialEnd = sub?.trialEndDate
    ? new Date(sub.trialEndDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <SectionCard
      icon={CreditCard}
      title="Billing & Subscription"
      subtitle="Manage your plan, payment method, and invoices."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      ) : !sub ? (
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          No active subscription found. Contact{" "}
          <a href="mailto:hello@solvr.com.au" className="underline" style={{ color: "#F5A623" }}>hello@solvr.com.au</a>{" "}
          for assistance.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Plan summary row */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Plan</div>
              <div className="text-sm font-semibold text-white">{planLabel}</div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Billing</div>
              <div className="text-sm font-semibold text-white">{cycleLabel}</div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Status</div>
              <div className="text-sm font-semibold" style={{ color: statusColor }}>{statusLabel}</div>
            </div>
          </div>

          {/* Dates */}
          {(nextBilling || trialEnd) && (
            <div className="text-sm space-y-1" style={{ color: "rgba(255,255,255,0.55)" }}>
              {trialEnd && (
                <div>Trial ends: <span className="text-white font-medium">{trialEnd}</span></div>
              )}
              {nextBilling && (
                <div>Next billing: <span className="text-white font-medium">{nextBilling}</span></div>
              )}
            </div>
          )}

          {/* Manage button */}
          <Button
            onClick={() => billingPortal.mutate({ origin: getSolvrOrigin() })}
            disabled={billingPortal.isPending}
            className="w-full flex items-center justify-center gap-2"
            style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)" }}
          >
            {billingPortal.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Opening...</>
            ) : (
              <><ExternalLink className="w-4 h-4" /> Manage Billing &amp; Invoices</>
            )}
          </Button>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Opens the Stripe billing portal in a new tab. Update your card, download invoices, or cancel your subscription.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Notifications Section ──────────────────────────────────────────────
function NotificationsSection() {
  const { data: prefs, isLoading } = trpc.portal.getNotificationPrefs.useQuery(undefined, {
    staleTime: 30_000,
  });
  const updatePrefs = trpc.portal.updateNotificationPrefs.useMutation({
    onSuccess: () => toast.success("Notification preferences saved."),
    onError: () => toast.error("Failed to save preferences."),
  });
  const utils = trpc.useUtils();

  function toggle(field: string, value: boolean) {
    updatePrefs.mutate(
      { [field]: value } as Parameters<typeof updatePrefs.mutate>[0],
      { onSuccess: () => utils.portal.getNotificationPrefs.invalidate() }
    );
  }

  type PrefRow = { label: string; emailKey: string | null; pushKey: string | null };
  const rows: PrefRow[] = [
    { label: "New call logged", emailKey: "notifyEmailNewCall", pushKey: "notifyPushNewCall" },
    { label: "New quote created", emailKey: "notifyEmailNewQuote", pushKey: "notifyPushNewQuote" },
    { label: "Quote accepted by customer", emailKey: "notifyEmailQuoteAccepted", pushKey: "notifyPushQuoteAccepted" },
    { label: "Job status update", emailKey: "notifyEmailJobUpdate", pushKey: "notifyPushJobUpdate" },
    { label: "Weekly summary email", emailKey: "notifyEmailWeeklySummary", pushKey: null },
  ];

  return (
    <SectionCard
      icon={Bell}
      title="Notification Preferences"
      subtitle="Choose how you want to be notified about activity."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      ) : (
        <div className="space-y-1">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_56px_56px] gap-2 pb-2 mb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Event</div>
            <div className="text-xs text-center" style={{ color: "rgba(255,255,255,0.35)" }}>Email</div>
            <div className="text-xs text-center" style={{ color: "rgba(255,255,255,0.35)" }}>Push</div>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1fr_56px_56px] gap-2 items-center py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-sm text-white">{row.label}</span>
              {/* Email toggle */}
              {row.emailKey ? (
                <div className="flex justify-center">
                  <button
                    onClick={() => toggle(row.emailKey!, !(prefs as Record<string, boolean>)?.[row.emailKey!])}
                    disabled={updatePrefs.isPending}
                    className="w-10 h-5 rounded-full transition-colors relative"
                    style={{
                      background: (prefs as Record<string, boolean>)?.[row.emailKey!]
                        ? "rgba(245,166,35,0.8)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                      style={{
                        transform: (prefs as Record<string, boolean>)?.[row.emailKey!]
                          ? "translateX(22px)"
                          : "translateX(2px)",
                      }}
                    />
                  </button>
                </div>
              ) : (
                <div className="flex justify-center">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                </div>
              )}
              {/* Push toggle */}
              {row.pushKey ? (
                <div className="flex justify-center">
                  <button
                    onClick={() => { const k = row.pushKey!; toggle(k, !(prefs as Record<string, boolean>)?.[k]); }}
                    disabled={updatePrefs.isPending}
                    className="w-10 h-5 rounded-full transition-colors relative"
                    style={{
                      background: (prefs as Record<string, boolean>)?.[row.pushKey]
                        ? "rgba(245,166,35,0.8)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                      style={{
                        transform: (prefs as Record<string, boolean>)?.[row.pushKey]
                          ? "translateX(22px)"
                          : "translateX(2px)",
                      }}
                    />
                  </button>
                </div>
              ) : (
                <div className="flex justify-center">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                </div>
              )}
            </div>
          ))}
          <p className="text-xs pt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Push notifications require the Solvr app to be installed and notifications to be enabled in your device settings.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Automation Section ──────────────────────────────────────────────────────
function AutomationSection() {
  const { canWrite } = usePortalRole();
  const { data: prefs, isLoading } = trpc.portal.getNotificationPrefs.useQuery(undefined, {
    staleTime: 30_000,
  });
  const updatePrefs = trpc.portal.updateNotificationPrefs.useMutation({
    onSuccess: () => toast.success("Automation settings saved."),
    onError: () => toast.error("Failed to save automation settings."),
  });
  const utils = trpc.useUtils();

  function toggleAutoInvoice() {
    if (!prefs) return;
    updatePrefs.mutate(
      { autoInvoiceOnCompletion: !prefs.autoInvoiceOnCompletion },
      { onSuccess: () => utils.portal.getNotificationPrefs.invalidate() },
    );
  }

  function toggleAppointmentReminder() {
    if (!prefs) return;
    updatePrefs.mutate(
      { appointmentReminderEnabled: !prefs.appointmentReminderEnabled },
      { onSuccess: () => utils.portal.getNotificationPrefs.invalidate() },
    );
  }

  return (
    <SectionCard
      icon={Zap}
      title="Automation"
      subtitle="Configure what happens automatically when you complete jobs."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Auto-Invoice Toggle */}
          <div
            className="flex items-center justify-between py-3 px-4 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex-1 mr-4">
              <div className="text-sm font-medium text-white">Auto-invoice on job completion</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Automatically generate and send an invoice when you mark a job as complete. The invoice will be emailed to the customer and an SMS payment link will be sent.
              </div>
            </div>
            <button
              onClick={toggleAutoInvoice}
              disabled={updatePrefs.isPending || !canWrite}
              className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
              style={{
                background: prefs?.autoInvoiceOnCompletion
                  ? "rgba(245,166,35,0.8)"
                  : "rgba(255,255,255,0.12)",
                opacity: canWrite ? 1 : 0.5,
                cursor: canWrite ? "pointer" : "not-allowed",
              }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{
                  transform: prefs?.autoInvoiceOnCompletion
                    ? "translateX(22px)"
                    : "translateX(2px)",
                }}
              />
            </button>
          </div>

          {/* Appointment Reminder Toggle */}
          <div
            className="flex items-center justify-between py-3 px-4 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex-1 mr-4">
              <div className="text-sm font-medium text-white">Appointment reminder SMS</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Send an SMS reminder to the customer 24 hours before their scheduled appointment. Includes a link to track their job status.
              </div>
            </div>
            <button
              onClick={toggleAppointmentReminder}
              disabled={updatePrefs.isPending || !canWrite}
              className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
              style={{
                background: prefs?.appointmentReminderEnabled
                  ? "rgba(245,166,35,0.8)"
                  : "rgba(255,255,255,0.12)",
                opacity: canWrite ? 1 : 0.5,
                cursor: canWrite ? "pointer" : "not-allowed",
              }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{
                  transform: prefs?.appointmentReminderEnabled
                    ? "translateX(22px)"
                    : "translateX(2px)",
                }}
              />
            </button>
          </div>

          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            These automations run in the background. Auto-invoice triggers when you mark a job complete. Appointment reminders are sent daily at 5pm for the next day's bookings.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Delete Account Section ──────────────────────────────────────────────────
function DeleteAccountSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const requestDeletion = trpc.portal.requestDeletion.useMutation({
    onSuccess: () => {
      toast.success("Deletion request sent. We will action it within 30 days.");
      setShowConfirm(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send deletion request. Please email hello@solvr.com.au.");
    },
  });

  return (
    <SectionCard
      icon={Trash2}
      title="Delete My Account"
      subtitle="Permanently remove your account and all data"
    >
      <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>
        Requesting account deletion will permanently remove your business profile, call recordings, uploaded files, and all associated data from Solvr's systems. This action cannot be undone.
      </p>
      {!showConfirm ? (
        <Button
          variant="outline"
          className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 hover:text-red-300 transition-colors"
          onClick={() => setShowConfirm(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Request Account Deletion
        </Button>
      ) : (
        <div className="rounded-lg border border-red-500/30 p-4" style={{ background: "rgba(239,68,68,0.07)" }}>
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300 mb-1">Are you sure?</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                This will send a deletion request to Solvr support. We will email you a confirmation and complete the deletion within 30 days. Your subscription will also need to be cancelled separately via the Billing page.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/60 hover:bg-white/5"
              onClick={() => setShowConfirm(false)}
              disabled={requestDeletion.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => requestDeletion.mutate()}
              disabled={requestDeletion.isPending}
            >
              {requestDeletion.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
              ) : (
                "Yes, Request Deletion"
              )}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}


// ─── Required Forms per Job Type Section ─────────────────────────────────────
function RequiredFormsConfigSection() {
  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.portal.listFormRequirements.useQuery();
  const { data: templates } = trpc.forms.listTemplates.useQuery();
  const { data: jobTypes } = trpc.portal.distinctJobTypes.useQuery();

  const upsertMutation = trpc.portal.upsertFormRequirement.useMutation({
    onSuccess: (data) => {
      utils.portal.listFormRequirements.invalidate();
      if (data.backfilledCount && data.backfilledCount > 0) {
        toast.success(`Rule saved — updated ${data.backfilledCount} existing job${data.backfilledCount === 1 ? '' : 's'}`);
      } else {
        toast.success("Rule saved");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.portal.deleteFormRequirement.useMutation({
    onSuccess: () => { utils.portal.listFormRequirements.invalidate(); toast.success("Rule deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newJobType, setNewJobType] = useState("");
  const [newTemplateIds, setNewTemplateIds] = useState<number[]>([]);
  const [applyToExisting, setApplyToExisting] = useState(false);

  const activeTemplates = (templates ?? []).filter(t => t.isActive);
  const templateMap = Object.fromEntries(activeTemplates.map(t => [t.id, t.name]));

  const handleSave = () => {
    if (!newJobType.trim()) { toast.error("Enter a job type"); return; }
    if (newTemplateIds.length === 0) { toast.error("Select at least one form template"); return; }
    upsertMutation.mutate({ jobType: newJobType.trim(), requiredFormTemplateIds: newTemplateIds, applyToExistingJobs: applyToExisting });
    setShowAdd(false);
    setNewJobType("");
    setNewTemplateIds([]);
    setApplyToExisting(false);
  };

  const toggleTemplate = (id: number) => {
    setNewTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <SectionCard
      icon={ClipboardList}
      title="Required Forms per Job Type"
      subtitle="Automatically require specific forms/certificates when a job is created with a matching type."
    >
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} /></div>
      ) : (
        <div className="space-y-3">
          {/* Existing rules */}
          {(rules ?? []).length === 0 && !showAdd && (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              No rules configured yet. Add a rule to automatically require forms when jobs of a specific type are created.
            </p>
          )}

          {(rules ?? []).map((rule) => (
            <div
              key={rule.id}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{rule.jobType}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {((rule.requiredFormTemplateIds as number[]) ?? []).map(tid => (
                    <span
                      key={tid}
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                    >
                      {templateMap[tid] ?? `Template #${tid}`}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate({ id: rule.id })}
                className="p-1.5 rounded-lg hover:bg-white/5 flex-shrink-0"
                title="Delete rule"
              >
                <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
              </button>
            </div>
          ))}

          {/* Add new rule form */}
          {showAdd && (
            <div
              className="p-4 rounded-lg space-y-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,166,35,0.2)" }}
            >
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Job Type</Label>
                <Input
                  value={newJobType}
                  onChange={e => setNewJobType(e.target.value)}
                  placeholder="e.g. Electrical, Plumbing, Gas Fitting"
                  style={inputStyle}
                  list="job-type-suggestions"
                />
                <datalist id="job-type-suggestions">
                  {(jobTypes ?? []).map(jt => <option key={jt} value={jt} />)}
                </datalist>
              </div>

              <div>
                <Label className="text-xs mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>Required Form Templates</Label>
                <div className="space-y-1.5">
                  {activeTemplates.map(t => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
                      style={{
                        background: newTemplateIds.includes(t.id) ? "rgba(245,166,35,0.1)" : "transparent",
                        border: `1px solid ${newTemplateIds.includes(t.id) ? "rgba(245,166,35,0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newTemplateIds.includes(t.id)}
                        onChange={() => toggleTemplate(t.id)}
                        className="accent-amber-500"
                      />
                      <span className="text-sm text-white">{t.name}</span>
                    </label>
                  ))}
                  {activeTemplates.length === 0 && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No active templates. Create templates in Forms & Certs first.</p>
                  )}
                </div>
              </div>

              {/* Apply to existing jobs checkbox */}
              <label
                className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
                style={{ background: applyToExisting ? "rgba(245,166,35,0.08)" : "transparent", border: `1px solid ${applyToExisting ? "rgba(245,166,35,0.25)" : "rgba(255,255,255,0.06)"}` }}
              >
                <input
                  type="checkbox"
                  checked={applyToExisting}
                  onChange={() => setApplyToExisting(!applyToExisting)}
                  className="accent-amber-500"
                />
                <div>
                  <span className="text-sm text-white">Apply to existing jobs</span>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Update all existing jobs of this type with these form requirements</p>
                </div>
              </label>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={upsertMutation.isPending}
                  className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D]"
                >
                  {upsertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Rule
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewJobType(""); setNewTemplateIds([]); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Add button */}
          {!showAdd && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAdd(true)}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Rule
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
