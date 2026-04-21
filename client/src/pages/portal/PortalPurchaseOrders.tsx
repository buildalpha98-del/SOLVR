/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Sprint 4 — Purchase Orders page (Mobile-First)
 * Tabs: Suppliers | Purchase Orders
 * Supplier CRUD, PO creation (manual or from job), PDF generation, email to supplier
 *
 * Mobile: card-based layout, full-width stacked buttons, full-width modals,
 * vertical sections in PO detail, pb-24 for tab bar clearance.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import AddressAutocomplete from "@/components/portal/AddressAutocomplete";
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
import {
  Plus, Search, Building2, FileText, Send, Download, Trash2, Package, Edit,
  ChevronRight, MapPin,
} from "lucide-react";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  acknowledged: "bg-amber-100 text-amber-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function PortalPurchaseOrders() {
  const [tab, setTab] = useState<"suppliers" | "orders">("orders");
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Manage suppliers and send purchase orders</p>
      </div>

      {/* Tabs — full width on mobile */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {(["orders", "suppliers"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "orders" ? "Purchase Orders" : "Suppliers"}
          </button>
        ))}
      </div>

      {/* Search — full width on mobile */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder={`Search ${tab}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 sm:max-w-sm"
        />
      </div>

      {tab === "suppliers" ? (
        <SuppliersTab search={search} />
      ) : (
        <OrdersTab search={search} />
      )}
    </div>
  );
}

// ─── Suppliers Tab ─────────────────────────────────────────────────────────
function SuppliersTab({ search }: { search: string }) {
  const { data: suppliers, isLoading } = trpc.purchaseOrders.listSuppliers.useQuery();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!suppliers) return [];
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.contactName && s.contactName.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  const deactivate = trpc.purchaseOrders.deactivateSupplier.useMutation({
    onSuccess: () => { utils.purchaseOrders.listSuppliers.invalidate(); hapticWarning(); toast.success("Supplier removed"); },
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading suppliers...</div>;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> Add Supplier
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No suppliers yet</p>
          <p className="text-sm mt-1">Add your first supplier to start creating purchase orders</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4">
              {/* Supplier info */}
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-gray-900 text-[15px] block truncate">{s.name}</span>
                    {s.abn && <span className="text-xs text-gray-400 block mt-0.5">ABN: {s.abn}</span>}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-4 gap-0.5 mt-2 text-sm text-gray-500">
                  {s.contactName && <span className="truncate">{s.contactName}</span>}
                  {s.email && <span className="truncate">{s.email}</span>}
                  {s.phone && <span>{s.phone}</span>}
                </div>
                {s.paymentTerms && (
                  <span className="text-xs text-gray-400 mt-1.5 block">Terms: {s.paymentTerms}</span>
                )}
              </div>
              {/* Actions — stacked on mobile */}
              <div className="flex gap-2 mt-3 sm:mt-2">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setEditId(s.id)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  <span className="sm:hidden">Edit</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none text-red-500 hover:text-red-700"
                  onClick={() => { if (confirm("Remove this supplier?")) deactivate.mutate({ id: s.id }); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  <span className="sm:hidden">Remove</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <SupplierDialog onClose={() => setShowAdd(false)} />
      )}
      {editId && (
        <SupplierDialog supplierId={editId} onClose={() => setEditId(null)} />
      )}
    </>
  );
}

// ─── Supplier Dialog (full-width on mobile) ───────────────────────────────
function SupplierDialog({ supplierId, onClose }: { supplierId?: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: existing } = trpc.purchaseOrders.getSupplier.useQuery(
    { id: supplierId! },
    { enabled: !!supplierId }
  );

  const [form, setForm] = useState({
    name: "", contactName: "", email: "", phone: "", abn: "", address: "", paymentTerms: "", notes: "",
  });

  // Populate form when editing
  const [populated, setPopulated] = useState(false);
  if (existing && !populated) {
    setForm({
      name: existing.name,
      contactName: existing.contactName ?? "",
      email: existing.email ?? "",
      phone: existing.phone ?? "",
      abn: existing.abn ?? "",
      address: existing.address ?? "",
      paymentTerms: existing.paymentTerms ?? "",
      notes: existing.notes ?? "",
    });
    setPopulated(true);
  }

  const createMut = trpc.purchaseOrders.createSupplier.useMutation({
    onSuccess: () => { utils.purchaseOrders.listSuppliers.invalidate(); hapticSuccess(); toast.success("Supplier added"); onClose(); },
  });
  const updateMut = trpc.purchaseOrders.updateSupplier.useMutation({
    onSuccess: () => { utils.purchaseOrders.listSuppliers.invalidate(); hapticSuccess(); toast.success("Supplier updated"); onClose(); },
  });

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Supplier name is required"); return; }
    const data = {
      name: form.name.trim(),
      contactName: form.contactName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      abn: form.abn || undefined,
      address: form.address || undefined,
      paymentTerms: form.paymentTerms || undefined,
      notes: form.notes || undefined,
    };
    if (supplierId) {
      updateMut.mutate({ id: supplierId, ...data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplierId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Company name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Contact person" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="ABN" value={form.abn} onChange={e => setForm(f => ({ ...f, abn: e.target.value }))} />
            <Input placeholder="Payment terms (e.g. Net 30)" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} />
          </div>
          <Input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full sm:w-auto">
            {supplierId ? "Save Changes" : "Add Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Orders Tab ────────────────────────────────────────────────────────────
function OrdersTab({ search }: { search: string }) {
  const { data: orders, isLoading } = trpc.purchaseOrders.list.useQuery();
  const { data: suppliers } = trpc.purchaseOrders.listSuppliers.useQuery();
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);

  const supplierMap = useMemo(() => {
    const m = new Map<number, string>();
    suppliers?.forEach(s => m.set(s.id, s.name));
    return m;
  }, [suppliers]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.poNumber.toLowerCase().includes(q) ||
      (supplierMap.get(o.supplierId) ?? "").toLowerCase().includes(q)
    );
  }, [orders, search, supplierMap]);

  const genPdf = trpc.purchaseOrders.generatePdf.useMutation({
    onSuccess: (data) => { window.open(data.pdfUrl, "_blank"); toast.success("PDF generated"); },
    onError: (err) => toast.error(err.message),
  });

  const sendToSupplier = trpc.purchaseOrders.sendToSupplier.useMutation({
    onSuccess: (data) => {
      utils.purchaseOrders.list.invalidate();
      toast.success(`PO sent to ${data.sentTo}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading purchase orders...</div>;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} size="sm" disabled={!suppliers?.length} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> New Purchase Order
        </Button>
      </div>

      {!suppliers?.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Add at least one supplier before creating purchase orders.
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No purchase orders yet</p>
          <p className="text-sm mt-1">Create your first PO to track material costs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <div
              key={o.id}
              className="bg-white border border-gray-200 rounded-lg p-4 active:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setViewId(o.id)}
            >
              {/* Card header: PO number + status */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-gray-900 text-[15px]">{o.poNumber}</span>
                    <Badge className={`${STATUS_COLORS[o.status] ?? ""} text-[11px]`}>{o.status}</Badge>
                  </div>
                  <span className="text-sm text-gray-500 block mt-0.5 truncate">
                    {supplierMap.get(o.supplierId) ?? "Unknown supplier"}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
              </div>

              {/* Card meta: total + date */}
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="font-semibold text-gray-700">{fmt(o.totalCents)}</span>
                <span>{new Date(o.createdAt).toLocaleDateString("en-AU")}</span>
                {o.sentAt && <span className="text-green-600">Sent {new Date(o.sentAt).toLocaleDateString("en-AU")}</span>}
              </div>

              {/* Card actions — stacked on mobile */}
              <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none text-[13px]"
                  onClick={() => genPdf.mutate({ id: o.id })}
                  disabled={genPdf.isPending}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
                </Button>
                {o.status === "draft" && (
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none text-[13px]"
                    onClick={() => sendToSupplier.mutate({ id: o.id })}
                    disabled={sendToSupplier.isPending}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Send
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreatePODialog onClose={() => setShowCreate(false)} />}
      {viewId && <ViewPODialog poId={viewId} onClose={() => setViewId(null)} />}
    </>
  );
}

// ─── Create PO Dialog (full-width on mobile) ─────────────────────────────
function CreatePODialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: suppliers } = trpc.purchaseOrders.listSuppliers.useQuery();
  const [supplierId, setSupplierId] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [addressPresetKey, setAddressPresetKey] = useState<string>("");
  const [requiredByDate, setRequiredByDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: "1.00", unit: "each", unitPriceCents: "" }]);
  const { data: addressPresets } = trpc.purchaseOrders.deliveryAddressPresets.useQuery();

  const createMut = trpc.purchaseOrders.create.useMutation({
    onSuccess: (data) => {
      utils.purchaseOrders.list.invalidate();
      toast.success(`${data.poNumber} created`);
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const addItem = () => setItems(prev => [...prev, { description: "", quantity: "1.00", unit: "each", unitPriceCents: "" }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const totalCents = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPriceCents) || 0;
    return sum + Math.round(qty * price * 100);
  }, 0);

  const handleCreate = () => {
    if (!supplierId) { toast.error("Select a supplier"); return; }
    if (items.every(i => !i.description.trim())) { toast.error("Add at least one item"); return; }
    createMut.mutate({
      supplierId: parseInt(supplierId),
      deliveryAddress: deliveryAddress || undefined,
      requiredByDate: requiredByDate || undefined,
      notes: notes || undefined,
      items: items.filter(i => i.description.trim()).map(i => ({
        description: i.description.trim(),
        quantity: i.quantity || "1.00",
        unit: i.unit || "each",
        unitPriceCents: i.unitPriceCents ? Math.round(parseFloat(i.unitPriceCents) * 100) : undefined,
      })),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Supplier *</label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers?.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Delivery address with presets */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              <MapPin className="h-3.5 w-3.5 inline mr-1" />Delivery address
            </label>
            {addressPresets && addressPresets.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {addressPresets.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setAddressPresetKey(p.key);
                      if (p.key !== "custom") setDeliveryAddress(p.address);
                      else setDeliveryAddress("");
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      addressPresetKey === p.key
                        ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <AddressAutocomplete
              value={deliveryAddress}
              onChange={(val: string) => { setDeliveryAddress(val); setAddressPresetKey("custom"); }}
              placeholder="Enter delivery address"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Required by</label>
            <Input type="date" value={requiredByDate} onChange={e => setRequiredByDate(e.target.value)} />
          </div>

          {/* Line items — mobile-friendly stacked layout */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Line Items</label>
              <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add</Button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={e => updateItem(idx, "description", e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={e => updateItem(idx, "quantity", e.target.value)}
                    />
                    <Input
                      placeholder="Unit"
                      value={item.unit}
                      onChange={e => updateItem(idx, "unit", e.target.value)}
                    />
                    <Input
                      placeholder="Price $"
                      value={item.unitPriceCents}
                      onChange={e => updateItem(idx, "unitPriceCents", e.target.value)}
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(idx)}
                      className="text-red-400 hover:text-red-600 w-full sm:w-auto text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove item
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-right mt-2 text-sm font-semibold text-gray-700">
              Total: {fmt(totalCents)}
            </div>
          </div>

          <Textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleCreate} disabled={createMut.isPending} className="w-full sm:w-auto">Create PO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── View PO Dialog (full-width on mobile, vertical sections) ─────────────
function ViewPODialog({ poId, onClose }: { poId: number; onClose: () => void }) {
  const { data: po, isLoading } = trpc.purchaseOrders.get.useQuery({ id: poId });
  const { data: suppliers } = trpc.purchaseOrders.listSuppliers.useQuery();
  const utils = trpc.useUtils();

  const supplierName = suppliers?.find(s => s.id === po?.supplierId)?.name ?? "Unknown";

  const genPdf = trpc.purchaseOrders.generatePdf.useMutation({
    onSuccess: (data) => { window.open(data.pdfUrl, "_blank"); toast.success("PDF generated"); },
  });

  const sendToSupplier = trpc.purchaseOrders.sendToSupplier.useMutation({
    onSuccess: (data) => {
      utils.purchaseOrders.list.invalidate();
      utils.purchaseOrders.get.invalidate({ id: poId });
      toast.success(`Sent to ${data.sentTo}`);
    },
  });

  const updateStatus = trpc.purchaseOrders.updateStatus.useMutation({
    onSuccess: () => {
      utils.purchaseOrders.list.invalidate();
      utils.purchaseOrders.get.invalidate({ id: poId });
      toast.success("Status updated");
    },
  });

  if (isLoading || !po) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono">{po.poNumber}</span>
            <Badge className={STATUS_COLORS[po.status] ?? ""}>{po.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* PO details — stacked vertically on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 block text-xs mb-0.5">Supplier</span>
              <span className="font-medium">{supplierName}</span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 block text-xs mb-0.5">Created</span>
              <span className="font-medium">{new Date(po.createdAt).toLocaleDateString("en-AU")}</span>
            </div>
            {po.deliveryAddress && (
              <div className="sm:col-span-2 bg-gray-50 rounded-lg p-3">
                <span className="text-gray-500 block text-xs mb-0.5">Delivery Address</span>
                <span className="font-medium">{po.deliveryAddress}</span>
              </div>
            )}
          </div>

          {/* Items — card-based instead of table on mobile */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Items</h4>

            {/* Desktop table (hidden on mobile) */}
            <div className="hidden sm:block border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(po as any).items?.map((item: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-center">{item.quantity} {item.unit}</td>
                      <td className="px-3 py-2 text-right">{item.lineTotalCents ? fmt(item.lineTotalCents) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-2">
              {(po as any).items?.map((item: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 text-[14px]">{item.description}</p>
                  <div className="flex justify-between mt-1 text-sm text-gray-500">
                    <span>{item.quantity} {item.unit}</span>
                    <span className="font-semibold text-gray-700">{item.lineTotalCents ? fmt(item.lineTotalCents) : "—"}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-right mt-2 font-semibold text-[15px]">{fmt(po.totalCents)}</div>
          </div>

          {po.notes && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">{po.notes}</div>
          )}

          {/* Status update */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Update Status</label>
            <Select value={po.status} onValueChange={(v) => updateStatus.mutate({ id: po.id, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft", "sent", "acknowledged", "received", "cancelled"].map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Close</Button>
          <Button variant="outline" onClick={() => genPdf.mutate({ id: po.id })} disabled={genPdf.isPending} className="w-full sm:w-auto">
            <FileText className="h-4 w-4 mr-1.5" /> Download PDF
          </Button>
          {po.status === "draft" && (
            <Button onClick={() => sendToSupplier.mutate({ id: po.id })} disabled={sendToSupplier.isPending} className="w-full sm:w-auto">
              <Send className="h-4 w-4 mr-1.5" /> Send to Supplier
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
