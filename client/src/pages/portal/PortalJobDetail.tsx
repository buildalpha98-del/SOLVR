/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Job Detail — tabbed job view.
 * Three tabs: Overview · Money · Work
 * Designed for tradies — minimal taps to find anything.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { getSolvrOrigin } from "@/const";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, User, Phone, Mail, Home, Briefcase,
  DollarSign, CheckCircle2, FileText, Camera, Clock,
  Plus, Trash2, Loader2, Edit2, Save, X, CreditCard,
  Banknote, Receipt, Send, Copy, Check,
  ChevronLeft, ChevronRight, ZoomIn, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QuoteEngineUpgradeButton } from "@/components/portal/QuoteEngineUpgradeButton";
import { JobTasksSection } from "@/components/portal/JobTasksSection";
import { useSwipe } from "@/hooks/useSwipe";
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { openMapsLatLng } from "@/lib/openMaps";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";

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
  label, value, onSave, icon, placeholder = "—", type = "text",
}: {
  label: string; value: string | null | undefined; onSave: (v: string) => void;
  icon?: React.ReactNode; placeholder?: string; type?: string;
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
              type={type} value={draft} onChange={e => setDraft(e.target.value)}
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
            <p className="text-sm" style={{ color: value ? "#fff" : "rgba(255,255,255,0.3)" }}>{value || placeholder}</p>
            <button
              onClick={() => { setDraft(value ?? ""); setEditing(true); }}
              className="flex items-center justify-center w-7 h-7 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 -mr-1"
              style={{ color: "rgba(255,255,255,0.5)", minWidth: "28px", minHeight: "28px" }}
              aria-label={`Edit ${label}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
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

// ─── Photo Lightbox ──────────────────────────────────────────────────────────
type LightboxPhoto = { imageUrl: string; caption: string | null; photoType: string; uploadedByStaffName?: string | null };

function PhotoLightbox({
  photos, initialIndex, onClose,
}: {
  photos: LightboxPhoto[]; initialIndex: number; onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const prev = useCallback(() => setIndex(i => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const current = photos[index];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.92)" }} onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}><X className="w-5 h-5" /></button>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>{index + 1} / {photos.length}</div>
      {photos.length > 1 && (
        <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}><ChevronLeft className="w-5 h-5" /></button>
      )}
      <div className="max-w-[90vw] max-h-[80vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
        onTouchEnd={(e) => { if (touchStartX === null) return; const dx = e.changedTouches[0].clientX - touchStartX; if (dx > 50) prev(); else if (dx < -50) next(); setTouchStartX(null); }}
      >
        <img src={current.imageUrl} alt={current.caption ?? current.photoType} className="rounded-xl object-contain" style={{ maxWidth: "90vw", maxHeight: "70vh" }} />
        {(current.caption || current.uploadedByStaffName) && (
          <div className="text-center space-y-0.5">
            {current.uploadedByStaffName && <p className="text-xs font-semibold" style={{ color: "#F5A623" }}>{current.uploadedByStaffName}</p>}
            {current.caption && <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{current.caption}</p>}
            <p className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.35)" }}>{current.photoType}</p>
          </div>
        )}
      </div>
      {photos.length > 1 && (
        <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}><ChevronRight className="w-5 h-5" /></button>
      )}
    </div>
  );
}

// ─── Photo Section ──────────────────────────────────────────────────────────
type JobPhoto = { id: string; photoType: string; imageUrl: string; imageKey: string; caption: string | null; uploadedByStaffName?: string | null };

function PhotoSection({
  jobId, beforePhotos, afterPhotos, staffPhotos, onRefresh,
}: {
  jobId: number; beforePhotos: JobPhoto[]; afterPhotos: JobPhoto[]; staffPhotos: JobPhoto[]; onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState<"before" | "after" | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);

  const allPhotosForLightbox: LightboxPhoto[] = [
    ...beforePhotos.map(p => ({ imageUrl: p.imageUrl, caption: p.caption, photoType: p.photoType, uploadedByStaffName: p.uploadedByStaffName })),
    ...afterPhotos.map(p => ({ imageUrl: p.imageUrl, caption: p.caption, photoType: p.photoType, uploadedByStaffName: p.uploadedByStaffName })),
    ...staffPhotos.map(p => ({ imageUrl: p.imageUrl, caption: p.caption, photoType: p.photoType, uploadedByStaffName: p.uploadedByStaffName })),
  ];

  function openLightbox(photo: JobPhoto) {
    const idx = allPhotosForLightbox.findIndex(p => p.imageUrl === photo.imageUrl);
    setLightbox({ photos: allPhotosForLightbox, index: idx >= 0 ? idx : 0 });
  }

  const addPhoto = trpc.portal.addJobPhoto.useMutation({ onSuccess: () => { onRefresh(); }, onError: (e) => toast.error(e.message) });
  const removePhoto = trpc.portal.removeJobPhoto.useMutation({ onSuccess: () => { onRefresh(); }, onError: (e) => toast.error(e.message) });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, photoType: "before" | "after") {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Validate all files first
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > 10 * 1024 * 1024) { toast.error(`"${files[i].name}" exceeds 10MB limit`); return; }
    }
    setUploading(photoType);
    let uploaded = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("photoType", photoType);
        const res = await fetch(`${getSolvrOrigin()}/api/portal/upload-photo`, { method: "POST", credentials: "include", body: fd });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as { error?: string }).error ?? "Upload failed"); }
        const { url } = await res.json() as { url: string };
        addPhoto.mutate({ jobId, photoType, imageUrl: url, imageKey: url.split("/").pop() ?? url });
        uploaded++;
      }
      if (uploaded > 1) toast.success(`${uploaded} photos uploaded`);
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
          <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>{type === "before" ? "Before" : "After"} ({photos.length})</p>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e, type)} />
            {uploading === type ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#F5A623" }} />
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}><Plus className="w-3 h-3" /> Add</span>
            )}
          </label>
        </div>
        {photos.length === 0 ? (
          <label className="cursor-pointer block">
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e, type)} />
            <div className="rounded-lg flex flex-col items-center justify-center h-24 gap-1 text-xs" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.25)" }}>
              <Camera className="w-4 h-4" />Click to upload
            </div>
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {photos.map(p => (
              <div key={p.id} className="relative group rounded-lg overflow-hidden cursor-pointer" style={{ aspectRatio: "4/3" }}>
                <img src={p.imageUrl} alt={p.caption ?? type} className="w-full h-full object-cover" onClick={() => openLightbox(p)} />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: "rgba(0,0,0,0.3)" }}><ZoomIn className="w-5 h-5 text-white" /></div>
                <button onClick={(e) => { e.stopPropagation(); removePhoto.mutate({ id: p.id, jobId }); }} className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(239,68,68,0.85)" }}><Trash2 className="w-2.5 h-2.5 text-white" /></button>
                {p.caption && <p className="absolute bottom-0 left-0 right-0 text-[10px] px-1.5 py-1 truncate" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>{p.caption}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {lightbox && <PhotoLightbox photos={lightbox.photos} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      <SectionCard title="Before & After Photos" action={<Camera className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
        <div className="grid grid-cols-2 gap-4">
          <PhotoGrid photos={beforePhotos} type="before" />
          <PhotoGrid photos={afterPhotos} type="after" />
        </div>
        {staffPhotos.length > 0 && (
          <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>Staff Photos ({staffPhotos.length})</p>
            <div className="grid grid-cols-3 gap-1.5">
              {staffPhotos.map(p => (
                <div key={p.id} className="relative group rounded-lg overflow-hidden cursor-pointer" style={{ aspectRatio: "1" }}>
                  <img src={p.imageUrl} alt={p.caption ?? p.photoType} className="w-full h-full object-cover" onClick={() => openLightbox(p)} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: "rgba(0,0,0,0.3)" }}><ZoomIn className="w-4 h-4 text-white" /></div>
                  <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1" style={{ background: "rgba(0,0,0,0.65)" }}>
                    {p.uploadedByStaffName && <p className="text-[9px] truncate" style={{ color: "rgba(245,166,35,0.9)" }}>{p.uploadedByStaffName}</p>}
                    <p className="text-[9px] capitalize" style={{ color: "rgba(255,255,255,0.6)" }}>{p.photoType}{p.caption ? ` — ${p.caption}` : ""}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removePhoto.mutate({ id: p.id, jobId }); }} className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(239,68,68,0.85)" }}><Trash2 className="w-2.5 h-2.5 text-white" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ─── Job Costing Section ───────────────────────────────────────────────────────
type CostItem = { id: number; category: string; description: string; amountCents: number; supplier?: string | null; reference?: string | null };

const COST_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  materials:     { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  labour:        { bg: "rgba(245,166,35,0.12)",  text: "#F5A623" },
  subcontractor: { bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
  equipment:     { bg: "rgba(20,184,166,0.12)",  text: "#14b8a6" },
  other:         { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.5)" },
};

function JobCostingSection({
  jobId, costItems, totalCostCents, invoicedCents, grossProfitCents, grossMarginPct, onRefresh,
}: {
  jobId: number; costItems: CostItem[]; totalCostCents: number; invoicedCents: number;
  grossProfitCents: number; grossMarginPct: number | null; onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [category, setCategory] = useState<"materials" | "labour" | "subcontractor" | "equipment" | "other">("materials");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");

  const addCost = trpc.portal.addJobCostItem.useMutation({
    onSuccess: () => { onRefresh(); setShowAdd(false); setDescription(""); setAmount(""); setSupplier(""); setReference(""); toast.success("Cost item added"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCost = trpc.portal.deleteJobCostItem.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Cost item removed"); },
    onError: (e) => toast.error(e.message),
  });

  const isProfitable = grossProfitCents >= 0;
  const marginColor = grossMarginPct === null ? "rgba(255,255,255,0.4)" : grossMarginPct >= 30 ? "#4ade80" : grossMarginPct >= 15 ? "#F5A623" : "#ef4444";

  return (
    <SectionCard title="Job Costing & Profit" action={<button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#F5A623" }}><Plus className="w-3.5 h-3.5" /> Add Cost</button>}>
      {/* Profit Summary */}
      <div className="grid grid-cols-3 gap-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Revenue</p>
          <p className="text-base font-bold text-white">{centsToAud(invoicedCents)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Total Costs</p>
          <p className="text-base font-bold" style={{ color: "#ef4444" }}>{centsToAud(totalCostCents)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Gross Profit</p>
          <p className="text-base font-bold" style={{ color: isProfitable ? "#4ade80" : "#ef4444" }}>{isProfitable ? "+" : ""}{centsToAud(grossProfitCents)}</p>
        </div>
      </div>
      {grossMarginPct !== null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, grossMarginPct))}%`, background: marginColor }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: marginColor }}>{grossMarginPct}% margin</span>
        </div>
      )}
      {costItems.length === 0 && !showAdd ? (
        <p className="text-xs text-center py-2" style={{ color: "rgba(255,255,255,0.3)" }}>No costs recorded yet. Add materials, labour, or subcontractor costs.</p>
      ) : (
        <div className="space-y-1.5">
          {costItems.map(item => {
            const catStyle = COST_CATEGORY_COLORS[item.category] ?? COST_CATEGORY_COLORS.other;
            return (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0" style={{ background: catStyle.bg, color: catStyle.text }}>{item.category}</span>
                  <span className="text-white truncate">{item.description}</span>
                  {item.supplier && <span className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{item.supplier}</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-medium" style={{ color: "#ef4444" }}>{centsToAud(item.amountCents)}</span>
                  <button onClick={() => deleteCost.mutate({ id: item.id })} className="hover:text-red-400 transition-colors" style={{ color: "rgba(255,255,255,0.2)" }}><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showAdd && (
        <div className="pt-2 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as typeof category)} className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}>
                <option value="materials">Materials</option>
                <option value="labour">Labour</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="equipment">Equipment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Amount (AUD)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Description *</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. 20m copper pipe, 3 hrs labour" className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Supplier (optional)</label>
              <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Reece Plumbing" className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Reference (optional)</label>
              <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. INV-001" className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              const cents = Math.round(parseFloat(amount) * 100);
              if (!cents || isNaN(cents) || cents < 1) { toast.error("Enter a valid amount"); return; }
              if (!description.trim()) { toast.error("Enter a description"); return; }
              addCost.mutate({ jobId, category, description: description.trim(), amountCents: cents, supplier: supplier || undefined, reference: reference || undefined });
            }} disabled={addCost.isPending} style={{ background: "#F5A623", color: "#0F1F3D" }}>
              {addCost.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add Cost"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Copy Link Buttons ───────────────────────────────────────────────────────
function CopyStatusLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${window.location.origin}/job/${token}`;
  const handleCopy = () => { navigator.clipboard.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <Button size="sm" onClick={handleCopy} title="Copy customer status link"
      style={{ background: copied ? "rgba(34,197,94,0.12)" : "rgba(245,166,35,0.12)", color: copied ? "#22c55e" : "#F5A623", border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "rgba(245,166,35,0.2)"}` }}>
      {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
    </Button>
  );
}

function CopyReportLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${window.location.origin}/report/${token}`;
  const handleCopy = () => { navigator.clipboard.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <Button size="sm" onClick={handleCopy}
      style={{ background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)", color: copied ? "#22c55e" : "rgba(255,255,255,0.6)", border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)"}` }}>
      {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
      {copied ? "Copied!" : "Copy Link"}
    </Button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Main Page ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
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
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); hapticLight(); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const addPayment = trpc.portal.addProgressPayment.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); setShowAddPayment(false); hapticMedium(); toast.success("Payment recorded"); },
    onError: (e) => toast.error(e.message),
  });

  const removePayment = trpc.portal.removeProgressPayment.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); hapticWarning(); toast.success("Payment removed"); },
    onError: (e) => toast.error(e.message),
  });

  const setRecurring = trpc.portal.setRecurring.useMutation({
    onSuccess: (res) => {
      utils.portal.getJobDetail.invalidate({ id: jobId });
      const label = res.frequency === "weekly" ? "Weekly" : res.frequency === "fortnightly" ? "Fortnightly" : "Monthly";
      toast.success(`${label} repeat enabled — 3 future jobs created`);
    },
    onError: (e) => toast.error(e.message),
  });

  const disableRecurring = trpc.portal.disableRecurring.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); toast.success("Repeat disabled"); },
    onError: (e) => toast.error(e.message),
  });

  const markComplete = trpc.portal.markJobComplete.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); setShowCompleteModal(false); hapticSuccess(); toast.success("Job marked complete"); },
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
    onSuccess: (res) => { utils.portal.getJobDetail.invalidate({ id: jobId }); hapticSuccess(); toast.success(`Invoice ${res.invoiceNumber} created`); },
    onError: (e) => toast.error(e.message),
  });

  const markPaid = trpc.portal.markInvoicePaid.useMutation({
    onSuccess: () => { utils.portal.getJobDetail.invalidate({ id: jobId }); setShowMarkPaid(false); hapticSuccess(); toast.success("Invoice marked as paid"); },
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

  const [showSendInvoice, setShowSendInvoice] = useState(false);
  const [sendInvoiceEmail, setSendInvoiceEmail] = useState("");

  // ── Tab state + swipe gestures ──────────────────────────────────────────────
  type TabKey = "overview" | "money" | "work" | "forms";
  const TAB_ORDER: TabKey[] = ["overview", "money", "work", "forms"];
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Forms data for the Forms tab
  const jobFormsQuery = trpc.portal.jobForms.useQuery({ jobId }, { enabled: !!jobId });
  const formComplianceQuery = trpc.portal.formCompliance.useQuery({ jobId }, { enabled: !!jobId });
  const formTemplatesQuery = trpc.forms.listTemplates.useQuery(undefined, { enabled: activeTab === "forms" });
  const updateRequiredForms = trpc.portal.updateRequiredForms.useMutation({
    onSuccess: () => {
      formComplianceQuery.refetch();
      toast.success("Required forms updated");
    },
  });

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      const idx = TAB_ORDER.indexOf(activeTab);
      if (idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
    },
    onSwipeRight: () => {
      const idx = TAB_ORDER.indexOf(activeTab);
      if (idx > 0) setActiveTab(TAB_ORDER[idx - 1]);
    },
    threshold: 50,
  });

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
  const staffPhotos = photos.filter(p => p.photoType === "during" || p.photoType === "other");

  const offlineAware = useOfflineMutation();

  function save(field: string, value: string | number | null) {
    const input = { id: jobId, [field]: value };
    offlineAware("portal.updateJob", input, () => updateJob.mutate(input as Parameters<typeof updateJob.mutate>[0]));
  }

  return (
    <PortalLayout>
      <div className="sm:max-w-4xl mx-auto space-y-4 pb-24">

        {/* ── Header (always visible) ── */}
        <div className="flex items-start gap-3">
          <button onClick={() => navigate("/portal/jobs")} className="mt-1 p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.4)" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{job.jobType}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: stageStyle.bg, color: stageStyle.text }}>{stageStyle.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: invoiceStyle.bg, color: invoiceStyle.text }}>{invoiceStyle.label}</span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Created {formatDate(job.createdAt)}
              {job.invoiceNumber && ` · ${job.invoiceNumber}`}
            </p>
          </div>
          {(job as any).customerStatusToken && <CopyStatusLinkButton token={(job as any).customerStatusToken} />}
          <select
            value={job.stage} onChange={e => save("stage", e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer"
            style={{ background: "#0F1F3D", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <option value="new_lead">New Lead</option>
            <option value="quoted">Quoted</option>
            <option value="booked">Booked</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── TABBED LAYOUT ── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div {...swipeHandlers}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
          {/* Sticky tab bar — thumb-reachable on mobile */}
          <TabsList
            className="w-full grid grid-cols-4 h-12 rounded-xl p-1 sticky top-0 z-30"
            style={{ background: "rgba(15,31,61,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
          >
            {(["overview", "money", "work", "forms"] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className={`rounded-lg text-sm font-semibold min-h-[44px] capitalize data-[state=active]:shadow-none data-[state=active]:!bg-[#F5A623] data-[state=active]:!text-[#0F1F3D] ${
                  activeTab !== tab ? "!text-white/45" : ""
                }`}
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ─── TAB 1: Overview ─── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Client Details */}
              <SectionCard title="Client Details" action={<User className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
                <EditableField label="Name" value={job.customerName ?? job.callerName} onSave={v => save("customerName", v)} icon={<User className="w-3.5 h-3.5" />} placeholder="Not set" />
                <EditableField label="Phone" value={job.customerPhone ?? job.callerPhone} onSave={v => save("customerPhone", v)} icon={<Phone className="w-3.5 h-3.5" />} placeholder="Not set" type="tel" />
                <EditableField label="Email" value={job.customerEmail} onSave={v => save("customerEmail", v)} icon={<Mail className="w-3.5 h-3.5" />} placeholder="Not set" type="email" />
                <EditableField label="Address" value={job.customerAddress ?? job.location} onSave={v => save("customerAddress", v)} icon={<Home className="w-3.5 h-3.5" />} placeholder="Not set" />
              </SectionCard>

              {/* Job Details */}
              <SectionCard title="Job Details" action={<Briefcase className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
                <EditableField label="Job Type" value={job.jobType} onSave={v => save("jobType", v)} icon={<Briefcase className="w-3.5 h-3.5" />} />
                <EditableField label="Location" value={job.location} onSave={v => save("location", v)} icon={<MapPin className="w-3.5 h-3.5" />} placeholder="Not set" />
                <EditableField label="Preferred Date" value={job.preferredDate} onSave={v => save("preferredDate", v)} icon={<Clock className="w-3.5 h-3.5" />} placeholder="Not set" />
                <EditableField label="Notes" value={job.notes} onSave={v => save("notes", v)} icon={<FileText className="w-3.5 h-3.5" />} placeholder="Add notes..." />
                <div className="flex items-center gap-4 pt-1">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Est. Value</p>
                    <p className="text-sm font-semibold" style={{ color: "#F5A623" }}>{job.estimatedValue ? `$${job.estimatedValue.toLocaleString()}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Actual Value</p>
                    <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>{job.actualValue ? `$${job.actualValue.toLocaleString()}` : "—"}</p>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Linked Quote */}
            {quote && (
              <SectionCard title="Linked Quote" action={<FileText className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Quote #{(quote as { quoteNumber?: string }).quoteNumber ?? quote.id}</p>
                    <p className="text-lg font-bold text-white mt-0.5">
                      ${(parseFloat(String((quote as unknown as { totalAmount?: string | number }).totalAmount ?? 0)) || 0).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">{(quote as { status?: string }).status ?? "draft"}</Badge>
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

            {/* Completion status */}
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
                <Button onClick={() => setShowCompleteModal(true)} style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Job Complete
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ─── TAB 2: Money ─── */}
          <TabsContent value="money" className="space-y-4 mt-4">
            {/* Progress Payments */}
            <SectionCard title="Progress Payments" action={
              <button onClick={() => setShowAddPayment(true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#F5A623" }}>
                <Plus className="w-3.5 h-3.5" /> Add Payment
              </button>
            }>
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
              {progressPayments.length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.3)" }}>No payments recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {progressPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-white font-medium">{centsToAud(p.amountCents)}</span>
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>{p.method.replace("_", " ")}</span>
                        {p.note && <span className="ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{p.note}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "rgba(255,255,255,0.35)" }}>{formatDate(p.receivedAt)}</span>
                        <button onClick={() => removePayment.mutate({ id: p.id, jobId })} className="hover:text-red-400 transition-colors" style={{ color: "rgba(255,255,255,0.2)" }}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showAddPayment && (
                <div className="pt-2 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Amount (AUD)</label>
                      <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Method</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)} className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}>
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
                      <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Note (optional)</label>
                      <input type="text" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="e.g. Deposit" className="w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      const cents = Math.round(parseFloat(paymentAmount) * 100);
                      if (!cents || isNaN(cents)) { toast.error("Enter a valid amount"); return; }
                      addPayment.mutate({ jobId, amountCents: cents, method: paymentMethod, note: paymentNote || undefined, receivedAt: paymentDate });
                    }} disabled={addPayment.isPending} style={{ background: "#F5A623", color: "#0F1F3D" }}>
                      {addPayment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Payment"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddPayment(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Job Costing */}
            <JobCostingSection
              jobId={jobId}
              costItems={(data as any).costItems ?? []}
              totalCostCents={(data as any).totalCostCents ?? 0}
              invoicedCents={invoicedCents}
              grossProfitCents={(data as any).grossProfitCents ?? 0}
              grossMarginPct={(data as any).grossMarginPct ?? null}
              onRefresh={() => utils.portal.getJobDetail.invalidate({ id: jobId })}
            />

            {/* Invoice */}
            <SectionCard title="Invoice" action={<Receipt className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
              {job.invoiceStatus === "not_invoiced" || !job.invoiceStatus ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  {hasQuoteEngine ? (
                    <>
                      <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>No invoice generated yet. Generate one from the accepted quote or job value.</p>
                      {!job.actualValue && !job.estimatedValue && !job.sourceQuoteId && (
                        <p className="text-xs text-center px-3 py-1.5 rounded-md" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>Set an Actual Value above before generating an invoice.</p>
                      )}
                      <Button onClick={() => generateInvoice.mutate({ jobId, paymentMethod: "bank_transfer" })} disabled={generateInvoice.isPending} style={{ background: "#F5A623", color: "#0F1F3D" }}>
                        {generateInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                        Generate Invoice
                      </Button>
                    </>
                  ) : (
                    <div className="w-full rounded-xl p-4 text-center space-y-3" style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)" }}>
                      <div className="text-2xl">🧾</div>
                      <p className="text-sm font-semibold text-white">Professional Invoicing</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Generate branded PDF invoices with your bank details, GST breakdown, and payment tracking. Included in the Quote Engine add-on.</p>
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
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: invoiceStyle.bg, color: invoiceStyle.text }}>{invoiceStyle.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span>Invoiced {formatDate(job.invoicedAt)}</span>
                    {job.paidAt && <><span>·</span><span>Paid {formatDate(job.paidAt)}</span></>}
                  </div>
                  {(job as any).invoicePdfUrl && (
                    <Button size="sm" onClick={() => window.open((job as any).invoicePdfUrl, "_blank")} style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}>
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> View PDF
                    </Button>
                  )}
                  {job.invoiceStatus !== "paid" && (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <Button size="sm" onClick={() => { setSendInvoiceEmail(job.customerEmail ?? ""); setShowSendInvoice(true); }} style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Send to Client
                      </Button>
                      <Button size="sm" onClick={() => { setPaidAmount(String((invoicedCents / 100).toFixed(2))); setShowMarkPaid(true); }} style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                        <Banknote className="w-3.5 h-3.5 mr-1.5" /> Mark as Paid
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateJob.mutate({ id: jobId, invoiceStatus: "sent" })}>Mark Sent</Button>
                    </div>
                  )}
                  {showSendInvoice && (
                    <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>Send invoice to:</p>
                      <div className="flex gap-2">
                        <input type="email" value={sendInvoiceEmail} onChange={e => setSendInvoiceEmail(e.target.value)} placeholder="customer@email.com" className="flex-1 text-xs px-3 py-1.5 rounded-md" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white", outline: "none" }} />
                        <Button size="sm" onClick={() => {
                          if (!sendInvoiceEmail) { toast.error("Enter a customer email"); return; }
                          generateInvoice.mutate({ jobId, sendEmail: true, customerEmail: sendInvoiceEmail }, {
                            onSuccess: (res) => { setShowSendInvoice(false); toast.success(res.sent ? "Invoice sent to client" : "Invoice generated (email not sent)"); }
                          });
                        }} disabled={generateInvoice.isPending} style={{ background: "#22c55e", color: "white" }}>
                          {generateInvoice.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowSendInvoice(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* ─── TAB 3: Work ─── */}
          <TabsContent value="work" className="space-y-4 mt-4">
            {/* Job Tasks */}
            <JobTasksSection
              jobId={jobId}
              jobType={(job as any).jobType ?? ""}
              jobDescription={(job as any).description ?? null}
              jobStage={(job as any).stage ?? "new_lead"}
              nextActionSuggestion={(job as any).nextActionSuggestion ?? null}
              onRefresh={() => utils.portal.getJobDetail.invalidate({ id: jobId })}
            />

            {/* Repeat This Job */}
            {!(job as any).parentJobId && (
              <SectionCard title="Repeat This Job" action={<RefreshCw className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
                {(job as any).isRecurring ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
                        <RefreshCw className="w-3 h-3" />
                        {(job as any).recurrenceFrequency === "weekly" ? "Repeats weekly" : (job as any).recurrenceFrequency === "fortnightly" ? "Repeats fortnightly" : "Repeats monthly"}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>3 upcoming jobs have been created in your job list. Disable repeat to stop creating new ones.</p>
                    <button onClick={() => disableRecurring.mutate({ jobId })} disabled={disableRecurring.isPending} className="text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: "rgba(239,68,68,0.3)", color: "#ef4444", background: "rgba(239,68,68,0.06)" }}>
                      {disableRecurring.isPending ? "Disabling..." : "Disable repeat"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Set this job to repeat for maintenance or regular clients. Creates the next 3 jobs automatically.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["weekly", "fortnightly", "monthly"] as const).map((freq) => (
                        <button key={freq} onClick={() => setRecurring.mutate({ jobId, frequency: freq })} disabled={setRecurring.isPending}
                          className="py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-95"
                          style={{ borderColor: "rgba(245,166,35,0.3)", color: "#F5A623", background: "rgba(245,166,35,0.06)" }}>
                          {setRecurring.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {/* Photos */}
            <PhotoSection
              jobId={jobId}
              beforePhotos={beforePhotos}
              afterPhotos={afterPhotos}
              staffPhotos={staffPhotos}
              onRefresh={() => utils.portal.getJobDetail.invalidate({ id: jobId })}
            />

            {/* Staff Activity */}
            {(() => {
              const scheduleEntries = (data as any).scheduleEntries ?? [];
              const timeEntries = (data as any).timeEntries ?? [];
              if (scheduleEntries.length === 0 && timeEntries.length === 0) return null;
              const REASON_LABELS: Record<string, string> = { sick: "Sick", unavailable: "Unavailable", personal: "Personal", other: "Other" };
              return (
                <SectionCard title="Staff Activity">
                  {scheduleEntries.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Scheduled Staff</p>
                      {scheduleEntries.map((entry: any) => (
                        <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                          <div className="flex items-center gap-2">
                            {entry.staffDeclinedAt ? (
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>✗</span>
                            ) : entry.staffConfirmedAt ? (
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>✓</span>
                            ) : (
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>?</span>
                            )}
                            <div>
                              <p className="text-sm text-white">{entry.staffName ?? `Staff #${entry.staffId}`}</p>
                              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                                {new Date(entry.startTime).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                                {entry.staffDeclinedAt && entry.declineReason && (
                                  <span className="ml-2 text-red-400/70">— {REASON_LABELS[entry.declineReason] ?? entry.declineReason}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            entry.status === "completed" ? "bg-green-500/15 text-green-400" :
                            entry.status === "confirmed" ? "bg-amber-500/15 text-amber-400" :
                            entry.status === "in_progress" ? "bg-blue-500/15 text-blue-400" :
                            entry.staffDeclinedAt ? "bg-red-500/15 text-red-400" :
                            "bg-white/8 text-white/40"
                          }`}>
                            {entry.staffDeclinedAt ? "Declined" : entry.status.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {timeEntries.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Check-in / Check-out Log</p>
                      {timeEntries.map((te: any) => {
                        const durationMins = te.checkOutAt
                          ? Math.round((new Date(te.checkOutAt).getTime() - new Date(te.checkInAt).getTime()) / 60000)
                          : null;
                        const hasCheckInCoords = !!(te.checkInLat && te.checkInLng);
                        const hasCheckOutCoords = !!(te.checkOutLat && te.checkOutLng);
                        return (
                          <div key={te.id} className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <p className="text-sm font-medium text-white">{te.staffName ?? `Staff #${te.staffId}`}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Checked in</p>
                                <p style={{ color: "rgba(255,255,255,0.7)" }}>
                                  {new Date(te.checkInAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                  {hasCheckInCoords && (
                                    <button onClick={() => openMapsLatLng(te.checkInLat, te.checkInLng)} className="ml-1.5 inline-flex items-center gap-0.5 text-[10px]" style={{ color: "#F5A623" }}>
                                      <MapPin className="w-2.5 h-2.5" /> Map
                                    </button>
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Checked out</p>
                                {te.checkOutAt ? (
                                  <p style={{ color: "rgba(255,255,255,0.7)" }}>
                                    {new Date(te.checkOutAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                    {hasCheckOutCoords && (
                                      <button onClick={() => openMapsLatLng(te.checkOutLat, te.checkOutLng)} className="ml-1.5 inline-flex items-center gap-0.5 text-[10px]" style={{ color: "#F5A623" }}>
                                        <MapPin className="w-2.5 h-2.5" /> Map
                                      </button>
                                    )}
                                  </p>
                                ) : (
                                  <p style={{ color: "rgba(74,222,128,0.7)" }}>On site</p>
                                )}
                              </div>
                            </div>
                            {durationMins !== null && (
                              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                                Duration: {Math.floor(durationMins / 60)}h {durationMins % 60}m
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              );
            })()}

            {/* Completion Report */}
            <SectionCard title="Completion Report" action={<FileText className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}>
              {(job as any).completionReportUrl ? (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Report generated and ready to send to your customer.</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => window.open((job as any).completionReportUrl, "_blank")} style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}>
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> View Report
                    </Button>
                    {(job as any).completionReportToken && <CopyReportLinkButton token={(job as any).completionReportToken} />}
                    <Button size="sm" onClick={() => { setSendReportEmail(job.customerEmail ?? ""); setShowSendReport(true); }} style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Send to Client
                    </Button>
                    <Button size="sm" onClick={() => generateCompletionReport.mutate({ jobId })} disabled={generateCompletionReport.isPending} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {generateCompletionReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                      Regenerate
                    </Button>
                  </div>
                  {showSendReport && (
                    <div className="mt-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>Send completion report to:</p>
                      <div className="flex gap-2">
                        <input type="email" value={sendReportEmail} onChange={e => setSendReportEmail(e.target.value)} placeholder="customer@email.com" className="flex-1 text-xs px-3 py-1.5 rounded-md" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white", outline: "none" }} />
                        <Button size="sm" onClick={() => {
                          if (!sendReportEmail) { toast.error("Enter a customer email"); return; }
                          generateCompletionReport.mutate({ jobId, sendEmail: true, customerEmail: sendReportEmail }, {
                            onSuccess: (res) => { setShowSendReport(false); toast.success(res.sent ? "Report sent to client" : "Report generated (email not sent)"); }
                          });
                        }} disabled={generateCompletionReport.isPending} style={{ background: "#22c55e", color: "white" }}>
                          {generateCompletionReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowSendReport(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-2">
                  {hasQuoteEngine ? (
                    <>
                      <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Generate a client-facing report showing what was done, variations, and before/after photos.</p>
                      <Button onClick={() => generateCompletionReport.mutate({ jobId })} disabled={generateCompletionReport.isPending} style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}>
                        {generateCompletionReport.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                        Generate Completion Report
                      </Button>
                    </>
                  ) : (
                    <div className="w-full rounded-xl p-4 text-center space-y-3" style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)" }}>
                      <div className="text-2xl">📋</div>
                      <p className="text-sm font-semibold text-white">Completion Reports</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Send professional completion reports with before/after photos directly to your customers. Included in the Quote Engine add-on.</p>
                      <QuoteEngineUpgradeButton size="sm" label="Unlock for $97/mo" />
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* ─── TAB 4: Forms & Certificates ─── */}
          <TabsContent value="forms" className="space-y-4 mt-4">
            {/* Invoice Blocking Banner */}
            {formComplianceQuery.data && !formComplianceQuery.data.canInvoice && (
              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#ef4444" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>Invoice Blocked</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Complete these forms before invoicing: {formComplianceQuery.data.missingTemplateNames.join(", ")}
                  </p>
                </div>
              </div>
            )}
            {formComplianceQuery.data?.canInvoice && formComplianceQuery.data.requiredTemplateIds.length > 0 && (
              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}>
                <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#4ade80" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>All Required Forms Completed</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>This job is ready to invoice.</p>
                </div>
              </div>
            )}

            {/* Required Forms Selector */}
            <SectionCard title="Required Forms" action={
              <span className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Must complete before invoicing</span>
            }>
              {formTemplatesQuery.data && formTemplatesQuery.data.length > 0 ? (
                <div className="space-y-2">
                  {formTemplatesQuery.data.map((t: any) => {
                    const requiredIds = (formComplianceQuery.data?.requiredTemplateIds ?? []) as number[];
                    const isRequired = requiredIds.includes(t.id);
                    const isCompleted = (formComplianceQuery.data?.completedTemplateIds ?? []).includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-white/5">
                        <input
                          type="checkbox"
                          checked={isRequired}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...requiredIds, t.id]
                              : requiredIds.filter((id: number) => id !== t.id);
                            updateRequiredForms.mutate({ jobId, requiredFormTemplateIds: newIds });
                          }}
                          className="w-4 h-4 rounded accent-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white">{t.name}</p>
                          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{t.category}</p>
                        </div>
                        {isRequired && isCompleted && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>Done</span>
                        )}
                        {isRequired && !isCompleted && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>Pending</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>No form templates available. Create templates in Forms & Certs.</p>
              )}
            </SectionCard>

            {/* Submitted Forms */}
            <SectionCard title="Job Forms" action={
              <Button
                variant="ghost" size="sm"
                className="text-xs gap-1"
                style={{ color: "#F5A623" }}
                onClick={() => window.open(`/portal/forms?jobId=${jobId}`, "_blank")}
              >
                <Plus className="w-3.5 h-3.5" /> New Form
              </Button>
            }>
              {jobFormsQuery.isLoading && (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} /></div>
              )}
              {jobFormsQuery.data && jobFormsQuery.data.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.4)" }}>No forms submitted for this job yet.</p>
              )}
              {jobFormsQuery.data && jobFormsQuery.data.length > 0 && (
                <div className="space-y-2">
                  {jobFormsQuery.data.map((sub: any) => (
                    <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: sub.status === "completed" ? "#4ade80" : "#F5A623" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{sub.title}</p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {sub.status === "completed" ? `Completed ${sub.completedAt ? new Date(sub.completedAt).toLocaleDateString("en-AU") : ""}` : "Draft"}
                          {sub.submittedBy && ` · ${sub.submittedBy}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: sub.status === "completed" ? "rgba(74,222,128,0.15)" : "rgba(245,166,35,0.15)",
                          color: sub.status === "completed" ? "#4ade80" : "#F5A623",
                        }}>{sub.status === "completed" ? "Completed" : "Draft"}</span>
                        {sub.pdfUrl && (
                          <a href={sub.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/5">
                            <FileText className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

        </Tabs>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* ── MODALS (always rendered, outside tabs) ── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* Mark Complete Modal */}
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
                  <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={3} placeholder="Describe what was completed..."
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Variations from quote (optional)</label>
                  <textarea value={variationNotes} onChange={e => setVariationNotes(e.target.value)} rows={2} placeholder="Any changes from the original quote..."
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Actual hours</label>
                    <input type="number" value={actualHours} onChange={e => setActualHours(e.target.value)} placeholder="e.g. 3.5"
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Final value ($)</label>
                    <input type="number" value={actualValue} onChange={e => setActualValue(e.target.value)} placeholder="e.g. 850"
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => {
                  const input = {
                    id: jobId,
                    completionNotes: completionNotes || undefined,
                    variationNotes: variationNotes || undefined,
                    actualHours: actualHours || undefined,
                    actualValue: actualValue ? parseFloat(actualValue) : undefined,
                  };
                  offlineAware("portal.markJobComplete", input, () => markComplete.mutate(input));
                }} disabled={markComplete.isPending} className="flex-1" style={{ background: "#4ade80", color: "#0F1F3D" }}>
                  {markComplete.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Complete Job
                </Button>
                <Button variant="ghost" onClick={() => setShowCompleteModal(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Mark Paid Modal */}
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
                  <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Payment method</label>
                  <select value={paidMethod} onChange={e => setPaidMethod(e.target.value as typeof paidMethod)}
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="stripe">Card (Stripe)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => {
                  const cents = Math.round(parseFloat(paidAmount) * 100);
                  if (!cents || isNaN(cents)) { toast.error("Enter a valid amount"); return; }
                  const input = { jobId, paymentMethod: paidMethod, amountCents: cents };
                  offlineAware("portal.markJobPaid", input, () => markPaid.mutate(input));
                }} disabled={markPaid.isPending} className="flex-1" style={{ background: "#4ade80", color: "#0F1F3D" }}>
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
