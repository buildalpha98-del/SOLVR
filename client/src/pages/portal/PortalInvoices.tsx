/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalInvoices — AI Invoice Chasing
 *
 * Clients can:
 * - View all outstanding invoices and their chase status
 * - Add a new invoice to start the chase sequence
 * - Mark invoices as paid
 * - Snooze a chase (pause for N days)
 * - Cancel a chase
 * - See escalated invoices that need a manual phone call
 */
import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/portal/PullToRefreshIndicator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Receipt, Plus, CheckCircle2, Clock, AlertTriangle,
  XCircle, PhoneCall, Loader2, RefreshCw, Download
} from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";

// ── Types ─────────────────────────────────────────────────────────────────────
type ChaseStatus = "active" | "paid" | "snoozed" | "cancelled" | "escalated";

interface InvoiceChase {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  description?: string | null;
  amountDue: string;
  issuedAt: string | Date;
  dueDate: string | Date;
  status: ChaseStatus;
  chaseCount: number;
  lastChasedAt?: string | Date | null;
  nextChaseAt?: string | Date | null;
  notes?: string | null;
  // Sprint 3.1 — Xero sync state per chase
  xeroInvoiceId?: string | null;
  xeroSyncedAt?: string | Date | null;
  xeroSyncFailedAt?: string | Date | null;
  xeroSyncError?: string | null;
  // Sprint 3.2 — payment link / refund state
  paymentLinkToken?: string | null;
  paymentLinkAmountCents?: number | null;
  paymentLinkRefundedCents?: number | null;
  paymentLinkPaidAt?: string | Date | null;
  paymentLinkStatus?: string | null;
  canRefund?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function statusBadge(status: ChaseStatus, chaseCount: number) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA" }}>
          <RefreshCw className="w-3 h-3" /> Chasing ({chaseCount}/3)
        </span>
      );
    case "paid":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(34,197,94,0.15)", color: "#4ADE80" }}>
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    case "snoozed":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(234,179,8,0.15)", color: "#FACC15" }}>
          <Clock className="w-3 h-3" /> Snoozed
        </span>
      );
    case "escalated":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}>
          <PhoneCall className="w-3 h-3" /> Call Required
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
          <XCircle className="w-3 h-3" /> Cancelled
        </span>
      );
  }
}

// ── Xero Sync Chip ────────────────────────────────────────────────────────────
/**
 * Per-invoice chip showing Xero sync state. Hides itself when:
 *   - Xero isn't connected (we'd be nagging users with no solution path)
 *   - Invoice is already paid (no point syncing a paid invoice)
 *
 * Three visible states:
 *   ✓ in Xero       — synced, has xeroInvoiceId
 *   ⚠ Sync failed   — xeroSyncFailedAt set, surfaces error tooltip + retry
 *   • Sync now      — connected but never pushed
 */
function XeroSyncChip({ chase }: { chase: InvoiceChase }) {
  const utils = trpc.useUtils();
  const { data: xeroStatus } = trpc.xero.getStatus.useQuery(undefined, {
    staleTime: 60_000, retry: 1,
  });
  const sync = trpc.xero.syncInvoice.useMutation({
    onSuccess: () => {
      utils.invoiceChasing.list.invalidate();
      toast.success("Invoice synced to Xero.");
    },
    onError: (err) => toast.error(err.message ?? "Xero sync failed."),
  });

  // Hide the chip entirely if Xero isn't connected — no value nagging.
  if (!xeroStatus?.connected) return null;
  if (chase.status === "paid") return null;

  const synced = !!chase.xeroInvoiceId;
  const failed = !synced && !!chase.xeroSyncFailedAt;

  if (synced) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
        style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}
        title={`Synced to Xero${chase.xeroSyncedAt ? ` on ${new Date(chase.xeroSyncedAt).toLocaleDateString("en-AU")}` : ""}`}
      >
        <CheckCircle2 className="w-2.5 h-2.5" /> Xero
      </span>
    );
  }

  if (failed) {
    return (
      <button
        type="button"
        onClick={() => sync.mutate({ invoiceChaseId: chase.id })}
        disabled={sync.isPending}
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
        style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
        title={chase.xeroSyncError ?? "Sync failed — tap to retry"}
      >
        {sync.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <AlertTriangle className="w-2.5 h-2.5" />}
        Retry Xero
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => sync.mutate({ invoiceChaseId: chase.id })}
      disabled={sync.isPending}
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
      style={{ background: "rgba(19,181,234,0.12)", color: "#13B5EA" }}
      title="Push this invoice to Xero now"
    >
      {sync.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
      Sync to Xero
    </button>
  );
}

