"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  FileText,
  Clock,
  Wallet,
  ClipboardList,
  Phone,
  ListChecks,
  Loader2,
  FileCheck,
  Award,
} from "lucide-react";

// ─── Document display names ──────────────────────────────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  certificateOfGoodMoralCharacter: "Certificate of Good Moral Character",
  certificateOfUnemployment: "Certificate of Unemployment",
  barangayBusinessClearance: "Barangay Business Clearance",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending — waiting to be reviewed",
  processing: "Processing — being prepared",
  "to claim": "To Claim — ready for pickup",
  completed: "Completed",
};

// ─── Message type ─────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  from: "bot" | "user";
  text: string;
}

interface QuickReply {
  label: string;
  icon: React.ElementType;
  action: () => void;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function Chatbot() {
  const { user } = useUserStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      from: "bot",
      text: "Hi! I'm the Barangay Assistant. I can help with document requests, fees, and processing times. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, open]);

  const addBotMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: uid(), from: "bot", text }]);
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: uid(), from: "user", text }]);
  };

  // ── AI answers — every reply comes from Gemini ────────────────────
  const queryAi = useCallback(
    async (text: string) => {
      const prior = messages
        .filter((m) => m.text)
        .map((m) => `${m.from === "user" ? "User" : "AI"}: ${m.text}`);
      const convo = [...prior, `User: ${text}`];
      setThinking(true);
      try {
        const res = await axiosInstance.post("/account/ai", { input: text, convo });
        addBotMessage(String(res.data));
      } catch {
        addBotMessage(
          "Sorry, I couldn't reach the AI assistant right now. Please try again in a moment."
        );
      } finally {
        setThinking(false);
      }
    },
    [messages]
  );

  const checkMyStatus = async () => {
    if (!user) {
      addBotMessage("Please sign in to your resident account first, then I can look up your requests.");
      return;
    }
    setCheckingStatus(true);
    try {
      const res = await axiosInstance.get<documentRequestInterface[]>(
        `/document-request/resident/${user._id}`
      );
      const docs = res.data;
      if (!docs || docs.length === 0) {
        addBotMessage("You don't have any document requests yet. Want to request one?");
      } else {
        const active = docs.filter((d) => d.status !== "completed").slice(0, 5);
        const list = (active.length ? active : docs.slice(0, 5))
          .map((d) => `• ${DOCUMENT_NAMES[d.document] || d.document} — ${STATUS_LABELS[d.status] || d.status}`)
          .join("\n");
        addBotMessage(
          `Here's the latest on your requests:\n${list}${
            docs.length > 5 ? `\n…and ${docs.length - 5} more. See "My Documents" for the full list.` : ""
          }`
        );
      }
    } catch {
      addBotMessage("Sorry, I couldn't fetch your requests right now. Please check the \"My Documents\" page directly.");
    } finally {
      setCheckingStatus(false);
    }
  };

  const QUICK_REPLIES: QuickReply[] = [
    { label: "What documents can I request?", icon: FileText, action: () => { addUserMessage("What documents can I request?"); queryAi("What documents can I request?"); } },
    { label: "How much do they cost?", icon: Wallet, action: () => { addUserMessage("How much do they cost?"); queryAi("How much do they cost?"); } },
    { label: "How long does it take?", icon: Clock, action: () => { addUserMessage("How long does it take?"); queryAi("How long does it take?"); } },
    { label: "What do statuses mean?", icon: ListChecks, action: () => { addUserMessage("What do statuses mean?"); queryAi("What do my document request statuses mean?"); } },
    { label: "How do I request a document?", icon: ClipboardList, action: () => { addUserMessage("How do I request a document?"); queryAi("How do I request a document?"); } },
    { label: "Check my request status", icon: FileCheck, action: () => { addUserMessage("Check my request status"); checkMyStatus(); } },
    { label: "Contact the barangay office", icon: Phone, action: () => { addUserMessage("Contact the barangay office"); queryAi("How can I contact the barangay office?"); } },
    { label: "Who is the Punong Barangay?", icon: Award, action: () => { addUserMessage("Who is the Punong Barangay?"); queryAi("Who is the Punong Barangay?"); } },
  ];

  // ── Free-text handling ───────────────────────────────────────────
  const handleSend = () => {
    const text = input.trim();
    if (!text || thinking) return;
    addUserMessage(text);
    setInput("");
    queryAi(text);
  };

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 size-14 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-600/40 flex items-center justify-center transition-all hover:scale-105"
        aria-label="Open chat assistant"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[92vw] max-w-sm h-[70vh] max-h-[560px] bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-600 to-emerald-600 text-white px-4 py-3 flex items-center gap-2 shrink-0">
            <div className="size-8 rounded-full bg-white/15 flex items-center justify-center">
              <Bot className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Barangay Assistant</p>
              <p className="text-[11px] text-sky-100 leading-tight">Usually replies instantly</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
                    m.from === "user"
                      ? "bg-sky-600 text-white rounded-br-sm"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {checkingStatus && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-500 border border-gray-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Looking up your requests…
                </div>
              </div>
            )}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-500 border border-gray-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 border-t border-gray-100 bg-white flex gap-1.5 overflow-x-auto shrink-0">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q.label}
                onClick={q.action}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded-full px-3 py-1.5 transition-colors"
              >
                <q.icon className="size-3" />
                {q.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 bg-white flex items-center gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your question..."
              className="flex-1 h-9 rounded-full border border-gray-200 px-3.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={thinking}
              className="rounded-full size-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white"
            >
              {thinking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
