"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { TradeDetailModal } from "@/components/journal/TradeDetailModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { Modal } from "@/components/ui/Modal";
import { PairIcon } from "@/components/ui/PairIcon";
import { useAccounts } from "@/components/providers/AccountProvider";
import { SignalProviderStats, SignalProvider, Trade } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Radio,
  User,
  TrendingUp,
  TrendingDown,
  Trophy,
  Award,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  BarChart2,
  Percent,
  Layers,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
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

export default function SignalsPage() {
  const { activeAccountId, activeAccount } = useAccounts();
  const [stats, setStats] = useState<SignalProviderStats[]>([]);
  const [providers, setProviders] = useState<SignalProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<SignalProviderStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isAddProviderModalOpen, setIsAddProviderModalOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // New provider form
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderNotes, setNewProviderNotes] = useState("");
  const [newProviderColor, setNewProviderColor] = useState("violet");
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSubmitting, setProviderSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const accParam =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const res = await fetch(`/api/providers${accParam}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats || []);
        setProviders(data.providers || []);
        if (data.stats && data.stats.length > 0) {
          // If already selected, update it; otherwise pick top provider or Self
          setSelectedProvider((prev) => {
            if (prev) {
              const updated = data.stats.find((s: SignalProviderStats) => s.name === prev.name);
              return updated || data.stats[0];
            }
            return data.stats[0];
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderName.trim()) return;
    setProviderError(null);
    setProviderSubmitting(true);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProviderName.trim(),
          notes: newProviderNotes.trim(),
          color: newProviderColor,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create provider");
      setNewProviderName("");
      setNewProviderNotes("");
      setIsAddProviderModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setProviderError(err.message);
    } finally {
      setProviderSubmitting(false);
    }
  };

  const handleDeleteProvider = async (name: string) => {
    if (name.toLowerCase() === "self") return;
    if (!confirm(`Are you sure you want to remove "${name}" from followed providers? Existing trades will be kept.`)) return;
    try {
      await fetch(`/api/providers?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Separate Self from Followed Signal Providers
  const selfStats = stats.find((s) => s.is_self);
  const signalProviders = stats.filter((s) => !s.is_self);

  // Aggregated signal providers performance
  const totalSignalTrades = signalProviders.reduce((acc, s) => acc + s.total_trades, 0);
  const totalSignalPnl = signalProviders.reduce((acc, s) => acc + s.total_pnl, 0);
  const totalSignalWins = signalProviders.reduce((acc, s) => acc + s.wins, 0);
  const totalSignalClosed = signalProviders.reduce((acc, s) => acc + s.wins + s.losses + s.breakeven, 0);
  const signalWinRate = totalSignalClosed > 0 ? Number(((totalSignalWins / totalSignalClosed) * 100).toFixed(1)) : 0;

  // Best performer among followed traders
  const sortedSignalsByPnl = [...signalProviders].sort((a, b) => b.total_pnl - a.total_pnl);
  const topPerformer = sortedSignalsByPnl.length > 0 && sortedSignalsByPnl[0].total_pnl > 0 ? sortedSignalsByPnl[0] : null;

  // Bar chart data
  const chartData = stats.map((s) => ({
    name: s.name,
    pnl: s.total_pnl,
    win_rate: s.win_rate,
    trades: s.total_trades,
  }));

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
              <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Signal Providers & Trader Comparison
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    <Layers className="w-3 h-3" />
                    {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track, compare, and rank performance between your own trades and followed signal providers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => setIsAddProviderModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-violet-400" />
                Add Trader
              </button>
              <button
                onClick={() => setIsTradeModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-sm transition-all flex items-center gap-1.5"
              >
                + Log Trade
              </button>
            </div>
          </div>

          {/* Top Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* My Own Trades (Self) */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> My Own Trades
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {selfStats?.total_trades || 0} Trades
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black font-mono tracking-tight num-tabular ${
                    (selfStats?.total_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatCurrency(selfStats?.total_pnl || 0, true)}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Win Rate: <strong className="text-white font-mono">{selfStats?.win_rate || 0}%</strong></span>
                <span>PF: <strong className="text-white font-mono">{selfStats?.profit_factor || 0}</strong></span>
                <span>W/L: <strong className="text-emerald-400 font-mono">{selfStats?.wins || 0}</strong>/<strong className="text-rose-400 font-mono">{selfStats?.losses || 0}</strong></span>
              </div>
            </div>

            {/* Followed Signal Providers Combined */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> Copied Signals Total
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {totalSignalTrades} Trades
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black font-mono tracking-tight num-tabular ${
                    totalSignalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatCurrency(totalSignalPnl, true)}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Win Rate: <strong className="text-white font-mono">{signalWinRate}%</strong></span>
                <span>Followed: <strong className="text-violet-300 font-mono">{signalProviders.length} Traders</strong></span>
                <span>W/L: <strong className="text-emerald-400 font-mono">{totalSignalWins}</strong>/<strong className="text-rose-400 font-mono">{totalSignalTrades - totalSignalWins}</strong></span>
              </div>
            </div>

            {/* Top Performing Trader */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" /> Best Signal Provider
                </span>
                {topPerformer && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold font-mono">
                    #1 Ranked
                  </span>
                )}
              </div>
              <div className="mt-2">
                {topPerformer ? (
                  <>
                    <div className="text-lg font-bold text-white truncate">{topPerformer.name}</div>
                    <div className="text-xl font-black font-mono text-emerald-400 num-tabular">
                      +{formatCurrency(topPerformer.total_pnl)}
                    </div>
                  </>
                ) : (
                  <div className="py-2">
                    <p className="text-sm font-semibold text-slate-400">No profitable signals yet</p>
                    <p className="text-[11px] text-slate-500">Log trades from followed traders</p>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Win Rate: <strong className="text-white font-mono">{topPerformer ? `${topPerformer.win_rate}%` : "-"}</strong></span>
                <span>Expectancy: <strong className="text-emerald-400 font-mono">{topPerformer ? `+${formatCurrency(topPerformer.expectancy)}/tr` : "-"}</strong></span>
              </div>
            </div>

            {/* Decision Edge */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Performance Verdict
                </span>
              </div>
              <div className="mt-2">
                {totalSignalTrades > 0 || (selfStats && selfStats.total_trades > 0) ? (
                  <div>
                    <div className="text-sm font-bold text-white">
                      {(selfStats?.total_pnl || 0) >= totalSignalPnl
                        ? "Your Independent Trades Lead"
                        : `${topPerformer?.name || "Copied Signals"} Outperforming`}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {(selfStats?.total_pnl || 0) >= totalSignalPnl
                        ? `You are making ${formatCurrency(
                            (selfStats?.total_pnl || 0) - totalSignalPnl
                          )} more on your own setups than followed signals.`
                        : `Signals are contributing +${formatCurrency(
                            totalSignalPnl - (selfStats?.total_pnl || 0)
                          )} more than self trades.`}
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    <p className="text-sm font-semibold text-slate-400">Awaiting trades</p>
                    <p className="text-[11px] text-slate-500">Log trades to generate comparison</p>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
                Real-time attribution powered by signal ledger
              </div>
            </div>
          </div>

          {/* Side-by-Side PnL Comparison Chart */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-sky-400" />
                    Net Profit / Loss Comparison by Source
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Compare net return ($) generated by your personal trades vs each followed signal provider
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#334155" }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#334155" }}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl text-xs space-y-1">
                              <p className="font-bold text-white">{data.name}</p>
                              <p className="font-mono text-slate-300">
                                Net PnL:{" "}
                                <span className={data.pnl >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                  {formatCurrency(data.pnl, true)}
                                </span>
                              </p>
                              <p className="text-slate-400 font-mono">Win Rate: {data.win_rate}%</p>
                              <p className="text-slate-400 font-mono">Trades: {data.trades}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.name.toLowerCase() === "self"
                              ? entry.pnl >= 0
                                ? "#38bdf8"
                                : "#f43f5e"
                              : entry.pnl >= 0
                              ? "#10b981"
                              : "#e11d48"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Full Side-by-Side Comparison Table */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Whose Signals Are Better? Detailed Trader Leaderboard
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete mathematical breakdown of win rate, profit factor, average win/loss, and trade expectancy
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Trader / Source</th>
                    <th className="px-4 py-3">Net Return</th>
                    <th className="px-4 py-3">Win Rate</th>
                    <th className="px-4 py-3">Record (W / L / BE)</th>
                    <th className="px-4 py-3">Profit Factor</th>
                    <th className="px-4 py-3">Expectancy</th>
                    <th className="px-4 py-3">Avg Win / Loss</th>
                    <th className="px-4 py-3">Top Pair</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats.map((s, idx) => {
                    const isSelected = selectedProvider?.name === s.name;
                    const isProfit = s.total_pnl > 0;
                    const isLoss = s.total_pnl < 0;
                    const topPair = s.top_pairs && s.top_pairs.length > 0 ? s.top_pairs[0] : null;

                    return (
                      <tr
                        key={s.name}
                        onClick={() => setSelectedProvider(s)}
                        className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                          isSelected ? "bg-slate-800/30" : ""
                        }`}
                      >
                        {/* Trader Name & Badge */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                s.is_self
                                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                                  : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              }`}
                            >
                              {s.is_self ? <User className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{s.name}</span>
                                {s.is_self && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                                    Self
                                  </span>
                                )}
                                {!s.is_self && idx === 1 && s.total_pnl > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                                    ★ Top Signal
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 truncate block max-w-xs">
                                {s.notes || (s.is_self ? "My own setups" : "Signal provider")}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Net Return */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-sm">
                          <span
                            className={`px-2 py-0.5 rounded-lg ${
                              isProfit
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : isLoss
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "text-slate-300"
                            }`}
                          >
                            {formatCurrency(s.total_pnl, true)}
                          </span>
                        </td>

                        {/* Win Rate */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-200">{s.win_rate}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, s.win_rate)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Record */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                          <span className="text-emerald-400 font-bold">{s.wins}W</span>
                          {" / "}
                          <span className="text-rose-400 font-bold">{s.losses}L</span>
                          {" / "}
                          <span className="text-slate-400">{s.breakeven}BE</span>
                          <span className="text-slate-500 text-[11px] ml-1.5">
                            ({s.total_trades} total)
                          </span>
                        </td>

                        {/* Profit Factor */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                          <span className={s.profit_factor >= 1.5 ? "text-emerald-400 font-bold" : "text-slate-300"}>
                            {s.profit_factor}
                          </span>
                        </td>

                        {/* Expectancy */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                          <span className={s.expectancy > 0 ? "text-emerald-400" : s.expectancy < 0 ? "text-rose-400" : "text-slate-400"}>
                            {s.expectancy > 0 ? `+${formatCurrency(s.expectancy)}` : formatCurrency(s.expectancy)}/tr
                          </span>
                        </td>

                        {/* Avg Win / Loss */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px]">
                          <span className="text-emerald-400">+${s.average_win}</span>
                          {" / "}
                          <span className="text-rose-400">-${s.average_loss}</span>
                        </td>

                        {/* Top Pair */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {topPair ? (
                            <div className="flex items-center gap-2 font-mono text-slate-300">
                              <PairIcon symbol={topPair.symbol} size="xs" />
                              <span>
                                {topPair.symbol} <span className="text-slate-500">({topPair.win_rate}%)</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/journal`}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                              Journal
                            </Link>
                            {!s.is_self && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProvider(s.name);
                                }}
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                title="Remove Trader"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drill-in Detail Section for Selected Provider */}
          {selectedProvider && (
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      selectedProvider.is_self
                        ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                        : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    }`}
                  >
                    {selectedProvider.is_self ? <User className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {selectedProvider.name} Deep Dive Analysis
                      {selectedProvider.is_self ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono">
                          Personal Setups
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono">
                          Copied Signals
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedProvider.notes || "Performance breakdown for this signal provider"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsTradeModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    + Log Trade for {selectedProvider.name}
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Net Profit/Loss</span>
                  <span
                    className={`text-lg font-black font-mono mt-0.5 block ${
                      selectedProvider.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatCurrency(selectedProvider.total_pnl, true)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Win Rate</span>
                  <span className="text-lg font-black font-mono text-white mt-0.5 block">
                    {selectedProvider.win_rate}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Profit Factor</span>
                  <span className="text-lg font-black font-mono text-sky-300 mt-0.5 block">
                    {selectedProvider.profit_factor}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Expectancy</span>
                  <span className="text-lg font-black font-mono text-slate-200 mt-0.5 block">
                    {formatCurrency(selectedProvider.expectancy, true)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Best Win</span>
                  <span className="text-lg font-black font-mono text-emerald-400 mt-0.5 block">
                    +{formatCurrency(selectedProvider.largest_win)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Worst Loss</span>
                  <span className="text-lg font-black font-mono text-rose-400 mt-0.5 block">
                    -{formatCurrency(selectedProvider.largest_loss)}
                  </span>
                </div>
              </div>

              {/* Pair Distribution & Recent Trades */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                {/* Traded Currencies Breakdown */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
                    Currency Pair Distribution
                  </h4>
                  {selectedProvider.top_pairs && selectedProvider.top_pairs.length > 0 ? (
                    <div className="space-y-2">
                      {selectedProvider.top_pairs.map((p) => (
                        <div key={p.symbol} className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                          <div className="flex items-center gap-2">
                            <PairIcon symbol={p.symbol} size="xs" showQuoteBadge />
                            <span className="font-bold text-white">{p.symbol}</span>
                          </div>
                          <span className="text-slate-400">{p.count} trades</span>
                          <span className="text-slate-300">{p.win_rate}% win</span>
                          <span className={`font-bold ${p.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {formatCurrency(p.pnl, true)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No currency breakdown available yet.</p>
                  )}
                </div>

                {/* Recent Trades by this Trader */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Recent Trades from {selectedProvider.name}
                    </h4>
                    <Link href={`/journal`} className="text-[11px] text-sky-400 hover:underline">
                      View all in journal →
                    </Link>
                  </div>
                  {selectedProvider.recent_trades && selectedProvider.recent_trades.length > 0 ? (
                    <div className="space-y-2">
                      {selectedProvider.recent_trades.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTrade(t)}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <PairIcon symbol={t.symbol} size="xs" />
                            <span className="font-bold font-mono text-white">{t.symbol}</span>
                            <span className={`text-[10px] font-bold ${t.direction === "LONG" ? "text-emerald-400" : "text-rose-400"}`}>
                              {t.direction}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">{formatDate(t.trade_date)}</span>
                          </div>
                          <span className={`font-mono font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {formatCurrency(t.pnl, true)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No trades recorded yet for this trader.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Provider Modal */}
      <Modal
        isOpen={isAddProviderModalOpen}
        onClose={() => setIsAddProviderModalOpen(false)}
        title="Add Followed Signal Provider / Trader"
        maxWidth="md"
      >
        <form onSubmit={handleAddProvider} className="space-y-4">
          {providerError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {providerError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Trader / Provider Name *</label>
            <input
              type="text"
              required
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              placeholder="Enter trader or signal channel name"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Channel / Strategy Description</label>
            <textarea
              rows={2}
              value={newProviderNotes}
              onChange={(e) => setNewProviderNotes(e.target.value)}
              placeholder="e.g. Telegram VIP swing signals, Gold & Crypto focus"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Badge Color Theme</label>
            <div className="flex items-center gap-2">
              {[
                { name: "violet", class: "bg-violet-500" },
                { name: "sky", class: "bg-sky-500" },
                { name: "emerald", class: "bg-emerald-500" },
                { name: "amber", class: "bg-amber-500" },
                { name: "rose", class: "bg-rose-500" },
                { name: "fuchsia", class: "bg-fuchsia-500" },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setNewProviderColor(c.name)}
                  className={`w-6 h-6 rounded-full ${c.class} transition-transform ${
                    newProviderColor === c.name ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddProviderModalOpen(false)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={providerSubmitting || !newProviderName.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
            >
              {providerSubmitting ? "Adding..." : "Add Provider"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Global Modals */}
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

      <TradeDetailModal
        trade={selectedTrade}
        isOpen={Boolean(selectedTrade)}
        onClose={() => setSelectedTrade(null)}
        onEdit={(trade) => {
          setSelectedTrade(null);
          setIsTradeModalOpen(true);
        }}
        onDelete={async (tradeId) => {
          await fetch(`/api/trades/${tradeId}`, { method: "DELETE" });
          setSelectedTrade(null);
          await fetchData();
        }}
      />
    </div>
  );
}
