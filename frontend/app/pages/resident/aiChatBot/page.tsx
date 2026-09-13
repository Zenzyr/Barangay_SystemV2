"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import axiosInstance from "@/app/utils/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Trash2,
  ChevronDown,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────────

export default function AiChatBotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────────

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Detect if user scrolled up
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBtn(!isNearBottom);
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Build the convo array from existing messages
    const convo: string[] = [];
    for (const msg of messages) {
      convo.push(`${msg.role === "user" ? "User" : "AI"}: ${msg.content}`);
    }

    // Add user message to UI immediately
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await axiosInstance.post("/account/ai", {
        input: trimmed,
        convo,
      });

      const aiReply: string = res.data;
      const aiMsg: ChatMessage = { role: "assistant", content: aiReply };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to get a response. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
      // Focus input after sending
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, messages]);

  // ── Keyboard shortcut ───────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Clear conversation ──────────────────────────────────────────────────────────

  const clearChat = () => {
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  };

  // ── Render helpers ──────────────────────────────────────────────────────────────

  const renderMessage = (msg: ChatMessage, idx: number) => {
    const isUser = msg.role === "user";

    return (
      <div
        key={idx}
        className={`flex items-start gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${
          isUser ? "flex-row-reverse" : ""
        }`}
        style={{ animationDelay: `${idx * 60}ms` }}
      >
        {/* Avatar */}
        <div
          className={`shrink-0 size-9 rounded-xl flex items-center justify-center ring-2 ring-offset-1 transition-all duration-200 ${
            isUser
              ? "bg-emerald-500 text-white ring-emerald-200"
              : "bg-sky-500 text-white ring-sky-200"
          }`}
        >
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Bubble */}
        <div
          className={`max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-200 ${
            isUser
              ? "bg-emerald-500 text-white rounded-tr-md"
              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-md"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>

          {/* Timestamp-like indicator */}
          <span
            className={`block mt-1.5 text-[10px] tracking-wide uppercase opacity-50 ${
              isUser ? "text-emerald-100" : "text-slate-400"
            }`}
          >
            {isUser ? "You" : "AI Assistant"}
          </span>
        </div>
      </div>
    );
  };

  // ── JSX ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full h-dvh md:h-[calc(100dvh-1rem)] bg-gradient-to-br from-sky-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="size-10 rounded-xl bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center shadow-md shadow-sky-200/50 dark:shadow-sky-800/20">
              <Bot size={20} className="text-white" />
            </div>
            {/* Online dot */}
            <span className="absolute -top-0.5 -right-0.5 size-3 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
              Barangay AI Assistant
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles size={11} className="text-emerald-500" />
              {isLoading ? "Thinking..." : "Online • Ready to help"}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5 text-xs"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
      </header>

      {/* ── Chat area ── */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 scroll-smooth"
        style={{ scrollBehavior: "smooth" }}
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Decorative icon */}
            <div className="relative mb-6">
              <div className="size-20 rounded-2xl bg-gradient-to-br from-sky-100 to-emerald-100 dark:from-sky-900/40 dark:to-emerald-900/40 flex items-center justify-center shadow-inner">
                <MessageSquare
                  size={36}
                  className="text-sky-400 dark:text-sky-300"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 size-6 bg-emerald-400 rounded-full flex items-center justify-center shadow-md">
                <Sparkles size={14} className="text-white" />
              </span>
            </div>

            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
              How can I help you?
            </h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-md leading-relaxed">
              Ask me anything about barangay services, document requirements,
              residents&apos; skills, or local information.
            </p>

            {/* Suggestion chips */}
            <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-lg">
              {[
                "What documents do I need for a barangay clearance?",
                "How do I request a certificate of residency?",
                "Tell me about available resident skills",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    // Auto focus input after setting suggestion
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="px-3.5 py-2 text-xs rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:border-sky-300 dark:hover:border-sky-700 hover:text-sky-700 dark:hover:text-sky-300 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(renderMessage)}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="shrink-0 size-9 rounded-xl bg-sky-500 text-white flex items-center justify-center ring-2 ring-sky-200 ring-offset-1">
              <Bot size={16} />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2
                  size={16}
                  className="text-sky-500 animate-spin"
                />
                <div className="flex gap-1">
                  <span className="size-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="size-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="size-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="shrink-0 size-9 rounded-xl bg-red-500 text-white flex items-center justify-center ring-2 ring-red-200 ring-offset-1">
              <AlertCircle size={16} />
            </div>
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm max-w-[75%] md:max-w-[65%]">
              <p className="text-sm text-red-700 dark:text-red-300 break-words">
                {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-200 mt-1.5 underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Invisible anchor for scrolling */}
        <div ref={messagesEndRef} className="h-px" />
      </div>

      {/* ── Scroll to bottom button ── */}
      {showScrollBtn && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scrollToBottom(true)}
            className="size-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg px-4 md:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isLoading}
              className="h-11 rounded-xl border-sky-200 dark:border-slate-700 bg-sky-50/50 dark:bg-slate-800/50 pr-10 text-sm placeholder:text-slate-400 focus-visible:border-sky-400 dark:focus-visible:border-sky-500 focus-visible:ring-sky-300/30 transition-all duration-200"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="lg"
            className={`h-11 w-11 rounded-xl p-0 transition-all duration-200 ${
              input.trim() && !isLoading
                ? "bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={16} className={input.trim() ? "ml-0.5" : ""} />
            )}
          </Button>
        </div>

        <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center mt-2 tracking-wide">
          AI responses are generated by Google Gemini. Verify important information
          with barangay officials.
        </p>
      </div>
    </div>
  );
}
