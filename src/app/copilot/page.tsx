"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { PairIcon } from "@/components/ui/PairIcon";
import { useAccounts } from "@/components/providers/AccountProvider";
import {
  Bot,
  Send,
  Sparkles,
  Layers,
  StickyNote,
  Check,
  Settings,
  Compass,
  CheckSquare,
  Activity,
  RefreshCw,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  engine?: string;
  context?: any;
  timestamp: string;
}

const QUICK_PROMPTS = [
  "Should I long BTCUSDT right now based on live Binance sentiment and my journal stats?",
  "Should I short ETHUSDT right now?",
  "Audit my recent mistakes, Do's & Don'ts, and biggest money leaks.",
  "Which trading sessions, weekdays, and coins make me the most profit?",
  "Check my live open positions and tell me my current risk exposure.",
  "Give me a strict trading gameplan for today based on my real performance.",
];

export default function CopilotPage() {
  const { activeAccountId, activeAccount } = useAccounts();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [focusSymbol, setFocusSymbol] = useState("");
  const [sending, setSending] = useState(false);
  const [savedMsgId, setSavedMsgId] = useState<string | null>(null);

  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (textOverride?: string) => {
    const prompt = (textOverride ?? input).trim();
    if (!prompt || sending) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/agent/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          account_id: activeAccountId || "ALL",
          symbol: focusSymbol.trim() || undefined,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: data.success
          ? data.reply
          : `Error: ${data.error || "Could not reach Trading Copilot."}`,
        engine: data.engine,
        context: data.context,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: `Network error: ${err.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSaveToNotes = async (msg: ChatMessage) => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id:
            activeAccountId && activeAccountId !== "ALL" ? activeAccountId : "acc_default",
          title: `AI Copilot Verdict${msg.context?.detectedSymbol ? ` — ${msg.context.detectedSymbol}` : ""}`,
          content: msg.content,
          category: "MARKET_ANALYSIS",
          symbol: msg.context?.detectedSymbol || "",
          tags: ["ai-copilot", "analysis"],
          is_pinned: false,
          note_date: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedMsgId(msg.id);
        setTimeout(() => setSavedMsgId(null), 2000);
      }
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    AI Trading Coach &amp; Binance Copilot
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    <Layers className="w-3 h-3" />
                    {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reads your real Positions Journal, Mistake Costs, Sessions, Do&apos;s &amp; Don&apos;ts, Open Positions, and live Binance Futures Sentiment in real time.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link
                href="/sentiment"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" /> Sentiment
              </Link>
              <Link
                href="/checklist"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-800 flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Checklist
              </Link>
              <Link
                href="/settings"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5"
                title="Configure Gemini / OpenAI / Anthropic API key & Binance Agent OS"
              >
                <Settings className="w-3.5 h-3.5" /> AI Config
              </Link>
            </div>
          </div>

          {/* Chat Workspace */}
          <div className="flex-1 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-2xl flex flex-col overflow-hidden min-h-[540px]">
            {/* Messages Stream */}
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[62vh]">
              {messages.length === 0 ? (
                <div className="py-6 space-y-5">
                  <div className="text-center space-y-2 max-w-lg mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center mx-auto">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h2 className="text-base font-bold text-white">
                      Ask Your Live Trading Coach Anything
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Mention any Binance Futures pair (like <span className="font-mono text-sky-300">BTCUSDT</span>,{" "}
                      <span className="font-mono text-sky-300">ETHUSDT</span>,{" "}
                      <span className="font-mono text-sky-300">SOLUSDT</span>, or{" "}
                      <span className="font-mono text-sky-300">KITEUSDT</span>) and the Copilot will cross-check live OI, Funding, Whales, Order Book, your open positions, and your historical mistakes.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-3xl mx-auto">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q)}
                        className="text-left p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/40 text-xs text-slate-200 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[82%] rounded-2xl p-4 space-y-2.5 ${
                        msg.role === "user"
                          ? "bg-sky-600/20 border border-sky-500/40 text-white"
                          : "bg-slate-900/90 border border-slate-800 text-slate-200"
                      }`}
                    >
                      {msg.role === "assistant" && msg.context && (
                        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-800/80 text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-800">
                            ✓ {msg.context.tradesAnalyzed} Trades
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-950 text-emerald-300 border border-slate-800">
                            ✓ {msg.context.openPositionsCount} Open Pos
                          </span>
                          {msg.context.detectedSymbol && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <PairIcon symbol={msg.context.detectedSymbol} size="xs" />
                              {msg.context.detectedSymbol}: {msg.context.liveSentimentZone || "Live"}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                            ✓ {msg.context.dosDontsDaysLogged}d Do&apos;s/Don&apos;ts
                          </span>
                        </div>
                      )}

                      <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>

                      {msg.role === "assistant" && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
                          <span>{msg.engine || "Trading Copilot"}</span>
                          <button
                            type="button"
                            onClick={() => handleSaveToNotes(msg)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            {savedMsgId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" /> Saved to Notes
                              </>
                            ) : (
                              <>
                                <StickyNote className="w-3 h-3 text-emerald-400" /> Save to Notes
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-xs text-violet-300 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Scanning live Binance Futures data, open positions &amp; your journal stats...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row gap-2"
            >
              <div className="flex items-center gap-1.5 sm:w-40">
                {focusSymbol && <PairIcon symbol={focusSymbol} size="xs" />}
                <input
                  type="text"
                  value={focusSymbol}
                  onChange={(e) => setFocusSymbol(e.target.value.toUpperCase())}
                  placeholder="Coin (optional)"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs font-mono text-white uppercase placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Ask e.g. "Should I long BTCUSDT right now?" or "What mistakes cost me the most?"'
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700/80 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Ask Coach
              </button>
            </form>
          </div>
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => {}}
      />
      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={() => {}}
      />
      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
