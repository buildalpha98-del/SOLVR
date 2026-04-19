/**
 * CustomerJobStatus — public read-only job status page for customers.
 * Accessible at /job/:token — no login required.
 * Shows job status, photos, invoice total, tradie contact details,
 * tradie branding (logo + trading name), and a customer feedback widget.
 */
import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { ClipboardList, PenLine, Download, ChevronDown, ChevronUp } from "lucide-react";
import {
  CheckCircle2,
  Clock,
  Wrench,
  MapPin,
  Calendar,
  Phone,
  Mail,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Star,
  ExternalLink,
  CreditCard,
  Camera,
  X,
} from "lucide-react";

// ── Stage display config ──────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  string,
  { label: string; colour: string; icon: React.ReactNode; description: string }
> = {
  new: {
    label: "Enquiry Received",
    colour: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="w-5 h-5" />,
    description: "Your enquiry has been received and is being reviewed.",
  },
  quoted: {
    label: "Quote Sent",
    colour: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <FileText className="w-5 h-5" />,
    description: "A quote has been prepared and sent to you.",
  },
  booked: {
    label: "Job Booked",
    colour: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: <Calendar className="w-5 h-5" />,
    description: "Your job is confirmed and scheduled.",
  },
  in_progress: {
    label: "In Progress",
    colour: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <Wrench className="w-5 h-5" />,
    description: "Work is currently underway.",
  },
  completed: {
    label: "Completed",
    colour: "bg-green-50 text-green-700 border-green-200",
    icon: <CheckCircle2 className="w-5 h-5" />,
    description: "Your job has been completed. Thank you for your business!",
  },
  invoiced: {
    label: "Invoice Sent",
    colour: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <FileText className="w-5 h-5" />,
    description: "Your invoice has been sent. Please review and pay at your convenience.",
  },
  paid: {
    label: "Paid",
    colour: "bg-green-50 text-green-700 border-green-200",
    icon: <CheckCircle2 className="w-5 h-5" />,
    description: "Payment received. Thank you!",
  },
};

// ── Progress steps ────────────────────────────────────────────────────────────
const PROGRESS_STAGES = ["new", "booked", "in_progress", "completed", "paid"];

function getStageIndex(stage: string | null | undefined) {
  const idx = PROGRESS_STAGES.indexOf(stage ?? "new");
  return idx === -1 ? 0 : idx;
}

