/**
 * PortalReviews — Review request history for the tradie.
 *
 * Shows every review request sent after job completion:
 *  - Customer name, contact details, job, channel, sent date, status
 *  - Resend button for any completed job
 */
import { useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Star, RefreshCw, Loader2, CheckCircle2, XCircle, SkipForward,
  MessageSquare, Mail, Phone, ExternalLink, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "sent" | "failed" | "skipped" }) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
        <CheckCircle2 className="w-3 h-3" /> Sent
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <SkipForward className="w-3 h-3" /> Skipped
    </span>
  );
}

// ─── Channel badge ────────────────────────────────────────────────────────────
function ChannelBadge({ channel }: { channel: "sms" | "email" | "both" }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
      style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}>
      {channel === "sms" && <><Phone className="w-3 h-3" /> SMS</>}
      {channel === "email" && <><Mail className="w-3 h-3" /> Email</>}
      {channel === "both" && <><MessageSquare className="w-3 h-3" /> SMS + Email</>}
    </span>
  );
}

export default function PortalReviews() {
  const requestsQuery = trpc.portal.listReviewRequests.useQuery({ limit: 100 });
  const statsQuery = trpc.portal.getReviewRequestStats.useQuery();
  const resendMutation = trpc.portal.resendReviewRequest.useMutation({
    onSuccess: () => {
      toast.success("Review request resent!");
      requestsQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err) => toast.error(err.message ?? "Failed to resend."),
  });

  const [resendingJobId, setResendingJobId] = useState<number | null>(null);

  function handleResend(jobId: number | null | undefined) {
    if (!jobId) { toast.error("No job linked to this request."); return; }
    setResendingJobId(jobId);
    resendMutation.mutate({ jobId }, {
      onSettled: () => setResendingJobId(null),
    });
  }

  const requests = requestsQuery.data?.requests ?? [];
  const stats = statsQuery.data;

  return (
    <PortalLayout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Google Reviews</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Review requests sent automatically after job completion
            </p>
          </div>
          <Link href="/portal/settings">
            <Button variant="outline" size="sm"
              className="border-white/15 text-white/60 hover:bg-white/5 hover:text-white/80">
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </Link>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl p-5 text-center"
              style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.15)" }}>
              <p className="text-3xl font-bold" style={{ color: "#F5A623" }}>{stats.sentThisMonth}</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Sent this month</p>
            </div>
            <div className="rounded-xl p-5 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-3xl font-bold text-white">{stats.totalSent}</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Sent all time</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">Channel</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Sent</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Loading */}
          {requestsQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>
          )}

          {/* Empty state */}
          {!requestsQuery.isLoading && requests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Star className="w-10 h-10 mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm font-medium text-white/60 mb-1">No review requests yet</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Review requests are sent automatically when you mark a job as complete.
              </p>
              <Link href="/portal/settings">
                <Button variant="outline" size="sm" className="mt-4 border-white/15 text-white/50 hover:bg-white/5">
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  Set up Google Review link
                </Button>
              </Link>
            </div>
          )}

          {/* Rows */}
          {requests.map((req) => (
            <div
              key={req.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              {/* Customer */}
              <div className="col-span-3 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {req.customerName ?? "Unknown"}
                </p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {req.customerPhone ?? req.customerEmail ?? "No contact"}
                </p>
              </div>

              {/* Channel */}
              <div className="col-span-2">
                <ChannelBadge channel={req.channel} />
              </div>

              {/* Status */}
              <div className="col-span-2">
                <StatusBadge status={req.status} />
                {req.status === "failed" && req.errorMessage && (
                  <p className="text-xs mt-1 truncate" style={{ color: "rgba(239,68,68,0.7)" }} title={req.errorMessage}>
                    {req.errorMessage.slice(0, 40)}
                  </p>
                )}
              </div>

              {/* Sent date */}
              <div className="col-span-3">
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {new Date(req.sentAt).toLocaleDateString("en-AU", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {new Date(req.sentAt).toLocaleTimeString("en-AU", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>

              {/* Resend */}
              <div className="col-span-2 flex justify-end">
                {req.jobId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/15 text-white/50 hover:bg-white/5 hover:text-white/80 text-xs"
                    onClick={() => handleResend(req.jobId)}
                    disabled={resendingJobId === req.jobId}
                  >
                    {resendingJobId === req.jobId ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <><RefreshCw className="w-3 h-3 mr-1" />Resend</>
                    )}
                  </Button>
                ) : (
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Help tip */}
        <div className="mt-6 rounded-lg p-4 flex gap-3"
          style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.12)" }}>
          <Star className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            <strong className="text-white/70">Tip:</strong> Review requests are sent automatically when you mark a job as complete in the Jobs tab.
            Make sure your Google review link is configured in{" "}
            <Link href="/portal/settings">
              <span className="underline cursor-pointer" style={{ color: "#F5A623" }}>Settings <ExternalLink className="inline w-3 h-3" /></span>
            </Link>.
          </p>
        </div>
      </div>
    </PortalLayout>
  );
}
