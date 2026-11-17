"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { DashboardStats, Trade } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Trophy,
  PieChart,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, tradesRes] = await Promise.all([
        fetch("/api/stats").then((r) => r.json()),
        fetch("/api/trades").then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (tradesRes.success) setTrades(tradesRes.trades);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Strategy breakdown
  const strategyStats: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (const t of trades) {
    const strat = t.strategy || "Manual";
    if (!strategyStats[strat]) strategyStats[strat] = { pnl: 0, count: 0, wins: 0 };
    strategyStats[strat].pnl += t.pnl;
    strategyStats[strat].count += 1;
    if (t.pnl > 0) strategyStats[strat].wins += 1;
  }

  const strategyArray = Object.entries(strategyStats)
    .map(([name, data]) => ({
      name,
      pnl: Number(data.pnl.toFixed(2)),
      count: data.count,
      win_rate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={fetchData}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Trading Edge & Currency Analytics
                </h1>
                <p className="text-xs text-slate-400">
                  Detailed mathematical breakdown of traded currency pairs, strategy edges, and risk metrics
                </p>
              </div>
            </div>
          </div>

          {/* Core Risk & Expectancy Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Average Win
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1 num-tabular">
                {formatCurrency(stats?.average_win || 0, true)}
              </div>
              <span className="text-[11px] text-slate-500">Per profitable trade</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Average Loss
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-1 num-tabular">
                {formatCurrency(-(stats?.average_loss || 0))}
              </div>
              <span className="text-[11px] text-slate-500">Per losing trade</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Largest Win
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1 num-tabular">
                {formatCurrency(stats?.largest_win || 0, true)}
              </div>
              <span className="text-[11px] text-slate-500">Best single execution</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] shadow-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Largest Loss
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-1 num-tabular">
                {formatCurrency(-(stats?.largest_loss || 0))}
              </div>
              <span className="text-[11px] text-slate-500">Max single drawdown</span>
            </div>
          </div>

          {/* Currency / Pair Profitability Breakdown - CORE REQUIREMENT */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Which Currency / Pairs Made or Lost Money
                </h3>
                <p className="text-xs text-slate-400">
                  Analyze your edge per currency asset (Forex, Crypto, Gold, Indices)
                </p>
              </div>
            </div>

            {(!stats?.pair_distribution || stats.pair_distribution.length === 0) ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                No traded pairs logged yet.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Visual Bar Chart */}
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.pair_distribution}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                      <XAxis dataKey="symbol" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
                                <div className="text-xs font-bold text-white mb-1 font-mono">
                                  {p.symbol}
                                </div>
                                <div className="text-xs text-slate-300">
                                  Net PnL:{" "}
                                  <strong
                                    className={p.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}
                                  >
                                    {formatCurrency(p.pnl, true)}
                                  </strong>
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  Trades: {p.count} • Win Rate: {p.win_rate}%
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                        {stats.pair_distribution.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Table Breakdown */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Pair / Symbol</th>
                        <th className="px-4 py-2.5">Trades Count</th>
                        <th className="px-4 py-2.5">Win Rate</th>
                        <th className="px-4 py-2.5 text-right">Net Profit / Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {stats.pair_distribution.map((p) => (
                        <tr key={p.symbol} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-bold text-white">{p.symbol}</td>
                          <td className="px-4 py-3 text-slate-300">{p.count}</td>
                          <td className="px-4 py-3 text-slate-200">{p.win_rate}%</td>
                          <td
                            className={`px-4 py-3 text-right font-bold num-tabular ${
                              p.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {formatCurrency(p.pnl, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Strategy Edge Performance */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Strategy Performance & Confluence Edge
              </h3>
              <p className="text-xs text-slate-400">
                Find out which trading setup generates the highest win rate and profit
              </p>
            </div>

            {strategyArray.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                No strategy data yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {strategyArray.map((strat) => (
                  <div
                    key={strat.name}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-sm text-white">{strat.name}</span>
                        <span className="text-xs font-mono text-slate-400">
                          {strat.win_rate}% WR
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{strat.count} executions</span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Realized:</span>
                      <span
                        className={`text-sm font-bold font-mono num-tabular ${
                          strat.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(strat.pnl, true)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => fetchData()}
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
      />
    </div>
  );
}
