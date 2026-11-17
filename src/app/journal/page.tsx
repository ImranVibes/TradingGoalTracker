"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { TradeDetailModal } from "@/components/journal/TradeDetailModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { Badge } from "@/components/ui/Badge";
import { Trade } from "@/lib/types";
import { formatCurrency, formatDate, calculateRR } from "@/lib/utils";
import {
  BookOpen,
  PlusCircle,
  Search,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  Edit2,
  Trash2,
} from "lucide-react";

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [marketFilter, setMarketFilter] = useState("ALL");

  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      if (data.success) setTrades(data.trades);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleDeleteTrade = async (id: string) => {
    try {
      await fetch(`/api/trades/${id}`, { method: "DELETE" });
      await fetchTrades();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = trades.filter((t) => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (marketFilter !== "ALL" && t.market !== marketFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.reason_entry?.toLowerCase().includes(q) ||
        t.reason_outcome?.toLowerCase().includes(q) ||
        t.strategy?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => {
          setEditTrade(null);
          setIsTradeModalOpen(true);
        }}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={fetchTrades}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Trading Journal</h1>
                <p className="text-xs text-slate-400">
                  Comprehensive trade autopsy: entries, outcomes, confluences, and psychological lessons
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setEditTrade(null);
                setIsTradeModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              Log New Trade
            </button>
          </div>

          {/* Filter Bar */}
          <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Box */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol, notes, strategy..."
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {["ALL", "WON", "LOST", "BREAKEVEN", "OPEN"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                      statusFilter === st
                        ? "bg-sky-500/20 text-sky-300 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Markets</option>
                <option value="FOREX">Forex</option>
                <option value="CRYPTO">Crypto</option>
                <option value="COMMODITY">Commodity (Gold)</option>
                <option value="INDEX">Indices (US30/NAS)</option>
              </select>
            </div>
          </div>

          {/* Trade Cards Stream */}
          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No journal entries found</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                {trades.length === 0
                  ? "Log your first trade with entry confluences and post-trade reflections."
                  : "Try clearing your filters or search keywords."}
              </p>
              <button
                onClick={() => {
                  setEditTrade(null);
                  setIsTradeModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white"
              >
                + Log Trade Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((trade) => {
                const isProfit = trade.pnl > 0;
                const isLoss = trade.pnl < 0;
                const rr = calculateRR(
                  trade.entry_price,
                  trade.stop_loss,
                  trade.take_profit,
                  trade.direction
                );

                return (
                  <div
                    key={trade.id}
                    className={`rounded-2xl border p-5 transition-all shadow-xl ${
                      isProfit
                        ? "bg-[#0f172a] border-slate-800 hover:border-emerald-500/40"
                        : isLoss
                        ? "bg-[#0f172a] border-slate-800 hover:border-rose-500/40"
                        : "bg-[#0f172a] border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl ${
                            trade.direction === "LONG"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {trade.direction === "LONG" ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono text-white tracking-tight">
                              {trade.symbol}
                            </span>
                            <span className="text-xs font-bold text-slate-400 uppercase">
                              {trade.direction}
                            </span>
                            <Badge
                              variant={
                                trade.status === "WON"
                                  ? "profit"
                                  : trade.status === "LOST"
                                  ? "loss"
                                  : trade.status === "BREAKEVEN"
                                  ? "breakeven"
                                  : "open"
                              }
                              size="sm"
                            >
                              {trade.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">
                            {formatDate(trade.trade_date, true)} • {trade.strategy || "Manual"} • {trade.timeframe || "1h"} • {trade.session || "NY"}
                          </p>
                        </div>
                      </div>

                      {/* Realized PnL & RR */}
                      <div className="flex items-center gap-4 sm:text-right">
                        <div>
                          <div
                            className={`text-xl font-black font-mono num-tabular ${
                              isProfit ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-slate-300"
                            }`}
                          >
                            {formatCurrency(trade.pnl, true)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {rr ? `1:${rr} R:R` : "Risk / Reward: N/A"}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditTrade(trade);
                              setIsTradeModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Trade"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this trade?")) handleDeleteTrade(trade.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Trade"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Trade Reflection Body */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                      {/* Why I took the trade */}
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-400 mb-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Why I took the trade (Setup / Confluence)
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {trade.reason_entry || "No entry reason logged."}
                        </p>
                      </div>

                      {/* Why profit or loss happened */}
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
                          <HelpCircle className="w-3.5 h-3.5" />
                          Why profit / loss was made (Autopsy)
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {trade.reason_outcome || "No outcome reason logged."}
                        </p>
                      </div>
                    </div>

                    {/* Footer Prices & Chart Link */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-4 text-slate-400 font-mono">
                        <span>
                          Entry: <strong className="text-white">{trade.entry_price}</strong>
                        </span>
                        <span>
                          Exit:{" "}
                          <strong className="text-white">
                            {trade.exit_price ?? <span className="text-slate-500 italic">open</span>}
                          </strong>
                        </span>
                        <span>
                          SL: <strong className="text-rose-400">{trade.stop_loss ?? "-"}</strong>
                        </span>
                        <span>
                          TP: <strong className="text-emerald-400">{trade.take_profit ?? "-"}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {trade.chart_url && (
                          <a
                            href={trade.chart_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline font-medium"
                          >
                            <ExternalLink className="w-3 h-3" /> View Chart
                          </a>
                        )}

                        <button
                          onClick={() => setSelectedTrade(trade)}
                          className="text-xs font-semibold text-slate-300 hover:text-white underline"
                        >
                          View Full Details →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => fetchTrades()}
        editTrade={editTrade}
      />

      <TradeDetailModal
        trade={selectedTrade}
        isOpen={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onEdit={(t) => {
          setSelectedTrade(null);
          setEditTrade(t);
          setIsTradeModalOpen(true);
        }}
        onDelete={handleDeleteTrade}
      />

      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={() => fetchTrades()}
      />

      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => fetchTrades()}
      />
    </div>
  );
}
