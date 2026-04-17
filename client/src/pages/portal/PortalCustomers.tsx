/**
 * PortalCustomers — CRM Customer List
 *
 * Auto-populated from accepted quotes and paid invoices.
 * Supports search, multi-select, bulk SMS preview, and navigation to customer detail.
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
} from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkSms, setShowBulkSms] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSent, setSmsSent] = useState(false);

  const { data: customers = [], isLoading } = trpc.portalCustomers.list.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const bulkSmsPreviewMutation = trpc.portalCustomers.bulkSmsPreview.useMutation({
    onSuccess: () => setSmsSent(true),
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
    if (selected.size === 0) { toast.error("Select at least one customer first"); return; }
    setSmsMessage("");
    setSmsSent(false);
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
        </div>
      </div>

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

      {/* Bulk SMS Modal */}
      <Dialog open={showBulkSms} onOpenChange={setShowBulkSms}>
        <DialogContent className="max-w-md" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white">
              Bulk SMS — {selected.size} customer{selected.size !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
              Compose your message, preview recipients, then send via Twilio.
            </DialogDescription>
          </DialogHeader>

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
              </div>
            </div>
          ) : (
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
