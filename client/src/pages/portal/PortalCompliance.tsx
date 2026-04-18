/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalCompliance — AI-generated compliance documents for tradies.
 * Supports: SWMS, Safety Certificates, JSA, Site Induction checklists.
 */
import { useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldCheck, Plus, Loader2, FileText, Trash2,
  AlertTriangle, CheckCircle2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
type DocType = "swms" | "safety_cert" | "site_induction" | "jsa";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  swms: "SWMS (Safe Work Method Statement)",
  safety_cert: "Safety Certificate",
  site_induction: "Site Induction Checklist",
  jsa: "JSA (Job Safety Analysis)",
};

// Short labels used in buttons and list views
const DOC_TYPE_SHORT_LABELS: Record<DocType, string> = {
  swms: "SWMS",
  safety_cert: "Safety Certificate",
  site_induction: "Site Induction",
  jsa: "JSA",
};

const DOC_TYPE_DESCRIPTIONS: Record<DocType, string> = {
  swms: "Required for high-risk work like working at heights, electrical, or confined spaces. Legally required on most construction sites.",
  safety_cert: "Confirms all safety checks have been done before starting work. Often required by builders and site managers.",
  site_induction: "Walk new workers through the hazards on your specific site. Covers emergency exits, PPE, and site rules.",
  jsa: "Step-by-step hazard check for a specific task. Great for everyday jobs that don't need a full SWMS.",
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
        <CheckCircle2 className="w-3 h-3" /> Ready
      </span>
    );
  }
  if (status === "generating") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}>
        <Loader2 className="w-3 h-3 animate-spin" /> Generating…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>
      <AlertTriangle className="w-3 h-3" /> Error
    </span>
  );
}

// ─── Document PDF action panel ────────────────────────────────────────────────
function DocPdfPanel({ pdfUrl, title }: { pdfUrl: string | null | undefined; title: string }) {
  if (!pdfUrl) {
    return (
      <div
        className="rounded-lg p-4 mt-3 text-sm"
        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
      >
        PDF not yet available.
      </div>
    );
  }
  return (
    <div
      className="rounded-lg p-4 mt-3 flex items-center justify-between gap-4"
      style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.18)" }}
    >
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "#F5A623" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "white" }}>{title}</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Branded PDF — ready to share or print</p>
        </div>
      </div>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0"
        style={{ background: "#F5A623", color: "#0F1F3D" }}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open PDF
      </a>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PortalCompliance() {
  const [showForm, setShowForm] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [pollingDocId, setPollingDocId] = useState<string | null>(null);

  // Form state
  const [docType, setDocType] = useState<DocType>("swms");
  const [jobDescription, setJobDescription] = useState("");
  const [siteAddress, setSiteAddress] = useState("");

  // List query
  const listQuery = trpc.portal.listComplianceDocs.useQuery(undefined, {
    refetchInterval: pollingDocId ? 3000 : false,
  });

  // Generate mutation
  const generateMutation = trpc.portal.generateComplianceDoc.useMutation({
    onSuccess: ({ docId }) => {
      toast.success("Document generation started. It will be ready in ~30 seconds.");
      setPollingDocId(docId);
      setShowForm(false);
      setJobDescription("");
      setSiteAddress("");
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message ?? "Failed to start generation."),
  });

  // Delete mutation
  const deleteMutation = trpc.portal.deleteComplianceDoc.useMutation({
    onSuccess: () => {
      toast.success("Document deleted.");
      if (selectedDocId) setSelectedDocId(null);
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete document."),
  });

  // Stop polling when all docs are ready/error
  const docs = listQuery.data ?? [];
  const hasGenerating = docs.some((d) => d.status === "generating");
  if (!hasGenerating && pollingDocId) {
    setPollingDocId(null);
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!jobDescription.trim()) {
      toast.error("Please describe the job / work to be performed.");
      return;
    }
    generateMutation.mutate({ docType, jobDescription, siteAddress: siteAddress || undefined });
  }

  return (
    <PortalLayout>
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Compliance Documents</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              AI-generated SWMS, safety certificates, JSAs, and site induction checklists.
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="font-semibold gap-2"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            <Plus className="w-4 h-4" />
            New Document
          </Button>
        </div>

        {/* Generate form */}
        {showForm && (
          <div
            className="rounded-xl p-6 mb-6"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,166,35,0.25)" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(245,166,35,0.12)" }}
              >
                <ShieldCheck className="w-4 h-4" style={{ color: "#F5A623" }} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Generate New Document</h2>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Describe the job and our AI will generate the document in ~30 seconds.
                </p>
              </div>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Document type selector */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Document Type</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDocType(type)}
                      className="text-left rounded-lg p-3 transition-all"
                      style={{
                        background: docType === type ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.04)",
                        border: docType === type ? "1px solid rgba(245,166,35,0.4)" : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="text-sm font-medium text-white">{DOC_TYPE_LABELS[type]}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {DOC_TYPE_DESCRIPTIONS[type]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Job description */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Job / Work Description *</Label>
                <Textarea
                  placeholder="e.g. Replacing hot water system at residential property. Work involves isolating gas and water supply, removing old unit, installing new 26L Rinnai continuous flow system, reconnecting and testing."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={4}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Site address */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Site Address (optional)</Label>
                <Input
                  placeholder="e.g. 42 George St, Parramatta NSW 2150"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="flex-1 font-semibold"
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4 mr-2" /> Generate {DOC_TYPE_SHORT_LABELS[docType]}</>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Document list */}
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
          </div>
        ) : docs.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <ShieldCheck className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="text-white/60 text-sm">No compliance documents yet.</p>
            <p className="text-white/35 text-xs mt-1">Click "New Document" to generate your first SWMS or safety cert.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <div key={doc.id}>
                <div
                  className="rounded-xl p-4 cursor-pointer transition-all"
                  style={{
                    background: selectedDocId === doc.id ? "rgba(245,166,35,0.07)" : "rgba(255,255,255,0.04)",
                    border: selectedDocId === doc.id ? "1px solid rgba(245,166,35,0.25)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                  onClick={() => setSelectedDocId(selectedDocId === doc.id ? null : doc.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(245,166,35,0.1)" }}
                      >
                        <FileText className="w-4 h-4" style={{ color: "#F5A623" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{doc.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {DOC_TYPE_LABELS[doc.docType as DocType]} &middot;{" "}
                          {new Date(doc.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={doc.status} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this document?")) {
                            deleteMutation.mutate({ docId: doc.id });
                          }
                        }}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "rgba(255,255,255,0.3)" }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: PDF panel when ready */}
                {selectedDocId === doc.id && doc.status === "ready" && (
                  <DocPdfPanel pdfUrl={doc.pdfUrl} title={doc.title} />
                )}

                {/* Expanded: generating state */}
                {selectedDocId === doc.id && doc.status === "generating" && (
                  <div
                    className="rounded-lg p-4 mt-2 flex items-center gap-3"
                    style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)" }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "#F5A623" }} />
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      Document is being generated… this usually takes 20–40 seconds. The page will refresh automatically.
                    </p>
                  </div>
                )}

                {/* Expanded: error state */}
                {selectedDocId === doc.id && doc.status === "error" && (
                  <div
                    className="rounded-lg p-4 mt-2 flex items-center gap-3"
                    style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#f87171" }} />
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      Generation failed. Please delete this document and try again.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