// ── Feedback widget ───────────────────────────────────────────────────────────
function FeedbackWidget({
  token,
  jobStage,
  initialFeedback,
  googleReviewLink,
}: {
  token: string;
  jobStage: string | null | undefined;
  initialFeedback: { positive: boolean; comment: string | null } | null;
  googleReviewLink?: string | null;
}) {
  const [selected, setSelected] = useState<boolean | null>(
    initialFeedback?.positive ?? null
  );
  const [comment, setComment] = useState(initialFeedback?.comment ?? "");
  const [submitted, setSubmitted] = useState(!!initialFeedback);
  const [reviewLink, setReviewLink] = useState<string | null>(googleReviewLink ?? null);

  const submitMutation = trpc.portal.submitJobFeedback.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.googleReviewLink) setReviewLink(data.googleReviewLink);
    },
  });

  // Only show feedback widget once job is completed or paid
  const showFeedback =
    jobStage === "completed" || jobStage === "paid" || jobStage === "invoiced";
  if (!showFeedback) return null;

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Thanks for your feedback!</p>
            <p className="text-xs text-gray-500">
              {selected ? "We're glad the job went well." : "We appreciate you letting us know."}
            </p>
          </div>
        </div>
        {selected && reviewLink && (
          <a
            href={reviewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors w-full justify-center mt-2"
          >
            <Star className="w-4 h-4" />
            Leave a Google Review
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        How did we do?
      </p>
      {selected === null ? (
        <div className="flex gap-3">
          <button
            onClick={() => setSelected(true)}
            className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all"
          >
            <ThumbsUp className="w-7 h-7 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Great job!</span>
          </button>
          <button
            onClick={() => setSelected(false)}
            className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all"
          >
            <ThumbsDown className="w-7 h-7 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Could be better</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                selected
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {selected ? (
                <ThumbsUp className="w-3.5 h-3.5" />
              ) : (
                <ThumbsDown className="w-3.5 h-3.5" />
              )}
              {selected ? "Great job!" : "Could be better"}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Change
            </button>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              selected
                ? "Any specific feedback? (optional)"
                : "What could we improve? (optional)"
            }
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-gray-400"
          />
          <button
            onClick={() =>
              submitMutation.mutate({
                token,
                positive: selected,
                comment: comment.trim() || undefined,
              })
            }
            disabled={submitMutation.isPending}
            className="w-full bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Feedback"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Photo Gallery with before/during/after grouping + lightbox ───────────────
const PHOTO_STAGE_ORDER = ["before", "during", "after", "other"] as const;
const PHOTO_STAGE_LABELS: Record<string, { label: string; icon: React.ReactNode; colour: string }> = {
  before: { label: "Before", icon: <Camera className="w-3.5 h-3.5" />, colour: "text-blue-600 bg-blue-50 border-blue-200" },
  during: { label: "During", icon: <Wrench className="w-3.5 h-3.5" />, colour: "text-orange-600 bg-orange-50 border-orange-200" },
  after:  { label: "After",  icon: <CheckCircle2 className="w-3.5 h-3.5" />, colour: "text-green-600 bg-green-50 border-green-200" },
  other:  { label: "Photos", icon: <ImageIcon className="w-3.5 h-3.5" />, colour: "text-gray-600 bg-gray-50 border-gray-200" },
};

function PhotoGallery({ photos }: { photos: Array<{ id: string; url: string; caption: string | null; photoType: string }> }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Group photos by stage
  const grouped = PHOTO_STAGE_ORDER.reduce<Record<string, typeof photos>>((acc, stage) => {
    const stagePhotos = photos.filter(p => p.photoType === stage);
    if (stagePhotos.length > 0) acc[stage] = stagePhotos;
    return acc;
  }, {});

  // Flat list for lightbox navigation
  const allPhotos = PHOTO_STAGE_ORDER.flatMap(s => grouped[s] ?? []);

  // If only one stage, skip the grouping headers
  const stages = Object.keys(grouped);
  const singleStage = stages.length === 1;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Job Photos ({photos.length})
          </p>
        </div>

        {singleStage ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allPhotos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setLightboxIdx(idx)}
                className="block rounded-lg overflow-hidden aspect-square bg-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? "Job photo"}
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {PHOTO_STAGE_ORDER.map(stage => {
              const stagePhotos = grouped[stage];
              if (!stagePhotos) return null;
              const config = PHOTO_STAGE_LABELS[stage];
              return (
                <div key={stage}>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border mb-2 ${config.colour}`}>
                    {config.icon}
                    {config.label}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {stagePhotos.map(photo => {
                      const flatIdx = allPhotos.findIndex(p => p.id === photo.id);
                      return (
                        <button
                          key={photo.id}
                          onClick={() => setLightboxIdx(flatIdx)}
                          className="block rounded-lg overflow-hidden aspect-square bg-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          <img
                            src={photo.url}
                            alt={photo.caption ?? `${config.label} photo`}
                            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox overlay */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev / Next arrows */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-bold transition-colors z-10"
            >
              ‹
            </button>
          )}
          {lightboxIdx < allPhotos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-bold transition-colors z-10"
            >
              ›
            </button>
          )}

          <div className="max-w-4xl max-h-[85vh] px-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={allPhotos[lightboxIdx].url}
              alt={allPhotos[lightboxIdx].caption ?? "Job photo"}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            {allPhotos[lightboxIdx].caption && (
              <p className="text-white/70 text-sm text-center mt-3">{allPhotos[lightboxIdx].caption}</p>
            )}
            <p className="text-white/40 text-xs text-center mt-1">
              {lightboxIdx + 1} / {allPhotos.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ── Customer Forms Section ──────────────────────────────────────────────────────────────
function CustomerFormsSection({ token }: { token: string }) {
  const { data: formsData, refetch } = trpc.portal.customerListJobForms.useQuery(
    { token },
    { enabled: !!token }
  );

  const [fillingTemplateId, setFillingTemplateId] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  if (!formsData) return null;
  const { submissions, pendingTemplates } = formsData;
  const completedSubmissions = submissions.filter(s => s.status === "completed");

  // Don't render anything if no forms exist and none are required
  if (pendingTemplates.length === 0 && completedSubmissions.length === 0) return null;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Forms & Certificates
          </p>
        </div>

        {/* Pending forms that need customer completion */}
        {pendingTemplates.length > 0 && (
          <div className="space-y-2 mb-3">
            <p className="text-xs text-amber-600 font-medium">Action Required</p>
            {pendingTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => setFillingTemplateId(t.id)}
                className="w-full flex items-center gap-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-4 py-3 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <PenLine className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                  {t.description && <p className="text-xs text-gray-500 truncate">{t.description}</p>}
                </div>
                <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">Fill &amp; Sign</span>
              </button>
            ))}
          </div>
        )}

        {/* Completed forms */}
        {completedSubmissions.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
            >
              {showCompleted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {completedSubmissions.length} completed form{completedSubmissions.length !== 1 ? "s" : ""}
            </button>
            {showCompleted && (
              <div className="space-y-1.5">
                {completedSubmissions.map(s => (
                  <div key={s.id} className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                      <p className="text-[10px] text-gray-400">
                        {s.submittedBy && `By ${s.submittedBy} • `}
                        {s.completedAt ? new Date(s.completedAt).toLocaleDateString("en-AU") : ""}
                      </p>
                    </div>
                    {s.pdfUrl && (
                      <a href={s.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-green-100 rounded-lg">
                        <Download className="w-4 h-4 text-green-600" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form filler dialog */}
      {fillingTemplateId && (
        <CustomerFormFiller
          token={token}
          templateId={fillingTemplateId}
          onClose={() => { setFillingTemplateId(null); refetch(); }}
        />
      )}
    </>
  );
}

// ── Customer Form Filler (modal overlay) ───────────────────────────────────────────
interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
}

function CustomerFormFiller({
  token,
  templateId,
  onClose,
}: {
  token: string;
  templateId: number;
  onClose: () => void;
}) {
  const { data: template, isLoading } = trpc.portal.customerGetFormTemplate.useQuery(
    { token, templateId },
    { enabled: !!token && !!templateId }
  );

  const submitMutation = trpc.portal.customerSubmitForm.useMutation({
    onSuccess: () => onClose(),
  });

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const fields = (template?.fields as FormField[] | null) ?? [];

  const handleSubmit = () => {
    // Validate required fields
    const missing = fields
      .filter(f => f.required && !values[f.id] && f.type !== "heading" && f.type !== "divider")
      .map(f => f.label);
    const missingSignatures = fields
      .filter(f => f.type === "signature" && f.required && !signatures[f.id])
      .map(f => f.label);
    const allMissing = [...missing, ...missingSignatures];
    if (allMissing.length > 0) {
      setErrors(allMissing);
      return;
    }
    setErrors([]);
    submitMutation.mutate({
      token,
      templateId,
      title: template?.name ?? "Form Submission",
      values,
      signatures: Object.keys(signatures).length > 0 ? signatures : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <p className="text-sm font-bold text-gray-900">{template?.name ?? "Loading..."}</p>
            {template?.description && <p className="text-xs text-gray-500">{template.description}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-red-700">Please complete: {errors.join(", ")}</p>
              </div>
            )}

            {fields.map(field => (
              <CustomerFieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                signature={signatures[field.id]}
                onChange={(v) => setValues(prev => ({ ...prev, [field.id]: v }))}
                onSignature={(sig) => setSignatures(prev => ({ ...prev, [field.id]: sig }))}
              />
            ))}

            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="w-full bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
              {submitMutation.isPending ? "Submitting…" : "Submit & Sign"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Customer Field Renderer ────────────────────────────────────────────────────────────
function CustomerFieldRenderer({
  field,
  value,
  signature,
  onChange,
  onSignature,
}: {
  field: FormField;
  value: unknown;
  signature?: string;
  onChange: (v: unknown) => void;
  onSignature: (sig: string) => void;
}) {
  if (field.type === "heading") {
    return <h3 className="text-sm font-bold text-gray-800 pt-2 border-t border-gray-100">{field.label}</h3>;
  }
  if (field.type === "divider") {
    return <hr className="border-gray-200" />;
  }

  const inputClass = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-gray-400";

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {field.type === "text" && (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={inputClass + " resize-none"}
        />
      )}

      {field.type === "number" && (
        <input
          type="number"
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {field.type === "date" && (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.type === "select" && (
        <select
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === "checkbox" && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            className="accent-amber-500 w-4 h-4"
          />
          <span className="text-sm text-gray-700">Yes</span>
        </label>
      )}

      {field.type === "signature" && (
        <CustomerSignaturePad
          value={signature}
          onChange={onSignature}
        />
      )}

      {field.type === "photo" && (
        <p className="text-xs text-gray-400 italic">Photo upload is available in the tradie portal.</p>
      )}
    </div>
  );
}

// ── Customer Signature Pad ─────────────────────────────────────────────────────────────
function CustomerSignaturePad({
  value,
  onChange,
}: {
  value?: string;
  onChange: (sig: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(img, 0, 0);
          setHasDrawn(true);
        }
      };
      img.src = value;
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDrawing(true);
    setHasDrawn(true);
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
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    setDrawing(false);
    if (canvasRef.current && hasDrawn) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setHasDrawn(false);
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        className="w-full border border-gray-200 rounded-lg bg-white cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {hasDrawn && (
        <button onClick={clear} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
          Clear signature
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────────────
export default function CustomerJobStatus() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data: job, isLoading, error } = trpc.portal.getJobByCustomerToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your job status…</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Job Not Found</h1>
          <p className="text-gray-500 text-sm">
            This link may have expired or the job reference is invalid. Please contact your tradie directly.
          </p>
        </div>
      </div>
    );
  }

  const stageConfig = STAGE_CONFIG[job.stage ?? "new"] ?? STAGE_CONFIG["new"];
  const currentStageIdx = getStageIndex(job.stage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header with tradie branding ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {/* Tradie logo + name */}
          <div className="flex items-center gap-3 min-w-0">
            {job.tradie.logoUrl ? (
              <img
                src={job.tradie.logoUrl}
                alt={job.tradie.tradingName ?? "Tradie logo"}
                className="w-10 h-10 object-contain rounded-lg flex-shrink-0 bg-gray-50 border border-gray-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-5 h-5 text-amber-600" />
              </div>
            )}
            <div className="min-w-0">
              {job.tradie.tradingName && (
                <p className="text-sm font-bold text-gray-900 truncate">{job.tradie.tradingName}</p>
              )}
              <p className="text-xs text-gray-400 truncate">{job.jobType ?? "Job Status"}</p>
            </div>
          </div>
          {/* Solvr branding — subtle */}
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-gray-300 leading-none">Powered by</p>
            <p className="text-xs font-semibold text-amber-400 leading-tight">Solvr</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Status banner */}
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-4 ${stageConfig.colour}`}>
          <div className="mt-0.5 flex-shrink-0">{stageConfig.icon}</div>
          <div>
            <p className="font-semibold text-sm">{stageConfig.label}</p>
            <p className="text-xs mt-0.5 opacity-80">{stageConfig.description}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Progress</p>
          <div className="flex items-center gap-0">
            {PROGRESS_STAGES.map((s, i) => {
              const isActive = i <= currentStageIdx;
              const isLast = i === PROGRESS_STAGES.length - 1;
              const label = STAGE_CONFIG[s]?.label ?? s;
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className={`w-3 h-3 rounded-full border-2 transition-all ${
                        isActive
                          ? "bg-amber-400 border-amber-400"
                          : "bg-white border-gray-300"
                      }`}
                    />
                    <p className={`text-[9px] mt-1 text-center leading-tight w-12 ${isActive ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                      {label.replace("Enquiry ", "").replace(" Sent", "")}
                    </p>
                  </div>
                  {!isLast && (
                    <div className={`flex-1 h-0.5 -mt-4 ${i < currentStageIdx ? "bg-amber-400" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Job details */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {job.customerName && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">👤</span>
              </div>
              <div>
                <p className="text-xs text-gray-400">Customer</p>
                <p className="text-sm font-medium text-gray-800">{job.customerName}</p>
              </div>
            </div>
          )}
          {job.location && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Location</p>
                <p className="text-sm font-medium text-gray-800">{job.location}</p>
              </div>
            </div>
          )}
          {job.preferredDate && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Scheduled Date</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(job.preferredDate).toLocaleDateString("en-AU", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
          {job.completedAt && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Completed</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(job.completedAt).toLocaleDateString("en-AU", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
          {job.description && (
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{job.description}</p>
            </div>
          )}
        </div>

        {/* Invoice + Pay Now */}
        {(job.invoicedAmount || job.invoicePdfUrl) && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Invoice</p>
            <div className="flex items-center justify-between">
              {job.invoicedAmount && (
                <div>
                  <p className="text-xs text-gray-400">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(job.invoicedAmount / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                {job.invoicePdfUrl && (
                  <a
                    href={job.invoicePdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    View Invoice
                  </a>
                )}
              </div>
            </div>
            {/* Pay Now CTA — only when there's a pending payment link */}
            {job.paymentLinkToken && (
              <a
                href={`/pay/${job.paymentLinkToken}`}
                className="flex items-center justify-center gap-2 w-full mt-4 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-3.5 rounded-xl transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                Pay Now — ${job.invoicedAmount ? (job.invoicedAmount / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 }) : ""}
              </a>
            )}
            {job.stage === "completed" && !job.paymentLinkToken && job.invoicedAmount && (
              <div className="flex items-center gap-2 mt-4 bg-green-50 text-green-700 text-sm font-semibold px-4 py-3 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
                Payment received — thank you!
              </div>
            )}
          </div>
        )}

        {/* Completion report */}
        {job.completionReportUrl && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Completion Report</p>
            <a
              href={job.completionReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              Download Completion Report
            </a>
          </div>
        )}

        {/* Forms & Certificates — customer can fill required forms */}
        {token && <CustomerFormsSection token={token} />}

        {/* Photos — grouped by stage (before / during / after) */}
        {job.photos.length > 0 && (
          <PhotoGallery photos={job.photos} />
        )}

        {/* ── Feedback widget (only shown when job is completed/invoiced/paid) ── */}
        {token && (
          <FeedbackWidget
            token={token}
            jobStage={job.stage}
            initialFeedback={job.feedback}
            googleReviewLink={null}
          />
        )}

        {/* Contact tradie */}
        {(job.tradie.phone || job.tradie.email) && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Contact {job.tradie.tradingName ?? "Your Tradie"}
            </p>
            <div className="flex flex-col gap-2">
              {job.tradie.phone && (
                <a
                  href={`tel:${job.tradie.phone}`}
                  className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm font-semibold text-gray-800">{job.tradie.phone}</p>
                  </div>
                </a>
              )}
              {job.tradie.email && (
                <a
                  href={`mailto:${job.tradie.email}`}
                  className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm font-semibold text-gray-800">{job.tradie.email}</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 pb-4">
          This page is provided by {job.tradie.tradingName ?? "your tradie"} via Solvr.
        </p>
      </div>
    </div>
  );
}