// ── Add Invoice Form ──────────────────────────────────────────────────────────
interface AddInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AddInvoiceDialog({ open, onClose, onSuccess }: AddInvoiceDialogProps) {
  const [form, setForm] = useState({
    invoiceNumber: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    description: "",
    amountDue: "",
    issuedAt: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: "",
  });

  const createMutation = trpc.invoiceChasing.create.useMutation({
    onSuccess: () => {
      toast.success(`Chase started for ${form.invoiceNumber}`);
      onSuccess();
      onClose();
      setForm({
        invoiceNumber: "", customerName: "", customerEmail: "",
        customerPhone: "", description: "", amountDue: "",
        issuedAt: new Date().toISOString().split("T")[0], dueDate: "", notes: "",
      });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invoiceNumber || !form.customerName || !form.customerEmail || !form.amountDue || !form.dueDate) {
      toast.error("Please fill in all required fields.");
      return;
    }
    createMutation.mutate({
      invoiceNumber: form.invoiceNumber,
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      customerPhone: form.customerPhone || undefined,
      description: form.description || undefined,
      amountDue: form.amountDue,
      issuedAt: form.issuedAt,
      dueDate: form.dueDate,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-auto" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F0" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F5A623" }}>Start Invoice Chase</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/70 text-xs">Invoice # *</Label>
              <Input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                placeholder="INV-0042" className="mt-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
            </div>
            <div>
              <Label className="text-white/70 text-xs">Amount Due (AUD) *</Label>
              <Input
                inputMode="decimal"
                value={form.amountDue} onChange={e => setForm(f => ({ ...f, amountDue: e.target.value }))}
                placeholder="1250.00" className="mt-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
            </div>
          </div>
          <div>
            <Label className="text-white/70 text-xs">Customer Name *</Label>
            <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              placeholder="John Smith" className="mt-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/70 text-xs">Customer Email *</Label>
              <Input
                type="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                placeholder="john@example.com" className="mt-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
            </div>
            <div>
              <Label className="text-white/70 text-xs">Customer Phone</Label>
              <Input
                type="tel"
                inputMode="tel"
                value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                placeholder="0412 345 678" className="mt-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/70 text-xs">Issued Date *</Label>
              <Input type="date" value={form.issuedAt} onChange={e => setForm(f => ({ ...f, issuedAt: e.target.value }))}
                className="mt-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
            </div>
            <div>
              <Label className="text-white/70 text-xs">Due Date *</Label>
              <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="mt-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
            </div>
          </div>
          <div>
            <Label className="text-white/70 text-xs">Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Hot water system installation" className="mt-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
          </div>
          <div>
            <Label className="text-white/70 text-xs">Internal Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes for your records..." rows={2} className="mt-1 resize-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} style={{ color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}
              style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700 }}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Start Chasing
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Mark Paid Dialog ─────────────────────────────────────────────────────────
interface MarkPaidDialogProps {
  chase: InvoiceChase | null;
  onClose: () => void;
  onConfirm: (id: string, amountReceived: string, notes: string) => void;
  isPending: boolean;
}

function MarkPaidDialog({ chase, onClose, onConfirm, isPending }: MarkPaidDialogProps) {
  const [amountReceived, setAmountReceived] = useState("");
  const [notes, setNotes] = useState("");

  // Pre-fill amount received from amountDue when dialog opens
  const open = !!chase;
  const handleOpenChange = (v: boolean) => { if (!v) onClose(); };

  // Reset on open
  const prevOpen = !chase;
  if (!prevOpen && open && amountReceived === "" && chase) {
    // Can't call setState in render — use the initial value from chase.amountDue
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F0" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#4ADE80" }}>Mark Invoice as Paid</DialogTitle>
        </DialogHeader>
        {chase && (
          <div className="space-y-4">
            <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Invoice</div>
              <div className="font-bold" style={{ color: "#F5F5F0" }}>{chase.invoiceNumber} — {chase.customerName}</div>
              <div className="text-sm mt-0.5" style={{ color: "#F5A623" }}>Amount due: ${Number(chase.amountDue).toLocaleString("en-AU")} AUD</div>
            </div>
            <div>
              <Label className="text-white/70 text-xs">Amount Received (AUD)</Label>
              <Input
                value={amountReceived || chase.amountDue}
                onChange={e => setAmountReceived(e.target.value)}
                placeholder={chase.amountDue}
                className="mt-1"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }}
              />
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Leave as-is if full amount was received.</p>
            </div>
            <div>
              <Label className="text-white/70 text-xs">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Paid via bank transfer on 10 Apr"
                rows={2}
                className="mt-1 resize-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} style={{ color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
          <Button
            onClick={() => chase && onConfirm(chase.id, amountReceived || chase.amountDue, notes)}
            disabled={isPending}
            style={{ background: "rgba(34,197,94,0.2)", color: "#4ADE80", border: "1px solid rgba(34,197,94,0.3)", fontWeight: 700 }}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Refund Dialog (Sprint 3.2) ───────────────────────────────────────────────
interface RefundDialogProps {
  chase: InvoiceChase | null;
  onClose: () => void;
}

function RefundDialog({ chase, onClose }: RefundDialogProps) {
  const utils = trpc.useUtils();
  const open = !!chase;
  const handleOpenChange = (v: boolean) => { if (!v) onClose(); };
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState<"requested_by_customer" | "duplicate" | "fraudulent">("requested_by_customer");
  const [note, setNote] = useState("");

  // Reset state on dialog open
  useEffect(() => {
    if (open) {
      setAmountInput("");
      setReason("requested_by_customer");
      setNote("");
    }
  }, [open]);

  const refund = trpc.stripeConnect.refundPayment.useMutation({
    onSuccess: (res) => {
      hapticSuccess();
      utils.invoiceChasing.list.invalidate();
      utils.invoiceChasing.summary.invalidate();
      toast.success(
        res.remainingCents > 0
          ? `Refunded $${(res.refundedCents / 100).toFixed(2)} — $${(res.remainingCents / 100).toFixed(2)} still on the original payment.`
          : `Fully refunded ($${(res.refundedCents / 100).toFixed(2)}).`,
      );
      onClose();
    },
    onError: (err) => {
      hapticWarning();
      toast.error(err.message ?? "Refund failed.");
    },
  });

  if (!chase || !chase.paymentLinkToken) return null;
  const totalCents = chase.paymentLinkAmountCents ?? 0;
  const refundedCents = chase.paymentLinkRefundedCents ?? 0;
  const remainingCents = totalCents - refundedCents;
  const remainingDollars = (remainingCents / 100).toFixed(2);

  const handleConfirm = () => {
    const inputDollars = parseFloat(amountInput);
    let amountCents: number | undefined = undefined;
    if (amountInput.trim() !== "") {
      if (isNaN(inputDollars) || inputDollars <= 0) {
        toast.error("Enter a valid dollar amount.");
        return;
      }
      amountCents = Math.round(inputDollars * 100);
    }
    refund.mutate({
      paymentLinkToken: chase.paymentLinkToken!,
      amountCents,
      reason,
      note: note || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F0" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F5A623" }}>Refund Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Invoice</div>
            <div className="font-bold" style={{ color: "#F5F5F0" }}>{chase.invoiceNumber} — {chase.customerName}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
              Original: ${(totalCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
              {refundedCents > 0 && (
                <> · Already refunded: ${(refundedCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</>
              )}
            </div>
            <div className="text-sm mt-1 font-bold" style={{ color: "#F5A623" }}>
              Available to refund: ${remainingDollars}
            </div>
          </div>

          <div>
            <Label className="text-white/70 text-xs">Refund Amount (AUD)</Label>
            <Input
              value={amountInput}
              onChange={e => setAmountInput(e.target.value)}
              placeholder={remainingDollars}
              inputMode="decimal"
              className="mt-1"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }}
            />
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              Leave blank to refund the full remaining amount (${remainingDollars}).
            </p>
          </div>

          <div>
            <Label className="text-white/70 text-xs">Reason</Label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value as typeof reason)}
              className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }}
            >
              <option value="requested_by_customer">Requested by customer</option>
              <option value="duplicate">Duplicate charge</option>
              <option value="fraudulent">Fraudulent</option>
            </select>
          </div>

          <div>
            <Label className="text-white/70 text-xs">Note (optional, for your records)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Customer wasn't happy with the work — full refund agreed"
              rows={2}
              className="mt-1 resize-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F0" }}
            />
          </div>

