"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { TradeDetailModal } from "@/components/journal/TradeDetailModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { Badge } from "@/components/ui/Badge";
import { useAccounts } from "@/components/providers/AccountProvider";
import { Trade, Goal } from "@/lib/types";
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
  Image as ImageIcon,
  RotateCcw,
  RefreshCw,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Receipt,
  CheckCircle2,
  Target,
} from "lucide-react";

type DateRangeType = "ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

export default function JournalPage() {
  const {
    accounts,
    activeAccountId,
    activeAccount,
    refreshAccounts,
    triggerAutoSync,
    autoSyncMessage,
    dismissSyncMessage,
  } = useAccounts();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [registeredProviders, setRegisteredProviders] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [marketFilter, setMarketFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [exchangeFilter, setExchangeFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRangeType>("ALL");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Selection for bulk actions (assign trader, move account, add to goal, or delete)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Sync & Legacy cleanup state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCleaningLegacy, setIsCleaningLegacy] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      const qs =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const [tradesRes, goalsRes, providersRes] = await Promise.all([
        fetch(`/api/trades${qs}`).then((r) => r.json()),
        fetch("/api/goals").then((r) => r.json()),
        fetch("/api/providers").then((r) => r.json()),
      ]);
      if (tradesRes.success) setTrades(tradesRes.trades);
      if (goalsRes.success) setGoals(goalsRes.goals);
      if (providersRes.success && Array.isArray(providersRes.providers)) {
        setRegisteredProviders(
          providersRes.providers
            .map((p: any) => p.name?.trim())
            .filter((n: string) => Boolean(n && n.toLowerCase() !== "self"))
        );
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeAccountId]);

  // 1-Click instant Signal Provider assignment right on the card (optimistic update)
  const handleAssignProvider = async (tradeId: string, providerName: string) => {
    const clean = providerName.trim() || "Self";
    setTrades((prev) =>
      prev.map((t) => (t.id === tradeId ? { ...t, signal_provider: clean } : t))
    );
    try {
      await fetch(`/api/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal_provider: clean }),
      });
    } catch (err) {
      console.error(err);
      await fetchTrades();
    }
  };

  const handleBulkAssignProvider = async (providerName: string) => {
    if (!providerName || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await fetch("/api/trades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, signal_provider: providerName }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner(`Assigned ${selectedIds.length} position(s) to "${providerName}"!`);
        setSelectedIds([]);
        await fetchTrades();
        setTimeout(() => setStatusBanner(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkMoveAccount = async (targetAccId: string) => {
    if (!targetAccId || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await fetch("/api/trades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, account_id: targetAccId }),
      });
      const data = await res.json();
      if (data.success) {
        const accName = accounts.find((a) => a.id === targetAccId)?.name || "Account";
        setStatusBanner(`Moved ${selectedIds.length} position(s) to "${accName}"!`);
        setSelectedIds([]);
        await Promise.all([fetchTrades(), refreshAccounts()]);
        setTimeout(() => setStatusBanner(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkAddToGoal = async (goalId: string) => {
    if (!goalId || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_trade_ids: selectedIds }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner(`Added ${selectedIds.length} position(s) to goal "${data.goal?.title || "Goal"}"!`);
        setSelectedIds([]);
        await fetchTrades();
        setTimeout(() => setStatusBanner(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleToggleTradeGoal = async (goalId: string, tradeId: string) => {
    if (!goalId) return;
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggle_trade_id: tradeId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner(`Updated goal "${data.goal?.title || "Goal"}" with this position's P&L!`);
        await fetchTrades();
        setTimeout(() => setStatusBanner(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTrades();
    setSelectedIds([]);
  }, [fetchTrades]);

  // Automatically fetch latest closed positions in the background when opening Journal
  useEffect(() => {
    triggerAutoSync(() => {
      fetchTrades();
    });
  }, [triggerAutoSync, fetchTrades]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner(data.message || `Synced ${data.imported_trades || 0} new closed position(s).`);
        await Promise.all([fetchTrades(), refreshAccounts()]);
      } else {
        setStatusBanner(data.error || "Sync failed.");
      }
    } catch (err: any) {
      setStatusBanner(err.message || "Sync failed.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setStatusBanner(null), 5000);
    }
  };

  const handleCleanupLegacyFills = async () => {
    if (
      !confirm(
        "This will remove your old raw partial-fill imports and re-import them cleanly as consolidated Closed Positions with Trading & Funding Fees. Continue?"
      )
    ) {
      return;
    }
    setIsCleaningLegacy(true);
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup_legacy_fills" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner(data.message);
        await Promise.all([fetchTrades(), refreshAccounts()]);
      } else {
        setStatusBanner(data.error || "Cleanup failed.");
      }
    } catch (err: any) {
      setStatusBanner(err.message || "Cleanup failed.");
    } finally {
      setIsCleaningLegacy(false);
    }
  };

  const handleDeleteTrade = async (id: string) => {
    try {
      await fetch(`/api/trades/${id}`, { method: "DELETE" });
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      await Promise.all([fetchTrades(), refreshAccounts()]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Delete ${selectedIds.length} selected position(s)? Any exchange-synced positions deleted will be permanently ignored and NEVER re-imported on future syncs.`
      )
    ) {
      return;
    }
    setIsBulkDeleting(true);
    try {
      const res = await fetch("/api/trades", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner(data.message);
        setSelectedIds([]);
        await Promise.all([fetchTrades(), refreshAccounts()]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBulkDeleting(false);
      setTimeout(() => setStatusBanner(null), 5000);
    }
  };

  const handleMoveToAccount = async (tradeId: string, newAccountId: string) => {
    try {
      await fetch(`/api/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: newAccountId }),
      });
      await Promise.all([fetchTrades(), refreshAccounts()]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = (format: "csv" | "json") => {
    const accParam =
      activeAccountId && activeAccountId !== "ALL"
        ? `&account_id=${encodeURIComponent(activeAccountId)}`
        : "";
    window.open(`/api/export?format=${format}${accParam}`, "_blank");
  };

  const legacyPartialFillCount = trades.filter(
    (t) => t.exchange_trade_id && t.exchange_trade_id.startsWith("binance_fut_")
  ).length;

  const knownProviders = Array.from(
    new Set([
      ...registeredProviders,
      ...trades
        .map((t) => t.signal_provider?.trim())
        .filter((p): p is string => Boolean(p && p.toLowerCase() !== "self")),
    ])
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
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
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

  const totalFilteredPnl = filtered.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
  const totalFilteredGross = filtered.reduce(
    (acc, t) => acc + Number(t.gross_pnl ?? t.pnl ?? 0),
    0
  );
  const totalTradingFees = filtered.reduce((acc, t) => acc + Math.abs(Number(t.trading_fee || 0)), 0);
  const totalFundingFees = filtered.reduce((acc, t) => acc + Number(t.funding_fee || 0), 0);
  const winCount = filtered.filter((t) => t.status === "WON").length;
  const filteredWinRate = filtered.length > 0 ? Math.round((winCount / filtered.length) * 100) : 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((t) => t.id));
    }
  };

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
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Positions Journal
                {activeAccount && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                    {activeAccount.name}
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidated closed positions, trading & funding fees, autopsy notes, and account assignment.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Fetch latest closed positions from connected exchanges"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Latest Positions"}
              </button>

              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                <button
                  onClick={() => handleExport("csv")}
                  className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Export positions & fees to CSV/Excel"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  CSV
                </button>
                <button
                  onClick={() => handleExport("json")}
                  className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Download full JSON database backup"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  JSON
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
                Log Position
              </button>
            </div>
          </div>

          {/* Auto-Sync / Action Status Notification */}
          {(statusBanner || autoSyncMessage) && (
            <div className="p-3 rounded-xl bg-slate-900 border border-sky-500/30 text-xs text-sky-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                {statusBanner || autoSyncMessage}
              </span>
              <button
                onClick={() => {
                  setStatusBanner(null);
                  dismissSyncMessage();
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Upgrade Banner if Legacy Partial Fills Detected */}
          {legacyPartialFillCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-amber-200">
                    Found {legacyPartialFillCount} old partial-fill trade rows from before Position Consolidation
                  </div>
                  <p className="text-amber-200/80 mt-0.5">
                    Click once to automatically replace those split fills with clean consolidated Closed Positions (including accurate Entry/Exit, Trading Fees, and Funding Fees).
                  </p>
                </div>
              </div>
              <button
                onClick={handleCleanupLegacyFills}
                disabled={isCleaningLegacy}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {isCleaningLegacy ? "Upgrading..." : "Clean Up & Re-Sync Positions"}
              </button>
            </div>
          )}

          {/* Quick Metrics Bar for Filtered View (including Fees!) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Positions
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-white mt-0.5">
                {filtered.length}{" "}
                <span className="text-xs text-slate-500 font-normal">({filteredWinRate}% win)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Gross P&L
              </span>
              <div
                className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
                  totalFilteredGross >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCurrency(totalFilteredGross, true)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <Receipt className="w-3 h-3 text-amber-400" />
                Trading Fees
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-amber-300 mt-0.5">
                -{formatCurrency(totalTradingFees)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Funding Fees
              </span>
              <div
                className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
                  totalFundingFees < 0
                    ? "text-rose-300"
                    : totalFundingFees > 0
                    ? "text-emerald-300"
                    : "text-slate-300"
                }`}
              >
                {formatCurrency(totalFundingFees, true)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0f172a] border border-slate-800/90 col-span-2 lg:col-span-1 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Net P&L (After Fees)
                </span>
                <div
                  className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
                    totalFilteredPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatCurrency(totalFilteredPnl, true)}
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
                  className="text-xs text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Date Filter & Control Bar */}
          <div className="p-3.5 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-sm space-y-3">
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

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
              <div className="flex flex-wrap items-center gap-2">
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

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none font-medium"
                >
                  <option value="ALL">All Sources</option>
                  <option value="SELF">👤 My Own Trades</option>
                  {knownProviders.map((p) => (
                    <option key={p} value={p}>
                      📡 {p}
                    </option>
                  ))}
                </select>

                <select
                  value={exchangeFilter}
                  onChange={(e) => setExchangeFilter(e.target.value)}
                  className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none font-medium"
                >
                  <option value="ALL">All Exchanges</option>
                  <option value="BINANCE">Binance</option>
                  <option value="BYBIT">Bybit</option>
                  <option value="OKX">OKX</option>
                  <option value="METATRADER">MetaTrader</option>
                  <option value="BITGET">Bitget</option>
                  <option value="WALLET">Wallet</option>
                  <option value="MANUAL">Manual</option>
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

              {/* Bulk Selection Bar */}
              {filtered.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={toggleSelectAllFiltered}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 flex items-center gap-1.5"
                  >
                    {selectedIds.length === filtered.length && filtered.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    {selectedIds.length > 0 ? `${selectedIds.length} Selected` : "Select All"}
                  </button>

                  {selectedIds.length > 0 && (
                    <>
                      {/* Bulk Assign Signal Provider */}
                      <div className="flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/40 rounded-lg px-2 py-1">
                        <Radio className="w-3 h-3 text-violet-400" />
                        <select
                          value=""
                          disabled={isBulkUpdating}
                          onChange={(e) => {
                            if (e.target.value) handleBulkAssignProvider(e.target.value);
                          }}
                          className="bg-transparent text-xs font-semibold text-violet-200 focus:outline-none cursor-pointer"
                          title="Assign all selected positions to a signal trader in 1 click"
                        >
                          <option value="" className="bg-slate-900 text-slate-400">
                            Assign Trader ({selectedIds.length})...
                          </option>
                          <option value="Self" className="bg-slate-900 text-white">
                            👤 Self (My Own)
                          </option>
                          {knownProviders.map((p) => (
                            <option key={p} value={p} className="bg-slate-900 text-white">
                              📡 {p}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bulk Move to Account */}
                      {accounts.length > 1 && (
                        <div className="flex items-center gap-1.5 bg-sky-500/15 border border-sky-500/40 rounded-lg px-2 py-1">
                          <Layers className="w-3 h-3 text-sky-400" />
                          <select
                            value=""
                            disabled={isBulkUpdating}
                            onChange={(e) => {
                              if (e.target.value) handleBulkMoveAccount(e.target.value);
                            }}
                            className="bg-transparent text-xs font-semibold text-sky-200 focus:outline-none cursor-pointer"
                          >
                            <option value="" className="bg-slate-900 text-slate-400">
                              Move Account...
                            </option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                                {acc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Bulk Add to Goal */}
                      {goals.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 rounded-lg px-2 py-1">
                          <Target className="w-3 h-3 text-emerald-400" />
                          <select
                            value=""
                            disabled={isBulkUpdating}
                            onChange={(e) => {
                              if (e.target.value) handleBulkAddToGoal(e.target.value);
                            }}
                            className="bg-transparent text-xs font-semibold text-emerald-200 focus:outline-none cursor-pointer"
                          >
                            <option value="" className="bg-slate-900 text-slate-400">
                              Add to Goal...
                            </option>
                            {goals.map((g) => (
                              <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                                {g.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        onClick={handleBulkDelete}
                        disabled={isBulkDeleting}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 disabled:opacity-50"
                        title="Delete selected positions permanently (they will never be re-imported)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isBulkDeleting ? "Deleting..." : `Delete (${selectedIds.length})`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Positions Stream */}
          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
              <BookOpen className="w-9 h-9 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No positions found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {trades.length === 0
                  ? activeAccount
                    ? `No positions assigned to "${activeAccount.name}" yet. Log a trade or move an existing position into this account.`
                    : "Log your first position or connect Binance/Bybit in Settings to auto-sync closed positions."
                  : "No positions matched your active filters."}
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
                  + Log Position
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((trade) => {
                const isProfit = trade.pnl > 0;
                const isLoss = trade.pnl < 0;
                const isSelected = selectedIds.includes(trade.id);
                const tFee = Math.abs(Number(trade.trading_fee || 0));
                const fFee = Number(trade.funding_fee || 0);
                const gPnl =
                  trade.gross_pnl !== undefined && trade.gross_pnl !== null
                    ? Number(trade.gross_pnl)
                    : trade.pnl;
                const rr = calculateRR(
                  trade.entry_price || 0,
                  trade.stop_loss,
                  trade.take_profit,
                  trade.direction
                );

                return (
                  <div
                    key={trade.id}
                    className={`rounded-xl border bg-[#0f172a] p-4 transition-colors space-y-3 ${
                      isSelected
                        ? "border-sky-500/60 bg-sky-500/5"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <button
                          onClick={() => toggleSelect(trade.id)}
                          className="mt-1 sm:mt-0 text-slate-500 hover:text-sky-400 transition-colors"
                          title="Select position for bulk delete"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

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

                            {trade.exchange && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wider ${getExchangeBadgeStyle(
                                  trade.exchange
                                )}`}
                              >
                                {trade.exchange}
                              </span>
                            )}

                            {/* 1-Click Inline Signal Provider Selector (No Edit Modal Needed!) */}
                            <div
                              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                                trade.signal_provider && trade.signal_provider.toLowerCase() !== "self"
                                  ? "bg-violet-500/15 text-violet-200 border-violet-500/40"
                                  : "bg-slate-800/90 text-slate-300 border-slate-700 hover:border-slate-500"
                              }`}
                              title="1-click assign this position to a trader / signal provider"
                            >
                              {trade.signal_provider && trade.signal_provider.toLowerCase() !== "self" ? (
                                <Radio className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" />
                              ) : (
                                <User className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                              )}
                              <select
                                value={trade.signal_provider || "Self"}
                                onChange={(e) => {
                                  if (e.target.value === "__NEW__") {
                                    const custom = prompt("Enter new trader / signal provider name:");
                                    if (custom && custom.trim()) {
                                      handleAssignProvider(trade.id, custom.trim());
                                    }
                                  } else {
                                    handleAssignProvider(trade.id, e.target.value);
                                  }
                                }}
                                className="bg-transparent focus:outline-none cursor-pointer pr-0.5 text-[11px] font-medium"
                              >
                                <option value="Self" className="bg-slate-900 text-white">
                                  Self
                                </option>
                                {knownProviders.map((p) => (
                                  <option key={p} value={p} className="bg-slate-900 text-white">
                                    {p}
                                  </option>
                                ))}
                                <option value="__NEW__" className="bg-slate-900 text-sky-400">
                                  + New Trader...
                                </option>
                              </select>
                            </div>

                            {trade.chart_image && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium flex items-center gap-1">
                                <ImageIcon className="w-2.5 h-2.5" />
                                Chart
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {formatDate(trade.trade_date, true)}{" "}
                            {trade.strategy ? `• ${trade.strategy}` : ""}
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
                          <div className="flex items-center sm:justify-end gap-2 text-[10px] font-mono text-slate-400">
                            {(tFee > 0 || fFee !== 0) && (
                              <>
                                <span>Gross: {formatCurrency(gPnl, true)}</span>
                                {tFee > 0 && (
                                  <span className="text-amber-300">Fee: -{formatCurrency(tFee)}</span>
                                )}
                                {fFee !== 0 && (
                                  <span className={fFee < 0 ? "text-rose-300" : "text-emerald-300"}>
                                    Fund: {formatCurrency(fFee, true)}
                                  </span>
                                )}
                              </>
                            )}
                            {rr && <span className="text-sky-400">1:{rr} R:R</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditTrade(trade);
                              setIsTradeModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                            title="Edit Position / Assign Signal Provider"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  trade.exchange_trade_id
                                    ? "Delete this synced position? It will be permanently excluded and NEVER re-imported on future syncs."
                                    : "Delete this position?"
                                )
                              ) {
                                handleDeleteTrade(trade.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                            title="Delete (won't be re-imported on future syncs)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Chart Image Thumbnail + Reasons */}
                    {(trade.chart_image || trade.reason_entry || trade.reason_outcome) && (
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
                          </div>
                        )}

                        <div className={trade.chart_image ? "md:col-span-9" : "md:col-span-12"}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {trade.reason_entry && (
                              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                                <span className="text-[11px] font-semibold text-sky-400 block mb-1">
                                  Entry Notes:
                                </span>
                                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">
                                  {trade.reason_entry}
                                </p>
                              </div>
                            )}
                            {trade.reason_outcome && (
                              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                                <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                                  Outcome / Fee Summary:
                                </span>
                                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">
                                  {trade.reason_outcome}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer: Prices + 1-Click Account Assignment */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400 gap-2">
                      <div className="font-mono">
                        {trade.entry_price ? (
                          <span>
                            Entry: {trade.entry_price}{" "}
                            {trade.exit_price ? `→ Exit: ${trade.exit_price}` : ""}{" "}
                            {trade.quantity ? `• Qty: ${trade.quantity}` : ""}
                          </span>
                        ) : (
                          <span>Quick-logged position</span>
                        )}
                      </div>

                      <div className="flex items-center flex-wrap gap-2.5">
                        {/* Linked Goal Badges + 1-Click Add to Goal */}
                        {goals.length > 0 && (
                          <div className="flex items-center flex-wrap gap-1.5">
                            {goals
                              .filter((g) => (g.linked_trade_ids || []).includes(trade.id))
                              .map((g) => (
                                <button
                                  key={g.id}
                                  onClick={() => handleToggleTradeGoal(g.id, trade.id)}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 transition-colors flex items-center gap-1"
                                  title={`Linked to goal "${g.title}" — click to unlink`}
                                >
                                  <Target className="w-2.5 h-2.5" />
                                  {g.title} ✕
                                </button>
                              ))}

                            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5">
                              <Target className="w-3 h-3 text-emerald-400" />
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleToggleTradeGoal(e.target.value, trade.id);
                                  }
                                }}
                                className="bg-transparent text-[11px] text-slate-300 focus:outline-none cursor-pointer"
                                title="Add this position's profit or loss to a specific goal"
                              >
                                <option value="" className="bg-slate-900 text-slate-400">
                                  + Add to Goal
                                </option>
                                {goals
                                  .filter((g) => !(g.linked_trade_ids || []).includes(trade.id))
                                  .map((g) => (
                                    <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                                      {g.title} ({formatCurrency(g.current_amount)}/{formatCurrency(g.target_amount)})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Inline 1-Click Account Assignment */}
                        {accounts.length > 1 && (
                          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5">
                            <Layers className="w-3 h-3 text-sky-400" />
                            <select
                              value={trade.account_id || "acc_default"}
                              onChange={(e) => handleMoveToAccount(trade.id, e.target.value)}
                              className="bg-transparent text-[11px] text-slate-300 focus:outline-none cursor-pointer"
                              title="Assign this position to another target or loss recovery account"
                            >
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                                  {acc.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {trade.chart_url && (
                          <a
                            href={trade.chart_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-400 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Chart Link
                          </a>
                        )}

                        <button
                          onClick={() => setSelectedTrade(trade)}
                          className="text-slate-300 hover:text-white underline"
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
        onSuccess={() => {
          fetchTrades();
          refreshAccounts();
        }}
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
