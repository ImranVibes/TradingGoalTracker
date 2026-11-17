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
  Edit2,
  Trash2,
  ExternalLink,
  Radio,
  User,
  Download,
  Calendar,
  Landmark,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react";

type DateRangeType = "ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [marketFilter, setMarketFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [exchangeFilter, setExchangeFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRangeType>("ALL");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

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

  const handleExport = (format: "csv" | "json") => {
    window.open(`/api/export?format=${format}`, "_blank");
  };

  const knownProviders = Array.from(
    new Set(
      trades
        .map((t) => t.signal_provider?.trim())
        .filter((p): p is string => Boolean(p && p.toLowerCase() !== "self"))
    )
  );

  const knownExchanges = Array.from(
    new Set(
      trades
        .map((t) => t.exchange?.trim())
        .filter((e): e is string => Boolean(e))
    )
  );

  const isWithinDateRange = (tradeDate: string) => {
    if (dateRange === "ALL") return true;
    const d = new Date(tradeDate);
    const now = new Date();

    if (dateRange === "TODAY") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }

    if (dateRange === "WEEK") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return d >= oneWeekAgo && d <= now;
    }

    if (dateRange === "MONTH") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    }

    if (dateRange === "CUSTOM") {
      if (customStart && tradeDate < customStart) return false;
      if (customEnd && tradeDate > customEnd + "T23:59:59") return false;
      return true;
    }

    return true;
  };

  const filtered = trades.filter((t) => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (marketFilter !== "ALL" && t.market !== marketFilter) return false;
    if (exchangeFilter !== "ALL" && (t.exchange || "Manual").toUpperCase() !== exchangeFilter.toUpperCase()) {
      return false;
    }
    if (sourceFilter === "SELF") {
      if (t.signal_provider && t.signal_provider.toLowerCase() !== "self") return false;
    } else if (sourceFilter !== "ALL") {
      if (t.signal_provider?.toLowerCase() !== sourceFilter.toLowerCase()) return false;
    }
    if (!isWithinDateRange(t.trade_date)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.signal_provider?.toLowerCase().includes(q) ||
        t.exchange?.toLowerCase().includes(q) ||
        t.reason_entry?.toLowerCase().includes(q) ||
        t.reason_outcome?.toLowerCase().includes(q) ||
        t.strategy?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalFilteredPnl = filtered.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const winCount = filtered.filter((t) => t.status === "WON").length;
  const filteredWinRate = filtered.length > 0 ? Math.round((winCount / filtered.length) * 100) : 0;

  const getExchangeBadgeStyle = (exchange?: string) => {
    const ex = exchange?.toUpperCase();
    if (ex === "BINANCE") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    if (ex === "BYBIT") return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    if (ex === "OKX") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    if (ex === "METATRADER" || ex === "MT4/MT5") return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
    return "bg-slate-800 text-slate-400 border-slate-700/80";
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setMarketFilter("ALL");
    setSourceFilter("ALL");
    setExchangeFilter("ALL");
    setDateRange("ALL");
    setCustomStart("");
    setCustomEnd("");
  };

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

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
          {/* Header & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Trading Journal
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Review executions, autopsy notes, exchange syncs, and win rate reflections.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                <button
                  onClick={() => handleExport("csv")}
                  className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Export filtered or all trades to Excel/CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Export</span> CSV
                </button>
                <button
                  onClick={() => handleExport("json")}
                  className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Download full JSON database backup"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  JSON Backup
                </button>
              </div>

              <button
                onClick={() => {
                  setEditTrade(null);
                  setIsTradeModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Log Trade
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar for Filtered View */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Filtered Trades</span>
              <div className="text-base sm:text-lg font-black font-mono text-white mt-0.5">
                {filtered.length} <span className="text-xs text-slate-500 font-normal">of {trades.length}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Filtered Net P&L</span>
              <div
                className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
                  totalFilteredPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCurrency(totalFilteredPnl, true)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Filtered Win Rate</span>
              <div className="text-base sm:text-lg font-black font-mono text-white mt-0.5">
                {filteredWinRate}% <span className="text-xs text-slate-500 font-normal">({winCount}W)</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Timeframe</span>
                <div className="text-xs sm:text-sm font-semibold text-sky-400 mt-0.5">
                  {dateRange === "ALL"
                    ? "All-Time"
                    : dateRange === "TODAY"
                    ? "Today"
                    : dateRange === "WEEK"
                    ? "Past 7 Days"
                    : dateRange === "MONTH"
                    ? "This Month"
                    : "Custom Range"}
                </div>
              </div>
              {(statusFilter !== "ALL" ||
                marketFilter !== "ALL" ||
                sourceFilter !== "ALL" ||
                exchangeFilter !== "ALL" ||
                dateRange !== "ALL" ||
                search) && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Date Filter & Control Bar */}
          <div className="p-3.5 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-sm space-y-3">
            {/* Top row: Search and Date Range Pills */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search symbol, notes, strategy, exchange..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-700/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Date Range Selector */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 hidden sm:block" />
                {(
                  [
                    { id: "ALL", label: "All Time" },
                    { id: "TODAY", label: "Today" },
                    { id: "WEEK", label: "This Week" },
                    { id: "MONTH", label: "This Month" },
                    { id: "CUSTOM", label: "Custom" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDateRange(item.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                      dateRange === item.id
                        ? "bg-sky-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker if CUSTOM selected */}
            {dateRange === "CUSTOM" && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-slate-400 font-medium">Custom Range:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-white text-xs focus:outline-none focus:border-sky-500"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-white text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            )}

            {/* Bottom row: Multi-Dropdown Filters (Status, Market, Signal Source, Exchange) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
              {/* Status Pills */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {["ALL", "WON", "LOST", "BREAKEVEN"].map((st) => (
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

              {/* Market Filter */}
              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Markets</option>
                <option value="CRYPTO">Crypto</option>
                <option value="FOREX">Forex</option>
                <option value="COMMODITY">Gold & Commodities</option>
                <option value="INDEX">Indices</option>
              </select>

              {/* Signal Source Filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none font-medium"
              >
                <option value="ALL">All Sources (Self + Signals)</option>
                <option value="SELF">👤 My Own Trades</option>
                {knownProviders.map((p) => (
                  <option key={p} value={p}>
                    📡 {p}
                  </option>
                ))}
              </select>

              {/* Exchange Platform Filter */}
              <select
                value={exchangeFilter}
                onChange={(e) => setExchangeFilter(e.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none font-medium"
              >
                <option value="ALL">All Platforms & Exchanges</option>
                <option value="BINANCE">Binance</option>
                <option value="BYBIT">Bybit</option>
                <option value="OKX">OKX</option>
                <option value="METATRADER">MetaTrader (MT4/MT5)</option>
                <option value="BITGET">Bitget</option>
                <option value="WALLET">Web3 Wallet</option>
                <option value="MANUAL">Manual / Paper</option>
                {knownExchanges
                  .filter(
                    (ex) =>
                      !["BINANCE", "BYBIT", "OKX", "METATRADER", "BITGET", "WALLET", "MANUAL"].includes(
                        ex.toUpperCase()
                      )
                  )
                  .map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Trades Stream */}
          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
              <BookOpen className="w-9 h-9 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No journal entries found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {trades.length === 0
                  ? "Log your first trade or connect your exchange API in Settings to auto-import trades."
                  : "No trades matched your active search or filters. Click below to reset filters or record a new trade."}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {trades.length > 0 && (
                  <button
                    onClick={resetFilters}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditTrade(null);
                    setIsTradeModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
                >
                  + Log Trade
                </button>
              </div>
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
                    className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 hover:border-slate-700 transition-colors space-y-3"
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
                          <div className="flex items-center flex-wrap gap-2">
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

                            {/* Exchange Badge */}
                            {trade.exchange && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wider ${getExchangeBadgeStyle(
                                  trade.exchange
                                )}`}
                              >
                                {trade.exchange}
                              </span>
                            )}

                            {/* Signal Source Badge */}
                            {trade.signal_provider && trade.signal_provider.toLowerCase() !== "self" ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30 font-medium flex items-center gap-1">
                                <Radio className="w-2.5 h-2.5 text-violet-400" />
                                {trade.signal_provider}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-medium flex items-center gap-1">
                                <User className="w-2.5 h-2.5 text-slate-400" />
                                Self
                              </span>
                            )}

                            {trade.chart_image && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium flex items-center gap-1">
                                <ImageIcon className="w-2.5 h-2.5" />
                                Screenshot
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {formatDate(trade.trade_date)} {trade.strategy ? `• ${trade.strategy}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:text-right">
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

                    {/* Chart Image Thumbnail + Reasons Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                      {trade.chart_image && (
                        <div
                          className="md:col-span-3 cursor-pointer group relative overflow-hidden rounded-lg border border-slate-800 bg-black/40 h-24 sm:h-28 flex items-center justify-center"
                          onClick={() => setSelectedTrade(trade)}
                          title="Click to expand chart autopsy"
                        >
                          <img
                            src={trade.chart_image}
                            alt="Chart Preview"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> View Setup
                          </div>
                        </div>
                      )}

                      <div className={trade.chart_image ? "md:col-span-9 space-y-2" : "md:col-span-12 space-y-2"}>
                        {(trade.reason_entry || trade.reason_outcome) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {trade.reason_entry && (
                              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                                <span className="text-[11px] font-semibold text-sky-400 block mb-1">
                                  Why I took the trade:
                                </span>
                                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">
                                  {trade.reason_entry}
                                </p>
                              </div>
                            )}
                            {trade.reason_outcome && (
                              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                                <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                                  Why profit / loss was made:
                                </span>
                                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">
                                  {trade.reason_outcome}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400 font-mono gap-1">
                      <div>
                        {trade.entry_price ? (
                          <span>
                            Entry: {trade.entry_price}{" "}
                            {trade.exit_price ? `→ Exit: ${trade.exit_price}` : ""}{" "}
                            {trade.quantity ? `• Qty: ${trade.quantity}` : ""}
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
                            <ExternalLink className="w-3 h-3" /> External Link
                          </a>
                        )}

                        <button
                          onClick={() => setSelectedTrade(trade)}
                          className="text-slate-300 hover:text-white underline font-sans"
                        >
                          View Details & Notes
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
