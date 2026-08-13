"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What foods are best for blood sugar control?",
  "What is Glycemic Index?",
  "Give me a low GI breakfast idea",
  "How much water should I drink daily?",
];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "👋 Hi! I'm your GI Smart assistant. Ask me anything about glycemic index, foods, or your diet!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#e05b2b] text-white shadow-lg flex items-center justify-center hover:brightness-105 transition-all"
        aria-label="Open chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-[rgba(26,26,20,0.1)] flex flex-col overflow-hidden" style={{ height: "480px" }}>
          {/* Header */}
          <div className="bg-[#1a1a14] text-white px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#e05b2b] flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div>
              <div className="text-sm font-bold">GI Smart Assistant</div>
              <div className="text-xs text-[#9a9a8a]">Ask about foods, GI, nutrition</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed"
                  style={m.role === "user"
                    ? { background: "#e05b2b", color: "white", borderBottomRightRadius: "4px" }
                    : { background: "#f5f0e8", color: "#1a1a14", borderBottomLeftRadius: "4px" }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#f5f0e8] rounded-2xl px-3 py-2 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#e05b2b]" />
                  <span className="text-xs text-[#4a4a3a]">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#f5f0e8] text-[#4a4a3a] hover:bg-[rgba(224,91,43,0.1)] hover:text-[#e05b2b] transition-colors border border-[rgba(26,26,20,0.08)]">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[rgba(26,26,20,0.08)] px-3 py-2 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder="Ask about GI, foods, nutrition…"
              className="flex-1 text-sm bg-[#f5f0e8] rounded-xl px-3 py-2 outline-none text-[#1a1a14] placeholder:text-[#9a9a8a]"
              disabled={loading}
            />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-[#e05b2b] text-white flex items-center justify-center disabled:opacity-40 hover:brightness-105 transition-all">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}