/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Per-customer asset register. Mounted on the customer detail page.
 *
 * Lists each piece of equipment SOLVR knows about for the customer,
 * with one-tap "Mark serviced today" shortcut + Edit + Decommission.
 * Sprint 4.2 will read nextServiceDueAt from these rows to auto-create
 * service-due jobs.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { getSolvrOrigin } from "@/const";
import { compressImage } from "@/lib/imageCompression";
import {
  Wrench, Plus, Camera, Loader2, Calendar, ShieldCheck,
  X, Edit2, Trash2, CheckCircle2, AlertTriangle, ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { WriteGuard } from "@/components/portal/ViewerBanner";

interface Asset {
  id: string;
  assetType: string;
  label: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  photoUrl: string | null;
  installedAt: string | null;
  warrantyUntil: string | null;
  lastServicedAt: string | null;
  serviceIntervalMonths: number | null;
  nextServiceDueAt: string | null;
  notes: string | null;
  status: "active" | "decommissioned";
}

/** Common Australian asset types for the dropdown — free-form fallback at the top */
const ASSET_TYPE_PRESETS = [
  { value: "hot_water", label: "Hot water system" },
  { value: "hvac", label: "Air conditioner / split system" },
  { value: "ducted_hvac", label: "Ducted heating/cooling" },
  { value: "switchboard", label: "Switchboard" },
  { value: "solar_inverter", label: "Solar inverter" },
  { value: "solar_battery", label: "Solar battery" },
  { value: "pool_pump", label: "Pool pump / heater" },
  { value: "gate_motor", label: "Gate motor" },
  { value: "garage_door", label: "Garage door opener" },
  { value: "smoke_alarm", label: "Smoke alarm" },
  { value: "septic", label: "Septic / pump-out" },
  { value: "fire", label: "Fire equipment" },
  { value: "other", label: "Other equipment" },
];

function assetTypeLabel(value: string): string {
  return ASSET_TYPE_PRESETS.find(t => t.value === value)?.label ?? value;
}

export function CustomerAssetsSection({ customerId, customerName }: { customerId: number; customerName: string }) {
  const utils = trpc.useUtils();
  const { data: assets, isLoading } = trpc.customerAssets.listByCustomer.useQuery(
    { customerId },
    { staleTime: 30_000, retry: 2 },
  );

  const [showAdd, setShowAdd] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const markServiced = trpc.customerAssets.markServiced.useMutation({
    onSuccess: (res) => {
      hapticSuccess();
      utils.customerAssets.listByCustomer.invalidate({ customerId });
      toast.success(
        res.nextServiceDueAt
          ? `Service logged. Next due ${new Date(res.nextServiceDueAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}.`
          : "Service logged.",
      );
    },
    onError: (err) => { hapticWarning(); toast.error(err.message ?? "Couldn't log service."); },
  });

  const markDecommissioned = trpc.customerAssets.markDecommissioned.useMutation({
    onSuccess: () => {
      utils.customerAssets.listByCustomer.invalidate({ customerId });
      toast.success("Asset decommissioned.");
    },
    onError: (err) => toast.error(err.message ?? "Couldn't update."),
  });

  const deleteAsset = trpc.customerAssets.delete.useMutation({
    onSuccess: () => {
      utils.customerAssets.listByCustomer.invalidate({ customerId });
      toast.success("Asset deleted.");
    },
    onError: (err) => toast.error(err.message ?? "Couldn't delete."),
  });

  const list = assets ?? [];
  const active = list.filter(a => a.status === "active");
  const decommissioned = list.filter(a => a.status === "decommissioned");

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4" style={{ color: "rgba(255,255,255,0.55)" }} />
          <h3 className="text-sm font-semibold text-white">Assets at this property</h3>
          {active.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
            >
              {active.length}
            </span>
          )}
        </div>
        <WriteGuard>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", minHeight: 32 }}
          >
            <Plus className="w-3 h-3" /> Add asset
          </button>
        </WriteGuard>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            No equipment registered yet.
          </p>
          <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Add HWS, AC units, switchboards, gates etc. so you can track service history + auto-schedule maintenance.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map(asset => (
            <AssetRow
              key={asset.id}
              asset={asset}
              onMarkServiced={() => markServiced.mutate({ id: asset.id })}
              onEdit={() => setEditingAsset(asset)}
              onDecommission={() => {
                if (window.confirm(`Decommission "${asset.label}"? It'll stay in history but no service reminders will fire.`)) {
                  markDecommissioned.mutate({ id: asset.id });
                }
              }}
              onDelete={() => {
                if (window.confirm(`Delete "${asset.label}" permanently? Service history will be lost.`)) {
                  deleteAsset.mutate({ id: asset.id });
                }
              }}
            />
          ))}

          {decommissioned.length > 0 && (
            <details className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <summary className="cursor-pointer text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {decommissioned.length} decommissioned asset{decommissioned.length === 1 ? "" : "s"}
              </summary>
              <div className="mt-2 space-y-2">
                {decommissioned.map(asset => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    onEdit={() => setEditingAsset(asset)}
                    onDelete={() => {
                      if (window.confirm(`Delete "${asset.label}" permanently? Service history will be lost.`)) {
                        deleteAsset.mutate({ id: asset.id });
                      }
                    }}
                    decommissioned
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {(showAdd || editingAsset) && (
        <AssetEditModal
          customerId={customerId}
          customerName={customerName}
          existing={editingAsset}
          onClose={() => { setShowAdd(false); setEditingAsset(null); }}
          onSaved={() => { utils.customerAssets.listByCustomer.invalidate({ customerId }); }}
        />
      )}
    </div>
  );
}

// ── Asset row ────────────────────────────────────────────────────────────────

function AssetRow({ asset, onMarkServiced, onEdit, onDecommission, onDelete, decommissioned = false }: {
  asset: Asset;
  onMarkServiced?: () => void;
  onEdit: () => void;
  onDecommission?: () => void;
  onDelete: () => void;
  decommissioned?: boolean;
}) {
  const dueSoon = !decommissioned && isDueSoon(asset.nextServiceDueAt);
  const overdue = !decommissioned && isOverdue(asset.nextServiceDueAt);

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg"
      style={{
        background: overdue ? "rgba(239,68,68,0.08)" : dueSoon ? "rgba(245,166,35,0.06)" : "rgba(255,255,255,0.04)",
        border: overdue ? "1px solid rgba(239,68,68,0.25)" : dueSoon ? "1px solid rgba(245,166,35,0.2)" : "1px solid rgba(255,255,255,0.06)",
        opacity: decommissioned ? 0.55 : 1,
      }}
    >
      {/* Photo */}
      <div
        className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {asset.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.photoUrl} alt={asset.label} className="w-full h-full object-cover" />
        ) : (
          <ImageOff className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-white truncate">{asset.label}</p>
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
            {assetTypeLabel(asset.assetType)}
          </span>
        </div>
        {(asset.make || asset.model || asset.serialNumber) && (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
            {[asset.make, asset.model, asset.serialNumber && `S/N ${asset.serialNumber}`].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
          {asset.lastServicedAt && (
            <span>
              <Calendar className="inline w-2.5 h-2.5 mr-0.5 -mt-0.5" />
              Last: {formatShortDate(asset.lastServicedAt)}
            </span>
          )}
          {asset.nextServiceDueAt && !decommissioned && (
            <span style={{ color: overdue ? "#ef4444" : dueSoon ? "#F5A623" : "rgba(255,255,255,0.5)" }}>
              {overdue ? <AlertTriangle className="inline w-2.5 h-2.5 mr-0.5 -mt-0.5" /> : null}
              {overdue ? "Overdue " : "Due "}
              {formatShortDate(asset.nextServiceDueAt)}
            </span>
          )}
          {asset.warrantyUntil && (
            <span>
              <ShieldCheck className="inline w-2.5 h-2.5 mr-0.5 -mt-0.5" />
              Warranty {formatShortDate(asset.warrantyUntil)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {onMarkServiced && (
          <WriteGuard>
            <button
              type="button"
              onClick={onMarkServiced}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold"
              style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", minHeight: 28 }}
              title="Mark serviced today"
            >
              <CheckCircle2 className="w-2.5 h-2.5" /> Serviced
            </button>
          </WriteGuard>
        )}
        <div className="flex items-center gap-1">
          <WriteGuard>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center justify-center w-7 h-7 rounded"
              style={{ color: "rgba(255,255,255,0.45)" }}
              aria-label="Edit asset"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </WriteGuard>
          {onDecommission && (
            <WriteGuard>
              <button
                type="button"
                onClick={onDecommission}
                className="flex items-center justify-center w-7 h-7 rounded"
                style={{ color: "rgba(255,255,255,0.4)" }}
                aria-label="Decommission asset"
                title="Decommission (keep history, no auto-jobs)"
              >
                <X className="w-3 h-3" />
              </button>
            </WriteGuard>
          )}
          <WriteGuard>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center justify-center w-7 h-7 rounded"
              style={{ color: "rgba(239,68,68,0.55)" }}
              aria-label="Delete asset"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </WriteGuard>
        </div>
      </div>
    </div>
  );
}

// ── Add / edit modal ────────────────────────────────────────────────────────

function AssetEditModal({ customerId, customerName, existing, onClose, onSaved }: {
  customerId: number;
  customerName: string;
  existing: Asset | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = existing !== null;
  const [form, setForm] = useState({
    assetType: existing?.assetType ?? "hot_water",
    label: existing?.label ?? "",
    make: existing?.make ?? "",
    model: existing?.model ?? "",
    serialNumber: existing?.serialNumber ?? "",
    photoUrl: existing?.photoUrl ?? "",
    installedAt: existing?.installedAt ?? "",
    warrantyUntil: existing?.warrantyUntil ?? "",
    lastServicedAt: existing?.lastServicedAt ?? "",
    serviceIntervalMonths: existing?.serviceIntervalMonths ?? 12,
    notes: existing?.notes ?? "",
  });
  const [uploading, setUploading] = useState(false);

  const create = trpc.customerAssets.create.useMutation({
    onSuccess: () => { hapticSuccess(); toast.success("Asset added."); onSaved(); onClose(); },
    onError: (err) => { hapticWarning(); toast.error(err.message ?? "Couldn't save."); },
  });
  const update = trpc.customerAssets.update.useMutation({
    onSuccess: () => { hapticSuccess(); toast.success("Asset updated."); onSaved(); onClose(); },
    onError: (err) => { hapticWarning(); toast.error(err.message ?? "Couldn't save."); },
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) {
      toast.error("Give the asset a label first.");
      return;
    }
    const base = {
      assetType: form.assetType,
      label: form.label.trim(),
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      serialNumber: form.serialNumber.trim() || null,
      photoUrl: form.photoUrl.trim() || null,
      installedAt: form.installedAt || null,
      warrantyUntil: form.warrantyUntil || null,
      lastServicedAt: form.lastServicedAt || null,
      serviceIntervalMonths: form.serviceIntervalMonths || null,
      notes: form.notes.trim() || null,
    };
    if (isEdit && existing) {
      update.mutate({ id: existing.id, ...base });
    } else {
      create.mutate({ customerId, ...base });
    }
  }, [form, isEdit, existing, customerId, create, update]);

  // Photo upload via the existing /api/portal/upload-photo endpoint
  const handleFile = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo too big — keep it under 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("photoType", "asset");
      const res = await fetch(`${getSolvrOrigin()}/api/portal/upload-photo`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Upload failed");
      }
      const { url } = await res.json() as { url: string };
      setForm(f => ({ ...f, photoUrl: url }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">{isEdit ? "Edit Asset" : "Add Asset"}</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              At {customerName}'s property
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 p-1 -m-1" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Photo */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.55)" }}>Photo (optional)</label>
            <div
              className="w-full h-36 rounded-lg flex items-center justify-center overflow-hidden relative"
              style={{ background: "rgba(0,0,0,0.25)", border: "1px dashed rgba(255,255,255,0.12)" }}
            >
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photoUrl} alt="Asset" className="w-full h-full object-cover" />
              ) : uploading ? (
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
              ) : (
                <Camera className="w-6 h-6" style={{ color: "rgba(255,255,255,0.3)" }} />
              )}
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            {form.photoUrl && (
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, photoUrl: "" }))}
                className="text-[10px] mt-1"
                style={{ color: "rgba(239,68,68,0.7)" }}
              >
                Remove photo
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.55)" }}>Label *</label>
            <input
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Master bedroom split, Main switchboard"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.55)" }}>Type</label>
            <select
              value={form.assetType}
              onChange={e => setForm(f => ({ ...f, assetType: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            >
              {ASSET_TYPE_PRESETS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Make" value={form.make} onChange={v => setForm(f => ({ ...f, make: v }))} placeholder="e.g. Daikin" />
            <Field label="Model" value={form.model} onChange={v => setForm(f => ({ ...f, model: v }))} placeholder="e.g. FTXM35Q" />
          </div>

          <Field label="Serial number" value={form.serialNumber} onChange={v => setForm(f => ({ ...f, serialNumber: v }))} placeholder="Optional" />

          <div className="grid grid-cols-2 gap-2">
            <DateField label="Installed" value={form.installedAt} onChange={v => setForm(f => ({ ...f, installedAt: v }))} />
            <DateField label="Warranty until" value={form.warrantyUntil} onChange={v => setForm(f => ({ ...f, warrantyUntil: v }))} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DateField label="Last serviced" value={form.lastServicedAt} onChange={v => setForm(f => ({ ...f, lastServicedAt: v }))} />
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.55)" }}>Service every (months)</label>
              <input
                type="number"
                inputMode="numeric"
                value={form.serviceIntervalMonths || ""}
                onChange={e => setForm(f => ({ ...f, serviceIntervalMonths: parseInt(e.target.value, 10) || 0 }))}
                placeholder="e.g. 12"
                min={1}
                max={120}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.55)" }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Fault history, customer preferences, location at property…"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>

          <button
            type="submit"
            disabled={create.isPending || update.isPending}
            className="w-full py-3 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: "#F5A623", color: "#0F1F3D", minHeight: 48 }}
          >
            {(create.isPending || update.isPending) ? <Loader2 className="inline w-4 h-4 animate-spin mr-1.5" /> : null}
            {isEdit ? "Save changes" : "Add asset"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Small field helpers ────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
      />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
      />
    </div>
  );
}

// ── Date helpers ────────────────────────────────────────────────────────────

function formatShortDate(yyyymmdd: string): string {
  return new Date(yyyymmdd).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(yyyymmdd: string | null): boolean {
  if (!yyyymmdd) return false;
  return new Date(yyyymmdd).getTime() < Date.now();
}

function isDueSoon(yyyymmdd: string | null): boolean {
  if (!yyyymmdd) return false;
  const ms = new Date(yyyymmdd).getTime() - Date.now();
  return ms > 0 && ms < 30 * 24 * 60 * 60 * 1000;
}
