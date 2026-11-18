"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { AssistedOrderModal } from "@/components/checklist/AssistedOrderModal";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PairIcon } from "@/components/ui/PairIcon";
import { useAccounts } from "@/components/providers/AccountProvider";
import { ChecklistItem, ChecklistLog, TradeDirection } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  CheckSquare,
  Square,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  RotateCcw,
  Compass,
  Layers,
  TrendingUp,
  TrendingDown,
  Award,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
} from "lucide-react";

const CATEGORIES = [
  "Price Action",
  "Sentiment",
  "Derivatives",
  "Smart Money",
  "Macro & News",
  "Risk Management",
  "Psychology",
  "General",
];

function ChecklistContent() {
  const searchParams = useSearchParams();
  const { activeAccountId, activeAccount } = useAccounts();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [logs, setLogs] = useState<ChecklistLog[]>([]);
  const [stats, setStats] = useState({ totalChecks: 0, averageScore: 0, passRate: 0 });
  const [loading, setLoading] = useState(true);

  // Active pre-trade check state
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [direction, setDirection] = useState<TradeDirection>("LONG");
  const [sentimentVerdict, setSentimentVerdict] = useState("");
  const [notes, setNotes] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [savingLog, setSavingLog] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Rule management modal
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Price Action");
  const [newDescription, setNewDescription] = useState("");
  const [newIsCritical, setNewIsCritical] = useState(false);
  const [savingRule, setSavingRule] = useState(false);

  // Global Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isAssistedOrderOpen, setIsAssistedOrderOpen] = useState(false);

  // Hydrate symbol/direction/verdict when navigated from Sentiment Detector
  useEffect(() => {
    const sym = searchParams.get("symbol");
    const dir = searchParams.get("direction");
    const verdict = searchParams.get("verdict");
    if (sym) setSymbol(sym.toUpperCase());
    if (dir === "SHORT" || dir === "LONG") setDirection(dir);
    if (verdict) setSentimentVerdict(verdict);
  }, [searchParams]);

  const fetchChecklist = useCallback(async () => {
    try {
      setLoading(true);
      const accParam =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const res = await fetch(`/api/checklist${accParam}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setLogs(data.logs || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const activeItems = useMemo(() => items.filter((i) => i.enabled !== false), [items]);
  const criticalItems = useMemo(() => activeItems.filter((i) => i.is_critical), [activeItems]);

  const checkedCount = checkedIds.filter((id) => activeItems.some((i) => i.id === id)).length;
  const score =
    activeItems.length > 0 ? Math.round((checkedCount / activeItems.length) * 100) : 0;
  const missingCritical = criticalItems.filter((i) => !checkedIds.includes(i.id));
  const criticalPassed = missingCritical.length === 0;
  const isClearedToTrade = activeItems.length > 0 && score >= 80 && criticalPassed;

  const toggleItem = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSaveCheck = async (openTradeModalAfter = false) => {
    setSavingLog(true);
    setSavedBanner(null);
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "log",
          account_id: activeAccountId && activeAccountId !== "ALL" ? activeAccountId : "acc_default",
          symbol: symbol.trim().toUpperCase() || "GENERAL",
          direction,
          checked_ids: checkedIds,
          total_items: activeItems.length,
          critical_passed: criticalPassed,
          score,
          sentiment_verdict: sentimentVerdict.trim(),
          notes: notes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedBanner(
          `Saved ${score}% discipline check for ${symbol.toUpperCase()} (${direction}).`
        );
        setCheckedIds([]);
        setNotes("");
        await fetchChecklist();
        if (openTradeModalAfter) {
          setIsTradeModalOpen(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingLog(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSavingRule(true);
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "item",
          title: newTitle.trim(),
          category: newCategory,
          description: newDescription.trim(),
          is_critical: newIsCritical,
          sort_order: items.length + 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewTitle("");
        setNewDescription("");
        setNewIsCritical(false);
        await fetchChecklist();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRule(false);
    }
  };

  const handleToggleRuleCritical = async (item: ChecklistItem) => {
    await fetch("/api/checklist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, is_critical: !item.is_critical }),
    });
    await fetchChecklist();
  };

  const handleToggleRuleEnabled = async (item: ChecklistItem) => {
    await fetch("/api/checklist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, enabled: !item.enabled }),
    });
    await fetchChecklist();
  };

  const handleDeleteRule = async (id: string) => {
    await fetch(`/api/checklist?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setCheckedIds((prev) => prev.filter((x) => x !== id));
    await fetchChecklist();
  };

  const handleRestoreDefaults = async () => {
    await fetch("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "reset_defaults" }),
    });
    await fetchChecklist();
  };

  const handleDeleteLog = async (logId: string) => {
    await fetch(`/api/checklist?log_id=${encodeURIComponent(logId)}`, { method: "DELETE" });
    await fetchChecklist();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={fetchChecklist}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Pre-Trade Checklist & Discipline Tracker
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    <Layers className="w-3 h-3" />
                    {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Run this checklist before every trade so you never skip Price Action, OI, Funding, Whales, News, or Stop-Loss rules.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link
                href="/sentiment"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                Check Sentiment First
              </Link>
              <button
                type="button"
                onClick={() => setIsManageOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5 text-sky-400" />
                Customize Rules ({items.length})
              </button>
            </div>
          </div>

          {/* Discipline KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Avg Discipline Score
                </span>
                <div className="text-2xl font-black font-mono text-white mt-0.5">
                  {stats.averageScore}%
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Cleared Trade Rate (≥80%)
                </span>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
                  {stats.passRate}%
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Logged Pre-Trade Checks
                </span>
                <div className="text-2xl font-black font-mono text-white mt-0.5">
                  {stats.totalChecks}
                </div>
              </div>
            </div>
          </div>

          {savedBanner && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {savedBanner}
              </span>
              <button
                type="button"
                onClick={() => setSavedBanner(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Main 2-Column Layout: Active Runner (Left) + Readiness Gate & History (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Active Checklist Runner */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-4 shadow-xl">
              {/* Target Trade Setup Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 border-b border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Planned Pair / Symbol
                  </label>
                  <div className="flex items-center gap-2">
                    <PairIcon symbol={symbol} size="sm" showQuoteBadge />
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="BTCUSDT"
                      className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs font-mono font-bold text-white uppercase focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Planned Direction
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDirection("LONG")}
                      className={`py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                        direction === "LONG"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" /> LONG
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("SHORT")}
                      className={`py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                        direction === "SHORT"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5" /> SHORT
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Sentiment Bias (Optional)
                  </label>
                  <input
                    type="text"
                    value={sentimentVerdict}
                    onChange={(e) => setSentimentVerdict(e.target.value)}
                    placeholder="e.g. Bullish (+48)"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Checklist Items */}
              {loading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-slate-900/70 animate-pulse" />
                  ))}
                </div>
              ) : activeItems.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-400 space-y-2">
                  <p>No active checklist rules.</p>
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                  >
                    Restore Default Pro Rules
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>
                      Click each rule as you verify it ({checkedCount}/{activeItems.length} verified)
                    </span>
                    {checkedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCheckedIds([])}
                        className="text-slate-400 hover:text-white underline"
                      >
                        Reset checks
                      </button>
                    )}
                  </div>

                  {activeItems.map((item) => {
                    const checked = checkedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                          checked
                            ? "bg-emerald-500/10 border-emerald-500/40"
                            : item.is_critical
                            ? "bg-slate-900/90 border-slate-800 hover:border-amber-500/40"
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {checked ? (
                            <CheckSquare className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs sm:text-sm font-bold ${
                                checked ? "text-emerald-200 line-through opacity-85" : "text-white"
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              {item.category}
                            </span>
                            {item.is_critical && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                REQUIRED
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Quick Pre-Trade Notes */}
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Quick Pre-Trade Note / Invalidation Level (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Entering on 15m retest of 92,400 support, hard SL at 91,800"
                  className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Right Column: Live Readiness Gate + History */}
            <div className="lg:col-span-4 space-y-5">
              {/* Live Readiness Gate */}
              <div
                className={`rounded-2xl border p-5 space-y-4 shadow-xl ${
                  isClearedToTrade
                    ? "bg-gradient-to-b from-emerald-500/15 to-[#0f172a] border-emerald-500/40"
                    : "bg-gradient-to-b from-amber-500/10 to-[#0f172a] border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Trade Readiness Gate
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isClearedToTrade
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {isClearedToTrade ? "GO — CLEARED" : "HOLD — NOT READY"}
                  </span>
                </div>

                {/* Score Bar */}
                <div className="text-center py-2">
                  <div
                    className={`text-5xl font-black font-mono num-tabular ${
                      isClearedToTrade
                        ? "text-emerald-400"
                        : score >= 50
                        ? "text-amber-300"
                        : "text-rose-400"
                    }`}
                  >
                    {score}%
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden mt-3">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isClearedToTrade
                          ? "bg-emerald-500"
                          : score >= 50
                          ? "bg-amber-400"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>

                {!criticalPassed && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-rose-300">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Missing {missingCritical.length} Required Check(s):
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-rose-200/90">
                      {missingCritical.map((m) => (
                        <li key={m.id}>{m.title}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={savingLog || activeItems.length === 0}
                    onClick={() => handleSaveCheck(false)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                      isClearedToTrade
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25"
                        : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {savingLog ? "Saving..." : "Log Pre-Trade Discipline Check"}
                  </button>

                  <button
                    type="button"
                    disabled={savingLog || activeItems.length === 0}
                    onClick={() => handleSaveCheck(true)}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Save Check &amp; Log Trade
                  </button>

                  <button
                    type="button"
                    disabled={!isClearedToTrade}
                    onClick={() => setIsAssistedOrderOpen(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      isClearedToTrade
                        ? "Open Checklist-Gated Assisted Order Modal (Binance Agent OS)"
                        : "Reach ≥ 80% and check all REQUIRED rules to unlock Assisted Order Execution"
                    }
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {isClearedToTrade
                      ? "Prepare Assisted Order (Agent OS)"
                      : "Pass Checklist (≥80%) to Unlock Order"}
                  </button>
                </div>
              </div>

              {/* Recent Discipline Check History */}
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 space-y-3 shadow-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Recent Pre-Trade Checks ({logs.length})
                </h3>

                {logs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No pre-trade checks logged yet in this account. Complete the checklist above before your next trade!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {logs.slice(0, 20).map((log) => {
                      const passed = log.score >= 80 && log.critical_passed;
                      return (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-2 text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <PairIcon symbol={log.symbol} size="xs" />
                              <span className="font-mono font-bold text-white">{log.symbol}</span>
                              <span
                                className={`text-[10px] font-bold ${
                                  log.direction === "LONG" ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {log.direction}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  passed
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-amber-500/15 text-amber-300"
                                }`}
                              >
                                {log.score}%
                              </span>
                            </div>
                            {log.sentiment_verdict && (
                              <div className="text-[10px] text-amber-300/90 font-mono">
                                Bias: {log.sentiment_verdict}
                              </div>
                            )}
                            {log.notes && (
                              <p className="text-[11px] text-slate-400 line-clamp-2">{log.notes}</p>
                            )}
                            <div className="text-[10px] text-slate-500 font-mono">
                              {formatDate(log.created_at, true)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 flex-shrink-0"
                            title="Delete check log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Customize Checklist Rules Modal */}
      <Modal
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
        title="Customize Your Pre-Trade Checklist"
        subtitle="Add your own trading rules, mark critical deal-breakers, or remove rules you don't need"
        maxWidth="2xl"
      >
        <div className="space-y-5">
          {/* Add New Rule Form */}
          <form
            onSubmit={handleAddRule}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
          >
            <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Custom Pre-Trade Rule
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Check BTC dominance & 15m liquidity sweep"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Optional reminder / explanation of what to verify..."
              className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsCritical}
                  onChange={(e) => setNewIsCritical(e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span>Mark as <strong className="text-rose-300">REQUIRED</strong> (blocks GO green light if unchecked)</span>
              </label>

              <Button type="submit" size="sm" variant="primary" disabled={savingRule}>
                {savingRule ? "Adding..." : "+ Add Rule"}
              </Button>
            </div>
          </form>

          {/* Existing Rules List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold ${item.enabled ? "text-white" : "text-slate-500 line-through"}`}>
                      {item.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {item.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleRuleCritical(item)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                      item.is_critical
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    {item.is_critical ? "Required" : "Optional"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleRuleEnabled(item)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${
                      item.enabled
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-slate-800 text-slate-500 border-slate-700"
                    }`}
                  >
                    {item.enabled ? "Active" : "Paused"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(item.id)}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore Default Rules
            </button>
            <Button type="button" variant="primary" size="sm" onClick={() => setIsManageOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

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

      <AssistedOrderModal
        isOpen={isAssistedOrderOpen}
        onClose={() => setIsAssistedOrderOpen(false)}
        accountId={activeAccountId && activeAccountId !== "ALL" ? activeAccountId : "acc_default"}
        symbol={symbol || "BTCUSDT"}
        direction={direction}
        checklistScore={score}
        criticalPassed={criticalPassed}
        sentimentVerdict={sentimentVerdict}
      />
    </div>
  );
}

export default function ChecklistPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-xs text-slate-400">
          Loading Pre-Trade Checklist...
        </div>
      }
    >
      <ChecklistContent />
    </Suspense>
  );
}
