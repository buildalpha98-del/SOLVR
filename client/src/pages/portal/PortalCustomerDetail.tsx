/**
 * PortalCustomerDetail — Full customer history page
 *
 * Shows:
 *  - Customer summary card (name, phone, email, address, lifetime value)
 *  - Editable notes field
 *  - Full job history (all jobs matched by phone number)
 *  - Re-quote button on each job (pre-fills a new quote from that job's details)
 */
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ViewerBanner, WriteGuard } from "@/components/portal/ViewerBanner";
import {
  ArrowLeft, Phone, Mail, MapPin, DollarSign, Briefcase,
  Calendar, FileText, Loader2, Save, RefreshCw, CheckCircle2,
  Clock, AlertCircle,
} from "lucide-react";

function fmtDate(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtAUD(cents: number | null | undefined) {
  if (!cents) return "$0";
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STAGE_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  quoted: "Quoted",
  booked: "Booked",
  in_progress: "In Progress",
  completed: "Completed",
  lost: "Lost",
};

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  new_lead: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" },
  quoted: { bg: "rgba(245,166,35,0.15)", color: "#F5A623" },
  booked: { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
  in_progress: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  completed: { bg: "rgba(74,222,128,0.15)", color: "#4ade80" },
  lost: { bg: "rgba(248,113,113,0.15)", color: "#f87171" },
};

export default function PortalCustomerDetail() {
  const params = useParams<{ id: string }>();
  const customerId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const [notes, setNotes] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);

  const { data, isLoading, error } = trpc.portalCustomers.get.useQuery(
    { id: customerId },
    {
      enabled: !!customerId,
      retry: false,
      onSuccess: (d) => {
        if (notes === null) setNotes(d.customer.notes ?? "");
      },
    },
  );

  const utils = trpc.useUtils();
  const updateNotesMutation = trpc.portalCustomers.updateNotes.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
      setEditingNotes(false);
      utils.portalCustomers.get.invalidate({ id: customerId });
    },
    onError: (err) => toast.error(err.message),
  });

  // Re-quote: navigate to /portal/quotes/new with pre-filled params from the job
  function handleReQuote(job: NonNullable<typeof data>["jobs"][number]) {
    const params = new URLSearchParams({
      customerName: job.customerName ?? job.callerName ?? "",
      customerPhone: job.customerPhone ?? job.callerPhone ?? "",
      customerEmail: job.customerEmail ?? "",
      customerAddress: job.customerAddress ?? job.location ?? "",
      jobType: job.jobType ?? "",
      description: job.description ?? "",
      prefill: "1",
    });
    navigate(`/portal/quotes/new?${params.toString()}`);
  }

  if (isLoading) {
    return (
      <PortalLayout activeTab="customers">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      </PortalLayout>
    );
  }

  if (error || !data) {
    return (
      <PortalLayout activeTab="customers">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="w-10 h-10" style={{ color: "rgba(255,255,255,0.2)" }} />
          <p className="text-white/50 text-sm">Customer not found.</p>
          <Button variant="outline" onClick={() => navigate("/portal/customers")} className="border-white/10 text-white/60">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Customers
          </Button>
        </div>
      </PortalLayout>
    );
  }

  const { customer, jobs } = data;
  const displayNotes = notes !== null ? notes : (customer.notes ?? "");

  return (
    <PortalLayout activeTab="customers">
      <ViewerBanner />

      {/* Back nav */}
      <button
        onClick={() => navigate("/portal/customers")}
        className="flex items-center gap-1.5 text-sm mb-5 transition-colors"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Customers
      </button>

      {/* Customer summary card */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
            >
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{customer.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1 text-sm"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    <Phone className="w-3.5 h-3.5" />{customer.phone}
                  </a>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-1 text-sm"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    <Mail className="w-3.5 h-3.5" />{customer.email}
                  </a>
                )}
                {(customer.suburb || customer.address) && (
                  <span className="flex items-center gap-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                    <MapPin className="w-3.5 h-3.5" />
                    {customer.suburb ?? customer.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Briefcase className="w-3.5 h-3.5" />
                <span className="text-xs">Jobs</span>
              </div>
              <p className="text-2xl font-bold text-white">{customer.jobCount}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-xs">Lifetime</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#4ade80" }}>
                {fmtAUD(customer.totalSpentCents)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs">First Job</span>
              </div>
              <p className="text-sm font-semibold text-white">{fmtDate(customer.firstJobAt)}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
              Notes
            </span>
            <WriteGuard>
              {editingNotes ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setNotes(customer.notes ?? ""); setEditingNotes(false); }}
                    className="h-6 text-xs border-white/10 text-white/50"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => updateNotesMutation.mutate({ id: customer.id, notes: displayNotes })}
                    disabled={updateNotesMutation.isPending}
                    className="h-6 text-xs"
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                  >
                    {updateNotesMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <><Save className="w-3 h-3 mr-1" />Save</>}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-xs transition-colors"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Edit
                </button>
              )}
            </WriteGuard>
          </div>
          {editingNotes ? (
            <Textarea
              value={displayNotes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this customer…"
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/25 resize-none text-sm"
            />
          ) : (
            <p
              className="text-sm"
              style={{ color: displayNotes ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.25)" }}
            >
              {displayNotes || "No notes yet. Click Edit to add one."}
            </p>
          )}
        </div>
      </div>

      {/* Job History */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
          Job History ({jobs.length})
        </h2>
      </div>

      {jobs.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.15)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            No jobs found for this customer's phone number.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const stageStyle = STAGE_COLORS[job.stage] ?? STAGE_COLORS.new_lead;
            const value = job.amountPaid
              ? job.amountPaid
              : job.invoicedAmount
              ? job.invoicedAmount
              : job.actualValue
              ? job.actualValue * 100
              : job.estimatedValue
              ? job.estimatedValue * 100
              : null;

            return (
              <div
                key={job.id}
                className="rounded-xl p-4"
                style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-white text-sm">{job.jobType}</span>
                      <Badge
                        className="text-[10px] px-1.5 py-0 h-4"
                        style={{ background: stageStyle.bg, color: stageStyle.color, border: "none" }}
                      >
                        {job.stage === "completed" && <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
                        {STAGE_LABELS[job.stage] ?? job.stage}
                      </Badge>
                      {job.invoiceNumber && (
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {job.invoiceNumber}
                        </span>
                      )}
                    </div>

                    {job.description && (
                      <p className="text-xs mb-2 line-clamp-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {job.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 flex-wrap">
                      {job.location && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                          <MapPin className="w-3 h-3" />{job.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        <Clock className="w-3 h-3" />{fmtDate(job.createdAt)}
                      </span>
                      {job.paidAt && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: "#4ade80" }}>
                          <CheckCircle2 className="w-3 h-3" />Paid {fmtDate(job.paidAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {value && value > 0 && (
                      <p className="text-base font-bold" style={{ color: "#4ade80" }}>
                        {fmtAUD(value)}
                      </p>
                    )}
                    <WriteGuard>
                      <Button
                        size="sm"
                        onClick={() => handleReQuote(job)}
                        className="h-7 text-xs font-semibold"
                        style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Re-quote
                      </Button>
                    </WriteGuard>
                  </div>
                </div>

                {/* Completion notes */}
                {job.completionNotes && (
                  <div
                    className="mt-3 pt-3 text-xs"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                  >
                    <span className="font-semibold text-white/30 uppercase tracking-wide text-[10px]">Completion notes: </span>
                    {job.completionNotes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
