/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalSubcontractors — Manage subcontractors, assign to jobs, log timesheets.
 * Costs auto-feed into the Job Costing report.
 */
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Hammer, Plus, Search, Phone, Mail, DollarSign,
  Loader2, UserX, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function PortalSubcontractors() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: subbies, isLoading } = trpc.subcontractors.list.useQuery();

  const createMut = trpc.subcontractors.create.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      setShowCreate(false);
      toast.success("Subcontractor added");
    },
    onError: () => toast.error("Failed to add subcontractor"),
  });

  const updateMut = trpc.subcontractors.update.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      setEditId(null);
      toast.success("Subcontractor updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const deactivateMut = trpc.subcontractors.deactivate.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      toast.success("Subcontractor deactivated");
    },
    onError: () => toast.error("Failed to deactivate"),
  });

  const filtered = (subbies ?? []).filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.trade ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Hammer className="w-6 h-6 text-amber-500" />
              Subcontractors
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your subbies, assign them to jobs, and track their hours
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="w-4 h-4" /> Add Subcontractor
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or trade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Hammer className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {subbies?.length === 0
                ? "No subcontractors yet. Add your first subbie to get started."
                : "No subcontractors match your search."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(sub => (
              <SubbieCard
                key={sub.id}
                sub={sub}
                onEdit={() => setEditId(sub.id)}
                onDeactivate={() => deactivateMut.mutate({ id: sub.id })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <SubbieFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Subcontractor"
        onSubmit={(data) => createMut.mutate(data)}
        isPending={createMut.isPending}
      />

      {/* Edit Dialog */}
      {editId && (
        <SubbieEditDialog
          id={editId}
          open={true}
          onClose={() => setEditId(null)}
          onSubmit={(data) => updateMut.mutate({ id: editId, ...data })}
          isPending={updateMut.isPending}
        />
      )}
    </PortalLayout>
  );
}

// ─── Subbie Card ─────────────────────────────────────────────────────────────
function SubbieCard({
  sub,
  onEdit,
  onDeactivate,
}: {
  sub: any;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Hammer className="w-5 h-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{sub.name}</h3>
              {!sub.isActive && (
                <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {sub.trade && <span>{sub.trade}</span>}
              {sub.abn && <span>ABN: {sub.abn}</span>}
              {sub.hourlyRateCents != null && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  ${(sub.hourlyRateCents / 100).toFixed(2)}/hr
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sub.phone && (
            <a href={`tel:${sub.phone}`} className="p-2 hover:bg-muted rounded-lg">
              <Phone className="w-4 h-4 text-muted-foreground" />
            </a>
          )}
          {sub.email && (
            <a href={`mailto:${sub.email}`} className="p-2 hover:bg-muted rounded-lg">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-3">
          {sub.notes && <p className="text-sm text-muted-foreground">{sub.notes}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {sub.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {sub.email}</span>}
            {sub.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {sub.phone}</span>}
          </div>
          {sub.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeactivate}
              className="text-red-500 border-red-500/30 hover:bg-red-500/10"
            >
              <UserX className="w-4 h-4 mr-1" /> Deactivate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create Form Dialog ──────────────────────────────────────────────────────
function SubbieFormDialog({
  open,
  onClose,
  title,
  onSubmit,
  isPending,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (data: any) => void;
  isPending: boolean;
  defaults?: any;
}) {
  const [name, setName] = useState(defaults?.name ?? "");
  const [trade, setTrade] = useState(defaults?.trade ?? "");
  const [abn, setAbn] = useState(defaults?.abn ?? "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [rate, setRate] = useState(defaults?.hourlyRateCents ? (defaults.hourlyRateCents / 100).toString() : "");
  const [notes, setNotes] = useState(defaults?.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      trade: trade.trim() || undefined,
      abn: abn.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      hourlyRateCents: rate ? Math.round(parseFloat(rate) * 100) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dave's Plumbing" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">Trade</label>
              <Input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Plumber" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">ABN</label>
              <Input value={abn} onChange={(e) => setAbn(e.target.value)} placeholder="12 345 678 901" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dave@example.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0412 345 678" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Hourly Rate ($)</label>
            <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="65.00" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px]"
              placeholder="Any notes about this subbie..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending || !name.trim()} className="bg-amber-500 hover:bg-amber-600 text-white">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog (loads existing data) ───────────────────────────────────────
function SubbieEditDialog({
  id,
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  id: number;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const { data } = trpc.subcontractors.get.useQuery({ id });
  if (!data) return null;
  return (
    <SubbieFormDialog
      open={open}
      onClose={onClose}
      title="Edit Subcontractor"
      onSubmit={onSubmit}
      isPending={isPending}
      defaults={data}
    />
  );
}
