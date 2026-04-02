import { useState } from "react";
import ConsoleLayout from "@/components/ConsoleLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Zap, Loader2, ArrowRight, DollarSign, Phone, Mail,
  MoreHorizontal, Trash2, CheckCircle, X, Edit2, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

const STAGES = [
  { id: "lead", label: "Lead", color: "bg-white/10 text-white/60" },
  { id: "qualified", label: "Qualified", color: "bg-blue-500/20 text-blue-400" },
  { id: "proposal", label: "Proposal Sent", color: "bg-amber-500/20 text-amber-400" },
  { id: "won", label: "Won", color: "bg-green-500/20 text-green-400" },
  { id: "lost", label: "Lost", color: "bg-red-500/20 text-red-400" },
] as const;

type Stage = typeof STAGES[number]["id"];

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;
  const color = score >= 70 ? "bg-green-500/20 text-green-400 border-green-500/30"
    : score >= 40 ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-red-500/20 text-red-400 border-red-500/30";
  return (
    <Badge className={`text-[10px] h-4 px-1.5 border ${color}`}>
      AI {score}
    </Badge>
  );
}

function DealCard({ deal, onScore, onConvert, onDelete, onEdit }: {
  deal: { id: number; prospectName: string; businessName: string; email?: string | null; phone?: string | null; industry?: string | null; stage: string; estimatedValue?: number | null; packageInterest?: string | null; aiScore?: number | null; aiNextAction?: string | null; aiScoreReason?: string | null; notes?: string | null };
  onScore: () => void;
  onConvert: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <div
        className="bg-[#0d1f38] border border-white/10 rounded-lg p-3 cursor-pointer hover:border-white/20 transition-colors group"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{deal.businessName}</p>
            <p className="text-white/40 text-[10px] truncate">{deal.prospectName}</p>
          </div>
          <button
            className="text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-all"
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        {showActions && (
          <div className="mb-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={onScore} className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5">
              <Zap size={10} /> AI Score
            </button>
            <span className="text-white/20">·</span>
            <button onClick={onEdit} className="text-[10px] text-white/50 hover:text-white flex items-center gap-0.5">
              <Edit2 size={10} /> Edit
            </button>
            {deal.stage !== "won" && (
              <>
                <span className="text-white/20">·</span>
                <button onClick={onConvert} className="text-[10px] text-green-400 hover:text-green-300 flex items-center gap-0.5">
                  <CheckCircle size={10} /> Convert
                </button>
              </>
            )}
            <span className="text-white/20">·</span>
            <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5">
              <Trash2 size={10} /> Delete
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {deal.industry && (
              <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{deal.industry}</span>
            )}
            {deal.packageInterest && (
              <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded capitalize">
                {deal.packageInterest.replace("-", " ")}
              </span>
            )}
          </div>
          <ScoreBadge score={deal.aiScore} />
        </div>

        {deal.estimatedValue ? (
          <p className="text-green-400 text-xs font-semibold mt-1.5">
            ${(deal.estimatedValue / 100).toLocaleString("en-AU")}
          </p>
        ) : null}

        {deal.aiNextAction && (
          <p className="text-amber-400/70 text-[10px] mt-1.5 line-clamp-2 italic">
            → {deal.aiNextAction}
          </p>
        )}
      </div>

      {/* Deal detail dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="bg-[#0d1f38] border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{deal.businessName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-white/40 text-xs">Contact</p>
                <p className="text-white">{deal.prospectName}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Industry</p>
                <p className="text-white">{deal.industry || "—"}</p>
              </div>
              {deal.email && (
                <div>
                  <p className="text-white/40 text-xs">Email</p>
                  <a href={`mailto:${deal.email}`} className="text-amber-400 hover:underline text-xs">{deal.email}</a>
                </div>
              )}
              {deal.phone && (
                <div>
                  <p className="text-white/40 text-xs">Phone</p>
                  <a href={`tel:${deal.phone}`} className="text-amber-400 hover:underline text-xs">{deal.phone}</a>
                </div>
              )}
              <div>
                <p className="text-white/40 text-xs">Package</p>
                <p className="text-white capitalize">{deal.packageInterest?.replace("-", " ") || "—"}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Est. Value</p>
                <p className="text-green-400 font-semibold">
                  {deal.estimatedValue ? `$${(deal.estimatedValue / 100).toLocaleString("en-AU")}` : "—"}
                </p>
              </div>
            </div>
            {deal.notes && (
              <div>
                <p className="text-white/40 text-xs mb-1">Notes</p>
                <p className="text-white/70 text-xs bg-white/5 rounded p-2">{deal.notes}</p>
              </div>
            )}
            {deal.aiScore !== null && deal.aiScore !== undefined && (
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={12} className="text-amber-400" />
                  <span className="text-amber-400 text-xs font-semibold">AI Score: {deal.aiScore}/100</span>
                </div>
                {deal.aiScoreReason && <p className="text-white/60 text-xs">{deal.aiScoreReason}</p>}
                {deal.aiNextAction && (
                  <p className="text-amber-400 text-xs mt-1 font-medium">→ {deal.aiNextAction}</p>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={onScore} className="bg-amber-400 hover:bg-amber-300 text-[#060e1a] text-xs h-7 gap-1">
                <Zap size={11} /> AI Score
              </Button>
              {deal.stage !== "won" && (
                <Button size="sm" onClick={onConvert} className="bg-green-500 hover:bg-green-400 text-white text-xs h-7 gap-1">
                  <CheckCircle size={11} /> Convert to Client
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ConsolePipeline() {
  const [addOpen, setAddOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<{ id: number; prospectName: string; businessName: string; email?: string | null; phone?: string | null; industry?: string | null; stage: string; estimatedValue?: number | null; packageInterest?: string | null; aiScore?: number | null; aiNextAction?: string | null; aiScoreReason?: string | null; notes?: string | null } | null>(null);
  const [scoringId, setScoringId] = useState<number | null>(null);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    prospectName: "", businessName: "", email: "", phone: "",
    industry: "", stage: "lead" as Stage, estimatedValue: "",
    packageInterest: "" as "" | "setup-only" | "setup-monthly" | "full-managed",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: deals = [], isLoading } = trpc.pipeline.list.useQuery();

  const createDeal = trpc.pipeline.create.useMutation({
    onSuccess: () => { utils.pipeline.list.invalidate(); setAddOpen(false); resetForm(); toast.success("Deal added"); },
    onError: () => toast.error("Failed to add deal"),
  });

  const updateDeal = trpc.pipeline.update.useMutation({
    onSuccess: () => { utils.pipeline.list.invalidate(); setEditDeal(null); toast.success("Deal updated"); },
  });

  const deleteDeal = trpc.pipeline.delete.useMutation({
    onSuccess: () => { utils.pipeline.list.invalidate(); toast.success("Deal deleted"); },
  });

  const aiScore = trpc.pipeline.aiScore.useMutation({
    onMutate: ({ dealId }) => setScoringId(dealId),
    onSuccess: (data) => {
      utils.pipeline.list.invalidate();
      setScoringId(null);
      toast.success(`AI Score: ${data.score}/100`, { description: data.nextAction });
    },
    onError: () => { setScoringId(null); toast.error("Scoring failed"); },
  });

  const convertToClient = trpc.pipeline.convertToClient.useMutation({
    onMutate: ({ dealId }) => setConvertingId(dealId),
    onSuccess: (data) => {
      utils.pipeline.list.invalidate();
      utils.crm.listClients.invalidate();
      setConvertingId(null);
      toast.success("Converted to CRM client!", { description: "Client record created in CRM." });
    },
    onError: () => { setConvertingId(null); toast.error("Conversion failed"); },
  });

  const resetForm = () => setForm({
    prospectName: "", businessName: "", email: "", phone: "",
    industry: "", stage: "lead", estimatedValue: "",
    packageInterest: "", notes: "",
  });

  const handleSubmit = () => {
    if (!form.prospectName || !form.businessName) return;
    const payload = {
      prospectName: form.prospectName,
      businessName: form.businessName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      industry: form.industry || undefined,
      stage: form.stage,
      estimatedValue: form.estimatedValue ? Math.round(parseFloat(form.estimatedValue) * 100) : undefined,
      packageInterest: form.packageInterest || undefined,
      notes: form.notes || undefined,
    };
    if (editDeal) {
      updateDeal.mutate({ id: editDeal.id, ...payload });
    } else {
      createDeal.mutate(payload);
    }
  };

  const openEdit = (deal: typeof deals[0]) => {
    setForm({
      prospectName: deal.prospectName,
      businessName: deal.businessName,
      email: deal.email || "",
      phone: deal.phone || "",
      industry: deal.industry || "",
      stage: deal.stage as Stage,
      estimatedValue: deal.estimatedValue ? (deal.estimatedValue / 100).toString() : "",
      packageInterest: (deal.packageInterest || "") as "" | "setup-only" | "setup-monthly" | "full-managed",
      notes: deal.notes || "",
    });
    setEditDeal(deal);
  };

  const dealsByStage = (stage: Stage) => deals.filter(d => d.stage === stage);
  const totalPipelineValue = deals
    .filter(d => d.stage !== "lost")
    .reduce((sum, d) => sum + (d.estimatedValue || 0), 0);

  return (
    <ConsoleLayout
      title="Sales Pipeline"
      actions={
        <div className="flex items-center gap-2">
          {totalPipelineValue > 0 && (
            <span className="text-green-400 text-xs font-semibold hidden sm:block">
              ${(totalPipelineValue / 100).toLocaleString("en-AU")} pipeline
            </span>
          )}
          <Button
            size="sm"
            onClick={() => { resetForm(); setEditDeal(null); setAddOpen(true); }}
            className="bg-amber-400 hover:bg-amber-300 text-[#060e1a] font-semibold text-xs h-7 gap-1"
          >
            <Plus size={12} /> Add Deal
          </Button>
        </div>
      }
    >
      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-amber-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 min-h-[60vh]">
            {STAGES.map(stage => {
              const stageDeals = dealsByStage(stage.id);
              const stageValue = stageDeals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0);
              return (
                <div key={stage.id} className="flex flex-col gap-2">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] h-5 px-2 ${stage.color}`}>{stage.label}</Badge>
                      <span className="text-white/30 text-[10px]">{stageDeals.length}</span>
                    </div>
                    {stageValue > 0 && (
                      <span className="text-green-400 text-[10px]">${(stageValue / 100).toLocaleString("en-AU")}</span>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 flex-1">
                    {stageDeals.map(deal => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onScore={() => aiScore.mutate({ dealId: deal.id })}
                        onConvert={() => convertToClient.mutate({ dealId: deal.id })}
                        onDelete={() => deleteDeal.mutate({ id: deal.id })}
                        onEdit={() => openEdit(deal)}
                      />
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="border border-dashed border-white/10 rounded-lg p-3 text-center">
                        <p className="text-white/20 text-[10px]">No deals</p>
                      </div>
                    )}
                  </div>

                  {/* Loading overlays */}
                  {scoringId !== null && stageDeals.some(d => d.id === scoringId) && (
                    <div className="flex items-center gap-1 text-amber-400 text-[10px]">
                      <Loader2 size={10} className="animate-spin" /> Scoring...
                    </div>
                  )}
                  {convertingId !== null && stageDeals.some(d => d.id === convertingId) && (
                    <div className="flex items-center gap-1 text-green-400 text-[10px]">
                      <Loader2 size={10} className="animate-spin" /> Converting...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Deal Dialog */}
      <Dialog open={addOpen || editDeal !== null} onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditDeal(null); } }}>
        <DialogContent className="bg-[#0d1f38] border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{editDeal ? "Edit Deal" : "Add Deal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60 text-xs">Prospect Name *</Label>
                <Input value={form.prospectName} onChange={e => setForm(f => ({ ...f, prospectName: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1" placeholder="Jane Smith" />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Business Name *</Label>
                <Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1" placeholder="Smith Plumbing" />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1" placeholder="jane@example.com" />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1" placeholder="0400 000 000" />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Industry</Label>
                <Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1" placeholder="Plumbing" />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Est. Value ($)</Label>
                <Input value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1" placeholder="1497" type="number" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60 text-xs">Stage</Label>
                <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v as Stage }))}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1f38] border-white/20">
                    {STAGES.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-white hover:bg-white/10">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/60 text-xs">Package Interest</Label>
                <Select value={form.packageInterest} onValueChange={v => setForm(f => ({ ...f, packageInterest: v as "" | "setup-only" | "setup-monthly" | "full-managed" }))}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1f38] border-white/20">
                    <SelectItem value="setup-only" className="text-white hover:bg-white/10">Setup Only</SelectItem>
                    <SelectItem value="setup-monthly" className="text-white hover:bg-white/10">Setup + Monthly</SelectItem>
                    <SelectItem value="full-managed" className="text-white hover:bg-white/10">Full Managed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-white/60 text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-white/5 border-white/20 text-white text-sm mt-1 resize-none" rows={2} placeholder="Any context..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSubmit}
                disabled={createDeal.isPending || updateDeal.isPending}
                className="flex-1 bg-amber-400 hover:bg-amber-300 text-[#060e1a] font-semibold text-sm h-8"
              >
                {(createDeal.isPending || updateDeal.isPending) ? <Loader2 size={14} className="animate-spin" /> : (editDeal ? "Save Changes" : "Add Deal")}
              </Button>
              <Button variant="ghost" onClick={() => { setAddOpen(false); setEditDeal(null); }}
                className="text-white/50 hover:text-white h-8">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ConsoleLayout>
  );
}
