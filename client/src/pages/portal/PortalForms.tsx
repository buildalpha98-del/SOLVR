/**
 * Sprint 5 — Digital Forms & Certificates
 * Tabs: Templates | Submissions
 * Form builder, signature capture, pre-built templates, PDF generation
 */
import { useState, useRef, useCallback, useEffect } from "react";
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
import {
  Plus, Search, FileText, Download, Trash2, Edit, ClipboardList,
  CheckCircle, PenTool, Loader2, FileCheck, AlertTriangle, Eye,
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
  draft: "bg-gray-100 text-gray-700",
  completed: "bg-green-100 text-green-700",
  archived: "bg-blue-100 text-blue-700",
};

// ─── Signature Pad Component ──────────────────────────────────────────────────
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
    ctx.lineWidth = 2;
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
        className="w-full h-24 border border-gray-300 rounded-lg cursor-crosshair bg-white touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <button onClick={clear} className="text-xs text-gray-500 hover:text-red-500 mt-1">
        Clear signature
      </button>
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
      <h3 className="text-base font-bold text-[#0F1F3D] border-b border-gray-200 pb-1 pt-3 col-span-2">
        {field.label}
      </h3>
    );
  }
  if (field.type === "divider") {
    return <hr className="border-gray-200 col-span-2 my-1" />;
  }

  const wrapClass = field.width === "half" ? "" : "col-span-2";
  const label = (
    <label className="block text-sm font-medium text-gray-700 mb-1">
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
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#F5A623] focus:ring-[#F5A623]"
          />
          <span className="text-sm text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </div>
      );
    case "signature":
      return (
        <div className={wrapClass}>
          {label}
          <SignaturePad
            onSave={dataUrl => onSignature?.(dataUrl)}
            initialData={signatureData}
          />
        </div>
      );
    case "photo":
      return (
        <div className={wrapClass}>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forms & Certificates</h1>
          <p className="text-sm text-gray-500 mt-1">Digital forms, certificates, and SWMS with signature capture</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(["submissions", "templates"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t === "submissions" ? "Completed Forms" : "Templates"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${tab}...`}
          className="pl-10"
        />
      </div>

      {tab === "templates" ? (
        <TemplatesTab search={search} />
      ) : (
        <SubmissionsTab search={search} />
      )}
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────
function TemplatesTab({ search }: { search: string }) {
  const { data: templates, isLoading } = trpc.forms.listTemplates.useQuery();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.forms.deleteTemplate.useMutation({
    onSuccess: () => { utils.forms.listTemplates.invalidate(); toast.success("Template deleted"); },
  });

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = (templates ?? []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { setEditingId(null); setShowBuilder(true); }} className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D]">
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No templates found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#F5A623]" />
                  <Badge variant="outline" className="text-xs">
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </Badge>
                  {t.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{t.description || "No description"}</p>
              <p className="text-xs text-gray-400 mb-4">
                {(t.fields as FormField[])?.filter(f => f.type !== "heading" && f.type !== "divider").length ?? 0} fields
              </p>
              <div className="flex gap-2">
                {!t.isSystem && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(t.id); setShowBuilder(true); }}>
                      <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => {
                      if (confirm("Delete this template?")) deleteMutation.mutate({ id: t.id });
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
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

// ─── Template Builder Dialog ──────────────────────────────────────────────────
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
    onSuccess: () => { utils.forms.listTemplates.invalidate(); toast.success("Template created"); onClose(); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.forms.updateTemplate.useMutation({
    onSuccess: () => { utils.forms.listTemplates.invalidate(); toast.success("Template updated"); onClose(); },
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{templateId ? "Edit Template" : "New Form Template"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Electrical Certificate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." />
            </div>
          </div>

          {/* Fields List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fields</label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{f.type}</Badge>
                  {f.type !== "divider" && (
                    <Input
                      value={f.label}
                      onChange={e => updateField(i, { label: e.target.value })}
                      className="h-8 text-sm flex-1"
                      placeholder="Field label"
                    />
                  )}
                  {f.type !== "heading" && f.type !== "divider" && (
                    <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                      <input
                        type="checkbox"
                        checked={f.required ?? false}
                        onChange={e => updateField(i, { required: e.target.checked })}
                        className="h-3 w-3"
                      />
                      Req
                    </label>
                  )}
                  {f.type === "select" && (
                    <Input
                      value={(f.options ?? []).join(", ")}
                      onChange={e => updateField(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                      className="h-8 text-xs flex-1"
                      placeholder="Options (comma-separated)"
                    />
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => removeField(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add field buttons */}
            <div className="flex flex-wrap gap-1 mt-3">
              {(["text", "textarea", "number", "date", "select", "checkbox", "signature", "photo", "heading", "divider"] as const).map(type => (
                <Button key={type} size="sm" variant="outline" className="text-xs h-7" onClick={() => addField(type)}>
                  + {type}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={isPending} className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D]">
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {templateId ? "Update Template" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Submissions Tab ──────────────────────────────────────────────────────────
function SubmissionsTab({ search }: { search: string }) {
  const { data: submissions, isLoading } = trpc.forms.listSubmissions.useQuery();
  const { data: templates } = trpc.forms.listTemplates.useQuery();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.forms.deleteSubmission.useMutation({
    onSuccess: () => { utils.forms.listSubmissions.invalidate(); toast.success("Form deleted"); },
  });

  const [showNew, setShowNew] = useState(false);
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
        <Button onClick={() => setShowNew(true)} className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D]">
          <Plus className="w-4 h-4 mr-2" /> New Form
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No forms completed yet</p>
          <p className="text-sm mt-1">Start a new form from a template</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-700">Form</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Template</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {templateMap[s.templateId]?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[s.status] ?? "bg-gray-100"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
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
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => {
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
      )}

      {/* New form: select template */}
      {showNew && (
        <Dialog open onOpenChange={() => setShowNew(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Start New Form</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-3">Choose a template to start filling out:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(templates ?? []).filter(t => t.isActive).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplateId(t.id); setShowNew(false); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:border-[#F5A623] ${
                    selectedTemplateId === t.id ? "border-[#F5A623] bg-amber-50" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#F5A623]" />
                    <span className="font-medium text-sm">{t.name}</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </Badge>
                  </div>
                  {t.description && <p className="text-xs text-gray-500 mt-1 ml-6">{t.description}</p>}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Fill form dialog */}
      {(selectedTemplateId || fillingId) && (
        <FormFillerDialog
          templateId={selectedTemplateId ?? undefined}
          submissionId={fillingId ?? undefined}
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

// ─── Form Filler Dialog ───────────────────────────────────────────────────────
function FormFillerDialog({
  templateId,
  submissionId,
  onClose,
}: {
  templateId?: number;
  submissionId?: number;
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
    onSuccess: () => { utils.forms.listSubmissions.invalidate(); toast.success("Form saved"); onClose(); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.forms.updateSubmission.useMutation({
    onSuccess: () => { utils.forms.listSubmissions.invalidate(); toast.success("Form updated"); onClose(); },
    onError: e => toast.error(e.message),
  });
  const pdfMutation = trpc.forms.generatePdf.useMutation({
    onSuccess: (data) => {
      toast.success("PDF generated");
      if (data.pdfUrl) window.open(data.pdfUrl, "_blank");
    },
    onError: e => toast.error(e.message),
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
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => save("draft")} disabled={isPending}>
            Save as Draft
          </Button>
          <Button onClick={() => save("completed")} disabled={isPending} className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D]">
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <CheckCircle className="w-4 h-4 mr-2" />
            Complete & Sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    onSuccess: (data) => {
      toast.success("PDF generated");
      if (data.pdfUrl) window.open(data.pdfUrl, "_blank");
    },
    onError: e => toast.error(e.message),
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {submission.title}
            <Badge className={STATUS_COLORS[submission.status]}>{submission.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {fields.map(field => {
            if (field.type === "heading") {
              return (
                <h3 key={field.id} className="text-base font-bold text-[#0F1F3D] border-b border-gray-200 pb-1 pt-2">
                  {field.label}
                </h3>
              );
            }
            if (field.type === "divider") {
              return <hr key={field.id} className="border-gray-200" />;
            }
            if (field.type === "signature") {
              return (
                <div key={field.id}>
                  <p className="text-sm font-medium text-gray-700">{field.label}</p>
                  {signatures[field.id] ? (
                    <img src={signatures[field.id]} alt="Signature" className="h-16 border rounded mt-1" />
                  ) : (
                    <p className="text-sm text-gray-400 italic">Not signed</p>
                  )}
                </div>
              );
            }
            if (field.type === "checkbox") {
              const checked = values[field.id] === true || values[field.id] === "true";
              return (
                <div key={field.id} className="flex items-center gap-2 text-sm">
                  {checked ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-gray-300" />}
                  <span className={checked ? "text-gray-900" : "text-gray-400"}>{field.label}</span>
                </div>
              );
            }
            return (
              <div key={field.id}>
                <p className="text-sm font-medium text-gray-700">{field.label}</p>
                <p className="text-sm text-gray-900">{(values[field.id] as string) || "—"}</p>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {submission.pdfUrl && (
            <Button variant="outline" asChild>
              <a href={submission.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </a>
            </Button>
          )}
          <Button
            onClick={() => pdfMutation.mutate({ submissionId })}
            disabled={pdfMutation.isPending}
            className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D]"
          >
            {pdfMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
            {submission.pdfUrl ? "Regenerate PDF" : "Generate PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
