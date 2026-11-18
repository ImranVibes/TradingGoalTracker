"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { SharePnlCardModal } from "@/components/analytics/SharePnlCardModal";
import { WeeklyReviewButton } from "@/components/analytics/WeeklyReviewButton";
import { PairIcon } from "@/components/ui/PairIcon";
import { useAccounts } from "@/components/providers/AccountProvider";
import { DashboardStats, Trade } from "@/lib/types";
import {
  computeLongShortStats,
  computeSessionStats,
  computeDayOfWeekStats,
  computeMistakeStats,
} from "@/lib/tradingMetrics";
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
  Layers,
  TrendingUp,
  TrendingDown,
  Clock,
  CalendarDays,
  AlertOctagon,
  CheckCircle2,
  Share2,
  Sparkles,
  Award,
} from "lucide-react";

export default function AnalyticsPage() {
  const { activeAccountId, activeAccount } = useAccounts();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const accParam =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const [statsRes, tradesRes] = await Promise.all([
        fetch(`/api/stats${accParam}`).then((r) => r.json()),
        fetch(`/api/trades${accParam}`).then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (tradesRes.success) setTrades(tradesRes.trades);
    } catch (err) {
      console.error(err);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Advanced Analytics Calculations
  const longShort = useMemo(() => computeLongShortStats(trades), [trades]);
  const sessionStats = useMemo(() => computeSessionStats(trades), [trades]);
  const weekdayStats = useMemo(() => computeDayOfWeekStats(trades), [trades]);
  const mistakeStats = useMemo(() => computeMistakeStats(trades), [trades]);

  const activeSessions = sessionStats.filter((s) => s.trades > 0);
  const bestSession = useMemo(
    () =>
      activeSessions.length > 0
        ? [...activeSessions].sort((a, b) => b.netPnl - a.netPnl)[0]
        : null,
    [activeSessions]
  );
  const worstSession = useMemo(() => {
    const losers = activeSessions.filter((s) => s.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl);
    return losers[0] || null;
  }, [activeSessions]);

  const mistakesOnly = mistakeStats.filter((m) => m.kind === "mistake");
  const habitsOnly = mistakeStats.filter((m) => m.kind === "habit");
  const totalMistakeCost = mistakesOnly.reduce(
    (s, m) => s + (m.netPnl < 0 ? Math.abs(m.netPnl) : 0),
    0
  );
  const costliestMistake = mistakesOnly.find((m) => m.netPnl < 0) || null;

  // Discipline vs Win Rate insight (from trades that have discipline_score)
  const disciplineInsight = useMemo(() => {
    const scored = trades.filter(
      (t) => t.discipline_score !== null && t.discipline_score !== undefined
    );
    if (scored.length === 0) return null;
    const high = scored.filter((t) => Number(t.discipline_score) >= 80);
    const low = scored.filter((t) => Number(t.discipline_score) < 80);
    const calcWr = (arr: Trade[]) =>
      arr.length > 0
        ? Number(
            ((arr.filter((t) => t.status === "WON" || t.pnl > 0).length / arr.length) * 100).toFixed(
              1
            )
          )
        : 0;
    return {
      totalScored: scored.length,
      avgScore: Math.round(
        scored.reduce((s, t) => s + Number(t.discipline_score || 0), 0) / scored.length
      ),
      highCount: high.length,
      highWinRate: calcWr(high),
      highPnl: Number(high.reduce((s, t) => s + Number(t.pnl || 0), 0).toFixed(2)),
      lowCount: low.length,
      lowWinRate: calcWr(low),
      lowPnl: Number(low.reduce((s, t) => s + Number(t.pnl || 0), 0).toFixed(2)),
    };
  }, [trades]);

  // Strategy breakdown
  const strategyArray = useMemo(() => {
    const strategyStats: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const t of trades) {
      const strat = t.strategy || "Manual";
      if (!strategyStats[strat]) strategyStats[strat] = { pnl: 0, count: 0, wins: 0 };
      strategyStats[strat].pnl += t.pnl;
      strategyStats[strat].count += 1;
      if (t.pnl > 0) strategyStats[strat].wins += 1;
    }
    return Object.entries(strategyStats)
      .map(([name, data]) => ({
        name,
        pnl: Number(data.pnl.toFixed(2)),
        count: data.count,
        win_rate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const maxAbsWeekdayPnl = Math.max(1, ...weekdayStats.map((d) => Math.abs(d.netPnl)));

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
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Trading Edge & Performance Analytics
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    <Layers className="w-3 h-3" />
                    {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Long vs. Short edge, trading session favorability, weekday heatmap, mistake costs, and pair profitability.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <WeeklyReviewButton accountId={activeAccountId} />
              <button
                type="button"
                onClick={() => setIsShareCardOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all inline-flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share PnL Card (PNG)
              </button>
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

          {/* 1. LONG VS. SHORT BREAKDOWN */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Long vs. Short Edge Breakdown
                </h3>
                <p className="text-xs text-slate-400">
                  Compare profitability, win rate, profit factor, and expectancy across Long and Short trades
                </p>
              </div>

              {(longShort.long.trades > 0 || longShort.short.trades > 0) && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  Stronger Side:{" "}
                  {longShort.long.netPnl >= longShort.short.netPnl ? "LONG" : "SHORT"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[longShort.long, longShort.short].map((side) => {
                const isLong = side.direction === "LONG";
                return (
                  <div
                    key={side.direction}
                    className={`rounded-2xl border p-4 space-y-3 ${
                      isLong
                        ? "bg-emerald-500/[0.04] border-emerald-500/25"
                        : "bg-rose-500/[0.04] border-rose-500/25"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-2 rounded-xl ${
                            isLong
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-rose-500/15 text-rose-400"
                          }`}
                        >
                          {isLong ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-black text-white">
                            {isLong ? "LONG Positions" : "SHORT Positions"}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {side.trades} trades •{" "}
                            <span className="text-emerald-400">{side.wins}W</span> /{" "}
                            <span className="text-rose-400">{side.losses}L</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-xl font-black font-mono num-tabular ${
                            side.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatCurrency(side.netPnl, true)}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">Net P&L</div>
                      </div>
                    </div>

                    {/* Win Rate Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Win Rate</span>
                        <span className="text-white font-bold">{side.winRate}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isLong ? "bg-emerald-500" : "bg-sky-500"}`}
                          style={{ width: `${Math.min(100, side.winRate)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block font-sans">Profit Factor</span>
                        <strong className="text-white">
                          {side.profitFactor >= 99 ? "∞" : side.profitFactor}
                        </strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block font-sans">Avg Win</span>
                        <strong className="text-emerald-400">+{formatCurrency(side.avgWin)}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block font-sans">Avg Loss</span>
                        <strong className="text-rose-400">-{formatCurrency(side.avgLoss)}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block font-sans">Expectancy</span>
                        <strong className={side.expectancy >= 0 ? "text-emerald-300" : "text-rose-300"}>
                          {formatCurrency(side.expectancy, true)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. TRADING SESSION PERFORMANCE + DAY-OF-WEEK HEATMAP */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Session Favorability */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Trading Session Performance (UTC Auto-Detected)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Automatically classified from your synced Binance/exchange timestamps to reveal which sessions go in your favor
                  </p>
                </div>
              </div>

              {/* Best / Worst Session Callouts */}
              {activeSessions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {bestSession && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                          Best Session (In Your Favor)
                        </span>
                        <span className="font-bold text-white">{bestSession.label}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {bestSession.utcWindow} • {bestSession.winRate}% WR
                        </span>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        {formatCurrency(bestSession.netPnl, true)}
                      </span>
                    </div>
                  )}

                  {worstSession ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-rose-300 block">
                          Weakest Session (Caution)
                        </span>
                        <span className="font-bold text-white">{worstSession.label}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {worstSession.utcWindow} • {worstSession.winRate}% WR
                        </span>
                      </div>
                      <span className="font-mono font-black text-rose-400 text-sm">
                        {formatCurrency(worstSession.netPnl, true)}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-slate-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>All active trading sessions are currently net positive!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Session Chart */}
              {activeSessions.length > 0 ? (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sessionStats} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                      <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const s = payload[0].payload;
                            return (
                              <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl text-xs space-y-1">
                                <div className="font-bold text-white">{s.label}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{s.utcWindow}</div>
                                <div className="font-mono">
                                  Net P&L:{" "}
                                  <strong className={s.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                    {formatCurrency(s.netPnl, true)}
                                  </strong>
                                </div>
                                <div className="text-slate-400 font-mono">
                                  {s.trades} trades • {s.winRate}% WR ({s.wins}W/{s.losses}L)
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="netPnl" radius={[6, 6, 0, 0]}>
                        {sessionStats.map((entry, idx) => (
                          <Cell
                            key={`sess-${idx}`}
                            fill={entry.netPnl >= 0 ? "#10b981" : "#f43f5e"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                  No trades recorded in this account yet.
                </div>
              )}

              {/* Session Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Session</th>
                      <th className="px-3 py-2">Window</th>
                      <th className="px-3 py-2">Trades</th>
                      <th className="px-3 py-2">Win Rate</th>
                      <th className="px-3 py-2 text-right">Net P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {sessionStats.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2.5 font-sans font-semibold text-white">{s.label}</td>
                        <td className="px-3 py-2.5 text-slate-400 text-[11px]">{s.shortWindow}</td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {s.trades}{" "}
                          {s.trades > 0 && (
                            <span className="text-[10px] text-slate-500">
                              ({s.wins}W/{s.losses}L)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">{s.trades > 0 ? `${s.winRate}%` : "—"}</td>
                        <td
                          className={`px-3 py-2.5 text-right font-bold ${
                            s.netPnl > 0
                              ? "text-emerald-400"
                              : s.netPnl < 0
                              ? "text-rose-400"
                              : "text-slate-500"
                          }`}
                        >
                          {s.trades > 0 ? formatCurrency(s.netPnl, true) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Day-of-Week Heatmap */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-sky-400" />
                  Day-of-Week Heatmap (Mon – Sun)
                </h3>
                <p className="text-xs text-slate-400">
                  Spot which days of the week produce consistent profits vs. avoidable drawdowns
                </p>
              </div>

              <div className="space-y-2">
                {weekdayStats.map((d) => {
                  const intensity =
                    d.trades === 0 ? 0 : Math.max(0.18, Math.min(1, Math.abs(d.netPnl) / maxAbsWeekdayPnl));
                  const barWidth =
                    d.trades === 0 ? 0 : Math.max(8, Math.round((Math.abs(d.netPnl) / maxAbsWeekdayPnl) * 100));

                  return (
                    <div
                      key={d.day}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-900/70 space-y-1.5"
                      style={
                        d.trades > 0
                          ? {
                              borderColor:
                                d.netPnl >= 0
                                  ? `rgba(16, 185, 129, ${(0.2 + intensity * 0.4).toFixed(2)})`
                                  : `rgba(244, 63, 94, ${(0.2 + intensity * 0.4).toFixed(2)})`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white w-20">{d.day}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {d.trades} {d.trades === 1 ? "trade" : "trades"}
                            {d.trades > 0 ? ` • ${d.winRate}% WR` : ""}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-bold ${
                            d.netPnl > 0
                              ? "text-emerald-400"
                              : d.netPnl < 0
                              ? "text-rose-400"
                              : "text-slate-500"
                          }`}
                        >
                          {d.trades > 0 ? formatCurrency(d.netPnl, true) : "—"}
                        </span>
                      </div>

                      <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            d.netPnl >= 0 ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. COST OF MISTAKES & HABITS REPORT + DISCIPLINE SCORE IMPACT */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  Cost of Mistakes & Trading Habits Report
                </h3>
                <p className="text-xs text-slate-400">
                  Tag trades with 1 click in Positions Journal (FOMO, Revenge Trade, Moved SL, A+ Setup) to measure the exact dollar cost of each habit
                </p>
              </div>

              <Link
                href="/journal"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 transition-colors"
              >
                Tag Trades in Journal →
              </Link>
            </div>

            {costliestMistake && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="text-rose-200">
                  <strong className="text-rose-300 uppercase text-[11px] tracking-wider block">
                    #1 Most Expensive Habit: {costliestMistake.tag}
                  </strong>
                  Eliminating <strong className="text-white">{costliestMistake.tag}</strong> alone
                  would have saved you{" "}
                  <strong className="text-emerald-300 font-mono">
                    {formatCurrency(Math.abs(costliestMistake.netPnl))}
                  </strong>{" "}
                  ({costliestMistake.count} trades, {costliestMistake.winRate}% win rate).
                </div>
                <div className="font-mono font-black text-rose-400 text-lg">
                  Total Mistake Cost: -{formatCurrency(totalMistakeCost)}
                </div>
              </div>
            )}

            {mistakeStats.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-slate-300">
                  No mistake or habit tags logged on trades yet
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Go to{" "}
                  <Link href="/journal" className="text-sky-400 hover:underline">
                    Positions Journal
                  </Link>{" "}
                  and click the 1-click tags (like <span className="text-rose-300">FOMO</span>,{" "}
                  <span className="text-rose-300">Moved SL</span>, or{" "}
                  <span className="text-emerald-300">A+ Setup</span>) on any trade to see exactly how much each habit costs or earns you.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mistakes Column */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Mistakes & Leaks ({mistakesOnly.length})
                  </h4>
                  {mistakesOnly.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-500">
                      No mistake tags recorded yet.
                    </div>
                  ) : (
                    mistakesOnly.map((m) => (
                      <div
                        key={m.tag}
                        className="p-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/25 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">{m.tag}</span>
                          <div className="text-[11px] font-mono text-slate-400">
                            {m.count} trades • {m.winRate}% WR ({m.wins}W/{m.losses}L)
                          </div>
                        </div>
                        <span
                          className={`font-mono font-black text-sm ${
                            m.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatCurrency(m.netPnl, true)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Good Habits Column */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Winning Habits & Discipline ({habitsOnly.length})
                  </h4>
                  {habitsOnly.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-500">
                      Tag your best executions with A+ Setup or Followed Plan.
                    </div>
                  ) : (
                    habitsOnly.map((h) => (
                      <div
                        key={h.tag}
                        className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">{h.tag}</span>
                          <div className="text-[11px] font-mono text-slate-400">
                            {h.count} trades • {h.winRate}% WR ({h.wins}W/{h.losses}L)
                          </div>
                        </div>
                        <span
                          className={`font-mono font-black text-sm ${
                            h.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatCurrency(h.netPnl, true)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Discipline Score Correlation */}
            {disciplineInsight && (
              <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-sky-400" />
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block">
                      Avg Trade Discipline Score
                    </span>
                    <strong className="text-lg font-mono text-white">
                      {disciplineInsight.avgScore}% ({disciplineInsight.totalScored} trades)
                    </strong>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <span className="text-[10px] uppercase text-emerald-300 font-bold block">
                    High Discipline (≥ 80% Checklist)
                  </span>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {disciplineInsight.highWinRate}% WR •{" "}
                    <span className={disciplineInsight.highPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {formatCurrency(disciplineInsight.highPnl, true)}
                    </span>{" "}
                    ({disciplineInsight.highCount} tr)
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <span className="text-[10px] uppercase text-amber-300 font-bold block">
                    Low Discipline (&lt; 80% Checklist)
                  </span>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {disciplineInsight.lowWinRate}% WR •{" "}
                    <span className={disciplineInsight.lowPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {formatCurrency(disciplineInsight.lowPnl, true)}
                    </span>{" "}
                    ({disciplineInsight.lowCount} tr)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. CURRENCY / PAIR PROFITABILITY BREAKDOWN */}
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

            {!stats?.pair_distribution || stats.pair_distribution.length === 0 ? (
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
                          <td className="px-4 py-3 font-bold text-white">
                            <div className="flex items-center gap-2.5">
                              <PairIcon symbol={p.symbol} size="sm" showQuoteBadge />
                              <span>{p.symbol}</span>
                            </div>
                          </td>
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

          {/* 5. STRATEGY EDGE PERFORMANCE */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
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

      <SharePnlCardModal
        isOpen={isShareCardOpen}
        onClose={() => setIsShareCardOpen(false)}
        trades={trades}
        accountName={activeAccount ? activeAccount.name : "All Accounts (Combined)"}
        startingBalance={activeAccount?.starting_balance || stats?.starting_balance || 0}
      />

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
