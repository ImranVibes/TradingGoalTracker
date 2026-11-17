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
  CheckCircle2,
  HelpCircle,
  Edit2,
  Trash2,
  ExternalLink,
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Trading Journal
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Review your trades, entry reasons, and outcome reflections.
              </p>
            </div>

            <button
              onClick={() => {
                setEditTrade(null);
                setIsTradeModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Log Trade
            </button>
          </div>

          {/* Filter Bar */}
          <div className="p-3.5 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
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

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {["ALL", "WON", "LOST", "BREAKEVEN", "OPEN"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                      statusFilter === st
                        ? "bg-slate-800 text-white font-bold"
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
                <option value="COMMODITY">Gold & Commodities</option>
                <option value="INDEX">Indices</option>
              </select>
            </div>
          </div>

          {/* Trades Stream */}
          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-300">No journal entries found</h3>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                {trades.length === 0
                  ? "Log your first trade to start tracking your performance."
                  : "Try clearing your search keyword."}
              </p>
              <button
                onClick={() => {
                  setEditTrade(null);
                  setIsTradeModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white"
              >
                + Log Trade
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((trade) => {
                const isProfit = trade.pnl > 0;
                const isLoss = trade.pnl < 0;
                const rr = calculateRR(
                  trade.entry_price || 0,
                  trade.stop_loss,
                  trade.take_profit,
                  trade.direction
                );

                return (
                  <div
                    key={trade.id}
                    className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 hover:border-slate-700 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg ${
                            trade.direction === "LONG"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {trade.direction === "LONG" ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold font-mono text-white">
                              {trade.symbol}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
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
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {formatDate(trade.trade_date)} {trade.strategy ? `• ${trade.strategy}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:text-right">
                        <div>
                          <div
                            className={`text-base font-bold font-mono num-tabular ${
                              isProfit ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-slate-300"
                            }`}
                          >
                            {formatCurrency(trade.pnl, true)}
                          </div>
                          {rr && (
                            <div className="text-[10px] text-slate-400 font-mono">1:{rr} R:R</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditTrade(trade);
                              setIsTradeModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                            title="Edit Trade"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this trade?")) handleDeleteTrade(trade.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                            title="Delete Trade"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Reasons */}
                    {(trade.reason_entry || trade.reason_outcome) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3 text-xs">
                        {trade.reason_entry && (
                          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                            <span className="text-[11px] font-semibold text-sky-400 block mb-1">
                              Why I took the trade:
                            </span>
                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {trade.reason_entry}
                            </p>
                          </div>
                        )}
                        {trade.reason_outcome && (
                          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                            <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                              Why profit / loss was made:
                            </span>
                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {trade.reason_outcome}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400 font-mono">
                      <div>
                        {trade.entry_price ? (
                          <span>
                            Entry: {trade.entry_price}{" "}
                            {trade.exit_price ? `→ Exit: ${trade.exit_price}` : ""}
                          </span>
                        ) : (
                          <span>Quick-logged trade</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {trade.chart_url && (
                          <a
                            href={trade.chart_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-400 hover:underline flex items-center gap-1 font-sans"
                          >
                            <ExternalLink className="w-3 h-3" /> Chart
                          </a>
                        )}

                        <button
                          onClick={() => setSelectedTrade(trade)}
                          className="text-slate-300 hover:text-white underline font-sans"
                        >
                          View Details
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
