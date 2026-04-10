/**
 * Portal Job Detail — full job view.
 * Shows client info, location, linked quote, progress payments, before/after photos,
 * invoice generation, and job completion.
 */
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, User, Phone, Mail, Home, Briefcase,
  DollarSign, CheckCircle2, FileText, Camera, Clock,
  Plus, Trash2, Loader2, Edit2, Save, X, CreditCard,
  Banknote, Receipt, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuoteEngineUpgradeButton } from "@/components/portal/QuoteEngineUpgradeButton";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STAGE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  new_lead:  { bg: "rgba(245,166,35,0.12)",  text: "#F5A623", label: "New Lead" },
  quoted:    { bg: "rgba(59,130,246,0.12)",   text: "#3b82f6", label: "Quoted" },
  booked:    { bg: "rgba(139,92,246,0.12)",   text: "#8b5cf6", label: "Booked" },
  completed: { bg: "rgba(74,222,128,0.12)",   text: "#4ade80", label: "Completed" },
  lost:      { bg: "rgba(239,68,68,0.12)",    text: "#ef4444", label: "Lost" },
};

const INVOICE_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  not_invoiced: { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.4)", label: "Not Invoiced" },
  draft:        { bg: "rgba(245,166,35,0.12)",  text: "#F5A623", label: "Draft" },
  sent:         { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6", label: "Sent" },
  paid:         { bg: "rgba(74,222,128,0.12)",  text: "#4ade80", label: "Paid" },
  overdue:      { bg: "rgba(239,68,68,0.12)",   text: "#ef4444", label: "Overdue" },
};

