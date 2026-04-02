import { useState, useRef, useEffect } from "react";
import ConsoleLayout from "@/components/ConsoleLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, Send, Loader2, Bot, User, Lightbulb, TrendingUp, Users, CheckSquare } from "lucide-react";
import { Streamdown } from "streamdown";

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "Pipeline summary", prompt: "Give me a summary of my current sales pipeline. Which deals are most likely to close and what should I do next?" },
  { icon: Users, label: "Client health check", prompt: "Review my active clients and flag any that might be at risk of churning or need attention." },
  { icon: CheckSquare, label: "Generate tasks", prompt: "Based on my current pipeline and clients, what are the most important tasks I should do today?" },
  { icon: Lightbulb, label: "Growth ideas", prompt: "What are 3 specific ways I could grow my AI consultancy revenue this month based on my current client base?" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ConsoleAIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: stats } = trpc.ai.stats.useQuery();

  const chat = trpc.ai.chat.useMutation({
    onMutate: ({ message }) => {
      setMessages(prev => [...prev, { role: "user", content: message }]);
      setIsStreaming(true);
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      setIsStreaming(false);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
      setIsStreaming(false);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = (text?: string) => {
    const message = text || input.trim();
    if (!message || isStreaming) return;
    setInput("");
    chat.mutate({ message, history: messages });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <ConsoleLayout title="AI Assistant">
      <div className="flex flex-col h-[calc(100vh-57px)]">
        {/* Context banner */}
        {stats && (
          <div className="px-4 py-2 border-b border-white/10 bg-amber-400/5 flex items-center gap-4 text-xs text-white/50 shrink-0">
            <Zap size={11} className="text-amber-400" />
            <span>Context: <span className="text-white/70">{stats.activeClients} active clients</span></span>
            <span><span className="text-white/70">{stats.openDeals} open deals</span></span>
            <span><span className="text-white/70">{stats.tasksDueToday} tasks due today</span></span>
            <span>MRR: <span className="text-green-400">${((stats.mrr) / 100).toLocaleString("en-AU")}</span></span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
              <div className="w-12 h-12 bg-amber-400/10 rounded-full flex items-center justify-center mb-4">
                <Bot size={22} className="text-amber-400" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">Solvr AI Assistant</h2>
              <p className="text-white/40 text-sm mb-6">
                Ask me anything about your pipeline, clients, or business. I have full context of your Solvr data.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full">
                {QUICK_PROMPTS.map((qp) => {
                  const Icon = qp.icon;
                  return (
                    <button
                      key={qp.label}
                      onClick={() => handleSend(qp.prompt)}
                      className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors text-left"
                    >
                      <Icon size={14} className="text-amber-400 shrink-0" />
                      <span className="text-white/70 text-xs">{qp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={13} className="text-amber-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-xl px-3 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-amber-400/15 text-white border border-amber-400/20"
                      : "bg-[#0d1f38] text-white/90 border border-white/10"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={13} className="text-white/60" />
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0">
                    <Bot size={13} className="text-amber-400" />
                  </div>
                  <div className="bg-[#0d1f38] border border-white/10 rounded-xl px-3 py-2.5">
                    <Loader2 size={14} className="animate-spin text-amber-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your pipeline, clients, or business..."
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30 text-sm"
              disabled={isStreaming}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="bg-amber-400 hover:bg-amber-300 text-[#060e1a] shrink-0"
            >
              {isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </div>
        </div>
      </div>
    </ConsoleLayout>
  );
}
