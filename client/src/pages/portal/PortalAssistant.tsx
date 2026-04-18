/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalAssistant — Trade AI Assistant
 *
 * A trade-specific AI chat pre-seeded with:
 * - The client's trade type, business profile, and job history
 * - 8 trade knowledge blocks (plumbing, electrical, carpentry, etc.)
 * - Voice-to-document generation (SWMS, job certs, notes)
 * - Conversation history with named conversations
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Streamdown } from "streamdown";
import {
  Bot, Plus, Mic, MicOff, FileText, ChevronRight,
  MessageSquare, Trash2, Sparkles, Loader2, Send,
} from "lucide-react";
import { toast } from "sonner";
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
    "What are the AS/NZS 3500 requirements for backflow prevention?",
    "Draft a scope of works for a full bathroom renovation",
    "Write job notes for a blocked drain callout",
  ],
  electrician: [
    "Generate a SWMS for switchboard upgrade",
    "What are the AS/NZS 3000 requirements for RCD protection?",
    "Draft a scope of works for a solar installation",
    "Write job notes for a fault-finding callout",
  ],
  carpenter: [
    "Generate a SWMS for working at heights on a deck build",
    "Draft a scope of works for a kitchen renovation",
    "Write a materials list for a 4m x 6m deck",
    "Create job notes for a door frame replacement",
  ],
  builder: [
    "Generate a SWMS for excavation works",
    "Draft a scope of works for a bathroom addition",
    "Write a progress report for a residential renovation",
    "Create a subcontractor coordination email for tiling stage",
  ],
  hvac: [
    "Generate a SWMS for rooftop AC installation",
    "Draft a scope of works for a commercial fitout",
    "Write job notes for a refrigerant leak repair",
    "Create a maintenance checklist for split system service",
  ],
  painter: [
    "Generate a SWMS for exterior painting at heights",
    "Draft a scope of works for interior repaint",
    "Write job notes for a water damage repaint",
    "Create a surface preparation checklist",
  ],
  tiler: [
    "Generate a SWMS for wet area tiling",
    "Draft a scope of works for bathroom retile",
    "Write job notes for a grout repair",
    "Create a materials list for a 15m² floor tile job",
  ],
  default: [
    "Generate a SWMS for my current job",
    "Write professional job notes from my voice recording",
    "Draft a scope of works for a quote",
    "What compliance requirements apply to my trade?",
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

// ─── Conversation Sidebar ─────────────────────────────────────────────────────
function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  tradeType,
  isLoading,
}: {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  tradeType: string | null;
  isLoading: boolean;
}) {
  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#0A1628", borderRight: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" style={{ color: "#F5A623" }} />
            <span className="font-semibold text-white text-sm">AI Assistant</span>
          </div>
          {tradeType && (
            <Badge
              className="text-[10px] px-2 py-0.5 capitalize"
              style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "none" }}
            >
              {tradeType}
            </Badge>
          )}
        </div>
        <Button
          onClick={onNew}
          size="sm"
          className="w-full gap-2 text-xs"
          style={{ background: "#F5A623", color: "#0F1F3D" }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Conversation
        </Button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors",
                activeId === conv.id ? "bg-amber-500/10" : "hover:bg-white/5"
              )}
              onClick={() => onSelect(conv.id)}
            >
              <MessageSquare
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: activeId === conv.id ? "#F5A623" : "rgba(255,255,255,0.4)" }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-medium truncate"
                  style={{ color: activeId === conv.id ? "#F5A623" : "rgba(255,255,255,0.75)" }}
                >
                  {conv.title}
                </p>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20"
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
          Powered by Solvr AI · Trade-specific knowledge
        </p>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "system") return null;
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
        style={isUser
          ? { background: "#F5A623", color: "#0F1F3D" }
          : { background: "rgba(245,166,35,0.15)", color: "#F5A623" }
        }
      >
        {isUser ? "Y" : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-3 text-sm",
          isUser
            ? "rounded-tr-sm"
            : "rounded-tl-sm"
        )}
        style={isUser
          ? { background: "#F5A623", color: "#0F1F3D" }
          : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.9)" }
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
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
  const [showSidebar, setShowSidebar] = useState(true);
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
      toast.success(`${data.title} generated — tap to open the document.`);
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
      toast.error("No active conversation — start a conversation first.");
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
  const isLoading = sendMessage.isPending || createConv.isPending;

  return (
    <div className="flex" style={{ height: "calc(100vh - 120px)", minHeight: "500px", background: "#0F1F3D" }}>
      {/* Sidebar */}
      <div
        className="flex-shrink-0 transition-all duration-200 overflow-hidden"
        style={{ width: showSidebar ? "256px" : "0px" }}
      >
        <div style={{ width: "256px" }}>
          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={(id) => { setActiveConversationId(id); setMessages([]); }}
            onNew={handleNewConversation}
            onDelete={(id) => deleteConv.mutate({ conversationId: id })}
            tradeType={tradeType}
            isLoading={convLoading}
          />
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ background: "#0F1F3D", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <ChevronRight
                className="w-4 h-4 text-white/60 transition-transform duration-200"
                style={{ transform: showSidebar ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: "#F5A623" }} />
                {tradeType
                  ? `${tradeType.charAt(0).toUpperCase() + tradeType.slice(1)} AI Assistant`
                  : "Trade AI Assistant"}
              </h1>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                Pre-loaded with your business profile and trade knowledge
              </p>
            </div>
          </div>

          {/* Quick doc generation */}
          <div className="flex items-center gap-2">
            {(["swms", "safety_cert"] as const).map((docType) => (
              <Button
                key={docType}
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 hidden sm:flex"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", background: "transparent" }}
                onClick={() => handleGenerateDoc(docType)}
                disabled={isGeneratingDoc || !activeConversationId}
              >
                {isGeneratingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                {docType === "swms" ? "SWMS" : "Safety Cert"}
              </Button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            /* Empty state with suggested prompts */
            <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
              <div className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(245,166,35,0.15)" }}
                >
                  <Bot className="w-7 h-7" style={{ color: "#F5A623" }} />
                </div>
                <h2 className="text-white font-semibold mb-1">
                  {tradeType
                    ? `Your ${tradeType.charAt(0).toUpperCase() + tradeType.slice(1)} AI Assistant`
                    : "Your Trade AI Assistant"}
                </h2>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Ask anything about your trade, generate compliance docs, or write job notes.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="text-left px-4 py-3 rounded-xl text-xs transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {isLoading && (
                <div className="flex gap-3 mb-4">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ background: "rgba(245,166,35,0.15)" }}
                  >
                    <Bot className="w-3.5 h-3.5" style={{ color: "#F5A623" }} />
                  </div>
                  <div
                    className="px-4 py-3 rounded-xl rounded-tl-sm flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#F5A623" }} />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-t flex-shrink-0"
          style={{ background: "#0A1628", borderColor: "rgba(255,255,255,0.08)" }}
        >
          {/* Voice button */}
          <button
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all",
              isRecording ? "bg-red-500" : isTranscribing ? "bg-amber-500/20" : "bg-white/10 hover:bg-white/20"
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
              isRecording ? "Recording… tap mic to stop" :
              isTranscribing ? "Transcribing…" :
              "Ask your trade assistant anything…"
            }
            className="flex-1 text-sm border-0 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-amber-500/50"
            disabled={isRecording || isTranscribing || isLoading}
          />

          {/* Send button */}
          <Button
            size="sm"
            className="flex-shrink-0 w-9 h-9 p-0"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            onClick={() => handleSend(inputText)}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
