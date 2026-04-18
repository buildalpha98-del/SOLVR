/**
 * PortalCustomers — CRM Customer List
 *
 * Tabs:
 *  - Customers: search, multi-select, bulk SMS (immediate or scheduled), navigation to detail
 *  - Campaign History: past SMS blasts with expandable per-recipient delivery rows + Retry Failed
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ViewerBanner, WriteGuard } from "@/components/portal/ViewerBanner";
import {
  Users, Search, MessageSquare, ChevronRight, Phone,
  MapPin, Loader2, CheckSquare, Square, Download, DollarSign, Briefcase,
  History, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, BellOff,
  RefreshCw, CalendarClock,
} from "lucide-react";

function fmtDate(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtDateTime(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtAUD(cents: number) {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Expandable row showing per-recipient delivery details for one campaign */
function CampaignRecipientsRow({ campaignId }: { campaignId: number }) {
  const { data: recipients = [], isLoading } = trpc.portalCustomers.getCampaignRecipients.useQuery(
    { campaignId },
    { staleTime: 120_000 },
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#F5A623" }} />
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Loading recipients…</span>
      </div>
    );
  }

  return (
    <div
      className="border-t"
      style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)" }}
    >
      <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto_1fr] gap-x-4 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "rgba(255,255,255,0.3)" }}>
        <span>Name / Phone</span>
        <span>Status</span>
        <span>Sent At</span>
        <span>Twilio SID / Error</span>
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        {recipients.map((r) => (
          <div
            key={r.id}
            className="px-4 py-2.5 grid grid-cols-[1fr_auto_auto_1fr] gap-x-4 items-center text-sm"
          >
            {/* Name + phone */}
            <div>
              <p className="text-white/80 font-medium text-xs">{r.name}</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.phone}</p>
            </div>

            {/* Status badge */}
            <div>
              {r.status === "sent" && (
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#4ade80" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                </span>
              )}
              {r.status === "failed" && (
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#f87171" }}>
                  <XCircle className="w-3.5 h-3.5" /> Failed
                </span>
              )}
              {r.status === "pending" && (
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <Clock className="w-3.5 h-3.5" /> Pending
                </span>
              )}
            </div>

            {/* Sent at */}
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {r.sentAt ? fmtDateTime(r.sentAt) : "—"}
            </p>

            {/* Twilio SID or error */}
            <div className="min-w-0">
              {r.twilioSid && (
                <p className="text-[11px] font-mono truncate" style={{ color: "rgba(245,166,35,0.7)" }}
                  title={r.twilioSid}>
                  {r.twilioSid}
                </p>
              )}
              {r.errorMessage && (
                <p className="text-[11px] truncate" style={{ color: "#f87171" }}
                  title={r.errorMessage}>
                  {r.errorMessage}
                </p>
              )}
              {!r.twilioSid && !r.errorMessage && (
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Single campaign row with expand/collapse and Retry Failed button */
function CampaignRow({ campaign, onRetried }: {
  campaign: {
    id: number;
    name: string;
    message: string;
    totalCount: number;
    sentCount: number;
    failedCount: number;
    status: string;
    scheduledAt: Date | string | null;
    createdAt: Date | string;
    completedAt: Date | string | null;
  };
  onRetried: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const retryMutation = trpc.portalCustomers.retryFailedRecipients.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      onRetried();
    },
    onError: (err) => toast.error(err.message),
  });

  const statusColor =
    campaign.status === "completed" ? "#4ade80"
    : campaign.status === "failed" ? "#f87171"
    : campaign.status === "pending" ? "#F5A623"
    : "#F5A623";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: "#F5A623" }} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{campaign.name}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
            {campaign.message.length > 80 ? campaign.message.slice(0, 80) + "…" : campaign.message}
          </p>
          {campaign.scheduledAt && campaign.status === "pending" && (
            <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "#F5A623" }}>
              <CalendarClock className="w-3 h-3" />
              Scheduled for {fmtDateTime(campaign.scheduledAt)}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-2 text-xs">
          <span style={{ color: "#4ade80" }}>{campaign.sentCount} sent</span>
          {campaign.failedCount > 0 && (
            <span style={{ color: "#f87171" }}>{campaign.failedCount} failed</span>
          )}
          <span style={{ color: "rgba(255,255,255,0.3)" }}>{fmtDate(campaign.createdAt)}</span>
          <Badge
            className="text-[10px] px-1.5 py-0 h-4 capitalize"
            style={{ background: `${statusColor}20`, color: statusColor, border: "none" }}
          >
            {campaign.status}
          </Badge>

          {/* Retry Failed button — only when there are failed recipients */}
          {campaign.failedCount > 0 && (campaign.status === "completed" || campaign.status === "failed") && (
            <button
              title={`Retry ${campaign.failedCount} failed recipient${campaign.failedCount !== 1 ? "s" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                retryMutation.mutate({ campaignId: campaign.id });
              }}
              disabled={retryMutation.isPending}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-70"
              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}
            >
              {retryMutation.isPending
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              Retry {campaign.failedCount}
            </button>
          )}

          {expanded
            ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            : <ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}
        </div>
      </div>

      {/* Expandable recipients */}
      {expanded && <CampaignRecipientsRow campaignId={campaign.id} />}
    </div>
  );
}

export default function PortalCustomers() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"customers" | "history">("customers");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkSms, setShowBulkSms] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  // Scheduling state
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const { data: customers = [], isLoading } = trpc.portalCustomers.list.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } =
    trpc.portalCustomers.listSmsCampaigns.useQuery(undefined, {
      enabled: activeTab === "history",
      staleTime: 30_000,
    });

  const bulkSmsPreviewMutation = trpc.portalCustomers.bulkSmsPreview.useMutation({
    onSuccess: () => setSmsSent(true),
    onError: (err) => toast.error(err.message),
  });
  const utils = trpc.useUtils();
  const toggleOptOutMutation = trpc.portalCustomers.toggleSmsOptOut.useMutation({
    onSuccess: (data) => {
      toast.success(data.optedOutSms ? "Customer opted out of SMS" : "Customer re-enabled for SMS");
      utils.portalCustomers.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
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
    onError: (err) => toast.error(err.message),
  });

  const scheduleBulkSmsMutation = trpc.portalCustomers.scheduleBulkSms.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowBulkSms(false);
      setSelected(new Set());
      setScheduleMode(false);
      setScheduledAt("");
    },
    onError: (err) => toast.error(err.message),
  });

  // alias for the preview step
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
    setShowBulkSms(true);
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
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: "#F5A623" }} />
            Customer Database
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Auto-populated from accepted quotes and paid invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "customers" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={exportCsv}
                disabled={customers.length === 0}
                className="border-white/10 text-white/60 hover:text-white"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
              </Button>
              <WriteGuard>
                <Button
                  size="sm"
                  onClick={openBulkSms}
                  disabled={selected.size === 0}
                  style={selected.size > 0 ? { background: "#F5A623", color: "#0F1F3D" } : {}}
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  Bulk SMS {selected.size > 0 && `(${selected.size})`}
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
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
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
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Total Customers", value: String(customers.length), icon: <Users className="w-4 h-4" /> },
              { label: "Total Jobs", value: String(totalJobs), icon: <Briefcase className="w-4 h-4" /> },
              { label: "Total Revenue", value: fmtAUD(totalRevenue), icon: <DollarSign className="w-4 h-4" /> },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-4" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2 mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {stat.icon}
                  <span className="text-xs">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Search + select-all */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={toggleAll}
              className="flex-shrink-0 transition-colors"
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
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
              <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm font-medium text-white mb-1">
                {search ? "No customers match your search" : "No customers yet"}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {search
                  ? "Try a different search term."
                  : "Customers appear here automatically when a quote is accepted or invoice is paid."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    background: selected.has(c.id) ? "rgba(245,166,35,0.07)" : "rgba(255,255,255,0.03)",
                    border: selected.has(c.id) ? "1px solid rgba(245,166,35,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                  onClick={() => navigate(`/portal/customers/${c.id}`)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                    className="flex-shrink-0"
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
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm truncate">{c.name}</span>
                      {c.jobCount > 1 && (
                        <Badge
                          className="text-[10px] px-1.5 py-0 h-4"
                          style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "none" }}
                        >
                          {c.jobCount} jobs
                        </Badge>
                      )}
                      {/* SMS opt-out badge — inline with name */}
                      {c.optedOutSms && (
                        <button
                          title="SMS opted out — click to re-enable"
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
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
              <History className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm font-medium text-white mb-1">No campaigns sent yet</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Select customers on the Customers tab and send a Bulk SMS to see history here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} — click any row to expand recipient delivery details.
              </p>
              {campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} onRetried={refetchCampaigns} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Bulk SMS Modal */}
      <Dialog open={showBulkSms} onOpenChange={setShowBulkSms}>
        <DialogContent className="max-w-md" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
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
                  onClick={() => setScheduleMode((v) => !v)}
                  className="flex items-center gap-2 text-xs font-medium mb-2 transition-opacity hover:opacity-70"
                  style={{ color: scheduleMode ? "#F5A623" : "rgba(255,255,255,0.4)" }}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  {scheduleMode ? "Scheduling for later" : "Send immediately — click to schedule instead"}
                </button>
                {scheduleMode && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                    className="w-full rounded-md px-3 py-2 text-sm bg-white/5 border border-white/10 text-white"
                    style={{ colorScheme: "dark" }}
                  />
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 border-white/10 text-white/60"
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
                    className="flex-1 font-semibold"
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
                    className="flex-1 font-semibold"
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
                  className="border-white/10 text-white/60"
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
                >
                  {bulkSmsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Preview Recipients"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
