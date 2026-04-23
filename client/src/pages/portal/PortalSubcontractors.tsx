/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalSubcontractors — Manage subcontractors, assign to jobs, log timesheets.
 * Costs auto-feed into the Job Costing report.
 *
 * Styling: matches PortalJobs canonical SOLVR palette — `#0F1F3D` surface,
 * `#F5A623` amber accent, white-on-navy inline styles. Previously used shadcn
 * semantic tokens (`bg-card`, `text-foreground`, `text-muted-foreground`)
 * which drifted from every other portal page; this rewrite restores brand
 * consistency without changing the data model or tRPC contracts.
 *
 * Mobile-first: card layout, full-width modal, stacked buttons, pb-24.
 */
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Hammer, Plus, Search, Phone, Mail, DollarSign,
  Loader2, UserX, ChevronRight, X,
} from "lucide-react";
import { toast } from "sonner";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";

// Minimum 44×44 tap target size — Apple HIG.
const TAP_TARGET = "min-h-[44px]";

type Subbie = {
  id: number;
  name: string;
  trade: string | null;
  abn: string | null;
  email: string | null;
  phone: string | null;
  hourlyRateCents: number | null;
  notes: string | null;
  isActive: boolean;
};

type SubbieFormData = {
  name: string;
  trade?: string;
  abn?: string;
  email?: string;
  phone?: string;
  hourlyRateCents?: number;
  notes?: string;
};

export default function PortalSubcontractors() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: subbies, isLoading } = trpc.subcontractors.list.useQuery(undefined, {
    retry: 2,
    staleTime: 30_000,
  });

  const createMut = trpc.subcontractors.create.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      setShowCreate(false);
      hapticSuccess();
      toast.success("Subcontractor added");
    },
    onError: (err) => toast.error(err.message || "Failed to add subcontractor"),
  });

  const updateMut = trpc.subcontractors.update.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      setEditId(null);
      hapticSuccess();
      toast.success("Subcontractor updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update subcontractor"),
  });

  const deactivateMut = trpc.subcontractors.deactivate.useMutation({
    onSuccess: () => {
      utils.subcontractors.list.invalidate();
      hapticWarning();
      toast.success("Subcontractor deactivated");
    },
    onError: (err) => toast.error(err.message || "Failed to deactivate subcontractor"),
  });

  const filtered = ((subbies ?? []) as Subbie[]).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.trade ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PortalLayout>
      <div className="space-y-4 pb-24">
        {/* Header — matches PortalJobs pattern */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Hammer className="w-5 h-5" style={{ color: "#F5A623" }} />
              Subcontractors
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              Manage your subbies — assign to jobs, track hours, feed job costing.
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); hapticLight(); }}
            className={`flex items-center gap-1.5 px-3 rounded-lg text-sm font-semibold flex-shrink-0 ${TAP_TARGET}`}
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            <Plus className="w-4 h-4" /> Add Subbie
          </button>
        </div>

        {/* Search — matches PortalJobs pattern */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "rgba(255,255,255,0.3)" }}
          />
          <input
            type="text"
            placeholder="Search by name or trade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "rgba(255,255,255,0.3)" }}
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl"
            style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <Hammer className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              {(subbies?.length ?? 0) === 0
                ? "No subcontractors yet. Add your first subbie to get started."
                : "No subcontractors match your search."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((sub) => (
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

      {/* Create Modal */}
      {showCreate && (
        <SubbieFormModal
          title="Add Subcontractor"
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createMut.mutate(data)}
          isPending={createMut.isPending}
        />
      )}

      {/* Edit Modal */}
      {editId !== null && (
        <SubbieEditModal
          id={editId}
          onClose={() => setEditId(null)}
          onSubmit={(data) => updateMut.mutate({ id: editId, ...data })}
          isPending={updateMut.isPending}
        />
      )}
    </PortalLayout>
  );
}

