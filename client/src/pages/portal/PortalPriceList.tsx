/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalPriceList — Manage the tradie's personal price catalogue.
 *
 * Tradies can add, edit, and delete items from their price list.
 * They can also bulk-import from a CSV (Xero export, Tradify export, or custom).
 * The AI uses this list when generating quotes from voice recordings.
 *
 * Categories: Labour | Materials | Call-Out / Travel | Subcontractor | Other
 */
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
import {
  Plus, Pencil, Trash2, Loader2, Tag, DollarSign, Info,
  Upload, FileText, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { usePortalRole } from "@/hooks/usePortalRole";
import { ViewerBanner } from "@/components/portal/ViewerBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = "labour" | "materials" | "call_out" | "subcontractor" | "other";

interface PriceListItem {
  id: number;
  clientId: number;
  name: string;
  description: string | null;
  unit: string;
  category: Category;
  costCents: number | null;
  sellCents: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<Category, string> = {
  labour: "Labour",
  materials: "Materials",
  call_out: "Call-Out / Travel",
  subcontractor: "Subcontractor",
  other: "Other",
};

const CATEGORY_COLORS: Record<Category, string> = {
  labour: "#2563EB",
  materials: "#059669",
  call_out: "#D97706",
  subcontractor: "#7C3AED",
  other: "#6B7280",
};

function centsToDisplay(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function displayToCents(val: string): number | null {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function calcMargin(costCents: number | null, sellCents: number): string {
  if (!costCents || costCents <= 0) return "—";
  const margin = ((sellCents - costCents) / sellCents) * 100;
  return `${margin.toFixed(0)}%`;
}

// ── Empty form state ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  description: "",
  unit: "each",
  category: "labour" as Category,
  costDisplay: "",
  sellDisplay: "",
};

// ── CSV Import Modal ──────────────────────────────────────────────────────────

interface ImportResult {
  imported: number;
  skipped: Array<{ row: number; reason: string }>;
}

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function CsvImportModal({ open, onClose, onImported }: CsvImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importMutation = trpc.priceList.importCsv.useMutation({
    onSuccess: (data) => {
      setResult(data);
      if (data.imported > 0) onImported();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50_000) {
      toast.error("File too large — max 50 KB. Split your CSV into smaller batches.");
      return;
    }
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText((ev.target?.result as string) ?? null);
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!csvText) { toast.error("Please select a CSV file first."); return; }
    importMutation.mutate({ csv: csvText, replace: replaceMode });
  }

  function handleClose() {
    setCsvText(null);
    setFileName(null);
    setResult(null);
    setReplaceMode(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-lg mx-auto"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-400" />
            Import Price List from CSV
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            {/* Format hint */}
            <div
              className="rounded-lg p-3 text-xs space-y-1"
              style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)", color: "rgba(255,255,255,0.7)" }}
            >
              <p className="font-semibold text-amber-400 mb-1">Accepted CSV formats</p>
              <p>Works with <strong>Xero</strong>, <strong>Tradify</strong>, <strong>ServiceM8</strong>, or any spreadsheet export.</p>
              <p>Required columns: <code className="bg-white/10 px-1 rounded">Name</code> and <code className="bg-white/10 px-1 rounded">Price</code> (or Sell Price / Rate / Amount).</p>
              <p>Optional: <code className="bg-white/10 px-1 rounded">Unit</code>, <code className="bg-white/10 px-1 rounded">Cost</code>, <code className="bg-white/10 px-1 rounded">Category</code>, <code className="bg-white/10 px-1 rounded">Notes</code>.</p>
              <p className="text-gray-500">Max 200 rows per import.</p>
            </div>

            {/* File picker */}
            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Select CSV file</Label>
              <div
                className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 cursor-pointer text-center"
                style={{ borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => fileInputRef.current?.click()}
              >
                {fileName ? (
                  <>
                    <FileText className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-white text-sm font-medium">{fileName}</p>
                    <p className="text-gray-400 text-xs mt-1">Click to change file</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-gray-300 text-sm">Click to select a CSV file</p>
                    <p className="text-gray-500 text-xs mt-1">or drag and drop</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Replace mode toggle */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={replaceMode}
                onChange={(e) => setReplaceMode(e.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <div>
                <p className="text-sm text-white font-medium">Replace existing price list</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  If checked, all current items will be removed before importing. Otherwise, new items are added alongside existing ones.
                </p>
              </div>
            </label>

            {replaceMode && (
              <div
                className="flex items-start gap-2 rounded-lg p-3 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>This will permanently delete all existing price list items before importing. This cannot be undone.</span>
              </div>
            )}
          </div>
        ) : (
          /* Import result summary */
          <div className="space-y-4 py-2">
            <div
              className="flex items-center gap-3 rounded-xl p-4"
              style={{ background: result.imported > 0 ? "rgba(5,150,105,0.1)" : "rgba(245,166,35,0.08)", border: `1px solid ${result.imported > 0 ? "rgba(5,150,105,0.3)" : "rgba(245,166,35,0.3)"}` }}
            >
              <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: result.imported > 0 ? "#059669" : "#F5A623" }} />
              <div>
                <p className="font-semibold text-white">
                  {result.imported} item{result.imported !== 1 ? "s" : ""} imported successfully
                </p>
                {result.skipped.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {result.skipped.length} row{result.skipped.length !== 1 ? "s" : ""} skipped
                  </p>
                )}
              </div>
            </div>

            {result.skipped.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Skipped rows</p>
                <div
                  className="rounded-lg overflow-hidden text-xs divide-y"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {result.skipped.map((s) => (
                    <div key={s.row} className="flex items-start gap-2 px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <span className="text-gray-500 shrink-0">Row {s.row}</span>
                      <span className="text-gray-300">{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "white", background: "transparent" }}
          >
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!csvText || importMutation.isPending}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {importMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Importing…</>
              ) : (
                <><Upload className="w-4 h-4 mr-1" /> Import</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PortalPriceList() {
  const { canWrite } = usePortalRole();
  const utils = trpc.useUtils();

  const { data: items = [], isLoading } = trpc.priceList.list.useQuery();

  const createMutation = trpc.priceList.create.useMutation({
    onSuccess: () => {
      utils.priceList.list.invalidate();
      setShowModal(false);
      toast.success("Item added to price list");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.priceList.update.useMutation({
    onSuccess: () => {
      utils.priceList.list.invalidate();
      setShowModal(false);
      toast.success("Item updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.priceList.delete.useMutation({
    onSuccess: () => {
      utils.priceList.list.invalidate();
      toast.success("Item removed");
    },
    onError: (e) => toast.error(e.message),
  });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function openCreate() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(item: PriceListItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      unit: item.unit,
      category: item.category,
      costDisplay: centsToDisplay(item.costCents),
      sellDisplay: centsToDisplay(item.sellCents),
    });
    setShowModal(true);
  }

  function handleSave() {
    const sellCents = displayToCents(form.sellDisplay);
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!sellCents || sellCents <= 0) { toast.error("Sell price must be greater than $0"); return; }
    const costCents = form.costDisplay ? displayToCents(form.costDisplay) : null;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      unit: form.unit.trim() || "each",
      category: form.category,
      costCents: costCents ?? undefined,
      sellCents,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // Group items by category for display
  const grouped = (items as PriceListItem[]).reduce<Record<Category, PriceListItem[]>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<Category, PriceListItem[]>,
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <PortalLayout>
      <div className="sm:max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Price List</h1>
            <p className="text-sm text-gray-400">
              Your personal catalogue of services, materials, and rates. The AI uses this when generating quotes from voice recordings.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              variant="outline"
              onClick={() => setShowImport(true)}
              disabled={!canWrite}
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", background: "transparent" }}
            >
              <Upload className="w-4 h-4 mr-1" />
              Import CSV
            </Button>
            <Button
              onClick={openCreate}
              disabled={!canWrite}
              style={{ background: canWrite ? "#F5A623" : "rgba(245,166,35,0.3)", color: "#0F1F3D" }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </div>
        </div>
        {!canWrite && <ViewerBanner />}

        {/* AI context notice */}
        <div
          className="flex items-start gap-3 rounded-xl border p-4 mb-6 text-sm"
          style={{ borderColor: "rgba(245,166,35,0.3)", background: "rgba(245,166,35,0.05)", color: "#F5A623" }}
        >
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>AI-powered quoting:</strong> When you record a voice quote, the AI will automatically match services and materials to your price list and pre-fill the correct sell prices. No more manually entering rates every time.
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-xl border p-12 text-center"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <Tag className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">No items yet</h3>
            <p className="text-gray-400 text-sm mb-4">
              Add your standard rates or import from a CSV — the AI will use them when building quotes.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowImport(true)}
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", background: "transparent" }}
              >
                <Upload className="w-4 h-4 mr-1" />
                Import CSV
              </Button>
              <Button onClick={openCreate} style={{ background: "#F5A623", color: "#0F1F3D" }}>
                <Plus className="w-4 h-4 mr-1" />
                Add First Item
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => {
              const catItems = grouped[cat];
              if (!catItems || catItems.length === 0) return null;
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: `${CATEGORY_COLORS[cat]}22`, color: CATEGORY_COLORS[cat] }}
                    >
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-xs text-gray-500">{catItems.length} item{catItems.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Items table */}
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    {/* Table header */}
                    <div
                      className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="col-span-4">Name</div>
                      <div className="col-span-1">Unit</div>
                      <div className="col-span-2 text-right">Cost</div>
                      <div className="col-span-2 text-right">Sell</div>
                      <div className="col-span-1 text-right">Margin</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {/* Rows */}
                    {catItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm"
                        style={{
                          borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                          background: "rgba(255,255,255,0.01)",
                        }}
                      >
                        <div className="col-span-4">
                          <div className="text-white font-medium truncate">{item.name}</div>
                          {item.description && (
                            <div className="text-gray-500 text-xs truncate mt-0.5">{item.description}</div>
                          )}
                        </div>
                        <div className="col-span-1 text-gray-400 text-xs">{item.unit}</div>
                        <div className="col-span-2 text-right text-gray-400">
                          {item.costCents ? `$${centsToDisplay(item.costCents)}` : "—"}
                        </div>
                        <div className="col-span-2 text-right text-white font-semibold">
                          ${centsToDisplay(item.sellCents)}
                        </div>
                        <div className="col-span-1 text-right text-xs" style={{ color: "#059669" }}>
                          {calcMargin(item.costCents, item.sellCents)}
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            disabled={!canWrite}
                            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove "${item.name}" from your price list?`)) {
                                deleteMutation.mutate({ id: item.id });
                              }
                            }}
                            disabled={!canWrite}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit modal ─────────────────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent
          className="w-[calc(100vw-2rem)] max-w-md mx-auto"
          style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingItem ? "Edit Item" : "Add Price List Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <Label className="text-gray-300 text-sm mb-1 block">Item Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Replace tap washer"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
              />
            </div>

            {/* Category + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-sm mb-1 block">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                >
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
                    <option key={cat} value={cat} style={{ background: "#0F1F3D" }}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-gray-300 text-sm mb-1 block">Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="each, hr, m², etc."
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                />
              </div>
            </div>

            {/* Cost + Sell */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-sm mb-1 block">
                  Cost Price (optional)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
                  <Input
                    inputMode="decimal"
                    value={form.costDisplay}
                    onChange={(e) => setForm({ ...form, costDisplay: e.target.value })}
                    placeholder="0.00"
                    className="pl-7"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">What you pay (for margin calc)</p>
              </div>
              <div>
                <Label className="text-gray-300 text-sm mb-1 block">
                  Sell Price *
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
                  <Input
                    inputMode="decimal"
                    value={form.sellDisplay}
                    onChange={(e) => setForm({ ...form, sellDisplay: e.target.value })}
                    placeholder="0.00"
                    className="pl-7"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">What you charge the customer</p>
              </div>
            </div>

            {/* Live margin preview */}
            {form.sellDisplay && form.costDisplay && (
              <div
                className="rounded-lg px-3 py-2 text-sm flex items-center justify-between"
                style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)" }}
              >
                <span className="text-gray-300">Margin</span>
                <span className="font-semibold" style={{ color: "#059669" }}>
                  {calcMargin(displayToCents(form.costDisplay), displayToCents(form.sellDisplay) ?? 0)}
                </span>
              </div>
            )}

            {/* Description */}
            <div>
              <Label className="text-gray-300 text-sm mb-1 block">Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Extra context for the AI (e.g. 'Includes fitting and 10-year warranty')"
                rows={2}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "white", resize: "none" }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "white", background: "transparent" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CSV Import modal ──────────────────────────────────────────────────── */}
      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => utils.priceList.list.invalidate()}
      />
    </PortalLayout>
  );
}
