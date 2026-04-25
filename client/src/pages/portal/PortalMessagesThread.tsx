/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Single-thread view: bubble list + compose box + AI-suggested-reply chip.
 * Mounted by PortalMessages when the URL matches /portal/messages/:id.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Send, Sparkles, Loader2, Phone, MessageSquare, Archive, ArchiveRestore, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { WriteGuard } from "@/components/portal/ViewerBanner";

const SENT_BY_LABELS: Record<string, string> = {
  "auto-faq": "Auto-reply (FAQ match)",
  "campaign": "Campaign",
  "system": "System",
};

export function PortalMessagesThread({ conversationId }: { conversationId: string }) {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  const { data, isLoading, error, refetch } = trpc.smsConversations.getThread.useQuery(
    { conversationId },
    { staleTime: 5_000, retry: 2 },
  );

  const markRead = trpc.smsConversations.markRead.useMutation({
    onSuccess: () => {
      // Refresh the inbox + unread badge after we read this thread
      utils.smsConversations.list.invalidate();
      utils.smsConversations.getUnreadCount.invalidate();
    },
  });

  const sendReply = trpc.smsConversations.sendReply.useMutation({
    onSuccess: () => {
      hapticSuccess();
      setDraft("");
      utils.smsConversations.getThread.invalidate({ conversationId });
      utils.smsConversations.list.invalidate();
    },
    onError: (err) => {
      hapticWarning();
      toast.error(err.message ?? "Couldn't send. Check your connection and try again.");
    },
  });

  const archive = trpc.smsConversations.archive.useMutation({
    onSuccess: () => {
      utils.smsConversations.list.invalidate();
      toast.success("Conversation archived");
      navigate("/portal/messages");
    },
    onError: (err) => toast.error(err.message ?? "Archive failed."),
  });

  const unarchive = trpc.smsConversations.unarchive.useMutation({
    onSuccess: () => {
      utils.smsConversations.list.invalidate();
      utils.smsConversations.getThread.invalidate({ conversationId });
      toast.success("Conversation restored");
    },
    onError: (err) => toast.error(err.message ?? "Restore failed."),
  });

  // Mark read on mount + whenever new inbound messages arrive (so opening
  // a thread that's actively receiving messages still clears the badge).
  useEffect(() => {
    if (data && data.conversation.unreadCount > 0) {
      markRead.mutate({ conversationId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, data?.conversation.unreadCount]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!data || !scrollerRef.current) return;
    if (data.messages.length > lastMessageCountRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
    lastMessageCountRef.current = data.messages.length;
  }, [data]);

  const useSuggestion = useCallback((suggestion: string) => {
    setDraft(suggestion);
  }, []);

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    if (body.length > 1600) {
      toast.error("Message too long — Twilio limit is 1600 characters.");
      return;
    }
    sendReply.mutate({ body, conversationId });
  }, [draft, conversationId, sendReply]);

  if (isLoading) {
    return (
      <PortalLayout activeTab="messages">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
        </div>
      </PortalLayout>
    );
  }

  if (error || !data) {
    return (
      <PortalLayout activeTab="messages">
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            {error?.message ?? "Couldn't load this conversation."}
          </p>
          <Link href="/portal/messages">
            <a className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold" style={{ color: "#F5A623" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to inbox
            </a>
          </Link>
        </div>
      </PortalLayout>
    );
  }

  const { conversation, messages } = data;
  const phoneClean = conversation.customerPhone.replace(/[^\d+]/g, "");
  // Most recent inbound message (with possible AI suggestion)
  const lastInbound = [...messages].reverse().find(m => m.direction === "inbound");
  const showSuggestion = lastInbound?.aiSuggestedReply && messages[messages.length - 1]?.direction === "inbound";

  return (
    <PortalLayout activeTab="messages">
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/portal/messages">
            <a
              className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
              aria-label="Back to inbox"
            >
              <ArrowLeft className="w-4 h-4" />
            </a>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {conversation.customerName ?? conversation.customerPhone}
            </p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              {conversation.customerPhone}
              {conversation.status === "archived" && " · Archived"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a
              href={`tel:${phoneClean}`}
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
              aria-label="Call"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
            <WriteGuard>
              {conversation.status === "active" ? (
                <button
                  onClick={() => {
                    if (window.confirm("Archive this conversation? You can restore it later from the Archived filter.")) {
                      archive.mutate({ conversationId });
                    }
                  }}
                  className="flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                  aria-label="Archive"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => unarchive.mutate({ conversationId })}
                  className="flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}
                  aria-label="Restore"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                </button>
              )}
            </WriteGuard>
          </div>
        </div>

        {/* Message bubbles */}
        <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-2 pb-2 -mx-1 px-1">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.2)" }} />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>No messages yet — type below to start.</p>
            </div>
          ) : (
            messages.map(m => <MessageBubble key={m.id} message={m} />)
          )}
        </div>

        {/* AI-suggested-reply chip */}
        {showSuggestion && lastInbound?.aiSuggestedReply && (
          <button
            type="button"
            onClick={() => useSuggestion(lastInbound.aiSuggestedReply!)}
            className="flex items-start gap-2 p-3 rounded-xl mb-2 text-left"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)" }}
          >
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#F5A623" }}>
                AI suggested reply — tap to edit
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.85)" }}>
                {lastInbound.aiSuggestedReply}
              </p>
            </div>
          </button>
        )}

        {/* Compose */}
        <WriteGuard>
          <div className="flex items-end gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={conversation.status === "archived" ? "Restore the conversation to reply…" : "Type a message…"}
              disabled={conversation.status === "archived"}
              rows={2}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none resize-none disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", maxHeight: 120 }}
            />
            <button
              onClick={handleSend}
              disabled={sendReply.isPending || !draft.trim() || conversation.status === "archived"}
              className="flex items-center justify-center min-w-11 min-h-11 rounded-lg flex-shrink-0 disabled:opacity-50"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              aria-label="Send"
            >
              {sendReply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {draft.length > 0 && (
            <p className="text-[10px] mt-1 text-right" style={{ color: draft.length > 160 ? "#F5A623" : "rgba(255,255,255,0.35)" }}>
              {draft.length} chars{draft.length > 160 && ` · ${Math.ceil(draft.length / 153)} segments`}
            </p>
          )}
        </WriteGuard>
      </div>
    </PortalLayout>
  );
}

