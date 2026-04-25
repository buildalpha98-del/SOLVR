/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Sprint 5 — Digital Forms & Certificates (Mobile-First)
 * Tabs: Templates | Submissions
 * Form builder, signature capture, pre-built templates, PDF generation
 *
 * Mobile: card-based submissions, full-screen form filler, larger signature
 * canvas for touch, full-width dialogs, stacked buttons, pb-24.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
import { openUrl } from "@/lib/openUrl";
import {
  Plus, Search, FileText, Download, Trash2, Edit, ClipboardList,
  CheckCircle, PenTool, Loader2, FileCheck, AlertTriangle, Eye,
  ChevronRight, X,
} from "lucide-react";

type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "signature" | "photo" | "heading" | "divider";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
  width?: "full" | "half";
};

const CATEGORY_LABELS: Record<string, string> = {
  certificate: "Certificate",
  safety: "Safety",
  inspection: "Inspection",
  custom: "Custom",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-white/10 text-white/60",
  completed: "bg-emerald-500/20 text-emerald-400",
  archived: "bg-blue-500/20 text-blue-400",
};

// ─── Signature Pad Component (mobile-optimised) ─────────────────────────────
function SignaturePad({
  onSave,
  initialData,
}: {
  onSave: (dataUrl: string) => void;
  initialData?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(!!initialData);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#0F1F3D";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
      img.src = initialData;
    }
  }, [initialData]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = "touches" in e ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  };

  const endDraw = () => {
    setDrawing(false);
    if (hasContent && canvasRef.current) {
      onSave(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onSave("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full h-48 sm:h-32 border-2 border-dashed border-white/20 rounded-lg cursor-crosshair bg-white/5 touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-white/40">Sign above with your finger</span>
        <button onClick={clear} className="text-xs text-white/50 hover:text-red-400 font-medium">
          Clear
        </button>
      </div>
    </div>
  );
}

// ─── Form Field Renderer ──────────────────────────────────────────────────────
function FormFieldRenderer({
  field,
  value,
  signatureData,
  onChange,
  onSignature,
}: {
  field: FormField;
  value: unknown;
  signatureData?: string;
  onChange: (val: unknown) => void;
  onSignature?: (dataUrl: string) => void;
}) {
  if (field.type === "heading") {
    return (
      <h3 className="text-base font-bold text-white border-b border-white/10 pb-1 pt-3 col-span-1 sm:col-span-2">
        {field.label}
      </h3>
    );
  }
  if (field.type === "divider") {
    return <hr className="border-white/10 col-span-1 sm:col-span-2 my-1" />;
  }

  // On mobile, everything is full-width (col-span-1 in a 1-col grid)
  const wrapClass = field.width === "half" ? "sm:col-span-1" : "col-span-1 sm:col-span-2";
  const label = (
    <label className="block text-sm font-medium text-white/80 mb-1">
      {field.label}
      {field.required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  switch (field.type) {
    case "text":
      return (
        <div className={wrapClass}>
          {label}
          <Input
            value={(value as string) ?? ""}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );
    case "textarea":
      return (
        <div className={wrapClass}>
          {label}
          <Textarea
            value={(value as string) ?? ""}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        </div>
      );
    case "number":
      return (
        <div className={wrapClass}>
          {label}
          <Input
            type="number"
            value={(value as string) ?? ""}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );
    case "date":
      return (
        <div className={wrapClass}>
          {label}
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      );
    case "select":
      return (
        <div className={wrapClass}>
          {label}
          <Select value={(value as string) ?? ""} onValueChange={v => onChange(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "checkbox":
      return (
        <div className={`${wrapClass} flex items-start gap-2 py-1`}>
          <input
            type="checkbox"
            checked={value === true || value === "true"}
            onChange={e => onChange(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-white/30 text-[#F5A623] focus:ring-[#F5A623]"
          />
          <span className="text-sm text-white/70">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </div>
      );
    case "signature":
      return (
        <div className={`col-span-1 sm:col-span-2`}>
          {label}
          <SignaturePad
            onSave={dataUrl => onSignature?.(dataUrl)}
            initialData={signatureData}
          />
        </div>
      );
    case "photo":
      return (
        <div className={`col-span-1 sm:col-span-2`}>
          {label}
          <Input type="file" accept="image/*" onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange(reader.result as string);
            reader.readAsDataURL(file);
          }} />
          {typeof value === "string" && value.startsWith("data:") ? (
            <img src={value} alt="Uploaded" className="mt-2 max-h-32 rounded border" />
          ) : null}
        </div>
      );
    default:
      return null;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PortalForms() {
  const [tab, setTab] = useState<"templates" | "submissions">("submissions");
  const [search, setSearch] = useState("");

  // Auto-link: read jobId from URL query params (e.g. /portal/forms?jobId=42)
  const urlParams = new URLSearchParams(window.location.search);
  const linkedJobId = urlParams.get("jobId") ? Number(urlParams.get("jobId")) : undefined;

  // Seed system templates on first load
  const seedMutation = trpc.forms.seedTemplates.useMutation();
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded) {
      seedMutation.mutate(undefined, {
        onSuccess: () => setSeeded(true),
        onError: () => setSeeded(true), // Already seeded
      });
    }
  }, [seeded]);

  return (
    <PortalLayout>
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Forms & Certificates</h1>
        <p className="text-[13px] text-white/50 mt-0.5">Digital forms, certificates, and SWMS with signature capture</p>
      </div>

      {/* Tabs — full width on mobile */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
        {(["submissions", "templates"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"
            }`}
          >
            {t === "submissions" ? "Completed Forms" : "Templates"}
          </button>
        ))}
      </div>

      {/* Search — full width on mobile */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${tab}...`}
          className="pl-10 sm:max-w-sm"
        />
      </div>

      {tab === "templates" ? (
        <TemplatesTab search={search} />
      ) : (
        <SubmissionsTab search={search} linkedJobId={linkedJobId} />
      )}
    </div>
    </PortalLayout>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────
function TemplatesTab({ search }: { search: string }) {
  const { data: templates, isLoading } = trpc.forms.listTemplates.useQuery();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.forms.deleteTemplate.useMutation({
    // Template row vanishes from list — visual change is feedback.
    onSuccess: () => { utils.forms.listTemplates.invalidate(); hapticWarning(); },
    onError: (err) => toast.error(err.message || "Failed to delete template"),
  });

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = (templates ?? []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { setEditingId(null); setShowBuilder(true); }} className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D] w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-white/20" />
          <p>No templates found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(t => (
            <div key={t.id} className="rounded-lg border border-white/10 p-4 sm:p-5 hover:border-white/20 transition-colors" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileCheck className="w-5 h-5 text-[#F5A623] flex-shrink-0" />
                  <Badge variant="outline" className="text-xs">
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </Badge>
                  {t.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                </div>
              </div>
              <h3 className="font-semibold text-white mb-1 text-[15px]">{t.name}</h3>
              <p className="text-sm text-white/50 mb-2 line-clamp-2">{t.description || "No description"}</p>
              <p className="text-xs text-white/30 mb-3">
                {(t.fields as FormField[])?.filter(f => f.type !== "heading" && f.type !== "divider").length ?? 0} fields
              </p>
              <div className="flex gap-2">
                {!t.isSystem && (
                  <>
                    <Button variant="outline" className="flex-1 sm:flex-none min-h-[44px]" onClick={() => { setEditingId(t.id); setShowBuilder(true); }}>
                      <Edit className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" className="flex-1 sm:flex-none min-h-[44px] text-red-400 hover:text-red-300" onClick={() => {
                      if (confirm("Delete this template?")) deleteMutation.mutate({ id: t.id });
                    }}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      <span>Delete</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <TemplateBuilderDialog
          templateId={editingId}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </>
  );
}

// ─── Template Builder Dialog (full-width on mobile) ──────────────────────────
function TemplateBuilderDialog({ templateId, onClose }: { templateId: number | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: existing } = trpc.forms.getTemplate.useQuery(
    { id: templateId! },
    { enabled: !!templateId }
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState<"certificate" | "safety" | "inspection" | "custom">("custom");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setCategory(existing.category as any);
      setDescription(existing.description ?? "");
      setFields((existing.fields as FormField[]) ?? []);
    }
  }, [existing]);

  const createMutation = trpc.forms.createTemplate.useMutation({
    onSuccess: () => { utils.forms.listTemplates.invalidate(); hapticSuccess(); toast.success("Template created"); onClose(); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.forms.updateTemplate.useMutation({
    // Modal closes + row updates — visual change is feedback.
    onSuccess: () => { utils.forms.listTemplates.invalidate(); hapticSuccess(); onClose(); },
    onError: e => toast.error(e.message),
  });

  const addField = (type: FormField["type"]) => {
    const id = `field_${Date.now()}`;
    setFields(prev => [...prev, { id, label: type === "heading" ? "Section Heading" : type === "divider" ? "" : "New Field", type }]);
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
  };

  const save = () => {
    if (!name.trim()) { toast.error("Template name is required"); return; }
    if (fields.length === 0) { toast.error("Add at least one field"); return; }
    const payload = { name, category, description, fields };
    if (templateId) {
      updateMutation.mutate({ id: templateId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{templateId ? "Edit Template" : "New Form Template"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Template Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Electrical Certificate" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Category</label>
                <Select value={category} onValueChange={v => setCategory(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Description</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." />
              </div>
            </div>
          </div>

          {/* Fields List */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Fields</label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fields.map((f, i) => (
                <div key={f.id} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30 w-5 flex-shrink-0">{i + 1}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{f.type}</Badge>
                    <div className="flex-1 min-w-0">
                      {f.type !== "divider" && (
                        <Input
                          value={f.label}
                          onChange={e => updateField(i, { label: e.target.value })}
                          className="h-8 text-sm"
                          placeholder="Field label"
                        />
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 flex-shrink-0" onClick={() => removeField(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {/* Required + options on second row for mobile */}
                  <div className="flex items-center gap-2 mt-1.5 ml-7">
                    {f.type !== "heading" && f.type !== "divider" && (
                      <label className="flex items-center gap-1 text-xs text-white/50 shrink-0">
                        <input
                          type="checkbox"
                          checked={f.required ?? false}
                          onChange={e => updateField(i, { required: e.target.checked })}
                          className="h-3.5 w-3.5"
                        />
                        Required
                      </label>
                    )}
                    {f.type === "select" && (
                      <Input
                        value={(f.options ?? []).join(", ")}
                        onChange={e => updateField(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                        className="h-7 text-xs flex-1"
                        placeholder="Options (comma-separated)"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add field buttons — horizontal scroll on mobile */}
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
              {(["text", "textarea", "number", "date", "select", "checkbox", "signature", "photo", "heading", "divider"] as const).map(type => (
                <Button key={type} size="sm" variant="outline" className="text-xs h-7 flex-shrink-0" onClick={() => addField(type)}>
                  + {type}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto min-h-[44px]">Cancel</Button>
          <Button onClick={save} disabled={isPending} className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D] w-full sm:w-auto min-h-[44px]">
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {templateId ? "Update Template" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Submissions Tab ──────────────────────────────────────────────────────────
function SubmissionsTab({ search, linkedJobId }: { search: string; linkedJobId?: number }) {
  const { data: submissions, isLoading } = trpc.forms.listSubmissions.useQuery();
  const { data: templates } = trpc.forms.listTemplates.useQuery();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.forms.deleteSubmission.useMutation({
    // Submission row vanishes from list — visual change is feedback.
    onSuccess: () => { utils.forms.listSubmissions.invalidate(); hapticWarning(); },
    onError: (err) => toast.error(err.message || "Failed to delete form"),
  });

  const [showNew, setShowNew] = useState(!!linkedJobId);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [fillingId, setFillingId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const filtered = (submissions ?? []).filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const templateMap = Object.fromEntries((templates ?? []).map(t => [t.id, t]));

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)} className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D] w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> New Form
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <FileText className="w-12 h-12 mx-auto mb-3 text-white/20" />
          <p>No forms completed yet</p>
          <p className="text-sm mt-1">Start a new form from a template</p>
        </div>
      ) : (
        <>
          {/* Desktop table (hidden on mobile) */}
          <div className="hidden sm:block rounded-lg border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left px-4 py-3 font-medium text-white/60">Form</th>
                  <th className="text-left px-4 py-3 font-medium text-white/60">Template</th>
                  <th className="text-left px-4 py-3 font-medium text-white/60">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-white/60">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-white">{s.title}</td>
                    <td className="px-4 py-3 text-white/50">
                      {templateMap[s.templateId]?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLORS[s.status] ?? "bg-white/10"}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-white/40">
                      {new Date(s.createdAt).toLocaleDateString("en-AU")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {s.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => setFillingId(s.id)}>
                            <Edit className="w-3.5 h-3.5 mr-1" /> Continue
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setViewingId(s.id)}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> View
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-400" onClick={() => {
                          if (confirm("Delete this form?")) deleteMutation.mutate({ id: s.id });
                        }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {filtered.map(s => (
              <div
                key={s.id}
                className="rounded-lg border border-white/10 p-4 active:bg-white/5 transition-colors" style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-[15px] truncate">{s.title}</p>
                    <p className="text-xs text-white/40 mt-0.5 truncate">
                      {templateMap[s.templateId]?.name ?? "—"}
                    </p>
                  </div>
                  <Badge className={`${STATUS_COLORS[s.status] ?? "bg-white/10"} text-[11px] flex-shrink-0`}>
                    {s.status}
                  </Badge>
                </div>
                <p className="text-xs text-white/30 mb-3">
                  {new Date(s.createdAt).toLocaleDateString("en-AU")}
                </p>
                <div className="flex gap-2">
                  {s.status === "draft" && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setFillingId(s.id)}>
                      <Edit className="w-3.5 h-3.5 mr-1" /> Continue
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewingId(s.id)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-400 px-3" onClick={() => {
                    if (confirm("Delete this form?")) deleteMutation.mutate({ id: s.id });
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New form: select template */}
      {showNew && (
        <Dialog open onOpenChange={() => setShowNew(false)}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Start New Form</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-white/60 mb-3">Choose a template to start filling out:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(templates ?? []).filter(t => t.isActive).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplateId(t.id); setShowNew(false); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:border-[#F5A623] ${
                    selectedTemplateId === t.id ? "border-[#F5A623] bg-amber-500/10" : "border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#F5A623] flex-shrink-0" />
                    <span className="font-medium text-sm truncate">{t.name}</span>
                    <Badge variant="outline" className="text-xs ml-auto flex-shrink-0">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </Badge>
                  </div>
                  {t.description && <p className="text-xs text-white/40 mt-1 ml-6">{t.description}</p>}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Fill form — full-screen overlay on mobile */}
      {(selectedTemplateId || fillingId) && (
        <FormFillerDialog
          templateId={selectedTemplateId ?? undefined}
          submissionId={fillingId ?? undefined}
          jobId={linkedJobId}
          onClose={() => { setSelectedTemplateId(null); setFillingId(null); }}
        />
      )}

      {/* View form dialog */}
      {viewingId && (
        <FormViewerDialog submissionId={viewingId} onClose={() => setViewingId(null)} />
      )}
    </>
  );
}

// ─── Form Filler — Full-screen overlay on mobile, dialog on desktop ──────────
function FormFillerDialog({
  templateId,
  submissionId,
  jobId,
  onClose,
}: {
  templateId?: number;
  submissionId?: number;
  jobId?: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: template } = trpc.forms.getTemplate.useQuery(
    { id: templateId! },
    { enabled: !!templateId }
  );
  const { data: existingSubmission } = trpc.forms.getSubmission.useQuery(
    { id: submissionId! },
    { enabled: !!submissionId }
  );

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (existingSubmission) {
      setValues((existingSubmission.values as Record<string, unknown>) ?? {});
      setSignatures((existingSubmission.signatures as Record<string, string>) ?? {});
      setTitle(existingSubmission.title);
    } else if (template) {
      setTitle(template.name);
    }
  }, [template, existingSubmission]);

  const createMutation = trpc.forms.createSubmission.useMutation({
    onSuccess: () => { utils.forms.listSubmissions.invalidate(); hapticSuccess(); toast.success("Form saved"); onClose(); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.forms.updateSubmission.useMutation({
    // Modal closes + row updates — visual change is feedback. Initial save
    // (createMutation) keeps its toast since first-time form submission is
    // a major action the user wants explicit confirmation on.
    onSuccess: () => { utils.forms.listSubmissions.invalidate(); hapticSuccess(); onClose(); },
    onError: e => toast.error(e.message),
  });
  const pdfMutation = trpc.forms.generatePdf.useMutation({
    onSuccess: async (data) => {
      toast.success("PDF generated");
      if (data.pdfUrl) await openUrl(data.pdfUrl);
    },
    onError: e => toast.error(e.message || "Failed to generate PDF"),
  });

  const fields: FormField[] = existingSubmission
    ? ((template ?? {} as any).fields as FormField[] ?? [])
    : ((template?.fields as FormField[]) ?? []);

  // Use the template from the existing submission if needed
  const { data: submissionTemplate } = trpc.forms.getTemplate.useQuery(
    { id: existingSubmission?.templateId! },
    { enabled: !!existingSubmission?.templateId && !templateId }
  );
  const activeFields = templateId ? fields : ((submissionTemplate?.fields as FormField[]) ?? fields);

  const save = (status: "draft" | "completed") => {
    // Validate required fields if completing
    if (status === "completed") {
      for (const f of activeFields) {
        if (f.required && f.type !== "heading" && f.type !== "divider") {
          if (f.type === "signature" && !signatures[f.id]) {
            toast.error(`Please sign: ${f.label}`);
            return;
          }
          if (f.type !== "signature" && !values[f.id]) {
            toast.error(`Required: ${f.label}`);
            return;
          }
        }
      }
    }

    if (submissionId) {
      updateMutation.mutate({ id: submissionId, values, signatures, status });
    } else {
      createMutation.mutate({
        templateId: templateId!,
        title,
        values,
        signatures,
        status,
        ...(jobId ? { jobId } : {}),
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {/* Mobile: full-screen overlay */}
      <div className="sm:hidden fixed inset-0 z-50 flex flex-col" style={{ background: '#0B1629' }}>
        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 z-10" style={{ background: '#0F1F3D' }}>
          <h2 className="font-semibold text-white text-[16px] truncate flex-1 mr-2">{title || "Fill Form"}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-white/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
          <div className="grid grid-cols-1 gap-y-3">
            {activeFields.map(field => (
              <FormFieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                signatureData={signatures[field.id]}
                onChange={val => setValues(prev => ({ ...prev, [field.id]: val }))}
                onSignature={dataUrl => setSignatures(prev => ({ ...prev, [field.id]: dataUrl }))}
              />
            ))}
          </div>
        </div>

        {/* Sticky bottom actions */}
        <div className="sticky bottom-0 border-t border-white/10 px-4 py-3 space-y-2"
          style={{ background: '#0F1F3D', paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
        >
          <Button
            onClick={() => save("completed")}
            disabled={isPending}
            className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D] w-full"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <CheckCircle className="w-4 h-4 mr-2" />
            Complete & Sign
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save("draft")} disabled={isPending} className="flex-1">
              Save Draft
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: dialog */}
      <div className="hidden sm:block">
        <Dialog open onOpenChange={() => onClose()}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{title || "Fill Form"}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {activeFields.map(field => (
                <FormFieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  signatureData={signatures[field.id]}
                  onChange={val => setValues(prev => ({ ...prev, [field.id]: val }))}
                  onSignature={dataUrl => setSignatures(prev => ({ ...prev, [field.id]: dataUrl }))}
                />
              ))}
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
              <Button variant="outline" onClick={() => save("draft")} disabled={isPending} className="w-full sm:w-auto">
                Save as Draft
              </Button>
              <Button onClick={() => save("completed")} disabled={isPending} className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D] w-full sm:w-auto">
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete & Sign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

// ─── Form Viewer Dialog ───────────────────────────────────────────────────────
function FormViewerDialog({ submissionId, onClose }: { submissionId: number; onClose: () => void }) {
  const { data: submission, isLoading } = trpc.forms.getSubmission.useQuery({ id: submissionId });
  const { data: template } = trpc.forms.getTemplate.useQuery(
    { id: submission?.templateId! },
    { enabled: !!submission?.templateId }
  );
  const pdfMutation = trpc.forms.generatePdf.useMutation({
    onSuccess: async (data) => {
      toast.success("PDF generated");
      if (data.pdfUrl) await openUrl(data.pdfUrl);
    },
    onError: e => toast.error(e.message || "Failed to generate PDF"),
  });

  if (isLoading || !submission) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent>
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        </DialogContent>
      </Dialog>
    );
  }

  const fields = (template?.fields as FormField[]) ?? [];
  const values = (submission.values as Record<string, unknown>) ?? {};
  const signatures = (submission.signatures as Record<string, string>) ?? {};

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="truncate">{submission.title}</span>
            <Badge className={STATUS_COLORS[submission.status]}>{submission.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {fields.map(field => {
            if (field.type === "heading") {
              return (
                <h3 key={field.id} className="text-base font-bold text-white border-b border-white/10 pb-1 pt-2">
                  {field.label}
                </h3>
              );
            }
            if (field.type === "divider") {
              return <hr key={field.id} className="border-white/10" />;
            }
            if (field.type === "signature") {
              return (
                <div key={field.id}>
                  <p className="text-sm font-medium text-white/70">{field.label}</p>
                  {signatures[field.id] ? (
                    <img src={signatures[field.id]} alt="Signature" className="h-16 border rounded mt-1" />
                  ) : (
                    <p className="text-sm text-white/30 italic">Not signed</p>
                  )}
                </div>
              );
            }
            if (field.type === "checkbox") {
              const checked = values[field.id] === true || values[field.id] === "true";
              return (
                <div key={field.id} className="flex items-center gap-2 text-sm">
                  {checked ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-white/20" />}
                  <span className={checked ? "text-white" : "text-white/40"}>{field.label}</span>
                </div>
              );
            }
            return (
              <div key={field.id}>
                <p className="text-sm font-medium text-white/70">{field.label}</p>
                <p className="text-sm text-white">{(values[field.id] as string) || "—"}</p>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Close</Button>
          {submission.pdfUrl && (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <a href={submission.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </a>
            </Button>
          )}
          <Button
            onClick={() => pdfMutation.mutate({ submissionId })}
            disabled={pdfMutation.isPending}
            className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D] w-full sm:w-auto"
          >
            {pdfMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
            {submission.pdfUrl ? "Regenerate PDF" : "Generate PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
