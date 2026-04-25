/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Messages inbox — top-level "Messages" portal page.
 * Lists all SMS conversations sorted by latest activity, badges unread,
 * and routes to the per-thread view at /portal/messages/:conversationId.
 */
import { useCallback, useState } from "react";
import { Link, useRoute } from "wouter";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Loader2, Search, Phone, MessageSquare, Archive, ArchiveRestore } from "lucide-react";
import { ErrorState } from "@/components/portal/ErrorState";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/portal/PullToRefreshIndicator";
import { PortalMessagesThread } from "./PortalMessagesThread";

export default function PortalMessages() {
  // Same component handles both inbox (/portal/messages) and thread
  // (/portal/messages/:id). Wouter route detection switches between them.
  const [matchThread, params] = useRoute<{ id: string }>("/portal/messages/:id");

  if (matchThread && params?.id) {
    return <PortalMessagesThread conversationId={params.id} />;
  }

  return <Inbox />;
}

function Inbox() {
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");

  const {
    data: conversations,
    isLoading,
    error,
    refetch,
  } = trpc.smsConversations.list.useQuery(
    { status: filter, limit: 100 },
    { staleTime: 30_000, retry: 2 },
  );

  const handlePullRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const { containerRef: ptrContainerRef, pullDistance, isRefreshing: isPullRefreshing } = usePullToRefresh({
    onRefresh: handlePullRefresh,
  });

  const filtered = (conversations ?? []).filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.customerName ?? "").toLowerCase().includes(q) ||
      (c.customerPhone ?? "").includes(q) ||
      (c.lastMessagePreview ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <PortalLayout activeTab="messages">
      <div ref={ptrContainerRef} style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPullRefreshing} />
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">Messages</h1>
              <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                Two-way SMS with your customers.
              </p>
            </div>
          </div>

          {/* Search + filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "rgba(255,255,255,0.35)" }} />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone, or message…"
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              />
            </div>
            <button
              type="button"
              onClick={() => setFilter(f => f === "active" ? "archived" : "active")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: filter === "archived" ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: filter === "archived" ? "#F5A623" : "rgba(255,255,255,0.6)",
              }}
            >
              {filter === "archived" ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {filter === "archived" ? "Archived" : "Active"}
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState filter={filter} hasSearch={!!search.trim()} />
          ) : (
            <ul className="space-y-2">
              {filtered.map(c => (
                <li key={c.id}>
                  <Link href={`/portal/messages/${c.id}`}>
                    <a className="block">
                      <ConversationRow conversation={c} />
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}

function ConversationRow({ conversation: c }: { conversation: {
  id: string;
  customerPhone: string;
  customerName: string | null;
  lastMessagePreview: string | null;
  lastDirection: "inbound" | "outbound" | null;
  lastMessageAt: Date | string | null;
  unreadCount: number;
} }) {
  const unread = c.unreadCount > 0;
  const initial = (c.customerName ?? c.customerPhone ?? "?").trim().charAt(0).toUpperCase();
  const lastTime = c.lastMessageAt ? new Date(c.lastMessageAt) : null;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl transition-colors"
      style={{
        background: unread ? "rgba(245,166,35,0.06)" : "rgba(255,255,255,0.03)",
        border: unread ? "1px solid rgba(245,166,35,0.2)" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{ background: unread ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.08)", color: unread ? "#F5A623" : "rgba(255,255,255,0.6)" }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-sm truncate ${unread ? "font-bold text-white" : "font-medium text-white/85"}`}>
            {c.customerName ?? c.customerPhone}
          </p>
          {lastTime && (
            <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>
              {formatRelative(lastTime)}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: unread ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.5)" }}>
          {c.lastDirection === "outbound" && <span style={{ color: "rgba(255,255,255,0.4)" }}>You: </span>}
          {c.lastMessagePreview ?? "(no messages yet)"}
        </p>
      </div>
      {unread && (
        <span
          className="flex-shrink-0 mt-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold"
          style={{ background: "#F5A623", color: "#0F1F3D" }}
        >
          {c.unreadCount > 9 ? "9+" : c.unreadCount}
        </span>
      )}
    </div>
  );
}

function EmptyState({ filter, hasSearch }: { filter: "active" | "archived"; hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Search className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
        <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>No messages match your search</p>
      </div>
    );
  }
  if (filter === "archived") {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Archive className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
        <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>No archived conversations</p>
      </div>
    );
  }
  return (
    <div className="text-center py-16 rounded-xl space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <MessageCircle className="w-10 h-10 mx-auto" style={{ color: "rgba(255,255,255,0.2)" }} />
      <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>No messages yet</p>
      <p className="text-xs max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
        Conversations appear here when customers reply to your SMS — quote sent, payment link, on-the-way, etc.
      </p>
      <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
        <Phone className="w-3 h-3" /> Inbound
        <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
        <MessageSquare className="w-3 h-3" /> Outbound
      </div>
    </div>
  );
}

/** "12m", "3h", "Mon", "12 Apr" — same convention as iMessage. */
function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000) return d.toLocaleDateString("en-AU", { weekday: "short" });
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
