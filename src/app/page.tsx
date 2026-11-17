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
import { Trade, Cashflow, Goal, DashboardStats } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  Percent,
  Wallet,
  ShoppingBag,
  Target,
  PlusCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
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
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
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
      console.error("Error deleting trade:", err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      await fetchData();
    } catch (err) {
      console.error("Error deleting goal:", err);
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
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Trading & Life Goal Command Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Real-time tracking of currency pairs, profit/loss execution reflections, withdrawals, and financial targets.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditTrade(null);
                  setIsTradeModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                Log Trade
              </button>
            </div>
          </div>

          {/* 4 Core Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Net Trading PnL"
              value={formatCurrency(stats?.net_pnl || 0, true)}
              subValue={`+${formatCurrency(stats?.total_profit || 0)} / -${formatCurrency(stats?.total_loss || 0)}`}
              icon={<TrendingUp className="w-5 h-5" />}
              variant={(stats?.net_pnl || 0) >= 0 ? "profit" : "loss"}
            />

            <StatCard
              label="Win Rate & Profit Factor"
              value={`${stats?.win_rate || 0}%`}
              subValue={`${stats?.won_trades || 0}W / ${stats?.lost_trades || 0}L • PF: ${stats?.profit_factor || 0}`}
              icon={<Percent className="w-5 h-5" />}
              variant="brand"
            />

            <StatCard
              label="Total Withdrawn (Bank/Crypto)"
              value={formatCurrency(stats?.total_withdrawn || 0)}
              subValue={`Net Extracted: ${formatCurrency(stats?.net_cash_extracted || 0)}`}
              icon={<Wallet className="w-5 h-5" />}
              variant="amber"
            />

            <StatCard
              label="Total Spent & Expenses"
              value={formatCurrency(stats?.total_spent || 0)}
              subValue="Life, gear, tools & bills"
              icon={<ShoppingBag className="w-5 h-5" />}
              variant="neutral"
            />
          </div>

          {/* Equity Curve & Goal Highlights Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Equity Curve Chart (2 cols) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Cumulative Equity Curve
                  </h3>
                  <p className="text-xs text-slate-400">
                    Track your equity growth and trade performance trajectory
                  </p>
                </div>
                <Link
                  href="/analytics"
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                >
                  Full Analytics <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <EquityChart data={stats?.equity_curve || []} />
            </div>

            {/* Target Goals Card (1 col) */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-sky-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">Active Goals</h3>
                </div>
                <Link
                  href="/goals"
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                >
                  Manage <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {goals.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl my-auto">
                  <p className="text-xs text-slate-400">No active goals set yet.</p>
                  <button
                    onClick={() => {
                      setEditGoal(null);
                      setIsGoalModalOpen(true);
                    }}
                    className="mt-3 text-xs font-bold text-sky-400 hover:underline"
                  >
                    + Set Your First Milestone
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
                className="mt-4 w-full py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              >
                + Add Another Goal
              </button>
            </div>
          </div>

          {/* Recent Trades Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Recent Journal Executions
                </h3>
                <p className="text-xs text-slate-400">
                  Click on any trade row to read complete reasoning, setup checklist, and post-trade autopsy
                </p>
              </div>
              <Link
                href="/journal"
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                View Full Journal ({trades.length}) <ArrowRight className="w-3.5 h-3.5" />
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

      {/* Global Modals */}
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
