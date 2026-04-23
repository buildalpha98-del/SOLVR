/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * SMSCampaignCard — mobile-first card for a single SMS campaign.
 * Replaces the packed grid row with a scannable 3-line vertical card.
 * Expanded state hosts Retry / Cancel actions and the per-recipient delivery list.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, ChevronDown, ChevronUp, CalendarClock, RefreshCw, X, Loader2,
  CheckCircle2, XCircle, Clock, UserMinus,
} from "lucide-react";
import { hapticWarning } from "@/lib/haptics";

type Campaign = {
  id: number;
  name: string;
  message: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount?: number | null;
  status: string;
  scheduledAt: Date | string | null;
  createdAt: Date | string;
  completedAt: Date | string | null;
};

function fmtDate(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtDateTime(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleString("en-AU", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function CampaignRecipientsList({ campaignId }: { campaignId: number }) {
  const { data: recipients = [], isLoading } = trpc.portalCustomers.getCampaignRecipients.useQuery(
    { campaignId },
    { retry: 2, staleTime: 30_000 },
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-4">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#F5A623" }} />
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          Loading recipients…
        </span>
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="px-4 py-4 text-center">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          No recipients recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        Recipients ({recipients.length})
      </p>
      {recipients.map((r) => (
        <div
          key={r.id}
          className="rounded-lg p-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{r.name}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                {r.phone}
              </p>
            </div>
            <div className="flex-shrink-0">
              {r.status === "sent" && (
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: "#4ade80" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                </span>
              )}
              {r.status === "failed" && (
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: "#f87171" }}
                >
                  <XCircle className="w-3.5 h-3.5" /> Failed
                </span>
              )}
              {r.status === "pending" && (
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <Clock className="w-3.5 h-3.5" /> Pending
                </span>
              )}
            </div>
          </div>
          {r.sentAt && (
            <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              Sent {fmtDateTime(r.sentAt)}
            </p>
          )}
          {r.errorMessage && (
            <p
              className="text-[11px] mt-1.5 line-clamp-2"
              style={{ color: "#f87171" }}
              title={r.errorMessage}
            >
              {r.errorMessage}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SMSCampaignCard({
  campaign,
  onRetried,
  onCancelled,
}: {
  campaign: Campaign;
  onRetried: () => void;
  onCancelled: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const retryMutation = trpc.portalCustomers.retryFailedRecipients.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      onRetried();
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  const cancelMutation = trpc.portalCustomers.cancelCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign cancelled — no messages will be sent.");
      onCancelled();
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  const statusColor =
    campaign.status === "completed" ? "#4ade80"
    : campaign.status === "failed" ? "#f87171"
    : campaign.status === "cancelled" ? "rgba(255,255,255,0.4)"
    : "#F5A623";

  const canRetry =
    campaign.failedCount > 0 &&
    (campaign.status === "completed" || campaign.status === "failed");
  const canCancel = campaign.status === "pending";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full min-h-11 text-left p-4"
      >
        <div className="flex items-start gap-3">
          <MessageSquare
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            style={{ color: "#F5A623" }}
          />

          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Row 1 — title + sent date */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white truncate">{campaign.name}</p>
              <span
                className="text-[11px] flex-shrink-0 whitespace-nowrap"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {fmtDate(campaign.createdAt)}
              </span>
            </div>

            {/* Row 2 — recipient count + status pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                {campaign.totalCount} recipient
                {campaign.totalCount !== 1 ? "s" : ""}
              </span>
              <Badge
                className="text-[10px] px-2 py-0.5 capitalize font-semibold"
                style={{
                  background: `${statusColor}20`,
                  color: statusColor,
                  border: "none",
                }}
              >
                {campaign.status}
              </Badge>
              {campaign.sentCount > 0 && (
                <span className="text-[11px]" style={{ color: "#4ade80" }}>
                  {campaign.sentCount} sent
                </span>
              )}
              {campaign.failedCount > 0 && (
                <span className="text-[11px]" style={{ color: "#f87171" }}>
                  {campaign.failedCount} failed
                </span>
              )}
              {(campaign.skippedCount ?? 0) > 0 && (
                <span
                  className="flex items-center gap-0.5 text-[11px]"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                  title={`${campaign.skippedCount} skipped (SMS opt-out)`}
                >
                  <UserMinus className="w-3 h-3" />
                  {campaign.skippedCount} skipped
                </span>
              )}
            </div>

            {/* Row 3 — truncated message preview (2 lines max) */}
            <p
              className="text-xs leading-relaxed"
              style={{
                color: "rgba(255,255,255,0.5)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {campaign.message}
            </p>

            {campaign.scheduledAt && campaign.status === "pending" && (
              <p
                className="text-[11px] flex items-center gap-1"
                style={{ color: "#F5A623" }}
              >
                <CalendarClock className="w-3 h-3" />
                Scheduled for {fmtDateTime(campaign.scheduledAt)}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 mt-1">
            {expanded ? (
              <ChevronUp className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div
          className="border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.12)" }}
        >
          {(canRetry || canCancel) && (
            <div
              className="px-4 py-3 flex flex-col gap-2 border-b"
              style={{ borderColor: "rgba(255,255,255,0.05)" }}
            >
              {canRetry && (
                <button
                  type="button"
                  onClick={() => retryMutation.mutate({ campaignId: campaign.id })}
                  disabled={retryMutation.isPending}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm disabled:opacity-50"
                  style={{
                    background: "rgba(248,113,113,0.15)",
                    color: "#f87171",
                    border: "1px solid rgba(248,113,113,0.25)",
                  }}
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Retry {campaign.failedCount} failed
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => {
                    hapticWarning();
                    if (
                      confirm(
                        "Cancel this scheduled campaign? This cannot be undone.",
                      )
                    ) {
                      cancelMutation.mutate({ campaignId: campaign.id });
                    }
                  }}
                  disabled={cancelMutation.isPending}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Cancel scheduled send
                </button>
              )}
            </div>
          )}

          <CampaignRecipientsList campaignId={campaign.id} />
        </div>
      )}
    </div>
  );
}
