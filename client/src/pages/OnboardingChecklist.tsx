/**
 * OnboardingChecklist — /console/crm/:id/checklist
 * Per-client 9-step delivery checklist with automation triggers.
 *
 * Steps:
 *  1. Payment confirmed       — auto (Stripe webhook)
 *  2. CRM client created      — auto (on client creation)
 *  3. Welcome email sent      — one-click automation
 *  4. Onboarding form sent    — one-click (generates signed URL + sends email)
 *  5. Onboarding form completed — auto (client submits form)
 *  6. Prompt built            — one-click (AI prompt generation)
 *  7. Vapi agent configured   — manual (paste Vapi assistant ID)
 *  8. Test call completed     — manual (tick after calling)
 *  9. Client live             — one-click (go-live email + sets stage active)
 */
import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  SkipForward,
  Zap,
  Hand,
  MousePointerClick,
  CreditCard,
  UserPlus,
  Mail,
  ClipboardList,
  FileCheck,
  Wand2,
  Radio,
  PhoneCall,
  Rocket,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "done" | "skipped";

type ChecklistData = {
  id: number;
  clientId: number;
  paymentConfirmedStatus: StepStatus;
  paymentConfirmedAt: Date | null;
  paymentConfirmedNote: string | null;
  crmCreatedStatus: StepStatus;
  crmCreatedAt: Date | null;
  welcomeEmailStatus: StepStatus;
  welcomeEmailSentAt: Date | null;
  welcomeEmailContent: string | null;
  formSentStatus: StepStatus;
  formSentAt: Date | null;
  formToken: string | null;
  formCompletedStatus: StepStatus;
  formCompletedAt: Date | null;
  promptBuiltStatus: StepStatus;
  promptBuiltAt: Date | null;
  savedPromptId: number | null;
  vapiConfiguredStatus: StepStatus;
  vapiConfiguredAt: Date | null;
  vapiAgentId: string | null;
  testCallStatus: StepStatus;
  testCallAt: Date | null;
  testCallNote: string | null;
  clientLiveStatus: StepStatus;
  clientLiveAt: Date | null;
  goLiveEmailContent: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date | null | string): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function completedCount(checklist: ChecklistData): number {
  const statuses = [
    checklist.paymentConfirmedStatus,
    checklist.crmCreatedStatus,
    checklist.welcomeEmailStatus,
    checklist.formSentStatus,
    checklist.formCompletedStatus,
    checklist.promptBuiltStatus,
    checklist.vapiConfiguredStatus,
    checklist.testCallStatus,
    checklist.clientLiveStatus,
  ];
  return statuses.filter(s => s === "done" || s === "skipped").length;
}

// ─── Step Card ────────────────────────────────────────────────────────────────

type AutomationType = "auto" | "one-click" | "manual";

interface StepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  automationType: AutomationType;
  status: StepStatus;
  completedAt?: Date | string | null;
  note?: string | null;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  actionLoading?: boolean;
  children?: React.ReactNode;
  skippable?: boolean;
  onSkip?: () => void;
  onUnskip?: () => void;
}

