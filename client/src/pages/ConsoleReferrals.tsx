/**
 * Console → Referrals
 * Admin view for managing referral partners, viewing conversions, and marking payouts.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { getSolvrOrigin } from "@/const";
import { Copy, Plus, Users, DollarSign, TrendingUp, CheckCircle, Gift, Clock, Award, Loader2, Mail, History, AlertTriangle, ToggleLeft, ToggleRight } from "lucide-react";

const APP_ORIGIN = getSolvrOrigin();

function fmtCents(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Add Partner Modal ────────────────────────────────────────────────────────
function AddPartnerModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", refCode: "", commissionPct: 20, notes: "" });
  const create = trpc.referral.createPartner.useMutation({
    onSuccess: () => { toast.success("Partner added"); onSuccess(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const suggestCode = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 20);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Referral Partner</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Full Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, refCode: f.refCode || suggestCode(e.target.value) }))}
              placeholder="e.g. Matt Johnson"
            />
          </div>
          <div>
            <Label>Email *</Label>
            <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="matt@example.com" type="email" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0400 000 000" />
          </div>
          <div>
            <Label>Ref Code * <span className="text-muted-foreground text-xs">(used in /ref/[code] URL)</span></Label>
            <Input
              value={form.refCode}
              onChange={(e) => setForm((f) => ({ ...f, refCode: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              placeholder="matt-johnson"
            />
            {form.refCode && (
              <p className="text-xs text-muted-foreground mt-1">{APP_ORIGIN}/ref/{form.refCode}</p>
            )}
          </div>
          <div>
            <Label>Commission % (of MRR)</Label>
            <Input
              value={form.commissionPct}
              onChange={(e) => setForm((f) => ({ ...f, commissionPct: Number(e.target.value) }))}
              type="number" min={5} max={50}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="How you know them, context..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate({ name: form.name, email: form.email, phone: form.phone || undefined, refCode: form.refCode, commissionPct: form.commissionPct, notes: form.notes || undefined })}
            disabled={!form.name || !form.email || !form.refCode || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add Partner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConsoleReferrals() {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [payMonth, setPayMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const utils = trpc.useUtils();
  const { data: summary } = trpc.referral.getSummary.useQuery();
  const { data: partners = [], isLoading: partnersLoading } = trpc.referral.listPartners.useQuery();
  const { data: conversions = [] } = trpc.referral.listConversions.useQuery(
    { partnerId: selectedPartnerId ?? undefined }
  );

  const toggleActive = trpc.referral.updatePartner.useMutation({
    onSuccess: () => utils.referral.listPartners.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const markPaid = trpc.referral.markPaid.useMutation({
    onSuccess: (d) => { toast.success(`Marked ${d.updated} conversion(s) as paid for ${payMonth}`); utils.referral.listConversions.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const unpaidConversions = conversions.filter((c) => c.status === "active" && c.lastPaidMonth !== payMonth);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Referral Programme</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage partners, track conversions, and process monthly payouts.</p>
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Partner
          </Button>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, label: "Active Partners", value: summary.activePartners },
              { icon: TrendingUp, label: "Active Conversions", value: summary.activeConversions },
              { icon: DollarSign, label: "Monthly Revenue (referred)", value: fmtCents(summary.monthlyRevenueCents) },
              { icon: CheckCircle, label: "Monthly Commissions", value: fmtCents(summary.monthlyCommissionCents) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label}
                </div>
                <div className="text-2xl font-display font-bold">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Partners table */}
        <div>
          <h2 className="text-lg font-display font-semibold mb-3">Partners</h2>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Ref Link</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Active Clients</TableHead>
                  <TableHead>Monthly Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnersLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                )}
                {!partnersLoading && partners.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No partners yet. Add your first referral partner above.</TableCell></TableRow>
                )}
                {partners.map((p) => (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer ${selectedPartnerId === p.id ? "bg-muted/50" : ""}`}
                    onClick={() => setSelectedPartnerId(selectedPartnerId === p.id ? null : p.id)}
                  >
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </TableCell>
                    <TableCell>
                      <button
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(`${APP_ORIGIN}/ref/${p.refCode}`);
                          toast.success("Link copied");
                        }}
                      >
                        <Copy className="w-3 h-3" />
                        /ref/{p.refCode}
                      </button>
                    </TableCell>
                    <TableCell>{p.commissionPct}% MRR</TableCell>
                    <TableCell>{p.activeConversions}</TableCell>
                    <TableCell className="font-medium">{fmtCents(p.monthlyCommissionCents)}/mo</TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive.mutate({ id: p.id, isActive: !p.isActive });
                        }}
                      >
                        {p.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Conversions / Payouts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold">
              {selectedPartnerId
                ? `Conversions — ${partners.find((p) => p.id === selectedPartnerId)?.name ?? ""}`
                : "All Conversions"}
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Pay Month</Label>
                <Input
                  type="month"
                  value={payMonth}
                  onChange={(e) => setPayMonth(e.target.value)}
                  className="w-36 text-sm"
                />
              </div>
              <Button
                size="sm"
                disabled={unpaidConversions.length === 0 || markPaid.isPending}
                onClick={() => markPaid.mutate({ conversionIds: unpaidConversions.map((c) => c.id), month: payMonth })}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Mark {unpaidConversions.length} Unpaid as Paid
              </Button>
            </div>
          </div>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subscriber</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Commission/mo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Paid</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No conversions yet.</TableCell></TableRow>
                )}
                {conversions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.subscriberName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.subscriberEmail}</div>
                    </TableCell>
                    <TableCell className="text-sm">{c.partnerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{c.plan}</Badge>
                    </TableCell>
                    <TableCell>{fmtCents(c.monthlyAmountCents)}</TableCell>
                    <TableCell className="font-medium text-green-600">{fmtCents(c.commissionAmountCents)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.lastPaidMonth || "Unpaid"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ─── Tradie-to-Tradie Referral Programme ─────────────────────────────── */}
      <TradieProgrammeSection />

      <AddPartnerModal open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => utils.referral.listPartners.invalidate()} />
    </DashboardLayout>
  );
}

// ─── Tradie Programme Section ─────────────────────────────────────────────────
function statusBadge(status: string) {
  if (status === "rewarded") return <Badge className="bg-green-100 text-green-700 border-green-200">Rewarded</Badge>;
  if (status === "converted") return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Converted</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function TradieProgrammeSection() {
  const utils = trpc.useUtils();
  const [showBlastConfirm, setShowBlastConfirm] = useState(false);
  const { data: summary, isLoading: summaryLoading } = trpc.adminReferral.getTradieProgrammeSummary.useQuery();
  const { data: referrals = [], isLoading } = trpc.adminReferral.listTradieProgramme.useQuery();
  const { data: blastHistory = [] } = trpc.adminReferral.getBlastHistory.useQuery();

  // Feature flag toggle
  const { data: featureFlags } = trpc.adminReferral.getFeatureFlags.useQuery();
  const toggleReferral = trpc.adminReferral.setReferralProgrammeEnabled.useMutation({
    onSuccess: (d) => {
      utils.adminReferral.getFeatureFlags.invalidate();
      toast.success(d.referralProgrammeEnabled ? "Referral programme enabled" : "Referral programme disabled");
    },
    onError: (e) => toast.error(e.message),
  });
  const referralEnabled = featureFlags?.referralProgrammeEnabled ?? true;

  const sendBlast = trpc.adminReferral.sendReferralBlast.useMutation({
    onSuccess: (d) => {
      setShowBlastConfirm(false);
      utils.adminReferral.getBlastHistory.invalidate();
      if (d.failed > 0) {
        toast.warning(`Sent ${d.sent}/${d.total} emails. ${d.failed} failed.`);
      } else {
        toast.success(`Referral programme email sent to ${d.sent} client${d.sent !== 1 ? "s" : ""}.`);
      }
    },
    onError: (e) => { setShowBlastConfirm(false); toast.error(e.message); },
  });

  const applyDiscount = trpc.adminReferral.applyDiscountManually.useMutation({
    onSuccess: () => {
      toast.success("20% discount applied and referral marked as rewarded.");
      utils.adminReferral.listTradieProgramme.invalidate();
      utils.adminReferral.getTradieProgrammeSummary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 border-t pt-8">
      {/* Section header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-500" />
            Tradie Referral Programme
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Tradie-to-tradie referrals — when a referred tradie pays their first invoice, the referrer gets 20% off their next bill.
          </p>
        </div>
        <Button
          size="sm"
          disabled={sendBlast.isPending}
          onClick={() => setShowBlastConfirm(true)}
          className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          {sendBlast.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending...</>
          ) : (
            <><Mail className="w-3.5 h-3.5 mr-1.5" /> Send Referral Email to All Clients</>
          )}
        </Button>
      </div>

      {/* Summary cards */}
      {!summaryLoading && summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Users, label: "Total Referred", value: summary.total },
            { icon: Clock, label: "Pending", value: summary.pending },
            { icon: TrendingUp, label: "Converted", value: summary.converted },
            { icon: Award, label: "Rewarded", value: summary.rewarded },
            { icon: Gift, label: "Pending Discounts", value: summary.clientsWithPendingDiscount },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </div>
              <div className="text-2xl font-display font-bold">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Referral table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referrer</TableHead>
              <TableHead>Ref Code</TableHead>
              <TableHead>Referee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pending Discount</TableHead>
              <TableHead>Referred</TableHead>
              <TableHead>Converted</TableHead>
              <TableHead>Rewarded</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            )}
            {!isLoading && referrals.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No tradie referrals yet. Share the portal link with clients to get started.</TableCell></TableRow>
            )}
            {referrals.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.referrer?.businessName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.referrer?.contactName ?? ""}</div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                    {r.referrer?.referralCode ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.referee?.businessName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.referee?.contactName ?? ""}</div>
                </TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell>
                  {(r.referrer?.pendingDiscountPct ?? 0) > 0 ? (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                      {r.referrer?.pendingDiscountPct}% off next invoice
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDate(r.createdAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.convertedAt ? fmtDate(r.convertedAt) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.rewardedAt ? fmtDate(r.rewardedAt) : "—"}
                </TableCell>
                <TableCell>
                  {r.status !== "rewarded" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 border-amber-500/30 text-amber-600 hover:bg-amber-50"
                      disabled={applyDiscount.isPending}
                      onClick={() => applyDiscount.mutate({ referralId: r.id })}
                    >
                      Apply Discount
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Blast history */}
      {blastHistory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            Blast History
          </h3>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Total Eligible</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blastHistory.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">{fmtDate(log.sentAt)}</TableCell>
                    <TableCell className="text-sm">{log.total}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-700 border-green-200">{log.sent} sent</Badge>
                    </TableCell>
                    <TableCell>
                      {log.failed > 0 ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200">{log.failed} failed</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Feature flag toggle */}
      <div className="flex items-center justify-between rounded-xl border p-4">
        <div>
          <p className="font-medium text-sm">Referral Programme</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When disabled, the "Refer a Tradie" nav item is hidden from all portal clients and the referral page shows a "Coming Soon" message.
          </p>
        </div>
        <button
          onClick={() => toggleReferral.mutate({ enabled: !referralEnabled })}
          disabled={toggleReferral.isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: referralEnabled ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: referralEnabled ? "#16a34a" : "#dc2626",
            border: `1px solid ${referralEnabled ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          {toggleReferral.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : referralEnabled ? (
            <ToggleRight className="w-4 h-4" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {referralEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {/* Blast confirmation dialog */}
      <Dialog open={showBlastConfirm} onOpenChange={setShowBlastConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Email Blast
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              You are about to email <strong>all active clients with a referral code</strong> their unique referral link and the 20% offer.
            </p>
            {blastHistory.length > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Last blast sent: <strong>{fmtDate(blastHistory[0].sentAt)}</strong> — {blastHistory[0].sent} emails sent.
              </p>
            )}
            <p className="text-sm font-medium">Are you sure you want to proceed?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlastConfirm(false)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              disabled={sendBlast.isPending}
              onClick={() => sendBlast.mutate()}
            >
              {sendBlast.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending...</>
              ) : (
                "Yes, Send Blast"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