// ─── Subbie Card (mobile-first, SOLVR palette) ──────────────────────────────
function SubbieCard({
  sub,
  isExpanded,
  onToggle,
  onEdit,
  onDeactivate,
}: {
  sub: Subbie;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Tap row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full p-3.5 flex items-center gap-3 text-left ${TAP_TARGET} active:opacity-80`}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(245,166,35,0.12)" }}
        >
          <Hammer className="w-4 h-4" style={{ color: "#F5A623" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{sub.name}</h3>
            {!sub.isActive && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-semibold"
                style={{ background: "rgba(239,68,68,0.12)", color: "#FCA5A5" }}
              >
                Inactive
              </span>
            )}
          </div>
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-0.5"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
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
          className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          style={{ color: "rgba(255,255,255,0.3)" }}
        />
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div
          className="px-3.5 py-3 space-y-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Contact info */}
          <div className="space-y-1.5">
            {sub.email && (
              <a
                href={`mailto:${sub.email}`}
                className="flex items-center gap-2 text-sm hover:text-white"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{sub.email}</span>
              </a>
            )}
            {sub.phone && (
              <a
                href={`tel:${sub.phone}`}
                className="flex items-center gap-2 text-sm hover:text-white"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{sub.phone}</span>
              </a>
            )}
            {sub.abn && (
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                ABN: {sub.abn}
              </div>
            )}
          </div>

          {sub.notes && (
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              {sub.notes}
            </p>
          )}

          {/* Actions — full-width tap targets on mobile */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {sub.phone && (
              <a
                href={`tel:${sub.phone}`}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold w-full sm:w-auto ${TAP_TARGET}`}
                style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
              >
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold w-full sm:w-auto ${TAP_TARGET}`}
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Edit
            </button>
            {sub.isActive && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeactivate(); }}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold w-full sm:w-auto ${TAP_TARGET}`}
                style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <UserX className="w-4 h-4" /> Deactivate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subbie Form Modal (SOLVR palette, matches PortalJobs AddJobModal) ──────
function SubbieFormModal({
  title,
  onClose,
  onSubmit,
  isPending,
  defaults,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (data: SubbieFormData) => void;
  isPending: boolean;
  defaults?: Partial<Subbie>;
}) {
  const [name, setName] = useState(defaults?.name ?? "");
  const [trade, setTrade] = useState(defaults?.trade ?? "");
  const [abn, setAbn] = useState(defaults?.abn ?? "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [rate, setRate] = useState(
    defaults?.hourlyRateCents != null ? (defaults.hourlyRateCents / 100).toString() : "",
  );
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

  const fieldStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={`flex items-center justify-center w-10 h-10 rounded-lg`}
            style={{ color: "rgba(255,255,255,0.4)" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dave's Plumbing"
              className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${TAP_TARGET}`}
              style={fieldStyle}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Trade">
              <input
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="e.g. Plumber"
                className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${TAP_TARGET}`}
                style={fieldStyle}
              />
            </Field>
            <Field label="ABN">
              <input
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                placeholder="12 345 678 901"
                className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${TAP_TARGET}`}
                style={fieldStyle}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dave@example.com"
                className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${TAP_TARGET}`}
                style={fieldStyle}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0412 345 678"
                className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${TAP_TARGET}`}
                style={fieldStyle}
              />
            </Field>
          </div>

          <Field label="Hourly Rate ($)">
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="65.00"
              className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${TAP_TARGET}`}
              style={fieldStyle}
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none min-h-[80px] resize-y"
              style={fieldStyle}
              placeholder="Any notes about this subbie…"
              rows={3}
            />
          </Field>

          {/* Footer — stacked on mobile */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 sm:flex-none rounded-lg px-4 text-sm font-semibold ${TAP_TARGET}`}
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className={`flex-1 rounded-lg px-4 text-sm font-semibold flex items-center justify-center gap-2 ${TAP_TARGET} disabled:opacity-50`}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Edit Modal (loads existing data) ────────────────────────────────────────
function SubbieEditModal({
  id,
  onClose,
  onSubmit,
  isPending,
}: {
  id: number;
  onClose: () => void;
  onSubmit: (data: SubbieFormData) => void;
  isPending: boolean;
}) {
  const { data, isLoading } = trpc.subcontractors.get.useQuery({ id }, {
    retry: 2,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)" }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-8 flex items-center justify-center"
          style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      </div>
    );
  }

  return (
    <SubbieFormModal
      title="Edit Subcontractor"
      onClose={onClose}
      onSubmit={onSubmit}
      isPending={isPending}
      defaults={data as Partial<Subbie>}
    />
  );
}
