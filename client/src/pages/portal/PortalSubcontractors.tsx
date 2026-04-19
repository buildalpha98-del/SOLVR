/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalSubcontractors — Manage subcontractors, assign to jobs, log timesheets.
 * Costs auto-feed into the Job Costing report.
 *
 * Mobile-first: card layout, full-width dialog, stacked buttons, pb-24.
 */
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Hammer, Plus, Search, Phone, Mail, DollarSign,
  Loader2, UserX, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";

export default function PortalSubcontractors() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: subbies, isLoading } = trpc.subcontractors.list.useQuery();

  const createMut = trpc.subcontractors.create.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      setShowCreate(false);
      hapticSuccess();
      toast.success("Subcontractor added");
    },
    onError: () => toast.error("Failed to add subcontractor"),
  });

  const updateMut = trpc.subcontractors.update.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      setEditId(null);
      hapticSuccess();
      toast.success("Subcontractor updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const deactivateMut = trpc.subcontractors.deactivate.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      hapticWarning();
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
      <div className="space-y-4 sm:space-y-6 pb-24">
        {/* Header — stacks on mobile */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Hammer className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
              Subcontractors
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Manage your subbies, assign them to jobs, and track their hours
            </p>
          </div>
          <Button
            onClick={() => { setShowCreate(true); hapticLight(); }}
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Add Subcontractor
          </Button>
        </div>

        {/* Search — full width */}
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
            <p className="text-muted-foreground text-sm">
              {subbies?.length === 0
                ? "No subcontractors yet. Add your first subbie to get started."
                : "No subcontractors match your search."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(sub => (
              <SubbieCard
                key={sub.id}
                sub={sub}
                isExpanded={expandedId === sub.id}
                onToggle={() => {
                  hapticLight();
                  setExpandedId(expandedId === sub.id ? null : sub.id);
                }}
                onEdit={() => { setEditId(sub.id); hapticLight(); }}
                onDeactivate={() => {
                  if (confirm("Deactivate this subcontractor?")) {
                    deactivateMut.mutate({ id: sub.id });
                  }
                }}
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

// ─── Subbie Card (mobile-first) ─────────────────────────────────────────────
function SubbieCard({
  sub,
  isExpanded,
  onToggle,
  onEdit,
  onDeactivate,
}: {
  sub: any;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      {/* Tap row — always visible */}
      <div
        className="p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer active:bg-muted/30"
        onClick={onToggle}
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Hammer className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">{sub.name}</h3>
            {!sub.isActive && (
              <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0">Inactive</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground mt-0.5">
            {sub.trade && <span>{sub.trade}</span>}
            {sub.hourlyRateCents != null && (
              <span className="flex items-center gap-0.5">
                <DollarSign className="w-3 h-3" />
                ${(sub.hourlyRateCents / 100).toFixed(2)}/hr
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
        />
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t px-3.5 sm:px-4 py-3 space-y-3">
          {/* Contact info — stacked on mobile */}
          <div className="space-y-1.5">
            {sub.email && (
              <a href={`mailto:${sub.email}`} className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{sub.email}</span>
              </a>
            )}
            {sub.phone && (
              <a href={`tel:${sub.phone}`} className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{sub.phone}</span>
              </a>
            )}
            {sub.abn && (
              <div className="text-[12px] text-muted-foreground">ABN: {sub.abn}</div>
            )}
          </div>

          {sub.notes && (
            <p className="text-[13px] text-muted-foreground leading-relaxed">{sub.notes}</p>
          )}

          {/* Actions — stacked on mobile */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {sub.phone && (
              <a
                href={`tel:${sub.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground w-full sm:w-auto"
              >
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-full sm:w-auto"
            >
              Edit
            </Button>
            {sub.isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDeactivate(); }}
                className="text-red-500 border-red-500/30 hover:bg-red-500/10 w-full sm:w-auto"
              >
                <UserX className="w-4 h-4 mr-1" /> Deactivate
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Form Dialog (mobile-first) ──────────────────────────────────────
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dave's Plumbing" />
          </div>
          {/* Trade + ABN — stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">Trade</label>
              <Input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Plumber" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">ABN</label>
              <Input value={abn} onChange={(e) => setAbn(e.target.value)} placeholder="12 345 678 901" />
            </div>
          </div>
          {/* Email + Phone — stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          {/* Footer — stacked on mobile */}
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
            >
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