          <div
            className="rounded-lg p-2.5 text-xs"
            style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)", color: "rgba(255,200,140,0.9)" }}
          >
            <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" />
            Funds will be debited from your Stripe balance and credited back to the customer's card. Usually takes 5–10 business days to show up.
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} style={{ color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={refund.isPending}
            style={{ background: "rgba(245,166,35,0.2)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)", fontWeight: 700 }}
          >
            {refund.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Issue Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PortalInvoices() {
  const [addOpen, setAddOpen] = useState(false);
  const [markPaidChase, setMarkPaidChase] = useState<InvoiceChase | null>(null);
  const [refundChase, setRefundChase] = useState<InvoiceChase | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "escalated" | "paid">("all");

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.invoiceChasing.list.useQuery(
    { status: filter === "all" ? undefined : filter },
    { staleTime: 60_000 }
  );

  const markPaidMutation = trpc.invoiceChasing.markPaid.useMutation({
    onSuccess: () => {
      utils.invoiceChasing.list.invalidate();
      utils.invoiceChasing.summary.invalidate();
      setMarkPaidChase(null);
      toast.success("Invoice marked as paid — chase stopped.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleMarkPaidConfirm = (id: string, amountReceived: string, notes: string) => {
    markPaidMutation.mutate({ id, amountReceived, notes: notes || undefined });
  };
  const snoozeMutation = trpc.invoiceChasing.snooze.useMutation({
    onSuccess: () => {
      utils.invoiceChasing.list.invalidate();
      toast.success("Chase snoozed for 7 days.");
    },
    onError: (err) => toast.error(err.message),
  });
  const cancelMutation = trpc.invoiceChasing.cancel.useMutation({
    onSuccess: () => {
      utils.invoiceChasing.list.invalidate();
      toast.success("Chase cancelled.");
    },
    onError: (err) => toast.error(err.message),
  });
  const { data: summary } = trpc.invoiceChasing.summary.useQuery(undefined, { staleTime: 60_000 });

  const chases: InvoiceChase[] = (data as InvoiceChase[] | undefined) ?? [];

  const escalated = chases.filter(c => c.status === "escalated");

  // Pull-to-refresh
  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      utils.invoiceChasing.list.invalidate(),
      utils.invoiceChasing.summary.invalidate(),
    ]);
  }, [utils]);
  const { containerRef: ptrContainerRef, pullDistance, isRefreshing: isPullRefreshing } = usePullToRefresh({
    onRefresh: handlePullRefresh,
  });

  return (
    <PortalLayout activeTab="invoices">
      <div ref={ptrContainerRef} className="space-y-6" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPullRefreshing} />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#F5F5F0" }}>Invoice Chasing</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              AI sends polite payment reminders automatically — you get notified when it's time to call.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const result = await utils.invoiceChasing.exportXeroCsv.fetch({ status: "all" });
                  if (!result.csv) { toast.info("No invoices to export."); return; }
                  const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `solvr-invoices-xero-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`Exported ${result.count} invoices for Xero.`);
                } catch { toast.error("Export failed."); }
              }}
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }}
            >
              <Download className="w-4 h-4 mr-1.5" /> Export to Xero
            </Button>
            <Button onClick={() => setAddOpen(true)} style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700 }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Invoice
            </Button>
          </div>
        </div>

        {/* ── Summary cards ──────────────────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Outstanding", value: summary.activeCount, sub: `$${Number(summary.totalOutstanding ?? 0).toLocaleString("en-AU")} AUD`, color: "#60A5FA" },
              { label: "Escalated", value: summary.escalatedCount, sub: "Need your call", color: "#F87171" },
              { label: "Paid (30d)", value: summary.paidCount30d, sub: `$${Number(summary.totalCollected30d ?? 0).toLocaleString("en-AU")} collected`, color: "#4ADE80" },
              { label: "Avg Days to Pay", value: summary.avgDaysToPay ? `${summary.avgDaysToPay}d` : "—", sub: "after invoice sent", color: "#F5A623" },
            ].map(card => (
              <div key={card.label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{card.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{card.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Escalation alert ───────────────────────────────────────────── */}
        {escalated.length > 0 && (
          <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <PhoneCall className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#F87171" }} />
            <div>
              <div className="font-semibold text-sm" style={{ color: "#F87171" }}>
                {escalated.length} invoice{escalated.length > 1 ? "s" : ""} need your personal attention
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                These have been chased 3 times with no response. Time to pick up the phone.
              </div>
              <div className="mt-2 space-y-1">
                {escalated.map(c => (
                  <div key={c.id} className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span className="font-semibold">{c.customerName}</span> — {c.invoiceNumber} — ${Number(c.amountDue).toLocaleString("en-AU")}
                    {c.customerPhone && <span style={{ color: "#F5A623" }}> · {c.customerPhone}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Filter tabs ────────────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "active", "escalated", "paid"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize"
              style={{
                background: filter === f ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.05)",
                color: filter === f ? "#F5A623" : "rgba(255,255,255,0.5)",
                border: filter === f ? "1px solid rgba(245,166,35,0.3)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Invoice list ───────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F5A623" }} />
          </div>
        ) : chases.length === 0 ? (
          <div className="text-center py-16 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Receipt className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
            <div className="font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>No invoices here</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              Add an invoice to start the automated chase sequence.
            </div>
            <Button onClick={() => setAddOpen(true)} className="mt-4" style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700 }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Your First Invoice
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {chases.map((chase) => (
              <div
                key={chase.id}
                className="rounded-xl p-4"
                style={{
                  background: chase.status === "escalated" ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)",
                  border: chase.status === "escalated" ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: "#F5F5F0" }}>{chase.invoiceNumber}</span>
                      {statusBadge(chase.status, chase.chaseCount)}
                      <XeroSyncChip chase={chase} />
                    </div>
                    <div className="text-sm mt-1 font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                      {chase.customerName}
                      <span className="font-normal ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{chase.customerEmail}</span>
                    </div>
                    {chase.description && (
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{chase.description}</div>
                    )}
                    <div className="flex gap-4 mt-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span>Due: <span style={{ color: "rgba(255,255,255,0.7)" }}>{formatDate(chase.dueDate)}</span></span>
                      {chase.lastChasedAt && <span>Last chased: <span style={{ color: "rgba(255,255,255,0.7)" }}>{formatDate(chase.lastChasedAt)}</span></span>}
                      {chase.nextChaseAt && chase.status === "active" && <span>Next: <span style={{ color: "#F5A623" }}>{formatDate(chase.nextChaseAt)}</span></span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold" style={{ color: "#F5A623" }}>
                      ${Number(chase.amountDue).toLocaleString("en-AU")}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>AUD</div>
                  </div>
                </div>

                {/* Actions */}
                {(chase.status === "active" || chase.status === "snoozed" || chase.status === "escalated") && (
                  <div className="flex gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <Button
                      size="sm"
                      onClick={() => setMarkPaidChase(chase)}
                      disabled={markPaidMutation.isPending}
                      style={{ background: "rgba(34,197,94,0.12)", color: "#4ADE80", border: "1px solid rgba(34,197,94,0.2)", fontSize: "12px" }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Paid
                    </Button>
                    {chase.status === "active" && (
                      <Button
                        size="sm"
                        onClick={() => snoozeMutation.mutate({ id: chase.id, snoozeUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })}
                        disabled={snoozeMutation.isPending}
                        style={{ background: "rgba(234,179,8,0.1)", color: "#FACC15", border: "1px solid rgba(234,179,8,0.2)", fontSize: "12px" }}
                      >
                        <Clock className="w-3.5 h-3.5 mr-1" /> Snooze 7 Days

                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => cancelMutation.mutate({ id: chase.id })}
                      disabled={cancelMutation.isPending}
                      variant="ghost"
                      style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                )}

                {/* Sprint 3.2 — Refund row for paid invoices that came through Pay Now */}
                {chase.canRefund && (
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {(chase.paymentLinkRefundedCents ?? 0) > 0 ? (
                        <>
                          Refunded ${((chase.paymentLinkRefundedCents ?? 0) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })} ·
                          ${(((chase.paymentLinkAmountCents ?? 0) - (chase.paymentLinkRefundedCents ?? 0)) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })} refundable
                        </>
                      ) : (
                        <>Paid via Stripe — refund available</>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setRefundChase(chase)}
                      style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.25)", fontSize: "12px" }}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refund
                    </Button>
                  </div>
                )}

                {/* Already-refunded indicator for paid chases without canRefund */}
                {chase.status === "paid" && !chase.canRefund && (chase.paymentLinkRefundedCents ?? 0) > 0 && (
                  <div className="text-xs mt-2 pt-2" style={{ color: "rgba(255,255,255,0.45)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    Fully refunded ${((chase.paymentLinkRefundedCents ?? 0) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AddInvoiceDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {
          utils.invoiceChasing.list.invalidate();
          utils.invoiceChasing.summary.invalidate();
        }}
      />

      <MarkPaidDialog
        chase={markPaidChase}
        onClose={() => setMarkPaidChase(null)}
        onConfirm={handleMarkPaidConfirm}
        isPending={markPaidMutation.isPending}
      />

      <RefundDialog
        chase={refundChase}
        onClose={() => setRefundChase(null)}
      />
    </PortalLayout>
  );
}
