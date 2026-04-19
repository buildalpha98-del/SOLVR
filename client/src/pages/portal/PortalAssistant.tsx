/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalAssistant — Trade AI Assistant (Mobile-First)
 *
 * A trade-specific AI chat pre-seeded with:
 * - The client's trade type, business profile, and job history
 * - 8 trade knowledge blocks (plumbing, electrical, carpentry, etc.)
 * - Voice-to-document generation (SWMS, job certs, notes)
 * - Conversation history with named conversations
 *
 * Mobile-first: full-width messages, sticky input with safe-area,
 * horizontal scroll prompt chips, 14px body / 12px metadata.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Streamdown } from "streamdown";
import {
  Bot, Plus, Mic, MicOff, FileText, ChevronRight, ChevronLeft,
  MessageSquare, Trash2, Sparkles, Loader2, Send, X,
} from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type ConversationItem = {
  id: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
  tradeType: string | null;
};

// ─── Suggested prompts by trade ───────────────────────────────────────────────
const TRADE_PROMPTS: Record<string, string[]> = {
  plumber: [
    "Generate a SWMS for hot water system replacement",
    "AS/NZS 3500 backflow prevention requirements",
    "Draft scope of works for bathroom reno",
    "Write job notes for blocked drain callout",
  ],
  electrician: [
    "Generate a SWMS for switchboard upgrade",
    "AS/NZS 3000 RCD protection requirements",
    "Draft scope of works for solar install",
    "Write job notes for fault-finding callout",
  ],
  carpenter: [
    "Generate a SWMS for working at heights",
    "Draft scope of works for kitchen reno",
    "Materials list for a 4m x 6m deck",
    "Job notes for door frame replacement",
  ],
  builder: [
    "Generate a SWMS for excavation works",
    "Draft scope of works for bathroom addition",
    "Progress report for residential reno",
    "Subcontractor coordination email for tiling",
  ],
  hvac: [
    "Generate a SWMS for rooftop AC install",
    "Draft scope of works for commercial fitout",
    "Job notes for refrigerant leak repair",
    "Maintenance checklist for split system",
  ],
  painter: [
    "Generate a SWMS for exterior painting",
    "Draft scope of works for interior repaint",
    "Job notes for water damage repaint",
    "Surface preparation checklist",
  ],
  tiler: [
    "Generate a SWMS for wet area tiling",
    "Draft scope of works for bathroom retile",
    "Job notes for grout repair",
    "Materials list for 15m² floor tile job",
  ],
  default: [
    "Generate a SWMS for my current job",
    "Write job notes from voice recording",
    "Draft a scope of works for a quote",
    "Compliance requirements for my trade",
  ],
};

function getSuggestedPrompts(tradeType: string | null | undefined): string[] {
  if (!tradeType) return TRADE_PROMPTS.default;
  const key = tradeType.toLowerCase();
  for (const [k, prompts] of Object.entries(TRADE_PROMPTS)) {
    if (key.includes(k)) return prompts;
  }
  return TRADE_PROMPTS.default;
}

// ─── Conversation Drawer (Mobile overlay / Desktop sidebar) ──────────────────
function ConversationDrawer({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  tradeType,
  isLoading,
  onClose,
}: {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  tradeType: string | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#0A1628" }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" style={{ color: "#F5A623" }} />
            <span className="font-semibold text-white text-[14px]">Conversations</span>
          </div>
          <div className="flex items-center gap-2">
            {tradeType && (
              <Badge
                className="text-[11px] px-2 py-0.5 capitalize"
                style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "none" }}
              >
                {tradeType}
              </Badge>
            )}
            {/* Close button — visible on mobile */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors sm:hidden"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>
        <Button
          onClick={() => { onNew(); onClose(); }}
          size="sm"
          className="w-full gap-2 text-[13px] h-9"
          style={{ background: "#F5A623", color: "#0F1F3D" }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Conversation
        </Button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-2.5 px-3 py-3 mx-2 rounded-lg cursor-pointer transition-colors",
                activeId === conv.id ? "bg-amber-500/10" : "hover:bg-white/5 active:bg-white/10"
              )}
              onClick={() => { onSelect(conv.id); onClose(); }}
            >
              <MessageSquare
                className="w-4 h-4 flex-shrink-0"
                style={{ color: activeId === conv.id ? "#F5A623" : "rgba(255,255,255,0.4)" }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-medium truncate"
                  style={{ color: activeId === conv.id ? "#F5A623" : "rgba(255,255,255,0.75)" }}
                >
                  {conv.title}
                </p>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 sm:opacity-0 active:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20"
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
          Powered by Solvr AI
        </p>
      </div>
    </div>
  );
}