function centsToAud(cents: number | null | undefined) {
  if (!cents) return "$0.00";
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Editable Field ───────────────────────────────────────────────────────────
function EditableField({
  label,
  value,
  onSave,
  icon,
  placeholder = "—",
  type = "text",
}: {
  label: string;
  value: string | null | undefined;
  onSave: (v: string) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  return (
    <div className="flex items-start gap-2 group">
      {icon && <span className="mt-0.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="flex-1 text-sm px-2 py-1 rounded outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") { onSave(draft); setEditing(false); }
                if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
              }}
            />
            <button onClick={() => { onSave(draft); setEditing(false); }} className="text-green-400 hover:text-green-300"><Save className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setDraft(value ?? ""); setEditing(false); }} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <p className="text-sm" style={{ color: value ? "#fff" : "rgba(255,255,255,0.3)" }}>
              {value || placeholder}
            </p>
            <button
              onClick={() => { setDraft(value ?? ""); setEditing(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Photo Section ──────────────────────────────────────────────────────────
type JobPhoto = { id: string; photoType: string; imageUrl: string; imageKey: string; caption: string | null };

function PhotoSection({
  jobId,
  beforePhotos,
  afterPhotos,
  onRefresh,
}: {
  jobId: number;
  beforePhotos: JobPhoto[];
  afterPhotos: JobPhoto[];
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState<"before" | "after" | null>(null);

  const addPhoto = trpc.portal.addJobPhoto.useMutation({
    onSuccess: () => { onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const removePhoto = trpc.portal.removeJobPhoto.useMutation({
    onSuccess: () => { onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, photoType: "before" | "after") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }
    setUploading(photoType);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("photoType", photoType);
      const res = await fetch("/api/portal/upload-photo", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as { error?: string }).error ?? "Upload failed"); }
      const { url } = await res.json() as { url: string };
      // imageKey is the S3 key — extract from URL path for now (server handles actual key)
      addPhoto.mutate({ jobId, photoType, imageUrl: url, imageKey: url.split("/").pop() ?? url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  }

  function PhotoGrid({ photos, type }: { photos: JobPhoto[]; type: "before" | "after" }) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
            {type === "before" ? "Before" : "After"} ({photos.length})
          </p>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, type)} />
            {uploading === type ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#F5A623" }} />
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}>
                <Plus className="w-3 h-3" /> Add
              </span>
            )}
          </label>
        </div>
        {photos.length === 0 ? (
          <label className="cursor-pointer block">
            <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, type)} />
            <div className="rounded-lg flex flex-col items-center justify-center h-24 gap-1 text-xs" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.25)" }}>
              <Camera className="w-4 h-4" />
              Click to upload
            </div>
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {photos.map(p => (
              <div key={p.id} className="relative group rounded-lg overflow-hidden" style={{ aspectRatio: "4/3" }}>
                <img src={p.imageUrl} alt={p.caption ?? type} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto.mutate({ id: p.id, jobId })}
                  className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(239,68,68,0.85)" }}
                >
                  <Trash2 className="w-2.5 h-2.5 text-white" />
                </button>
                {p.caption && <p className="absolute bottom-0 left-0 right-0 text-[10px] px-1.5 py-1 truncate" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>{p.caption}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <SectionCard title="Before & After Photos" action={<Camera className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
      <div className="grid grid-cols-2 gap-4">
        <PhotoGrid photos={beforePhotos} type="before" />
        <PhotoGrid photos={afterPhotos} type="after" />
      </div>
    </SectionCard>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PortalJobDetail() {
  const [, params] = useRoute("/portal/jobs/:id");
  const [, navigate] = useLocation();
  const jobId = parseInt(params?.id ?? "0", 10);

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.portal.getJobDetail.useQuery(
    { id: jobId },
    { enabled: !!jobId }
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateJob = trpc.portal.updateJobDetail.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const addPayment = trpc.portal.addProgressPayment.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); setShowAddPayment(false); toast.success("Payment recorded"); },
    onError: (e) => toast.error(e.message),
  });

  const removePayment = trpc.portal.removeProgressPayment.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); toast.success("Payment removed"); },
    onError: (e) => toast.error(e.message),
  });

  const markComplete = trpc.portal.markJobComplete.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); setShowCompleteModal(false); toast.success("Job marked complete"); },
    onError: (e) => toast.error(e.message),
  });

  const generateCompletionReport = trpc.portal.generateCompletionReport.useMutation({
    onSuccess: (res) => {
      utils.portal.getJobDetail.invalidate({ id: jobId });
      toast.success("Completion report generated");
      if (res.pdfUrl) window.open(res.pdfUrl, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateInvoice = trpc.portal.generateInvoice.useMutation({
    onSuccess: (res) => { utils.portal.getJobDetail.invalidate({ id: jobId }); toast.success(`Invoice ${res.invoiceNumber} created`); },
    onError: (e) => toast.error(e.message),
  });

  const markPaid = trpc.portal.markInvoicePaid.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); setShowMarkPaid(false); toast.success("Invoice marked as paid"); },
    onError: (e) => toast.error(e.message),
  });

  // ── Local state ────────────────────────────────────────────────────────────
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cash" | "stripe" | "cheque" | "other">("cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const [variationNotes, setVariationNotes] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [actualValue, setActualValue] = useState("");

  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [paidMethod, setPaidMethod] = useState<"bank_transfer" | "cash" | "stripe" | "other">("cash");
  const [paidAmount, setPaidAmount] = useState("");

  const [showSendReport, setShowSendReport] = useState(false);
  const [sendReportEmail, setSendReportEmail] = useState("");

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      </PortalLayout>
    );
  }

  if (error || !data) {
    return (
      <PortalLayout>
        <div className="text-center py-16">
          <p className="text-white/40">Job not found.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/portal/jobs")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Jobs
          </Button>
        </div>
      </PortalLayout>
    );
  }

  const { job, progressPayments, photos, quote, lineItems, hasQuoteEngine } = data;
  const stageStyle = STAGE_COLORS[job.stage] ?? STAGE_COLORS.new_lead;
  const invoiceStyle = INVOICE_STATUS_COLORS[job.invoiceStatus ?? "not_invoiced"] ?? INVOICE_STATUS_COLORS.not_invoiced;

  const totalPaidCents = progressPayments.reduce((s, p) => s + p.amountCents, 0);
  const invoicedCents = job.invoicedAmount ?? 0;
  const remainingCents = Math.max(0, invoicedCents - totalPaidCents);

  const beforePhotos = photos.filter(p => p.photoType === "before");
  const afterPhotos = photos.filter(p => p.photoType === "after");

  function save(field: string, value: string | number | null) {
    updateJob.mutate({ id: jobId, [field]: value } as Parameters<typeof updateJob.mutate>[0]);
  }

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto space-y-5 pb-12">

        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/portal/jobs")}
            className="mt-1 p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{job.jobType}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: stageStyle.bg, color: stageStyle.text }}>
                {stageStyle.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: invoiceStyle.bg, color: invoiceStyle.text }}>
                {invoiceStyle.label}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Created {formatDate(job.createdAt)}
              {job.invoiceNumber && ` · ${job.invoiceNumber}`}
            </p>
          </div>
          {/* Stage selector */}
          <select
            value={job.stage}
            onChange={e => save("stage", e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer"
            style={{ background: "#0F1F3D", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <option value="new_lead">New Lead</option>
            <option value="quoted">Quoted</option>
            <option value="booked">Booked</option>
            <option value="completed">Completed</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── Client Details ── */}
          <SectionCard title="Client Details" action={<User className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
            <EditableField label="Name" value={job.customerName ?? job.callerName} onSave={v => save("customerName", v)} icon={<User className="w-3.5 h-3.5" />} placeholder="Not set" />
            <EditableField label="Phone" value={job.customerPhone ?? job.callerPhone} onSave={v => save("customerPhone", v)} icon={<Phone className="w-3.5 h-3.5" />} placeholder="Not set" type="tel" />
            <EditableField label="Email" value={job.customerEmail} onSave={v => save("customerEmail", v)} icon={<Mail className="w-3.5 h-3.5" />} placeholder="Not set" type="email" />
            <EditableField label="Address" value={job.customerAddress ?? job.location} onSave={v => save("customerAddress", v)} icon={<Home className="w-3.5 h-3.5" />} placeholder="Not set" />
          </SectionCard>

          {/* ── Job Details ── */}
          <SectionCard title="Job Details" action={<Briefcase className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
            <EditableField label="Job Type" value={job.jobType} onSave={v => save("jobType", v)} icon={<Briefcase className="w-3.5 h-3.5" />} />
            <EditableField label="Location" value={job.location} onSave={v => save("location", v)} icon={<MapPin className="w-3.5 h-3.5" />} placeholder="Not set" />
            <EditableField label="Preferred Date" value={job.preferredDate} onSave={v => save("preferredDate", v)} icon={<Clock className="w-3.5 h-3.5" />} placeholder="Not set" />
            <EditableField label="Notes" value={job.notes} onSave={v => save("notes", v)} icon={<FileText className="w-3.5 h-3.5" />} placeholder="Add notes..." />
            <div className="flex items-center gap-4 pt-1">
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Est. Value</p>
                <p className="text-sm font-semibold" style={{ color: "#F5A623" }}>
                  {job.estimatedValue ? `$${job.estimatedValue.toLocaleString()}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Actual Value</p>
                <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>
                  {job.actualValue ? `$${job.actualValue.toLocaleString()}` : "—"}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Linked Quote ── */}
        {quote && (
          <SectionCard title="Linked Quote" action={<FileText className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Quote #{(quote as { quoteNumber?: string }).quoteNumber ?? quote.id}</p>
                <p className="text-lg font-bold text-white mt-0.5">
                  ${(parseFloat(String((quote as unknown as { totalAmount?: string | number }).totalAmount ?? 0)) || 0).toLocaleString()}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {(quote as { status?: string }).status ?? "draft"}
              </Badge>
            </div>
            {(lineItems as Array<{ id: string; description: string; quantity: number; unitPrice: number }>).length > 0 && (
              <div className="space-y-1 pt-1">
                {(lineItems as Array<{ id: string; description: string; quantity: number; unitPrice: number }>).map(item => (
                  <div key={item.id} className="flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                    <span>{item.description} × {item.quantity}</span>
                    <span>${(item.unitPrice * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Progress Payments ── */}
        <SectionCard
          title="Progress Payments"
          action={
            <button
              onClick={() => setShowAddPayment(true)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "#F5A623" }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Payment
            </button>
          }
        >
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Invoiced</p>
              <p className="text-base font-bold text-white">{centsToAud(invoicedCents)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Received</p>
              <p className="text-base font-bold" style={{ color: "#4ade80" }}>{centsToAud(totalPaidCents)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Outstanding</p>
              <p className="text-base font-bold" style={{ color: remainingCents > 0 ? "#ef4444" : "#4ade80" }}>{centsToAud(remainingCents)}</p>
            </div>
          </div>

          {/* Payment list */}
          {progressPayments.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.3)" }}>No payments recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {progressPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-white font-medium">{centsToAud(p.amountCents)}</span>
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                      {p.method.replace("_", " ")}
                    </span>
                    {p.note && <span className="ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{p.note}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>{formatDate(p.receivedAt)}</span>
                    <button
                      onClick={() => removePayment.mutate({ id: p.id, jobId })}
                      className="hover:text-red-400 transition-colors"
                      style={{ color: "rgba(255,255,255,0.2)" }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add payment form */}
          {showAddPayment && (
            <div className="pt-2 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Amount (AUD)</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm px-2 py-1.5 rounded-lg outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}
                    className="w-full text-sm px-2 py-1.5 rounded-lg outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="stripe">Card (Stripe)</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Date Received</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full text-sm px-2 py-1.5 rounded-lg outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Note (optional)</label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={e => setPaymentNote(e.target.value)}
                    placeholder="e.g. Deposit"
                    className="w-full text-sm px-2 py-1.5 rounded-lg outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const cents = Math.round(parseFloat(paymentAmount) * 100);
                    if (!cents || isNaN(cents)) { toast.error("Enter a valid amount"); return; }
                    addPayment.mutate({ jobId, amountCents: cents, method: paymentMethod, note: paymentNote || undefined, receivedAt: paymentDate });
                  }}
                  disabled={addPayment.isPending}
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                >
                  {addPayment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Payment"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddPayment(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Before/After Photos ── */}
        <PhotoSection
          jobId={jobId}
          beforePhotos={beforePhotos}
          afterPhotos={afterPhotos}
          onRefresh={() => utils.portal.getJobDetail.invalidate({ id: jobId })}
        />

        {/* ── Completion ── */}
        {(job.stage === "completed" || job.completedAt) ? (
          <SectionCard title="Completion Details" action={<CheckCircle2 className="w-4 h-4" style={{ color: "#4ade80" }} />}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Completed</p>
                <p className="text-sm text-white">{formatDate(job.completedAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Hours</p>
                <p className="text-sm text-white">{job.actualHours ? `${job.actualHours} hrs` : "—"}</p>
              </div>
            </div>
            {job.completionNotes && (
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>What was done</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{job.completionNotes}</p>
              </div>
            )}
            {job.variationNotes && (
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Variations</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{job.variationNotes}</p>
              </div>
            )}
          </SectionCard>
        ) : (
          <div className="flex justify-center">
            <Button
              onClick={() => setShowCompleteModal(true)}
              style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Job Complete
            </Button>
          </div>
        )}

        {/* ── Completion Report ── */}
        <SectionCard title="Completion Report" action={<FileText className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
          {(job as any).completionReportUrl ? (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Report generated and ready to send to your customer.</p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => window.open((job as any).completionReportUrl, "_blank")}
                  style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> View Report
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setSendReportEmail(job.customerEmail ?? "");
                    setShowSendReport(true);
                  }}
                  style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Send to Client
                </Button>
                <Button
                  size="sm"
                  onClick={() => generateCompletionReport.mutate({ jobId })}
                  disabled={generateCompletionReport.isPending}
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {generateCompletionReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                  Regenerate
                </Button>
              </div>
              {/* Send Report modal */}
              {showSendReport && (
                <div className="mt-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>Send completion report to:</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={sendReportEmail}
                      onChange={e => setSendReportEmail(e.target.value)}
                      placeholder="customer@email.com"
                      className="flex-1 text-xs px-3 py-1.5 rounded-md"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white", outline: "none" }}
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!sendReportEmail) { toast.error("Enter a customer email"); return; }
                        generateCompletionReport.mutate({ jobId, sendEmail: true, customerEmail: sendReportEmail }, {
                          onSuccess: (res) => {
                            setShowSendReport(false);
                            toast.success(res.sent ? "Report sent to client" : "Report generated (email not sent)");
                          }
                        });
                      }}
                      disabled={generateCompletionReport.isPending}
                      style={{ background: "#22c55e", color: "white" }}
                    >
                      {generateCompletionReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowSendReport(false)} style={{ color: "rgba(255,255,255,0.4)" }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-2">
              {hasQuoteEngine ? (
                <>
                  <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Generate a client-facing report showing what was done, variations, and before/after photos.
                  </p>
                  <Button
                    onClick={() => generateCompletionReport.mutate({ jobId })}
                    disabled={generateCompletionReport.isPending}
                    style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}
                  >
                    {generateCompletionReport.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                    Generate Completion Report
                  </Button>
                </>
              ) : (
                <div className="w-full rounded-xl p-4 text-center space-y-3" style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)" }}>
                  <div className="text-2xl">📋</div>
                  <p className="text-sm font-semibold text-white">Completion Reports</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Send professional completion reports with before/after photos directly to your customers. Included in the Quote Engine add-on.
                  </p>
                  <QuoteEngineUpgradeButton size="sm" label="Unlock for $97/mo" />
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── Invoice Actions ── */}
        <SectionCard title="Invoice" action={<Receipt className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
          {job.invoiceStatus === "not_invoiced" || !job.invoiceStatus ? (
            <div className="flex flex-col items-center gap-3 py-2">
              {hasQuoteEngine ? (
                <>
                  <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                    No invoice generated yet. Generate one from the accepted quote or job value.
                  </p>
                  <Button
                    onClick={() => generateInvoice.mutate({ jobId, paymentMethod: "bank_transfer" })}
                    disabled={generateInvoice.isPending}
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                  >
                    {generateInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                    Generate Invoice
                  </Button>
                </>
              ) : (
                <div className="w-full rounded-xl p-4 text-center space-y-3" style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)" }}>
                  <div className="text-2xl">🧾</div>
                  <p className="text-sm font-semibold text-white">Professional Invoicing</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Generate branded PDF invoices with your bank details, GST breakdown, and payment tracking. Included in the Quote Engine add-on.
                  </p>
                  <QuoteEngineUpgradeButton size="sm" label="Unlock for $97/mo" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{job.invoiceNumber}</p>
                  <p className="text-xl font-bold text-white">{centsToAud(invoicedCents)}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: invoiceStyle.bg, color: invoiceStyle.text }}>
                  {invoiceStyle.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span>Invoiced {formatDate(job.invoicedAt)}</span>
                {job.paidAt && <><span>·</span><span>Paid {formatDate(job.paidAt)}</span></>}
              </div>
              {job.invoiceStatus !== "paid" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => { setPaidAmount(String((invoicedCents / 100).toFixed(2))); setShowMarkPaid(true); }}
                    style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
                  >
                    <Banknote className="w-3.5 h-3.5 mr-1.5" /> Mark as Paid
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => updateJob.mutate({ id: jobId, invoiceStatus: "sent" })}>
                    Mark Sent
                  </Button>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── Mark Complete Modal ── */}
        {showCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Mark Job Complete</h2>
                <button onClick={() => setShowCompleteModal(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>What was done (completion notes)</label>
                  <textarea
                    value={completionNotes}
                    onChange={e => setCompletionNotes(e.target.value)}
                    rows={3}
                    placeholder="Describe what was completed..."
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Variations from quote (optional)</label>
                  <textarea
                    value={variationNotes}
                    onChange={e => setVariationNotes(e.target.value)}
                    rows={2}
                    placeholder="Any changes from the original quote..."
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Actual hours</label>
                    <input
                      type="number"
                      value={actualHours}
                      onChange={e => setActualHours(e.target.value)}
                      placeholder="e.g. 3.5"
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Final value ($)</label>
                    <input
                      type="number"
                      value={actualValue}
                      onChange={e => setActualValue(e.target.value)}
                      placeholder="e.g. 850"
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => markComplete.mutate({
                    id: jobId,
                    completionNotes: completionNotes || undefined,
                    variationNotes: variationNotes || undefined,
                    actualHours: actualHours || undefined,
                    actualValue: actualValue ? parseFloat(actualValue) : undefined,
                  })}
                  disabled={markComplete.isPending}
                  className="flex-1"
                  style={{ background: "#4ade80", color: "#0F1F3D" }}
                >
                  {markComplete.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Complete Job
                </Button>
                <Button variant="ghost" onClick={() => setShowCompleteModal(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mark Paid Modal ── */}
        {showMarkPaid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Mark Invoice Paid</h2>
                <button onClick={() => setShowMarkPaid(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Amount received ($)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Payment method</label>
                  <select
                    value={paidMethod}
                    onChange={e => setPaidMethod(e.target.value as typeof paidMethod)}
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="stripe">Card (Stripe)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const cents = Math.round(parseFloat(paidAmount) * 100);
                    if (!cents || isNaN(cents)) { toast.error("Enter a valid amount"); return; }
                    markPaid.mutate({ jobId, paymentMethod: paidMethod, amountCents: cents });
                  }}
                  disabled={markPaid.isPending}
                  className="flex-1"
                  style={{ background: "#4ade80", color: "#0F1F3D" }}
                >
                  {markPaid.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                  Confirm Payment
                </Button>
                <Button variant="ghost" onClick={() => setShowMarkPaid(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