function MessageBubble({ message: m }: { message: {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  sentBy: string | null;
  createdAt: Date | string;
} }) {
  const isOutbound = m.direction === "outbound";
  const isFailed = m.status === "failed";
  const sentByLabel = m.sentBy && m.sentBy !== "tradie" ? SENT_BY_LABELS[m.sentBy] : null;

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%] space-y-0.5">
        {sentByLabel && (
          <p className="text-[10px] font-semibold uppercase tracking-wide px-1" style={{ color: "rgba(245,166,35,0.7)" }}>
            {sentByLabel}
          </p>
        )}
        <div
          className="px-3 py-2 rounded-2xl text-sm"
          style={{
            background: isOutbound
              ? (isFailed ? "rgba(239,68,68,0.15)" : "#F5A623")
              : "rgba(255,255,255,0.06)",
            color: isOutbound ? (isFailed ? "#fff" : "#0F1F3D") : "#fff",
            border: isFailed ? "1px solid rgba(239,68,68,0.4)" : "none",
            borderBottomRightRadius: isOutbound ? 4 : undefined,
            borderBottomLeftRadius: !isOutbound ? 4 : undefined,
          }}
        >
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        </div>
        <p className={`text-[10px] px-2 ${isOutbound ? "text-right" : "text-left"}`} style={{ color: "rgba(255,255,255,0.35)" }}>
          {new Date(m.createdAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
          {isFailed && (
            <span className="ml-1.5 inline-flex items-center gap-0.5" style={{ color: "#ef4444" }}>
              <AlertTriangle className="w-2.5 h-2.5" /> Failed
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
