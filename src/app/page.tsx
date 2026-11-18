"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatCard } from "@/components/dashboard/StatCard";
import { EquityChart } from "@/components/dashboard/EquityChart";
import { RecentTradesTable } from "@/components/dashboard/RecentTradesTable";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { TradeDetailModal } from "@/components/journal/TradeDetailModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { GoalCard } from "@/components/goals/GoalCard";
import { useAccounts } from "@/components/providers/AccountProvider";
import { Trade, Goal, DashboardStats } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  Percent,
  Wallet,
  Receipt,
  PlusCircle,
  ArrowRight,
  Calculator,
  Radio,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Landmark,
  Sliders,
  CheckCircle2,
  Target,
  RotateCcw,
  Layers,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const {
    activeAccountId,
    activeAccount,
    accounts,
    refreshAccounts,
    triggerAutoSync,
    autoSyncMessage,
    dismissSyncMessage,
  } = useAccounts();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const accParam =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const [statsRes, tradesRes, goalsRes] = await Promise.all([
        fetch(`/api/stats${accParam}`).then((r) => r.json()),
        fetch(`/api/trades${accParam}`).then((r) => r.json()),
        fetch("/api/goals").then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (tradesRes.success) setTrades(tradesRes.trades);
      if (goalsRes.success) setGoals(goalsRes.goals);
    } catch (err) {
      console.error(err);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-sync latest closed positions automatically in the background when visiting Dashboard
  useEffect(() => {
    triggerAutoSync(() => {
      fetchData();
    });
  }, [triggerAutoSync, fetchData]);

  const handleSyncExchanges = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(data.message || `Sync complete: ${data.imported_trades || 0} new position(s) imported.`);
        await Promise.all([fetchData(), refreshAccounts()]);
      } else {
        setSyncMessage(data.error || "Exchange sync failed.");
      }
    } catch (err: any) {
      setSyncMessage(err.message || "Failed to trigger sync.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    try {
      await fetch(`/api/trades/${tradeId}`, { method: "DELETE" });
      await Promise.all([fetchData(), refreshAccounts()]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const maxDd = stats?.drawdown?.max_drawdown_pct ?? 0;
  const currentDd = stats?.drawdown?.current_drawdown_pct ?? 0;
  const livingBalance = stats?.drawdown?.current_balance ?? stats?.living_balance ?? stats?.net_pnl ?? 0;
  const startingBalance = stats?.drawdown?.starting_balance ?? stats?.starting_balance ?? 10000;
  const peakEquity = stats?.drawdown?.peak_equity ?? livingBalance;

  const activeGoalTarget =
    activeAccount?.type === "RECOVERY"
      ? activeAccount.initial_loss || activeAccount.target_amount || 0
      : activeAccount?.target_amount || 0;
  const activeNetPnl = stats?.net_pnl ?? 0;
  const activeProgressPct =
    activeGoalTarget > 0
      ? Math.max(0, Math.min(100, Number(((activeNetPnl / activeGoalTarget) * 100).toFixed(1))))
      : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => {
          setEditTrade(null);
          setIsTradeModalOpen(true);
        }}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => {
          setEditGoal(null);
          setIsGoalModalOpen(true);
        }}
        onRefresh={fetchData}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header & Quick Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Trading Dashboard
                {activeAccount && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                    {activeAccount.name}
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Living balance, consolidated positions, trading & funding fees, drawdown risk, and multi-account targets.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={handleSyncExchanges}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Sync latest closed positions & fees from Binance and Bybit"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Positions"}
              </button>

              <Link
                href="/accounts"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Accounts ({accounts.length})
              </Link>

              <Link
                href="/calculator"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                Risk Calc
              </Link>

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

          {/* Sync Status Banner */}
          {(syncMessage || autoSyncMessage) && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-sky-500/30 text-xs text-sky-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                {syncMessage || autoSyncMessage}
              </span>
              <button
                onClick={() => {
                  setSyncMessage(null);
                  dismissSyncMessage();
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active Account Target / Loss Recovery Progress Banner */}
          {activeAccount && activeGoalTarget > 0 && (
            <div
              className={`rounded-2xl border p-4 space-y-2.5 ${
                activeAccount.type === "RECOVERY"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-emerald-500/10 border-emerald-500/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {activeAccount.type === "RECOVERY" ? (
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Target className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="text-sm font-bold text-white">{activeAccount.name}</span>
                  <span className="text-[11px] text-slate-300">
                    ({activeAccount.type === "RECOVERY" ? "Loss Recovery Account" : "Profit Target Account"})
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-white">
                  {formatCurrency(Math.max(0, activeNetPnl))} / {formatCurrency(activeGoalTarget)}{" "}
                  <span className={activeAccount.type === "RECOVERY" ? "text-amber-300" : "text-emerald-300"}>
                    ({activeProgressPct}%)
                  </span>
                </div>
              </div>

              <div className="w-full h-2.5 bg-slate-950/70 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    activeAccount.type === "RECOVERY" ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${activeProgressPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                <span>
                  {activeGoalTarget - activeNetPnl <= 0
                    ? activeAccount.type === "RECOVERY"
                      ? "Loss 100% Recovered!"
                      : "Profit Target Hit!"
                    : `${formatCurrency(Math.max(0, activeGoalTarget - activeNetPnl))} remaining`}
                </span>
                <Link href="/accounts" className="text-sky-400 hover:underline font-sans">
                  Manage Accounts →
                </Link>
              </div>
            </div>
          )}

          {/* Living Account Balance & Drawdown Risk Hero Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-lg relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left Column: Living Balance */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    {activeAccount ? `${activeAccount.name} Balance` : "Living Account Balance"}
                  </span>
                  <Link
                    href={activeAccount ? "/accounts" : "/settings"}
                    className="text-[10px] text-slate-500 hover:text-sky-400 flex items-center gap-1 transition-colors"
                    title="Configure starting balance & risk settings"
                  >
                    <Sliders className="w-3 h-3" /> Config
                  </Link>
                </div>

                <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white num-tabular">
                  {formatCurrency(livingBalance)}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                  <span>
                    Initial: <strong className="text-slate-200">{formatCurrency(startingBalance)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Net P&L:{" "}
                    <strong className={(stats?.net_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {formatCurrency(stats?.net_pnl || 0, true)}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Peak Equity: <strong className="text-sky-300">{formatCurrency(peakEquity)}</strong>
                  </span>
                </div>
              </div>

              {/* Right Column: Drawdown & Risk Telemetry */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <span>Max Drawdown</span>
                    {maxDd > 10 ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
                      maxDd > 10 ? "text-rose-400" : maxDd > 5 ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {maxDd.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    -{formatCurrency(stats?.drawdown?.max_drawdown_amount || 0)} from peak
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 min-w-[140px]">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Current Drawdown
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
                      currentDd > 5 ? "text-rose-400" : "text-slate-200"
                    }`}
                  >
                    {currentDd.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {currentDd === 0
                      ? "At Peak High"
                      : `-${formatCurrency(stats?.drawdown?.current_drawdown_amount || 0)}`}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 min-w-[140px]">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Profit Factor
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono mt-1 text-sky-400">
                    {stats?.profit_factor || 0}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {stats?.won_trades || 0}W / {stats?.lost_trades || 0}L
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Primary Stat Cards (including Total Fees Paid!) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Net Closed P&L"
              value={formatCurrency(stats?.net_pnl || 0, true)}
              subValue={`Gross: ${formatCurrency(stats?.gross_pnl ?? stats?.net_pnl ?? 0, true)}`}
              icon={<TrendingUp className="w-4 h-4" />}
              variant={(stats?.net_pnl || 0) >= 0 ? "profit" : "loss"}
            />

            <StatCard
              label="Win Rate"
              value={`${stats?.win_rate || 0}%`}
              subValue={`${stats?.won_trades || 0}W / ${stats?.lost_trades || 0}L • ${stats?.total_trades || 0} Positions`}
              icon={<Percent className="w-4 h-4" />}
              variant="brand"
            />

            <StatCard
              label="Total Fees Paid"
              value={formatCurrency(stats?.total_fees || 0)}
              subValue={`Trading: -${formatCurrency(stats?.total_trading_fees || 0)} • Funding: ${formatCurrency(stats?.total_funding_fees || 0, true)}`}
              icon={<Receipt className="w-4 h-4" />}
              variant="amber"
            />

            <StatCard
              label="Withdrawn / Spent"
              value={formatCurrency(stats?.total_withdrawn || 0)}
              subValue={`Spent: ${formatCurrency(stats?.total_spent || 0)}`}
              icon={<Wallet className="w-4 h-4" />}
              variant="neutral"
            />
          </div>

          {/* Equity Curve & Active Goals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Equity Curve</h3>
                  <p className="text-xs text-slate-400">Cumulative net P&L growth over time</p>
                </div>
                <Link
                  href="/analytics"
                  className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Analytics <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <EquityChart data={stats?.equity_curve || []} />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white tracking-tight">Active Goals</h3>
                <Link
                  href="/goals"
                  className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {goals.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl my-auto">
                  <p className="text-xs text-slate-400">No active goals set.</p>
                  <button
                    onClick={() => {
                      setEditGoal(null);
                      setIsGoalModalOpen(true);
                    }}
                    className="mt-2 text-xs font-bold text-sky-400 hover:underline"
                  >
                    + Set a Target
                  </button>
                </div>
              ) : (
                <div className="space-y-3 my-auto">
                  {goals.slice(0, 2).map((g) => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      onEdit={(item) => {
                        setEditGoal(item);
                        setIsGoalModalOpen(true);
                      }}
                      onDelete={handleDeleteGoal}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setEditGoal(null);
                  setIsGoalModalOpen(true);
                }}
                className="mt-3 w-full py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              >
                + Add Goal
              </button>
            </div>
          </div>

          {/* Exchanges Distribution & Signal Attribution Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Exchange Breakdown */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Exchange Platforms</h4>
                    <p className="text-[11px] text-slate-400">Net P&L by broker / exchange source</p>
                  </div>
                </div>

                <Link
                  href="/settings"
                  className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Manage Keys <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {stats?.exchange_distribution && stats.exchange_distribution.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {stats.exchange_distribution.map((ex) => {
                    const exPnl = ex.pnl ?? ex.total_pnl ?? 0;
                    return (
                      <div
                        key={ex.exchange}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="font-semibold text-slate-300 truncate uppercase tracking-wider text-[10px]">
                          {ex.exchange}
                        </div>
                        <div
                          className={`font-mono font-bold text-sm mt-0.5 ${
                            exPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatCurrency(exPnl, true)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {ex.count} pos • {ex.win_rate}% win
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No exchange data yet. Connect Binance or Bybit in Settings.
                </div>
              )}
            </div>

            {/* Signal Attribution Breakdown */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Signal Attribution</h4>
                    <p className="text-[11px] text-slate-400">Self vs followed trader performance</p>
                  </div>
                </div>

                <Link
                  href="/signals"
                  className="text-xs text-violet-300 hover:underline flex items-center gap-1 font-medium"
                >
                  Leaderboard <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {stats?.provider_distribution && stats.provider_distribution.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {stats.provider_distribution.slice(0, 3).map((p) => (
                    <div
                      key={p.name}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div className="font-semibold text-slate-300 truncate text-[10px]">
                        {p.is_self ? "👤 Self" : `📡 ${p.name}`}
                      </div>
                      <div
                        className={`font-mono font-bold text-sm mt-0.5 ${
                          p.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(p.total_pnl, true)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {p.total_trades} pos • {p.win_rate}% win
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No signal providers logged yet.
                </div>
              )}
            </div>
          </div>

          {/* Recent Positions Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight">Recent Closed Positions</h3>
              <Link
                href="/journal"
                className="text-xs font-medium text-sky-400 hover:underline flex items-center gap-1"
              >
                Full Positions Journal ({trades.length}) <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <RecentTradesTable
              trades={trades.slice(0, 8)}
              onSelectTrade={(t) => setSelectedTrade(t)}
              onOpenNewTrade={() => {
                setEditTrade(null);
                setIsTradeModalOpen(true);
              }}
            />
          </div>
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => {
          fetchData();
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
        onSuccess={() => fetchData()}
      />

      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => fetchData()}
        editGoal={editGoal}
      />
    </div>
  );
}
