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
import { getSolvrOrigin, isNativeApp } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  KeyRound, Eye, EyeOff, CheckCircle2, Building2, Save, Loader2, CreditCard, Trash2, AlertTriangle,
  Bell, ExternalLink, RefreshCw, ShieldCheck, LogOut, Zap, ClipboardList, Plus, X, ChevronDown,
  Download, Banknote, FileText, Bot,
} from "lucide-react";
import MemoryFileSection from "./MemoryFileSection";
import GoogleReviewSection from "./GoogleReviewSection";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
import { usePortalRole } from "@/hooks/usePortalRole";
import { ViewerBanner, WriteGuard } from "@/components/portal/ViewerBanner";

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
  defaultOpen = false,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-xl mb-4 sm:mb-6 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 sm:p-6 sm:pb-0 text-left"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(245,166,35,0.12)" }}
        >
          <Icon className="w-4 h-4" style={{ color: "#F5A623" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{subtitle}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: "rgba(255,255,255,0.3)" }}
        />
      </button>
      {open && <div className="p-4 sm:p-6 pt-4">{children}</div>}
    </div>
  );
}

export default function PortalSettings() {
  const [, navigate] = useLocation();
  const { canWrite } = usePortalRole();

  // ─── Logout ──────────────────────────────────────────────────────────────
  const logoutMutation = trpc.portal.logout.useMutation({
    onSuccess: () => {
      // Navigation to /portal is the feedback — toast on a different page is confusing.
      navigate("/portal");
    },
    onError: () => {
      // Server call failed (network down, already-expired session) — surface
      // it briefly so the user knows the local sign-out happened anyway, then
      // navigate. Without this they'd see the page swap with zero context.
      toast.error("Couldn't reach the server — signing you out anyway.");
      navigate("/portal");
    },
  });

  // ─── Business Profile state ──────────────────────────────────────────────
  const profileQuery = trpc.portal.getBusinessProfile.useQuery();
  const updateProfile = trpc.portal.updateBusinessProfile.useMutation({
    onSuccess: () => {
      hapticSuccess();
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
    onSuccess: () => { hapticSuccess(); toast.success("Payment details saved."); },
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
      hapticSuccess();
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
      <div className="sm:max-w-xl pb-24">
        {/* Page header */}
        <div className="mb-5 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Settings</h1>
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
          defaultOpen
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
                  className="w-full font-semibold"
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
                className="w-full font-semibold"
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

        {/* ─── Stripe Connect (Pay Now) ──────────────────────────────────────────── */}
        <StripeConnectSection />

        {/* ─── Stripe Disputes ───────────────────────────────────────────────────── */}
        <StripeDisputesSection />

        {/* ─── Xero Integration ──────────────────────────────────────────────────── */}
        <XeroIntegrationSection />

        {/* ─── Google Reviews ───────────────────────────────────────────────────── */}
        <GoogleReviewSection />

        {/* ─── Required Forms per Job Type ──────────────────────────────────── */}
        <RequiredFormsConfigSection />

        {/* ─── Automation ──────────────────────────────────────────────────────── */}
        <AutomationSection />

        {/* ─── AI Booking (Sprint 4.3) ─────────────────────────────────────── */}
        <AiBookingSection />

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
      hapticSuccess();
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

// ─── Stripe Connect (Pay Now on invoices) ────────────────────────────────
/**
 * Connect / disconnect block for Stripe Express. Once connected and
 * onboarding completes, customer SMS payment links route through the
 * tradie's account directly. Money lands in their bank, SOLVR never
 * holds it.
 *
 * Auto-refresh: when Stripe redirects back here with ?stripe=connected,
 * we trigger refreshStatus once to pick up the latest account state
 * before the webhook arrives.
 */
function StripeConnectSection() {
  const { data: status, isLoading, refetch } = trpc.stripeConnect.getStatus.useQuery(undefined, {
    staleTime: 30_000,
    retry: 2,
  });

  const startOnboarding = trpc.stripeConnect.startOnboarding.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (err) => toast.error(err.message ?? "Couldn't start Stripe setup."),
  });
  const refreshStatus = trpc.stripeConnect.refreshStatus.useMutation({
    onSuccess: () => { refetch(); },
    onError: (err) => toast.error(err.message ?? "Couldn't refresh Stripe status."),
  });
  const dashboardLink = trpc.stripeConnect.createDashboardLink.useMutation({
    onSuccess: ({ url }) => { window.open(url, "_blank"); },
    onError: (err) => toast.error(err.message ?? "Couldn't open Stripe dashboard."),
  });
  const disconnect = trpc.stripeConnect.disconnect.useMutation({
    onSuccess: () => { refetch(); toast.success("Stripe disconnected. You can reconnect any time."); },
    onError: (err) => toast.error(err.message ?? "Couldn't disconnect Stripe."),
  });

  // Stripe → SOLVR redirect handling. Cleans the URL so a refresh doesn't
  // re-trigger the status pull, and avoids the user seeing ?stripe=connected
  // sitting in the address bar forever.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeParam = params.get("stripe");
    if (stripeParam === "connected" || stripeParam === "refresh") {
      refreshStatus.mutate();
      params.delete("stripe");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = status?.connected ?? false;
  const ready = connected && status?.chargesEnabled;
  const onboardingPending = connected && !status?.chargesEnabled;

  return (
    <SectionCard
      icon={Banknote}
      title="Pay Now — Online Card Payments"
      subtitle="Let customers pay invoices with a card. Money lands in your bank, not ours."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
        </div>
      ) : !connected ? (
        // ── Not connected ────────────────────────────────────────────────
        <div className="space-y-3">
          <div
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <CreditCard className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }} />
            <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
              <p className="text-white font-semibold mb-1">How it works:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Connect your Stripe account once — takes about 3 minutes (ABN, ID, bank details).</li>
                <li>When you mark a job complete, the customer gets an SMS with a "Pay Now" link.</li>
                <li>They pay with a card; the money settles to your bank in 1–2 business days.</li>
                <li>Stripe takes their standard fee (~1.75% + 30c). SOLVR takes nothing.</li>
              </ul>
            </div>
          </div>
          <WriteGuard>
            <Button
              onClick={() => startOnboarding.mutate({ origin: window.location.origin })}
              disabled={startOnboarding.isPending}
              className="min-h-11"
              style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700 }}
            >
              {startOnboarding.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Banknote className="w-4 h-4 mr-1.5" />
              )}
              Connect Stripe
            </Button>
          </WriteGuard>
        </div>
      ) : ready ? (
        // ── Fully connected and ready ────────────────────────────────────
        <div className="space-y-3">
          <div
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
              <p className="font-semibold text-white">Connected — accepting card payments</p>
              <p className="mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                Pay Now SMS links go out automatically when you mark a job complete with a balance due.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <WriteGuard>
              <Button
                onClick={() => dashboardLink.mutate()}
                disabled={dashboardLink.isPending}
                variant="outline"
                className="min-h-11 border-white/15 text-white/70"
              >
                {dashboardLink.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ExternalLink className="w-4 h-4 mr-1.5" />}
                Open Stripe Dashboard
              </Button>
            </WriteGuard>
            <WriteGuard>
              <Button
                onClick={() => refreshStatus.mutate()}
                disabled={refreshStatus.isPending}
                variant="outline"
                className="min-h-11 border-white/15 text-white/50"
              >
                {refreshStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                Refresh status
              </Button>
            </WriteGuard>
            <WriteGuard>
              <Button
                onClick={() => {
                  if (window.confirm("Disconnect Stripe? Future invoices won't include a Pay Now link until you reconnect.")) {
                    disconnect.mutate();
                  }
                }}
                disabled={disconnect.isPending}
                variant="outline"
                className="min-h-11 border-red-500/20 text-red-400/70 hover:bg-red-500/10"
              >
                {disconnect.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Disconnect
              </Button>
            </WriteGuard>
          </div>
        </div>
      ) : (
        // ── Connected but charges not yet enabled (mid-onboarding or
        //    requirements outstanding) ───────────────────────────────────
        <div className="space-y-3">
          <div
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.3)" }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
              <p className="font-semibold text-white">Stripe needs more info</p>
              <p className="mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                {onboardingPending
                  ? "You started onboarding but haven't finished. Click Continue to pick up where you left off."
                  : "Stripe is asking for additional details before they'll enable card payments."}
              </p>
              {(status?.requirements?.length ?? 0) > 0 && (
                <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
                  {(status?.requirements ?? []).slice(0, 5).map(req => (
                    <li key={req}>{humaniseStripeRequirement(req)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <WriteGuard>
              <Button
                onClick={() => startOnboarding.mutate({ origin: window.location.origin })}
                disabled={startOnboarding.isPending}
                className="min-h-11"
                style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700 }}
              >
                {startOnboarding.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Continue Stripe Setup
              </Button>
            </WriteGuard>
            <WriteGuard>
              <Button
                onClick={() => refreshStatus.mutate()}
                disabled={refreshStatus.isPending}
                variant="outline"
                className="min-h-11 border-white/15 text-white/50"
              >
                {refreshStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                Refresh status
              </Button>
            </WriteGuard>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/**
 * Translate Stripe's machine codes for currently-due requirements into
 * tradie-readable text. Anything we haven't mapped falls back to the raw
 * code, which is at least informative even if not pretty.
 */
function humaniseStripeRequirement(code: string): string {
  const map: Record<string, string> = {
    "individual.id_number": "Personal ID number",
    "individual.verification.document": "Photo ID document",
    "individual.dob.day": "Date of birth",
    "individual.dob.month": "Date of birth",
    "individual.dob.year": "Date of birth",
    "individual.first_name": "First name",
    "individual.last_name": "Last name",
    "individual.email": "Email address",
    "individual.phone": "Phone number",
    "individual.address.line1": "Address",
    "individual.address.city": "Address (city)",
    "individual.address.postal_code": "Address (postcode)",
    "individual.address.state": "Address (state)",
    "external_account": "Bank account for payouts",
    "tos_acceptance.date": "Accept Stripe terms of service",
    "tos_acceptance.ip": "Accept Stripe terms of service",
    "business_profile.url": "Business website or social link",
    "business_profile.product_description": "What your business does",
    "business_profile.mcc": "Business category",
  };
  return map[code] ?? code;
}

// ─── Xero Integration ───────────────────────────────────────────────────────
/**
 * Xero connect/disconnect block. Mirrors the Stripe pattern: idle / mid /
 * ready states. Mid-state isn't really possible with Xero (OAuth either
 * succeeds or it doesn't) but we still handle ?xero=error returns from
 * the callback handler with a friendly toast.
 */
// ─── Stripe Disputes (Sprint 3.2) ───────────────────────────────────────────
/**
 * Lists chargebacks/disputes raised on the tradie's Stripe account.
 * Hidden when Stripe Connect isn't set up. Hidden also when there are
 * NO disputes ever (clean install) — only renders once a dispute has
 * been received via webhook.
 *
 * v1: surfaces the dispute + a button to open Stripe's dashboard for
 * actual evidence submission. v2 will add in-app evidence upload.
 */
function StripeDisputesSection() {
  const { data: stripeStatus } = trpc.stripeConnect.getStatus.useQuery(undefined, {
    staleTime: 60_000, retry: 1,
  });
  const { data: disputes, isLoading } = trpc.stripeConnect.listDisputes.useQuery(
    { activeOnly: false },
    { staleTime: 60_000, retry: 2, enabled: stripeStatus?.connected === true },
  );
  const dashboardLink = trpc.stripeConnect.createDashboardLink.useMutation({
    onSuccess: ({ url }) => { window.open(url, "_blank"); },
    onError: (err) => toast.error(err.message ?? "Couldn't open Stripe dashboard."),
  });

  // Don't render anything if Stripe isn't connected, or no disputes exist
  if (stripeStatus?.connected !== true) return null;
  if (!isLoading && (!disputes || disputes.length === 0)) return null;

  const activeCount = (disputes ?? []).filter(d => isDisputeActive(d.status)).length;

  return (
    <SectionCard
      icon={AlertTriangle}
      title={`Payment Disputes${activeCount > 0 ? ` (${activeCount} need attention)` : ""}`}
      subtitle="Chargebacks and disputes raised on your Stripe payments."
      defaultOpen={activeCount > 0}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
        </div>
      ) : (
        <div className="space-y-2">
          {activeCount > 0 && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "rgba(255,200,200,0.9)" }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
              <div>
                <p className="font-semibold" style={{ color: "#fff" }}>Submit evidence in Stripe</p>
                <p className="mt-0.5">
                  Disputes have a tight deadline (usually 7 days). Open the Stripe dashboard and add your evidence — receipts, customer correspondence, before/after photos.
                </p>
                <WriteGuard>
                  <button
                    type="button"
                    onClick={() => dashboardLink.mutate()}
                    disabled={dashboardLink.isPending}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    {dashboardLink.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                    Open Stripe Dashboard
                  </button>
                </WriteGuard>
              </div>
            </div>
          )}

          {(disputes ?? []).map(d => (
            <div
              key={d.id}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{
                background: isDisputeActive(d.status) ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)",
                border: isDisputeActive(d.status) ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white">
                    ${(d.amountCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })} {d.currency.toUpperCase()}
                  </p>
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: isDisputeActive(d.status) ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.08)",
                      color: isDisputeActive(d.status) ? "#ef4444" : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {humaniseDisputeStatus(d.status)}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Reason: <span style={{ color: "rgba(255,255,255,0.85)" }}>{humaniseDisputeReason(d.reason)}</span>
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Filed {new Date(d.stripeCreatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  {d.evidenceDueBy && (
                    <> · <span style={{ color: isEvidenceUrgent(d.evidenceDueBy) ? "#ef4444" : "rgba(255,255,255,0.5)" }}>
                      Evidence due {new Date(d.evidenceDueBy).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span></>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function isDisputeActive(status: string): boolean {
  return ["warning_needs_response", "warning_under_review", "needs_response", "under_review"].includes(status);
}

function isEvidenceUrgent(due: Date | string): boolean {
  const ms = new Date(due).getTime() - Date.now();
  return ms < 48 * 60 * 60 * 1000; // <48h
}

function humaniseDisputeStatus(status: string): string {
  const map: Record<string, string> = {
    warning_needs_response: "Action required",
    warning_under_review: "Under review",
    warning_closed: "Closed",
    needs_response: "Action required",
    under_review: "Under review",
    charge_refunded: "Refunded",
    won: "Won",
    lost: "Lost",
  };
  return map[status] ?? status;
}

function humaniseDisputeReason(reason: string): string {
  const map: Record<string, string> = {
    duplicate: "Duplicate charge",
    fraudulent: "Reported fraud",
    subscription_canceled: "Cancelled subscription",
    product_not_received: "Product not received",
    product_unacceptable: "Product unacceptable",
    unrecognized: "Customer doesn't recognise charge",
    credit_not_processed: "Credit not processed",
    general: "General dispute",
    incorrect_account_details: "Incorrect account details",
    insufficient_funds: "Insufficient funds",
    bank_cannot_process: "Bank can't process",
    debit_not_authorized: "Debit not authorised",
    customer_initiated: "Customer initiated",
  };
  return map[reason] ?? reason;
}

function XeroIntegrationSection() {
  const utils = trpc.useUtils();
  const { data: status, isLoading, refetch } = trpc.xero.getStatus.useQuery(undefined, {
    staleTime: 30_000, retry: 2,
  });

  const startConnect = trpc.xero.startConnect.useMutation({
    onSuccess: () => {
      // The tRPC procedure only returns the URL — we navigate via
      // /api/xero/start so the callback can set the state cookie HttpOnly.
      window.location.href = "/api/xero/start";
    },
    onError: (err) => toast.error(err.message ?? "Couldn't start Xero connection."),
  });

  const disconnect = trpc.xero.disconnect.useMutation({
    onSuccess: () => {
      refetch();
      utils.xero.getStatus.invalidate();
      toast.success("Xero disconnected. Reconnect any time.");
    },
    onError: (err) => toast.error(err.message ?? "Couldn't disconnect."),
  });

  const setInvoiceMode = trpc.xero.setInvoiceMode.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Invoice mode updated.");
    },
    onError: (err) => toast.error(err.message ?? "Couldn't update."),
  });

  // Handle the ?xero=connected | cancelled | error redirect once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const xeroParam = params.get("xero");
    if (!xeroParam) return;
    if (xeroParam === "connected") {
      toast.success("Xero connected.");
      refetch();
    } else if (xeroParam === "cancelled") {
      toast.info("Xero connection cancelled.");
    } else if (xeroParam === "error") {
      const reason = params.get("reason") ?? "Connection failed";
      toast.error(`Xero error: ${reason}`);
    }
    params.delete("xero");
    params.delete("reason");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <SectionCard icon={FileText} title="Xero" subtitle="Sync invoices and customers automatically.">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
        </div>
      </SectionCard>
    );
  }

  // Server doesn't have credentials — feature unavailable
  if (status && !status.configured) {
    return (
      <SectionCard icon={FileText} title="Xero" subtitle="Sync invoices and customers automatically.">
        <div
          className="flex items-start gap-2 p-3 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }} />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
            Xero integration isn't enabled on this server yet. Existing CSV export still works from the Invoices page — choose <strong>Export to Xero</strong> to download an importable file.
          </p>
        </div>
      </SectionCard>
    );
  }

  const connected = status?.connected === true;

  return (
    <SectionCard icon={FileText} title="Xero" subtitle="Sync invoices and customers automatically.">
      {!connected ? (
        // ── Not connected ────────────────────────────────────────────────
        <div className="space-y-3">
          <div
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }} />
            <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
              <p className="text-white font-semibold mb-1">How it works:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Connect once — about 90 seconds.</li>
                <li>SOLVR invoices auto-create as Drafts in your Xero Sales tab.</li>
                <li>Customer contact details sync the first time you invoice them.</li>
                <li>Tap "Sync now" on any past invoice to push it through.</li>
              </ul>
            </div>
          </div>
          <WriteGuard>
            <Button
              onClick={() => startConnect.mutate()}
              disabled={startConnect.isPending}
              className="min-h-11"
              style={{ background: "#13B5EA", color: "#fff", fontWeight: 700 }}
            >
              {startConnect.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FileText className="w-4 h-4 mr-1.5" />}
              Connect Xero
            </Button>
          </WriteGuard>
        </div>
      ) : (
        // ── Connected ────────────────────────────────────────────────────
        <div className="space-y-3">
          <div
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
              <p className="font-semibold text-white">Connected to {status?.tenantName ?? "your Xero org"}</p>
              <p className="mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                New invoices will sync automatically.
              </p>
            </div>
          </div>

          {/* Invoice mode toggle */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
              Push as
            </p>
            <div className="flex gap-2">
              {(["DRAFT", "AUTHORISED"] as const).map(mode => {
                const active = status?.invoiceStatus === mode;
                return (
                  <WriteGuard key={mode}>
                    <button
                      type="button"
                      onClick={() => setInvoiceMode.mutate({ mode })}
                      disabled={setInvoiceMode.isPending || active}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide"
                      style={{
                        background: active ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.04)",
                        color: active ? "#F5A623" : "rgba(255,255,255,0.55)",
                        border: active ? "1px solid rgba(245,166,35,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {mode === "DRAFT" ? "Draft (safer)" : "Approved"}
                    </button>
                  </WriteGuard>
                );
              })}
            </div>
            <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
              {status?.invoiceStatus === "DRAFT"
                ? "Invoices land as Draft in Xero — review + approve them there before they're emailed."
                : "Invoices land as Approved (Sales tab) — Xero will treat them as ready-to-email."}
            </p>
          </div>

          <WriteGuard>
            <Button
              onClick={() => {
                if (window.confirm("Disconnect Xero? Future SOLVR invoices won't sync until you reconnect. Existing Xero invoices stay where they are.")) {
                  disconnect.mutate();
                }
              }}
              disabled={disconnect.isPending}
              variant="outline"
              className="min-h-11 border-red-500/20 text-red-400/70 hover:bg-red-500/10"
            >
              {disconnect.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Disconnect
            </Button>
          </WriteGuard>
        </div>
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
      window.open(url, "_blank");
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
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
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

          {/* Manage button — iOS routes to Apple Settings (Apple Guideline 3.1.1) */}
          {isNativeApp() ? (
            <>
              <Button
                onClick={() => { window.location.href = "itms-apps://apps.apple.com/account/subscriptions"; }}
                className="w-full flex items-center justify-center gap-2"
                style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)" }}
              >
                <ExternalLink className="w-4 h-4" /> Manage in Apple Settings
              </Button>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Apple subscriptions are managed in your Apple ID settings.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
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
    onSuccess: () => { hapticSuccess(); toast.success("Notification preferences saved."); },
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
// ─── AI Booking (Sprint 4.3) ────────────────────────────────────────────────
/**
 * Toggle that enables real-time job booking on the AI receptionist.
 * Hidden when the tradie doesn't have a Vapi assistant provisioned.
 *
 * On toggle, the server PATCHes the Vapi assistant config with the
 * booking tools + an extended system prompt. Takes effect on the next
 * inbound call.
 */
function AiBookingSection() {
  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.portal.getAiBookingStatus.useQuery(undefined, {
    staleTime: 30_000,
    retry: 1,
  });
  const setEnabled = trpc.portal.setAiBookingEnabled.useMutation({
    onSuccess: (res) => {
      utils.portal.getAiBookingStatus.invalidate();
      hapticSuccess();
      toast.success(
        res.enabled
          ? "AI receptionist can now book jobs in real time."
          : "Real-time booking disabled. AI will keep capturing details for follow-up.",
      );
    },
    onError: (err) => {
      hapticWarning();
      toast.error(err.message ?? "Couldn't update.");
    },
  });

  if (isLoading) return null;
  if (!status?.hasVapiAssistant) return null; // No agent provisioned yet — nothing to gate

  const enabled = status.enabled;

  return (
    <SectionCard
      icon={Bot}
      title="AI Receptionist — Real-time Booking"
      subtitle="Let the AI book jobs straight into your diary while the customer is on the call."
    >
      <div className="space-y-3">
        <div
          className="flex items-start gap-3 p-3 rounded-lg"
          style={{ background: enabled ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", border: enabled ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.08)" }}
        >
          {enabled ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
          ) : (
            <Bot className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }} />
          )}
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
            <p className="font-semibold text-white mb-1">{enabled ? "Booking is live" : "Capture-only mode"}</p>
            <p style={{ color: "rgba(255,255,255,0.55)" }}>
              {enabled
                ? "The AI checks your calendar live, offers 2-3 available slots, locks the job in, and texts the customer a confirmation. ServiceM8 doesn't do this — it's the killer demo."
                : "Right now the AI captures caller details but doesn't book. Turn this on and it'll close the loop end-to-end on every call."}
            </p>
            <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
              Available slots are picked from 9am, 11am, 2pm and 4pm — Monday to Saturday — that don't clash with your existing calendar events.
            </p>
          </div>
        </div>
        <WriteGuard>
          <Button
            onClick={() => setEnabled.mutate({ enabled: !enabled })}
            disabled={setEnabled.isPending}
            className="min-h-11"
            style={{
              background: enabled ? "rgba(255,255,255,0.06)" : "#F5A623",
              color: enabled ? "rgba(255,255,255,0.7)" : "#0F1F3D",
              fontWeight: 700,
            }}
          >
            {setEnabled.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            {enabled ? "Turn off real-time booking" : "Enable real-time booking"}
          </Button>
        </WriteGuard>
      </div>
    </SectionCard>
  );
}

function AutomationSection() {
  const { canWrite } = usePortalRole();
  const { data: prefs, isLoading } = trpc.portal.getNotificationPrefs.useQuery(undefined, {
    staleTime: 30_000,
  });
  const updatePrefs = trpc.portal.updateNotificationPrefs.useMutation({
    onSuccess: () => { hapticSuccess(); toast.success("Automation settings saved."); },
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

// ─── Delete Account Section (Apple 5.1.1(v) compliant) ──────────────────────
function DeleteAccountSection() {
  const [, navigate] = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const exportData = trpc.portal.exportMyData.useQuery(undefined, { enabled: false });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportData.refetch();
      if (result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `solvr-data-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        hapticSuccess();
        toast.success("Data exported successfully.");
      }
    } catch {
      toast.error("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const deleteAccount = trpc.portal.deleteAccount.useMutation({
    onSuccess: () => {
      hapticWarning();
      toast.success("Account deleted successfully.");
      // Redirect to login after short delay
      setTimeout(() => navigate("/portal/login"), 1500);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete account. Please try again or email hello@solvr.com.au.");
    },
  });

  const canDelete = confirmText === "DELETE";

  return (
    <SectionCard
      icon={Trash2}
      title="Delete Account"
      subtitle="Permanently delete your account and all data"
    >
      <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>
        Deleting your account will permanently remove your business profile, call recordings, uploaded files, staff accounts, and all associated data from Solvr's systems. Any active subscriptions will be cancelled. This action cannot be undone.
      </p>

      {/* Data export — let users download before deleting */}
      <div className="rounded-lg border border-white/10 p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-start gap-3">
          <Download className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
          <div className="flex-1">
            <p className="text-sm font-medium text-white/80 mb-1">Export Your Data</p>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
              Download a copy of all your business data (jobs, quotes, customers, staff, and more) as a JSON file before deleting your account.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/70 hover:bg-white/5 hover:text-white"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" />Download My Data</>
              )}
            </Button>
          </div>
        </div>
      </div>
      {!showConfirm ? (
        <Button
          variant="outline"
          className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 hover:text-red-300 transition-colors"
          onClick={() => setShowConfirm(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      ) : (
        <div className="rounded-lg border border-red-500/30 p-4" style={{ background: "rgba(239,68,68,0.07)" }}>
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300 mb-1">This permanently deletes your account and all data.</p>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
                This action cannot be undone. Your subscription will be cancelled, all staff accounts removed, and all business data permanently erased.
              </p>
              <label className="text-xs font-medium text-red-300 block mb-1.5">
                Type <span className="font-mono font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full sm:w-48 px-3 py-1.5 rounded-md text-sm font-mono bg-black/30 border border-red-500/30 text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/60"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/60 hover:bg-white/5 w-full sm:w-auto"
              onClick={() => { setShowConfirm(false); setConfirmText(""); }}
              disabled={deleteAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold w-full sm:w-auto disabled:opacity-40"
              onClick={() => deleteAccount.mutate({ confirmText })}
              disabled={!canDelete || deleteAccount.isPending}
            >
              {deleteAccount.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>
              ) : (
                "Delete My Account"
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

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={upsertMutation.isPending}
                  className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D] w-full sm:w-auto"
                >
                  {upsertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Rule
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewJobType(""); setNewTemplateIds([]); }} className="w-full sm:w-auto">
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
