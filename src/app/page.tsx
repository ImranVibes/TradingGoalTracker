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
import { Trade, Goal, DashboardStats } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  Percent,
  Wallet,
  ShoppingBag,
  PlusCircle,
  ArrowRight,
  Calculator,
  Radio,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, tradesRes, goalsRes] = await Promise.all([
        fetch("/api/stats").then((r) => r.json()),
        fetch("/api/trades").then((r) => r.json()),
        fetch("/api/goals").then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (tradesRes.success) setTrades(tradesRes.trades);
      if (goalsRes.success) setGoals(goalsRes.goals);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteTrade = async (tradeId: string) => {
    try {
      await fetch(`/api/trades/${tradeId}`, { method: "DELETE" });
      await fetchData();
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
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Trading Dashboard
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Overview of your P&L, win rate, goals, and recent executions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/calculator"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5 text-sky-400" />
                Risk Calculator
              </Link>

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

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Net P&L"
              value={formatCurrency(stats?.net_pnl || 0, true)}
              subValue={`+${formatCurrency(stats?.total_profit || 0)} / -${formatCurrency(stats?.total_loss || 0)}`}
              icon={<TrendingUp className="w-4 h-4" />}
              variant={(stats?.net_pnl || 0) >= 0 ? "profit" : "loss"}
            />

            <StatCard
              label="Win Rate"
              value={`${stats?.win_rate || 0}%`}
              subValue={`${stats?.won_trades || 0}W / ${stats?.lost_trades || 0}L • PF: ${stats?.profit_factor || 0}`}
              icon={<Percent className="w-4 h-4" />}
              variant="brand"
            />

            <StatCard
              label="Total Withdrawn"
              value={formatCurrency(stats?.total_withdrawn || 0)}
              subValue={`Net Extracted: ${formatCurrency(stats?.net_cash_extracted || 0)}`}
              icon={<Wallet className="w-4 h-4" />}
              variant="amber"
            />

            <StatCard
              label="Total Spent"
              value={formatCurrency(stats?.total_spent || 0)}
              subValue="Living & expenses"
              icon={<ShoppingBag className="w-4 h-4" />}
              variant="neutral"
            />
          </div>

          {/* Equity Curve & Active Goals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Equity Curve</h3>
                  <p className="text-xs text-slate-400">Cumulative net P&L over time</p>
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

          {/* Signal Providers Attribution Banner */}
          {stats?.provider_distribution && stats.provider_distribution.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Signal Attribution Breakdown
                  </h4>
                  <p className="text-xs text-slate-400">
                    Comparing profits between your own trading setups and followed traders
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {stats.provider_distribution.slice(0, 4).map((p) => {
                  const isProfit = p.total_pnl > 0;
                  const isLoss = p.total_pnl < 0;
                  return (
                    <div
                      key={p.name}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs"
                    >
                      <span className="font-semibold text-slate-300 flex items-center gap-1">
                        {p.is_self ? "👤 Self" : `📡 ${p.name}`}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          isProfit ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-slate-400"
                        }`}
                      >
                        {formatCurrency(p.total_pnl, true)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({p.win_rate}%)
                      </span>
                    </div>
                  );
                })}

                <Link
                  href="/signals"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition-colors flex items-center gap-1"
                >
                  Full Comparison <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Recent Trades Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight">Recent Trades</h3>
              <Link
                href="/journal"
                className="text-xs font-medium text-sky-400 hover:underline flex items-center gap-1"
              >
                Full Journal ({trades.length}) <ArrowRight className="w-3.5 h-3.5" />
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
        onSuccess={() => fetchData()}
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
