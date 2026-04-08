/**
 * PortalQuoteDetail — View, edit, and send a single quote.
 *
 * Sections:
 * - Quote header (number, status, customer info)
 * - Line items editor (editable for drafts)
 * - AI report section (generate / view)
 * - Photos section (upload, analyse, delete)
 * - Send section (email recipient, custom message, PDF link)
 */
import { useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Send, FileText, Sparkles, Camera, Trash2,
  Loader2, CheckCircle, Download, Plus, XCircle, RefreshCw,
  ExternalLink,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtAUD(val: string | null | undefined) {
  if (!val) return "—";
  return `$${parseFloat(val).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "#6B7280" },
    sent: { label: "Sent", color: "#2563EB" },
    viewed: { label: "Viewed", color: "#7C3AED" },
    accepted: { label: "Accepted", color: "#059669" },
    declined: { label: "Declined", color: "#DC2626" },
    expired: { label: "Expired", color: "#9CA3AF" },
    cancelled: { label: "Cancelled", color: "#9CA3AF" },
  };
  const s = map[status] ?? { label: status, color: "#6B7280" };
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
      style={{ background: `${s.color}22`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PortalQuoteDetail() {
  const params = useParams<{ id: string }>();
  const quoteId = params.id;
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = trpc.quotes.get.useQuery({ id: quoteId });

  const updateMutation = trpc.quotes.update.useMutation({
    onSuccess: () => utils.quotes.get.invalidate({ id: quoteId }),
  });
  const generateReportMutation = trpc.quotes.generateReport.useMutation({
    onSuccess: () => utils.quotes.get.invalidate({ id: quoteId }),
  });
  const generatePdfMutation = trpc.quotes.generatePdf.useMutation();
  const sendMutation = trpc.quotes.send.useMutation({
    onSuccess: () => utils.quotes.get.invalidate({ id: quoteId }),
  });
  const addPhotoMutation = trpc.quotes.addPhoto.useMutation({
    onSuccess: () => utils.quotes.get.invalidate({ id: quoteId }),
  });
  const analysePhotosMutation = trpc.quotes.analysePhotos.useMutation({
    onSuccess: () => utils.quotes.get.invalidate({ id: quoteId }),
  });
  const deletePhotoMutation = trpc.quotes.deletePhoto.useMutation({
    onSuccess: () => utils.quotes.get.invalidate({ id: quoteId }),
  });

  // Local edit state
  const [editingLineItems, setEditingLineItems] = useState(false);
  const [lineItems, setLineItems] = useState<
    { description: string; quantity: string; unit: string; unitPrice: string }[]
  >([]);

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({ recipientEmail: "", recipientName: "", customMessage: "" });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (isLoading) {
    return (
      <PortalLayout activeTab="quotes">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      </PortalLayout>
    );
  }

  if (error || !data) {
    return (
      <PortalLayout activeTab="quotes">
        <div className="text-center py-20">
          <p className="text-white/50">Quote not found.</p>
          <Button variant="ghost" className="mt-4 text-amber-400" onClick={() => navigate("/portal/quotes")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Quotes
          </Button>
        </div>
      </PortalLayout>
    );
  }

  const { quote, lineItems: savedLineItems, photos } = data;
  const isDraft = quote.status === "draft";
  const reportContent = quote.reportContent as Record<string, unknown> | null;

  function startEditLineItems() {
    setLineItems(
      savedLineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit: li.unit ?? "each",
        unitPrice: li.unitPrice ?? "",
      })),
    );
    setEditingLineItems(true);
  }

  async function saveLineItems() {
    try {
      await updateMutation.mutateAsync({ id: quoteId, lineItems });
      setEditingLineItems(false);
      toast.success("Line items saved");
    } catch {
      toast.error("Failed to save line items");
    }
  }

  async function handleGenerateReport() {
    try {
      await generateReportMutation.mutateAsync({ id: quoteId });
      toast.success("AI report generated");
    } catch {
      toast.error("Failed to generate report");
    }
  }

  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    try {
      const result = await generatePdfMutation.mutateAsync({ id: quoteId });
      setPdfUrl(result.pdfUrl);
      toast.success("PDF ready");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleSend() {
    if (!sendForm.recipientEmail) {
      toast.error("Recipient email is required");
      return;
    }
    try {
      await sendMutation.mutateAsync({
        id: quoteId,
        recipientEmail: sendForm.recipientEmail,
        recipientName: sendForm.recipientName || undefined,
        customMessage: sendForm.customMessage || undefined,
        pdfUrl: pdfUrl || undefined,
      });
      toast.success("Quote sent!");
      setShowSendModal(false);
    } catch {
      toast.error("Failed to send quote");
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be under 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        await addPhotoMutation.mutateAsync({
          quoteId,
          imageDataUrl: dataUrl,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        });
        toast.success("Photo added");
      } catch {
        toast.error("Failed to upload photo");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <PortalLayout activeTab="quotes">
      {/* ── Back nav ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/portal/quotes")}
          className="text-white/50 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Quotes
        </Button>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/70 font-mono">{quote.quoteNumber}</span>
        {statusBadge(quote.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: details + line items ──────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Customer + job info */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <h2 className="text-lg font-bold text-white mb-4">{quote.jobTitle}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Customer", value: quote.customerName },
                { label: "Email", value: quote.customerEmail },
                { label: "Phone", value: quote.customerPhone },
                { label: "Address", value: quote.customerAddress },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label}>
                    <p className="text-white/40 text-xs mb-0.5">{label}</p>
                    <p className="text-white">{value}</p>
                  </div>
                ) : null,
              )}
            </div>
            {quote.jobDescription && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <p className="text-white/40 text-xs mb-1">Job Description</p>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{quote.jobDescription}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Line Items</h3>
              {isDraft && !editingLineItems && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-amber-400/70 hover:text-amber-400 text-xs"
                  onClick={startEditLineItems}
                >
                  Edit
                </Button>
              )}
            </div>

            {editingLineItems ? (
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                    <div className="col-span-5">
                      <Input
                        value={li.description}
                        onChange={(e) => {
                          const u = [...lineItems];
                          u[i] = { ...u[i], description: e.target.value };
                          setLineItems(u);
                        }}
                        placeholder="Description"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={li.quantity}
                        onChange={(e) => {
                          const u = [...lineItems];
                          u[i] = { ...u[i], quantity: e.target.value };
                          setLineItems(u);
                        }}
                        placeholder="Qty"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={li.unitPrice}
                        onChange={(e) => {
                          const u = [...lineItems];
                          u[i] = { ...u[i], unitPrice: e.target.value };
                          setLineItems(u);
                        }}
                        placeholder="Unit $"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {lineItems.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 text-red-400/60 hover:text-red-400"
                          onClick={() => setLineItems((items) => items.filter((_, j) => j !== i))}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-amber-400/70 hover:text-amber-400 text-xs"
                  onClick={() =>
                    setLineItems((items) => [
                      ...items,
                      { description: "", quantity: "1", unit: "each", unitPrice: "" },
                    ])
                  }
                >
                  <Plus className="w-3 h-3 mr-1" /> Add line
                </Button>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={saveLineItems}
                    disabled={updateMutation.isPending}
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                    className="font-semibold"
                  >
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white/40"
                    onClick={() => setEditingLineItems(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                      <th className="text-left text-white/40 font-normal pb-2">Description</th>
                      <th className="text-right text-white/40 font-normal pb-2">Qty</th>
                      <th className="text-right text-white/40 font-normal pb-2">Unit $</th>
                      <th className="text-right text-white/40 font-normal pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedLineItems.map((li) => (
                      <tr key={li.id} className="border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                        <td className="py-2 text-white">{li.description}</td>
                        <td className="py-2 text-right text-white/70">{li.quantity}</td>
                        <td className="py-2 text-right text-white/70">{fmtAUD(li.unitPrice)}</td>
                        <td className="py-2 text-right text-white font-medium">{fmtAUD(li.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 pt-3 border-t space-y-1 text-sm" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex justify-between text-white/60">
                    <span>Subtotal</span>
                    <span>{fmtAUD(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>GST ({quote.gstRate}%)</span>
                    <span>{fmtAUD(quote.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white text-base pt-1">
                    <span>Total</span>
                    <span style={{ color: "#F5A623" }}>{fmtAUD(quote.totalAmount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Report */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white">AI Report</h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-amber-400/70 hover:text-amber-400 text-xs"
                onClick={handleGenerateReport}
                disabled={generateReportMutation.isPending}
              >
                {generateReportMutation.isPending ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating…</>
                ) : reportContent ? (
                  <><RefreshCw className="w-3 h-3 mr-1" />Regenerate</>
                ) : (
                  <><Sparkles className="w-3 h-3 mr-1" />Generate</>
                )}
              </Button>
            </div>
            {reportContent ? (
              <div className="space-y-3 text-sm">
                {(reportContent.executiveSummary as string) && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Executive Summary</p>
                    <p className="text-white/80">{reportContent.executiveSummary as string}</p>
                  </div>
                )}
                {(reportContent.scopeOfWork as string) && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Scope of Work</p>
                    <p className="text-white/80">{reportContent.scopeOfWork as string}</p>
                  </div>
                )}
                {(reportContent.whyChooseUs as string) && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Why Choose Us</p>
                    <p className="text-white/80">{reportContent.whyChooseUs as string}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                Generate an AI-written report to include in the PDF and email.
              </p>
            )}
          </div>

          {/* Photos */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white">Photos</h3>
              </div>
              <div className="flex gap-2">
                {photos.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-400/70 hover:text-amber-400 text-xs"
                    onClick={() => analysePhotosMutation.mutate({ quoteId })}
                    disabled={analysePhotosMutation.isPending}
                  >
                    {analysePhotosMutation.isPending ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Analysing…</>
                    ) : (
                      <><Sparkles className="w-3 h-3 mr-1" />AI Analyse</>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/50 hover:text-white text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={addPhotoMutation.isPending}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {addPhotoMutation.isPending ? "Uploading…" : "Add Photo"}
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            {photos.length === 0 ? (
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                Add site photos to include in the quote PDF.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="relative group rounded-lg overflow-hidden aspect-square bg-white/5">
                    <img
                      src={p.imageUrl}
                      alt={p.caption ?? "Photo"}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => deletePhotoMutation.mutate({ photoId: p.id })}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                    {p.aiDescription && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                        <p className="text-[10px] text-white/70 line-clamp-2">{p.aiDescription}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: actions ───────────────────────────────────── */}
        <div className="space-y-4">
          {/* Send quote */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="font-semibold text-white mb-3">Send Quote</h3>
            <div className="space-y-2">
              <Button
                className="w-full font-semibold"
                style={{ background: "#F5A623", color: "#0F1F3D" }}
                onClick={() => {
                  setSendForm({
                    recipientEmail: quote.customerEmail ?? "",
                    recipientName: quote.customerName ?? "",
                    customMessage: "",
                  });
                  setShowSendModal(true);
                }}
              >
                <Send className="w-4 h-4 mr-2" />
                Send to Customer
              </Button>
              <Button
                variant="outline"
                className="w-full border-white/10 text-white/60 hover:text-white hover:border-white/30"
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
              >
                {generatingPdf ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating PDF…</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" />Generate PDF</>
                )}
              </Button>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open PDF
                </a>
              )}
            </div>
          </div>

          {/* Quote summary */}
          <div
            className="rounded-xl border p-5 space-y-2"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="font-semibold text-white mb-3">Summary</h3>
            {[
              { label: "Quote #", value: quote.quoteNumber },
              { label: "Status", value: statusBadge(quote.status) },
              { label: "Total", value: <span className="font-bold text-amber-400">{fmtAUD(quote.totalAmount)}</span> },
              { label: "Payment Terms", value: quote.paymentTerms },
              { label: "Valid Until", value: quote.validUntil ? new Date(String(quote.validUntil)).toLocaleDateString("en-AU") : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-white/40">{label}</span>
                <span className="text-white">{value}</span>
              </div>
            ))}
          </div>

          {/* Customer link */}
          {quote.status !== "draft" && (
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
            >
              <h3 className="font-semibold text-white mb-2 text-sm">Customer Link</h3>
              <a
                href={`/quote/${quote.customerToken}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 break-all"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                /quote/{quote.customerToken?.slice(0, 16)}…
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Send modal ──────────────────────────────────────────────────── */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent
          className="max-w-md"
          style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Send Quote</DialogTitle>
            <DialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
              The customer will receive an email with a link to view and accept the quote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-white/70 text-xs mb-1 block">Recipient Email *</Label>
              <Input
                value={sendForm.recipientEmail}
                onChange={(e) => setSendForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                placeholder="customer@email.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div>
              <Label className="text-white/70 text-xs mb-1 block">Recipient Name</Label>
              <Input
                value={sendForm.recipientName}
                onChange={(e) => setSendForm((f) => ({ ...f, recipientName: e.target.value }))}
                placeholder="John Smith"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div>
              <Label className="text-white/70 text-xs mb-1 block">Custom Message (optional)</Label>
              <Textarea
                value={sendForm.customMessage}
                onChange={(e) => setSendForm((f) => ({ ...f, customMessage: e.target.value }))}
                placeholder="Add a personal note to the email…"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                rows={3}
              />
            </div>
            {pdfUrl && (
              <div
                className="rounded-lg p-3 flex items-center gap-2"
                style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.3)" }}
              >
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-white/70">PDF will be included as a download link</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowSendModal(false)}
              className="text-white/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Send Quote</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