function StepCard({
  stepNumber,
  title,
  description,
  automationType,
  status,
  completedAt,
  note,
  actionLabel,
  actionIcon,
  onAction,
  actionLoading,
  children,
  skippable,
  onSkip,
  onUnskip,
}: StepCardProps) {
  const isDone = status === "done";
  const isSkipped = status === "skipped";
  const isPending = status === "pending";

  const automationBadge = {
    auto: { label: "Automated", icon: <Zap className="w-3 h-3" />, className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    "one-click": { label: "One-click", icon: <MousePointerClick className="w-3 h-3" />, className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    manual: { label: "Manual", icon: <Hand className="w-3 h-3" />, className: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  }[automationType];

  return (
    <div
      className={`relative rounded-xl border transition-all duration-200 ${
        isDone
          ? "border-green-500/30 bg-green-500/5"
          : isSkipped
          ? "border-slate-600/30 bg-slate-800/30 opacity-60"
          : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600/50"
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Step number / status icon */}
          <div className="flex-shrink-0 mt-0.5">
            {isDone ? (
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            ) : isSkipped ? (
              <SkipForward className="w-6 h-6 text-slate-500" />
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-slate-600 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-400">{stepNumber}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className={`font-semibold text-sm ${isDone ? "text-green-300" : isSkipped ? "text-slate-500" : "text-slate-200"}`}>
                {title}
              </h3>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${automationBadge.className}`}>
                {automationBadge.icon}
                {automationBadge.label}
              </span>
              {isDone && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/20 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Done
                </span>
              )}
              {isSkipped && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-400 border-slate-500/20 font-medium">
                  <SkipForward className="w-3 h-3" />
                  Skipped
                </span>
              )}
            </div>

            <p className={`text-xs leading-relaxed mb-3 ${isDone || isSkipped ? "text-slate-500" : "text-slate-400"}`}>
              {description}
            </p>

            {completedAt && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                <Clock className="w-3 h-3" />
                {formatDate(completedAt)}
              </p>
            )}

            {note && (
              <p className="text-xs text-slate-400 bg-slate-700/30 rounded-lg px-3 py-2 border border-slate-700/50 mb-3">
                {note}
              </p>
            )}

            {/* Extra content (e.g. form URL, prompt preview) */}
            {children}

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap mt-3">
              {!isDone && !isSkipped && onAction && actionLabel && (
                <Button
                  size="sm"
                  onClick={onAction}
                  disabled={actionLoading}
                  className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
                >
                  {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : actionIcon}
                  {actionLabel}
                </Button>
              )}
              {isDone && onAction && actionLabel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAction}
                  disabled={actionLoading}
                  className="h-8 text-xs gap-1.5 border-slate-600 text-slate-400 hover:text-slate-200"
                >
                  {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : actionIcon}
                  Redo
                </Button>
              )}
              {skippable && !isDone && !isSkipped && onSkip && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onSkip}
                  className="h-8 text-xs text-slate-500 hover:text-slate-300"
                >
                  Skip
                </Button>
              )}
              {isSkipped && onUnskip && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onUnskip}
                  className="h-8 text-xs text-slate-500 hover:text-slate-300"
                >
                  Undo skip
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingChecklist() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id || "0", 10);
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();

  // Modal state
  const [vapiModalOpen, setVapiModalOpen] = useState(false);
  const [vapiAgentIdInput, setVapiAgentIdInput] = useState("");
  const [testCallModalOpen, setTestCallModalOpen] = useState(false);
  const [testCallNote, setTestCallNote] = useState("");
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [promptContent, setPromptContent] = useState<{ systemPrompt: string; firstMessage: string } | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailContent, setEmailContent] = useState("");
  const [emailModalTitle, setEmailModalTitle] = useState("");
  const [formUrlModalOpen, setFormUrlModalOpen] = useState(false);
  const [formUrlData, setFormUrlData] = useState<{ formUrl: string; emailContent: string } | null>(null);

  // Data queries
  const { data: client } = trpc.crm.getClient.useQuery({ id: clientId }, { enabled: !!clientId });
  const { data: checklist, isLoading } = trpc.checklist.get.useQuery({ clientId }, { enabled: !!clientId });

  // Mutations
  const updateStep = trpc.checklist.updateStep.useMutation({
    onSuccess: () => utils.checklist.get.invalidate({ clientId }),
    onError: (e) => toast.error(e.message),
  });

  const sendWelcomeEmail = trpc.checklist.sendWelcomeEmail.useMutation({
    onSuccess: (data) => {
      utils.checklist.get.invalidate({ clientId });
      setEmailContent(data.emailContent);
      setEmailModalTitle("Welcome Email Drafted");
      setEmailModalOpen(true);
      toast.success("Welcome email drafted and saved to CRM");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendOnboardingForm = trpc.checklist.sendOnboardingForm.useMutation({
    onSuccess: (data) => {
      utils.checklist.get.invalidate({ clientId });
      setFormUrlData({ formUrl: data.formUrl, emailContent: data.emailContent });
      setFormUrlModalOpen(true);
      toast.success("Onboarding form link generated");
    },
    onError: (e) => toast.error(e.message),
  });

  const generatePrompt = trpc.checklist.generatePrompt.useMutation({
    onSuccess: (data) => {
      utils.checklist.get.invalidate({ clientId });
      setPromptContent({ systemPrompt: data.systemPrompt, firstMessage: data.firstMessage });
      setPromptModalOpen(true);
      toast.success("Vapi prompt generated and saved to CRM");
    },
    onError: (e) => toast.error(e.message),
  });

  const goLive = trpc.checklist.goLive.useMutation({
    onSuccess: (data) => {
      utils.checklist.get.invalidate({ clientId });
      setEmailContent(data.emailContent);
      setEmailModalTitle("Go-Live Email Drafted");
      setEmailModalOpen(true);
      toast.success("Client marked as live! Go-live email drafted.");
    },
    onError: (e) => toast.error(e.message),
  });

  // Auth guard
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </DashboardLayout>
    );
  }
  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  const done = checklist ? completedCount(checklist as unknown as ChecklistData) : 0;
  const total = 9;
  const progressPct = Math.round((done / total) * 100);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/console/crm/${clientId}`}>
            <a className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to client
            </a>
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                Onboarding Checklist
              </h1>
              {client && (
                <p className="text-slate-400 text-sm mt-1">
                  {client.businessName} · {client.contactName}
                </p>
              )}
            </div>
            {checklist && (
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold text-slate-100">{done}/{total}</div>
                <div className="text-xs text-slate-400">steps complete</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {checklist && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400">Automated</span> — fires on its own
            </span>
            <span className="flex items-center gap-1.5">
              <MousePointerClick className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400">One-click</span> — press a button
            </span>
            <span className="flex items-center gap-1.5">
              <Hand className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Manual</span> — do it yourself
            </span>
          </div>
        </div>

        {/* Checklist steps */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : checklist ? (
          <div className="space-y-3">
            {/* Step 1: Payment confirmed */}
            <StepCard
              stepNumber={1}
              title="Payment Confirmed"
              description="Stripe checkout completed. The subscription is active and the client record has been created."
              automationType="auto"
              status={(checklist as unknown as ChecklistData).paymentConfirmedStatus}
              completedAt={(checklist as unknown as ChecklistData).paymentConfirmedAt}
              note={(checklist as unknown as ChecklistData).paymentConfirmedNote}
              skippable
              onSkip={() => updateStep.mutate({ clientId, step: "paymentConfirmed", status: "skipped" })}
              onUnskip={() => updateStep.mutate({ clientId, step: "paymentConfirmed", status: "pending" })}
            >
              {(checklist as unknown as ChecklistData).paymentConfirmedStatus === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStep.mutate({ clientId, step: "paymentConfirmed", status: "done" })}
                  disabled={updateStep.isPending}
                  className="h-8 text-xs gap-1.5 border-slate-600 text-slate-400 hover:text-slate-200"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Mark as confirmed
                </Button>
              )}
            </StepCard>

            {/* Step 2: CRM client created */}
            <StepCard
              stepNumber={2}
              title="CRM Client Created"
              description="Client record exists in the CRM with contact details, package, and MRR set."
              automationType="auto"
              status={(checklist as unknown as ChecklistData).crmCreatedStatus}
              completedAt={(checklist as unknown as ChecklistData).crmCreatedAt}
            />

            {/* Step 3: Welcome email */}
            <StepCard
              stepNumber={3}
              title="Welcome Email Sent"
              description="A personalised welcome email is drafted by AI and sent to the client. Introduces Solvr, confirms the package, and sets expectations."
              automationType="one-click"
              status={(checklist as unknown as ChecklistData).welcomeEmailStatus}
              completedAt={(checklist as unknown as ChecklistData).welcomeEmailSentAt}
              actionLabel="Draft & Send Welcome Email"
              actionIcon={<Mail className="w-3 h-3" />}
              onAction={() => sendWelcomeEmail.mutate({ clientId })}
              actionLoading={sendWelcomeEmail.isPending}
              skippable
              onSkip={() => updateStep.mutate({ clientId, step: "welcomeEmail", status: "skipped" })}
              onUnskip={() => updateStep.mutate({ clientId, step: "welcomeEmail", status: "pending" })}
            >
              {(checklist as unknown as ChecklistData).welcomeEmailContent && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEmailContent((checklist as unknown as ChecklistData).welcomeEmailContent || "");
                    setEmailModalTitle("Welcome Email");
                    setEmailModalOpen(true);
                  }}
                  className="h-7 text-xs text-slate-400 hover:text-slate-200 gap-1"
                >
                  <Mail className="w-3 h-3" />
                  View email
                </Button>
              )}
            </StepCard>

            {/* Step 4: Onboarding form sent */}
            <StepCard
              stepNumber={4}
              title="Onboarding Form Sent"
              description="A signed onboarding form link is generated and emailed to the client. Captures business details, FAQs, hours, services, and tone preference."
              automationType="one-click"
              status={(checklist as unknown as ChecklistData).formSentStatus}
              completedAt={(checklist as unknown as ChecklistData).formSentAt}
              actionLabel="Generate & Send Form Link"
              actionIcon={<ClipboardList className="w-3 h-3" />}
              onAction={() => sendOnboardingForm.mutate({ clientId, origin: window.location.origin })}
              actionLoading={sendOnboardingForm.isPending}
              skippable
              onSkip={() => updateStep.mutate({ clientId, step: "formSent", status: "skipped" })}
              onUnskip={() => updateStep.mutate({ clientId, step: "formSent", status: "pending" })}
            >
              {(checklist as unknown as ChecklistData).formToken && (
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-slate-400 bg-slate-700/40 rounded px-2 py-1 font-mono truncate max-w-xs">
                    {window.location.origin}/onboarding?token={(checklist as unknown as ChecklistData).formToken}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/onboarding?token=${(checklist as unknown as ChecklistData).formToken}`);
                      toast.success("Form URL copied");
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </StepCard>

            {/* Step 5: Form completed */}
            <StepCard
              stepNumber={5}
              title="Onboarding Form Completed"
              description="The client has submitted their onboarding form. All business details are now available for prompt building."
              automationType="auto"
              status={(checklist as unknown as ChecklistData).formCompletedStatus}
              completedAt={(checklist as unknown as ChecklistData).formCompletedAt}
              skippable
              onSkip={() => updateStep.mutate({ clientId, step: "formCompleted", status: "skipped" })}
              onUnskip={() => updateStep.mutate({ clientId, step: "formCompleted", status: "pending" })}
            >
              {(checklist as unknown as ChecklistData).formCompletedStatus === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStep.mutate({ clientId, step: "formCompleted", status: "done" })}
                  disabled={updateStep.isPending}
                  className="h-8 text-xs gap-1.5 border-slate-600 text-slate-400 hover:text-slate-200"
                >
                  <FileCheck className="w-3 h-3" />
                  Mark as received
                </Button>
              )}
            </StepCard>

            {/* Step 6: Prompt built */}
            <StepCard
              stepNumber={6}
              title="Vapi Prompt Built"
              description="An AI-generated system prompt and first message are created for the Vapi agent, tailored to the client's business, services, and tone."
              automationType="one-click"
              status={(checklist as unknown as ChecklistData).promptBuiltStatus}
              completedAt={(checklist as unknown as ChecklistData).promptBuiltAt}
              actionLabel="Generate Vapi Prompt"
              actionIcon={<Wand2 className="w-3 h-3" />}
              onAction={() => generatePrompt.mutate({ clientId })}
              actionLoading={generatePrompt.isPending}
              skippable
              onSkip={() => updateStep.mutate({ clientId, step: "promptBuilt", status: "skipped" })}
              onUnskip={() => updateStep.mutate({ clientId, step: "promptBuilt", status: "pending" })}
            >
              {(checklist as unknown as ChecklistData).promptBuiltStatus === "done" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => generatePrompt.mutate({ clientId })}
                  disabled={generatePrompt.isPending}
                  className="h-7 text-xs text-slate-400 hover:text-slate-200 gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  Regenerate
                </Button>
              )}
            </StepCard>

            {/* Step 7: Vapi configured */}
            <StepCard
              stepNumber={7}
              title="Vapi Agent Configured"
              description="Create the Vapi assistant, paste in the generated system prompt and first message, and copy the Vapi assistant ID back here."
              automationType="manual"
              status={(checklist as unknown as ChecklistData).vapiConfiguredStatus}
              completedAt={(checklist as unknown as ChecklistData).vapiConfiguredAt}
              skippable
              onSkip={() => updateStep.mutate({ clientId, step: "vapiConfigured", status: "skipped" })}
              onUnskip={() => updateStep.mutate({ clientId, step: "vapiConfigured", status: "pending" })}
            >
              {(checklist as unknown as ChecklistData).vapiAgentId ? (
                <div className="flex items-center gap-2 mt-1">
                  <Radio className="w-3 h-3 text-green-400" />
                  <code className="text-xs text-green-400 font-mono">{(checklist as unknown as ChecklistData).vapiAgentId}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                    onClick={() => {
                      navigator.clipboard.writeText((checklist as unknown as ChecklistData).vapiAgentId || "");
                      toast.success("Agent ID copied");
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setVapiModalOpen(true)}
                  className="h-8 text-xs gap-1.5 border-slate-600 text-slate-400 hover:text-slate-200 mt-1"
                >
                  <Radio className="w-3 h-3" />
                  Enter Vapi Agent ID
                </Button>
              )}
            </StepCard>

            {/* Step 8: Test call */}
            <StepCard
              stepNumber={8}
              title="Test Call Completed"
              description="Call the Vapi number yourself and verify the agent introduces itself correctly, handles a sample enquiry, and escalates appropriately."
              automationType="manual"
              status={(checklist as unknown as ChecklistData).testCallStatus}
              completedAt={(checklist as unknown as ChecklistData).testCallAt}
              note={(checklist as unknown as ChecklistData).testCallNote}
              skippable
              onSkip={() => updateStep.mutate({ clientId, step: "testCall", status: "skipped" })}
              onUnskip={() => updateStep.mutate({ clientId, step: "testCall", status: "pending" })}
            >
              {(checklist as unknown as ChecklistData).testCallStatus === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTestCallModalOpen(true)}
                  className="h-8 text-xs gap-1.5 border-slate-600 text-slate-400 hover:text-slate-200 mt-1"
                >
                  <PhoneCall className="w-3 h-3" />
                  Mark test call done
                </Button>
              )}
            </StepCard>

            {/* Step 9: Client live */}
            <StepCard
              stepNumber={9}
              title="Client Live"
              description="The agent is live and the client's number is forwarded. A go-live email is drafted and sent. The CRM stage is updated to Active."
              automationType="one-click"
              status={(checklist as unknown as ChecklistData).clientLiveStatus}
              completedAt={(checklist as unknown as ChecklistData).clientLiveAt}
              actionLabel="Go Live!"
              actionIcon={<Rocket className="w-3 h-3" />}
              onAction={() => goLive.mutate({ clientId })}
              actionLoading={goLive.isPending}
              skippable
              onSkip={() => updateStep.mutate({ clientId, step: "clientLive", status: "skipped" })}
              onUnskip={() => updateStep.mutate({ clientId, step: "clientLive", status: "pending" })}
            >
              {(checklist as unknown as ChecklistData).goLiveEmailContent && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEmailContent((checklist as unknown as ChecklistData).goLiveEmailContent || "");
                    setEmailModalTitle("Go-Live Email");
                    setEmailModalOpen(true);
                  }}
                  className="h-7 text-xs text-slate-400 hover:text-slate-200 gap-1"
                >
                  <Mail className="w-3 h-3" />
                  View email
                </Button>
              )}
            </StepCard>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <Circle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No checklist found for this client.</p>
          </div>
        )}
      </div>

      {/* Vapi Agent ID Modal */}
      <Dialog open={vapiModalOpen} onOpenChange={setVapiModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Enter Vapi Agent ID</DialogTitle>
            <DialogDescription className="text-slate-400">
              Paste the Vapi assistant ID from your Vapi dashboard. This links call transcripts to this client automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={vapiAgentIdInput}
              onChange={(e) => setVapiAgentIdInput(e.target.value)}
              placeholder="e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890"
              className="bg-slate-800 border-slate-600 text-slate-100 font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVapiModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!vapiAgentIdInput.trim()) return;
                updateStep.mutate({
                  clientId,
                  step: "vapiConfigured",
                  status: "done",
                  vapiAgentId: vapiAgentIdInput.trim(),
                });
                setVapiModalOpen(false);
                setVapiAgentIdInput("");
              }}
              disabled={!vapiAgentIdInput.trim() || updateStep.isPending}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
            >
              Save Agent ID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Call Modal */}
      <Dialog open={testCallModalOpen} onOpenChange={setTestCallModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Mark Test Call Complete</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add any notes from the test call (optional). What worked well? Anything to fix?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={testCallNote}
              onChange={(e) => setTestCallNote(e.target.value)}
              placeholder="e.g. Agent introduced correctly, handled quote request well. Need to adjust escalation wording."
              className="bg-slate-800 border-slate-600 text-slate-100 text-sm min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestCallModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateStep.mutate({
                  clientId,
                  step: "testCall",
                  status: "done",
                  note: testCallNote || undefined,
                });
                setTestCallModalOpen(false);
                setTestCallNote("");
              }}
              disabled={updateStep.isPending}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle>{emailModalTitle}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Review this email before sending. Copy and paste into your email client.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="bg-slate-800/60 rounded-lg border border-slate-700/50 p-4 text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-[400px] overflow-y-auto">
              {emailContent}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(emailContent);
                toast.success("Email copied to clipboard");
              }}
              className="text-slate-400 gap-1.5"
            >
              <Copy className="w-4 h-4" />
              Copy
            </Button>
            <Button onClick={() => setEmailModalOpen(false)} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form URL Modal */}
      <Dialog open={formUrlModalOpen} onOpenChange={setFormUrlModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Onboarding Form Ready</DialogTitle>
            <DialogDescription className="text-slate-400">
              Send this link to your client. The email below has been drafted — copy and paste it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {formUrlData && (
              <>
                <div>
                  <p className="text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Form URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-amber-400 bg-slate-800/60 rounded px-3 py-2 font-mono border border-slate-700/50 truncate">
                      {formUrlData.formUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 flex-shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(formUrlData.formUrl);
                        toast.success("URL copied");
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <a href={formUrlData.formUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 flex-shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Email to send</p>
                  <div className="bg-slate-800/60 rounded-lg border border-slate-700/50 p-4 text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-[280px] overflow-y-auto">
                    {formUrlData.emailContent}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (formUrlData) {
                  navigator.clipboard.writeText(formUrlData.emailContent);
                  toast.success("Email copied to clipboard");
                }
              }}
              className="text-slate-400 gap-1.5"
            >
              <Copy className="w-4 h-4" />
              Copy email
            </Button>
            <Button onClick={() => setFormUrlModalOpen(false)} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt Preview Modal */}
      <Dialog open={promptModalOpen} onOpenChange={setPromptModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vapi Prompt Generated</DialogTitle>
            <DialogDescription className="text-slate-400">
              Copy the system prompt and first message into your Vapi assistant configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {promptContent && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">System Prompt</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-slate-400 hover:text-slate-200 gap-1"
                      onClick={() => {
                        navigator.clipboard.writeText(promptContent.systemPrompt);
                        toast.success("System prompt copied");
                      }}
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg border border-slate-700/50 p-4 text-xs text-slate-300 font-mono leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                    {promptContent.systemPrompt}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">First Message</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-slate-400 hover:text-slate-200 gap-1"
                      onClick={() => {
                        navigator.clipboard.writeText(promptContent.firstMessage);
                        toast.success("First message copied");
                      }}
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg border border-slate-700/50 p-4 text-sm text-slate-300 font-sans leading-relaxed border-amber-500/20 bg-amber-500/5">
                    {promptContent.firstMessage}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPromptModalOpen(false)} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