// ─── Message Bubble (Mobile-optimised) ───────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "system") return null;
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5 mb-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
        style={isUser
          ? { background: "#F5A623", color: "#0F1F3D", fontSize: "11px", fontWeight: 700 }
          : { background: "rgba(245,166,35,0.15)", color: "#F5A623" }
        }
      >
        {isUser ? "Y" : <Bot className="w-3.5 h-3.5" />}
      </div>
      {/* Bubble */}
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2.5 min-w-0",
          isUser ? "rounded-tr-md" : "rounded-tl-md"
        )}
        style={{
          maxWidth: "calc(100% - 44px)",
          ...(isUser
            ? { background: "#F5A623", color: "#0F1F3D" }
            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.9)" }),
        }}
      >
        {isUser ? (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
        ) : (
          <div
            className="prose prose-invert prose-sm max-w-none"
            style={{
              fontSize: "14px",
              lineHeight: "1.6",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            <Streamdown>{msg.content}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalAssistant() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [showSidebar, setShowSidebar] = useState(false); // default closed on mobile
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch conversations
  const { data: convData, isLoading: convLoading, refetch: refetchConvs } = trpc.assistant.listConversations.useQuery();

  // Fetch messages for active conversation
  const { data: msgData } = trpc.assistant.getMessages.useQuery(
    { conversationId: activeConversationId! },
    { enabled: !!activeConversationId }
  );

  // Get client trade type from portal.me
  const { data: meData } = trpc.portal.me.useQuery();
  const tradeType = (meData as any)?.client?.tradeType ?? null;

  // Sync messages from server when conversation changes
  useEffect(() => {
    if (msgData) {
      const msgs = Array.isArray(msgData) ? msgData : [];
      setMessages(
        msgs
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }))
      );
    }
  }, [msgData]);

  // Mutations
  const createConv = trpc.assistant.createConversation.useMutation({
    onSuccess: (data) => {
      setActiveConversationId(data.id);
      setMessages([]);
      refetchConvs();
    },
  });

  const sendMessage = trpc.assistant.chat.useMutation({
    onMutate: ({ message }) => {
      setMessages((prev) => [...prev, { role: "user", content: message }]);
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      refetchConvs();
    },
    onError: (err) => {
      toast.error(`Failed to send: ${err.message}`);
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const deleteConv = trpc.assistant.deleteConversation.useMutation({
    onSuccess: () => {
      setActiveConversationId(null);
      setMessages([]);
      refetchConvs();
    },
  });

  const transcribeVoice = trpc.assistant.transcribeVoice.useMutation({
    onSuccess: (data) => {
      setInputText((prev) => prev ? `${prev} ${data.text}` : data.text);
      setIsTranscribing(false);
    },
    onError: (err) => {
      toast.error(`Transcription failed: ${err.message}`);
      setIsTranscribing(false);
    },
  });

  const generateDoc = trpc.assistant.generateDoc.useMutation({
    onSuccess: (data) => {
      setIsGeneratingDoc(false);
      toast.success(`${data.title} generated — tap to open.`);
      window.open(data.url, "_blank");
    },
    onError: (err) => {
      setIsGeneratingDoc(false);
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  // Voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 100) {
          setIsTranscribing(true);
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            transcribeVoice.mutate({ audioBase64: base64, mimeType: "audio/webm" });
          };
          reader.readAsDataURL(blob);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied — allow microphone access to use voice input.");
    }
  }, [transcribeVoice]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // Send handler — auto-creates conversation if none active
  const handleSend = useCallback((content: string) => {
    if (!content.trim()) return;
    const title = content.slice(0, 60) + (content.length > 60 ? "…" : "");

    if (!activeConversationId) {
      createConv.mutate(
        { title },
        {
          onSuccess: (conv) => {
            sendMessage.mutate({ conversationId: conv.id, message: content });
          },
        }
      );
    } else {
      sendMessage.mutate({ conversationId: activeConversationId, message: content });
    }
    setInputText("");
  }, [activeConversationId, createConv, sendMessage]);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  const handleGenerateDoc = (docType: "swms" | "safety_cert" | "jsa" | "site_induction") => {
    if (!activeConversationId) {
      toast.error("Start a conversation first.");
      return;
    }
    setIsGeneratingDoc(true);
    generateDoc.mutate({
      conversationId: activeConversationId,
      docType,
      jobDescription: "Generated from AI Assistant conversation",
    });
  };

  const conversations: ConversationItem[] = convData?.conversations ?? [];
  const suggestedPrompts = getSuggestedPrompts(tradeType);
  const isSending = sendMessage.isPending || createConv.isPending;

  return (
    <div
      className="flex relative"
      style={{
        height: "calc(100dvh - 64px)",
        background: "#0F1F3D",
      }}
    >
      {/* ── Mobile sidebar overlay ── */}
      {showSidebar && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
            onClick={() => setShowSidebar(false)}
          />
          {/* Drawer */}
          <div
            className="fixed inset-y-0 left-0 z-50 w-[280px] sm:hidden"
            style={{ background: "#0A1628" }}
          >
            <ConversationDrawer
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={(id) => { setActiveConversationId(id); setMessages([]); }}
              onNew={handleNewConversation}
              onDelete={(id) => deleteConv.mutate({ conversationId: id })}
              tradeType={tradeType}
              isLoading={convLoading}
              onClose={() => setShowSidebar(false)}
            />
          </div>
        </>
      )}

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <div
        className="hidden sm:flex flex-shrink-0 transition-all duration-200 overflow-hidden"
        style={{
          width: showSidebar ? "256px" : "0px",
          borderRight: showSidebar ? "1px solid rgba(255,255,255,0.08)" : "none",
        }}
      >
        <div style={{ width: "256px" }}>
          <ConversationDrawer
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={(id) => { setActiveConversationId(id); setMessages([]); }}
            onNew={handleNewConversation}
            onDelete={(id) => deleteConv.mutate({ conversationId: id })}
            tradeType={tradeType}
            isLoading={convLoading}
            onClose={() => setShowSidebar(false)}
          />
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-3 sm:px-4 py-2.5 flex-shrink-0"
          style={{ background: "#0F1F3D", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className="p-1.5 rounded-md hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
            >
              {showSidebar ? (
                <ChevronLeft className="w-4 h-4 text-white/60" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/60" />
              )}
            </button>
            <div className="min-w-0">
              <h1 className="text-[14px] font-semibold text-white flex items-center gap-1.5 truncate">
                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#F5A623" }} />
                <span className="truncate">
                  {tradeType
                    ? `${tradeType.charAt(0).toUpperCase() + tradeType.slice(1)} AI`
                    : "Trade AI"}
                </span>
              </h1>
              <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                Trade knowledge + your business profile
              </p>
            </div>
          </div>

          {/* Quick doc generation */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(["swms", "safety_cert"] as const).map((docType) => (
              <Button
                key={docType}
                size="sm"
                variant="outline"
                className="text-[11px] gap-1 h-7 px-2"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", background: "transparent" }}
                onClick={() => handleGenerateDoc(docType)}
                disabled={isGeneratingDoc || !activeConversationId}
              >
                {isGeneratingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                <span className="hidden xs:inline">{docType === "swms" ? "SWMS" : "Safety"}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
          {messages.length === 0 ? (
            /* ── Empty state with horizontal scroll chips ── */
            <div className="flex flex-col items-center justify-center h-full gap-5 pb-4">
              <div className="text-center px-2">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(245,166,35,0.15)" }}
                >
                  <Bot className="w-6 h-6" style={{ color: "#F5A623" }} />
                </div>
                <h2 className="text-white font-semibold text-[16px] mb-1">
                  {tradeType
                    ? `${tradeType.charAt(0).toUpperCase() + tradeType.slice(1)} AI Assistant`
                    : "Trade AI Assistant"}
                </h2>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Ask anything about your trade, generate compliance docs, or write job notes.
                </p>
              </div>

              {/* Horizontal scroll chips */}
              <div className="w-full overflow-x-auto scrollbar-hide -mx-3 px-3">
                <div className="flex gap-2 w-max pb-1">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      className="flex-shrink-0 px-3.5 py-2.5 rounded-full text-[13px] leading-snug transition-colors whitespace-nowrap active:scale-95"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.75)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                      onClick={() => handleSend(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {isSending && (
                <div className="flex gap-2.5 mb-3">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ background: "rgba(245,166,35,0.15)" }}
                  >
                    <Bot className="w-3.5 h-3.5" style={{ color: "#F5A623" }} />
                  </div>
                  <div
                    className="px-3.5 py-2.5 rounded-2xl rounded-tl-md flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#F5A623" }} />
                    <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* ── Sticky input bar with safe-area padding ── */}
        <div
          className="flex items-center gap-2 px-3 sm:px-4 py-2.5 flex-shrink-0"
          style={{
            background: "#0A1628",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Voice button */}
          <button
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95",
              isRecording ? "bg-red-500" : isTranscribing ? "bg-amber-500/20" : "bg-white/10 active:bg-white/20"
            )}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            title={isRecording ? "Stop recording" : "Voice input"}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4 text-white/60" />
            )}
          </button>

          {/* Text input */}
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(inputText);
              }
            }}
            placeholder={
              isRecording ? "Recording… tap to stop" :
              isTranscribing ? "Transcribing…" :
              "Ask anything…"
            }
            className="flex-1 text-[14px] h-9 border-0 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-amber-500/50 rounded-full px-3.5"
            disabled={isRecording || isTranscribing || isSending}
          />

          {/* Send button */}
          <Button
            size="sm"
            className="flex-shrink-0 w-9 h-9 p-0 rounded-full active:scale-95"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            onClick={() => handleSend(inputText)}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
