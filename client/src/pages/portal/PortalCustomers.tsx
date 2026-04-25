/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalCustomers — CRM Customer List
 *
 * Tabs:
 *  - Customers: search, multi-select, bulk SMS (immediate or scheduled), navigation to detail
 *  - Campaign History: past SMS blasts rendered as vertical cards (SMSCampaignCard)
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import AddressAutocomplete from "@/components/portal/AddressAutocomplete";
import SMSCampaignCard from "@/components/portal/SMSCampaignCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { hapticSuccess } from "@/lib/haptics";
import { ViewerBanner, WriteGuard } from "@/components/portal/ViewerBanner";
import { ErrorState } from "@/components/portal/ErrorState";
import {
  Users, Search, MessageSquare, ChevronRight, Phone, UserPlus,
  MapPin, Loader2, CheckSquare, Square, Download, DollarSign, Briefcase,
  History, BellOff, CalendarClock, BookOpen, Plus, Trash2,
} from "lucide-react";
import { Label } from "@/components/ui/label";

function fmtDate(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtAUD(cents: number) {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function PortalCustomers() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"customers" | "history">("customers");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkSms, setShowBulkSms] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplBody, setNewTplBody] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustFirst, setNewCustFirst] = useState("");
  const [newCustLast, setNewCustLast] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  const { data: customers = [], isLoading, error: custError, refetch: refetchCust } =
    trpc.portalCustomers.list.useQuery(undefined, {
      retry: 2,
      staleTime: 60_000,
    });

  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } =
    trpc.portalCustomers.listSmsCampaigns.useQuery(undefined, {
      enabled: activeTab === "history",
      retry: 2,
      staleTime: 30_000,
    });

  const { data: templates = [], refetch: refetchTemplates } =
    trpc.portalCustomers.listSmsTemplates.useQuery(undefined, {
      enabled: showBulkSms,
      retry: 2,
      staleTime: 60_000,
    });

  const bulkSmsPreviewMutation = trpc.portalCustomers.bulkSmsPreview.useMutation({
    onSuccess: () => setSmsSent(true),
    onError: (err) => toast.error(err.message || "Something went wrong"),
  });
  const utils = trpc.useUtils();

  const createCustomerMutation = trpc.portalCustomers.createCustomer.useMutation({
    onSuccess: (data) => {
      hapticSuccess();
      toast.success(`Customer "${data.name}" added`);
      setShowAddCustomer(false);
      setNewCustFirst(""); setNewCustLast(""); setNewCustEmail(""); setNewCustPhone(""); setNewCustAddress("");
      utils.portalCustomers.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Something went wrong"),
  });

  const toggleOptOutMutation = trpc.portalCustomers.toggleSmsOptOut.useMutation({
    onSuccess: (data) => {
      toast.success(data.optedOutSms ? "Customer opted out of SMS" : "Customer re-enabled for SMS");
      utils.portalCustomers.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Something went wrong"),
  });

  const sendBulkSmsMutation = trpc.portalCustomers.sendBulkSms.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Sent ${data.sentCount} of ${data.total} SMS${
          data.failedCount > 0 ? ` (${data.failedCount} failed)` : ""
        }`,
      );
      setShowBulkSms(false);
      setSelected(new Set());
      refetchCampaigns();
    },
    onError: (err) => toast.error(err.message || "Something went wrong"),
  });

  const scheduleBulkSmsMutation = trpc.portalCustomers.scheduleBulkSms.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowBulkSms(false);
      setSelected(new Set());
      setScheduleMode(false);
      setScheduledAt("");
    },
    onError: (err) => toast.error(err.message || "Something went wrong"),
  });

  const createTemplateMutation = trpc.portalCustomers.createSmsTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template saved");
      setNewTplName("");
      setNewTplBody("");
      refetchTemplates();
    },
    onError: (err) => toast.error(err.message || "Something went wrong"),
  });

  const deleteTemplateMutation = trpc.portalCustomers.deleteSmsTemplate.useMutation({
    // Template row disappears from list — visual change is feedback.
    onSuccess: () => refetchTemplates(),
    onError: (err) => toast.error(err.message || "Something went wrong"),
  });

  const bulkSmsMutation = bulkSmsPreviewMutation;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.suburb ?? "").toLowerCase().includes(q) ||
        (c.lastJobType ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpentCents, 0);
  const totalJobs = customers.reduce((s, c) => s + c.jobCount, 0);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  function openBulkSms() {
    if (selected.size === 0) { toast.error("Select at least one customer"); return; }
    setSmsMessage("");
    setSmsSent(false);
    setScheduleMode(false);
    setScheduledAt("");
    setShowTemplates(false);
    setShowBulkSms(true);
  }

  function startNewCampaign() {
    setActiveTab("customers");
    toast.info("Select customers below, then tap Bulk SMS to send.");
  }

  function exportCsv() {
    const rows = [
      ["Name", "Phone", "Email", "Suburb", "Jobs", "Total Spent (AUD)", "Last Job Type", "Last Job Date"],
      ...customers.map((c) => [
        c.name,
        c.phone ?? "",
        c.email ?? "",
        c.suburb ?? "",
        String(c.jobCount),
        String((c.totalSpentCents / 100).toFixed(2)),
        c.lastJobType ?? "",
        fmtDate(c.lastJobAt),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solvr-customers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  return (
    <PortalLayout activeTab="customers">
      <ViewerBanner />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: "#F5A623" }} />
            Customer Database
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Auto-populated from accepted quotes and paid invoices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {activeTab === "customers" && (
            <>
              <WriteGuard>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCustomer(true)}
                  className="border-white/10 text-white/60 hover:text-white min-h-11"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add
                </Button>
              </WriteGuard>
              <Button
                size="sm"
                variant="outline"
                onClick={exportCsv}
                disabled={customers.length === 0}
                className="border-white/10 text-white/60 hover:text-white min-h-11"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
              </Button>
              <WriteGuard>
                <Button
                  size="sm"
                  onClick={openBulkSms}
                  disabled={selected.size === 0}
                  className="min-h-11"
                  style={selected.size > 0 ? { background: "#F5A623", color: "#0F1F3D" } : {}}
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  <span className="hidden sm:inline">Bulk SMS</span>
                  <span className="sm:hidden">SMS</span>
                  {selected.size > 0 && ` (${selected.size})`}
                </Button>
              </WriteGuard>
            </>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(["customers", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1.5 px-3 min-h-11 rounded-md text-sm font-medium transition-colors"
            style={
              activeTab === tab
                ? { background: "#F5A623", color: "#0F1F3D" }
                : { color: "rgba(255,255,255,0.5)" }
            }
          >
            {tab === "customers" ? <Users className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
            {tab === "customers" ? "Customers" : "Campaign History"}
          </button>
        ))}
      </div>

      {/* ── Customers tab ── */}
      {activeTab === "customers" && (
        <>
          {/* Stats row — flex for mobile-safe layout (no bare grid-cols-3) */}
          <div className="flex gap-2 sm:gap-3 mb-5">
            {[
              { label: "Customers", value: String(customers.length), icon: <Users className="w-4 h-4" /> },
              { label: "Jobs", value: String(totalJobs), icon: <Briefcase className="w-4 h-4" /> },
              { label: "Revenue", value: fmtAUD(totalRevenue), icon: <DollarSign className="w-4 h-4" /> },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex-1 min-w-0 rounded-xl p-3 sm:p-4"
                style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-2 mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {stat.icon}
                  <span className="text-[11px] sm:text-xs truncate">{stat.label}</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-white truncate">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Search + select-all */}
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={toggleAll}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center transition-colors"
              title={selected.size === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
            >
              {selected.size === filtered.length && filtered.length > 0
                ? <CheckSquare className="w-5 h-5" style={{ color: "#F5A623" }} />
                : <Square className="w-5 h-5 text-white/30" />}
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, suburb, or job type…"
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            {customers.length > 0 && (
              <span className="text-sm flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
                {filtered.length} of {customers.length}
              </span>
            )}
          </div>

          {/* Customer list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
            </div>
          ) : custError ? (
            <ErrorState error={custError} onRetry={() => refetchCust()} />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
              <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm font-medium text-white mb-1">
                {search ? "No customers match your search" : "No customers yet"}
              </p>
              <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                {search
                  ? "Try a different search term."
                  : "Customers appear here automatically when a quote is accepted or invoice is paid — or you can add one manually now."}
              </p>
              {!search && (
                <Button
                  onClick={() => setShowAddCustomer(true)}
                  className="mt-1"
                  style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700 }}
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add Customer Manually
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl flex items-center gap-3 px-4 py-3 min-h-11 cursor-pointer transition-colors"
                  style={{
                    background: selected.has(c.id) ? "rgba(245,166,35,0.07)" : "rgba(255,255,255,0.03)",
                    border: selected.has(c.id) ? "1px solid rgba(245,166,35,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                  onClick={() => navigate(`/portal/customers/${c.id}`)}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                    className="flex-shrink-0 w-11 h-11 -m-2 flex items-center justify-center"
                    aria-label={selected.has(c.id) ? "Deselect" : "Select"}
                  >
                    {selected.has(c.id)
                      ? <CheckSquare className="w-5 h-5" style={{ color: "#F5A623" }} />
                      : <Square className="w-5 h-5 text-white/30" />}
                  </button>

                  {/* Avatar */}
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm truncate">{c.name}</span>
                      {c.jobCount > 1 && (
                        <Badge
                          className="text-[10px] px-1.5 py-0 h-4"
                          style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "none" }}
                        >
                          {c.jobCount} jobs
                        </Badge>
                      )}
                      {c.optedOutSms && (
                        <button
                          type="button"
                          title="SMS opted out — tap to re-enable"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOptOutMutation.mutate({ customerId: c.id, optedOut: false });
                          }}
                          disabled={toggleOptOutMutation.isPending}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-70"
                          style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}
                        >
                          <BellOff className="w-3 h-3" />
                          SMS opt-out
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.phone && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          <Phone className="w-3 h-3" />{c.phone}
                        </span>
                      )}
                      {c.suburb && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          <MapPin className="w-3 h-3" />{c.suburb}
                        </span>
                      )}
                      {c.lastJobType && (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{c.lastJobType}</span>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex-shrink-0 text-right">
                    {c.totalSpentCents > 0 && (
                      <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>{fmtAUD(c.totalSpentCents)}</p>
                    )}
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{fmtDate(c.lastJobAt)}</p>
                  </div>

                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Campaign History tab ── */}
      {activeTab === "history" && (
        <>
          {/* Primary action — full-width amber at top */}
          <WriteGuard>
            <Button
              onClick={startNewCampaign}
              className="w-full font-semibold h-11 mb-4"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              <Plus className="w-5 h-5 mr-1.5" />
              New SMS campaign
            </Button>
          </WriteGuard>

          {campaignsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
            </div>
          ) : campaigns.length === 0 ? (
            <div
              className="rounded-2xl border p-10 text-center"
              style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
            >
              <div className="text-5xl mb-3" aria-hidden="true">📣</div>
              <p className="text-base font-semibold text-white mb-1">No campaigns yet</p>
              <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Send your first bulk SMS blast to customers and it'll show up here.
              </p>
              <WriteGuard>
                <Button
                  onClick={startNewCampaign}
                  className="font-semibold h-11"
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Start first campaign
                </Button>
              </WriteGuard>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} — tap any card to view recipients and actions.
              </p>
              {campaigns.map((c) => (
                <SMSCampaignCard
                  key={c.id}
                  campaign={c}
                  onRetried={refetchCampaigns}
                  onCancelled={refetchCampaigns}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Bulk SMS Modal */}
      <Dialog open={showBulkSms} onOpenChange={setShowBulkSms}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[85vh] overflow-y-auto" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white">
              Bulk SMS — {selected.size} customer{selected.size !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
              Compose your message, preview recipients, then send or schedule via Twilio.
            </DialogDescription>
          </DialogHeader>

          {/* ── Step 2: Preview + confirm send ── */}
          {smsSent && bulkSmsMutation.data ? (
            <div className="space-y-3">
              <div
                className="rounded-lg p-3 text-sm font-mono"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)" }}
              >
                {bulkSmsMutation.data.message}
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                Recipients ({bulkSmsMutation.data.count}):
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {bulkSmsMutation.data.recipients.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{r.name}</span>
                    <span style={{ color: "#F5A623" }}>{r.phone}</span>
                  </div>
                ))}
              </div>

              {/* Schedule toggle */}
              <div className="pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <button
                  type="button"
                  onClick={() => setScheduleMode((v) => !v)}
                  className="flex items-center gap-2 text-xs font-medium mb-2 min-h-11 transition-opacity hover:opacity-70"
                  style={{ color: scheduleMode ? "#F5A623" : "rgba(255,255,255,0.4)" }}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  {scheduleMode ? "Scheduling for later" : "Send immediately — tap to schedule instead"}
                </button>
                {scheduleMode && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                    className="w-full rounded-md px-3 py-2 h-11 text-sm bg-white/5 border border-white/10 text-white"
                    style={{ colorScheme: "dark" }}
                  />
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 border-white/10 text-white/60 h-11"
                  onClick={() => {
                    const lines = bulkSmsMutation.data!.recipients.map((r) => r.phone).join(", ");
                    navigator.clipboard.writeText(lines);
                    toast.success("Numbers copied to clipboard");
                  }}
                >
                  Copy Numbers
                </Button>
                {scheduleMode ? (
                  <Button
                    className="flex-1 font-semibold h-11"
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                    disabled={scheduleBulkSmsMutation.isPending || !scheduledAt}
                    onClick={() => {
                      if (!scheduledAt) { toast.error("Pick a date and time"); return; }
                      scheduleBulkSmsMutation.mutate({
                        customerIds: Array.from(selected),
                        message: smsMessage.trim(),
                        scheduledAt: new Date(scheduledAt).toISOString(),
                      });
                    }}
                  >
                    {scheduleBulkSmsMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><CalendarClock className="w-4 h-4 mr-1.5" />Schedule</>}
                  </Button>
                ) : (
                  <Button
                    className="flex-1 font-semibold h-11"
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                    disabled={sendBulkSmsMutation.isPending}
                    onClick={() =>
                      sendBulkSmsMutation.mutate({
                        customerIds: Array.from(selected),
                        message: smsMessage.trim(),
                      })
                    }
                  >
                    {sendBulkSmsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Send via Twilio"
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* ── Step 1: Compose message ── */
            <>
              {/* Template library toggle */}
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setShowTemplates((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium min-h-11 transition-opacity hover:opacity-70"
                  style={{ color: showTemplates ? "#F5A623" : "rgba(255,255,255,0.4)" }}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {showTemplates ? "Hide templates" : "Use a saved template"}
                </button>

                {showTemplates && (
                  <div
                    className="mt-2 rounded-lg overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {/* Existing templates */}
                    {templates.length === 0 ? (
                      <p className="px-3 py-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        No templates saved yet. Add one below.
                      </p>
                    ) : (
                      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        {templates.map((tpl) => (
                          <div key={tpl.id} className="flex items-center gap-2 px-3 py-2">
                            <button
                              type="button"
                              className="flex-1 min-h-11 text-left"
                              onClick={() => {
                                // Message body populates immediately + dropdown closes — toast was redundant.
                                setSmsMessage(tpl.body);
                                setShowTemplates(false);
                              }}
                            >
                              <p className="text-xs font-semibold text-white">{tpl.name}</p>
                              <p className="text-[11px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                                {tpl.body.length > 60 ? tpl.body.slice(0, 60) + "…" : tpl.body}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTemplateMutation.mutate({ id: tpl.id })}
                              disabled={deleteTemplateMutation.isPending}
                              className="flex-shrink-0 w-11 h-11 flex items-center justify-center transition-opacity hover:opacity-70"
                              title="Delete template"
                              aria-label="Delete template"
                            >
                              <Trash2 className="w-3.5 h-3.5" style={{ color: "rgba(248,113,113,0.6)" }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new template */}
                    <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Save current message as template
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={newTplName}
                          onChange={(e) => setNewTplName(e.target.value)}
                          placeholder="Template name…"
                          className="h-11 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                        />
                        <Button
                          size="sm"
                          className="h-11 w-11 p-0 flex-shrink-0"
                          style={{ background: "#F5A623", color: "#0F1F3D" }}
                          disabled={!newTplName.trim() || !smsMessage.trim() || createTemplateMutation.isPending}
                          onClick={() => {
                            if (!newTplName.trim() || !smsMessage.trim()) return;
                            createTemplateMutation.mutate({ name: newTplName.trim(), body: smsMessage.trim() });
                          }}
                          aria-label="Save template"
                        >
                          {createTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Hi [name], just following up on your recent job with us…"
                rows={4}
                maxLength={320}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              />
              <p className="text-xs text-right" style={{ color: "rgba(255,255,255,0.3)" }}>
                {smsMessage.length}/320
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowBulkSms(false)}
                  className="border-white/10 text-white/60 h-11"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!smsMessage.trim()) { toast.error("Enter a message"); return; }
                    bulkSmsMutation.mutate({
                      customerIds: Array.from(selected),
                      message: smsMessage.trim(),
                    });
                  }}
                  disabled={bulkSmsMutation.isPending || !smsMessage.trim()}
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                  className="h-11"
                >
                  {bulkSmsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Preview Recipients"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Customer Dialog ── */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white">Add Customer</DialogTitle>
            <DialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
              Manually add a customer to your CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/60">First Name *</Label>
                <Input
                  value={newCustFirst}
                  onChange={(e) => setNewCustFirst(e.target.value)}
                  placeholder="Jay"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-white/60">Last Name</Label>
                <Input
                  value={newCustLast}
                  onChange={(e) => setNewCustLast(e.target.value)}
                  placeholder="Smith"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-white/60">Phone</Label>
              <Input
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="0412 345 678"
                inputMode="tel"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-white/60">Email</Label>
              <Input
                value={newCustEmail}
                onChange={(e) => setNewCustEmail(e.target.value)}
                placeholder="jay@example.com"
                inputMode="email"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-white/60">Address</Label>
              <AddressAutocomplete
                value={newCustAddress}
                onChange={setNewCustAddress}
                placeholder="123 Main St, Sydney NSW 2000"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddCustomer(false)}
              className="w-full sm:w-auto border-white/10 text-white/60 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newCustFirst.trim()) { toast.error("First name is required"); return; }
                createCustomerMutation.mutate({
                  firstName: newCustFirst.trim(),
                  lastName: newCustLast.trim() || undefined,
                  email: newCustEmail.trim() || undefined,
                  phone: newCustPhone.trim() || undefined,
                  address: newCustAddress.trim() || undefined,
                });
              }}
              disabled={createCustomerMutation.isPending || !newCustFirst.trim()}
              className="w-full sm:w-auto h-11"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {createCustomerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
