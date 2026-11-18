"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PairIcon } from "../ui/PairIcon";
import { LiveOpenPosition } from "@/lib/exchanges";
import { formatCurrency } from "@/lib/utils";
import {
  Activity,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bot,
} from "lucide-react";

interface LiveOpenPositionsPanelProps {
  accountId: string;
}

interface PositionsPayload {
  connectedSources: number;
  positions: LiveOpenPosition[];
  totalUnrealizedPnl: number;
  totalNotionalUsd: number;
  totalAccountEquity: number;
  totalAvailableBalance: number;
  todayRealizedPnl: number;
  totalDailyPnl: number;
  dailyLossLimitUsd: number;
  dailyLossPctUsed: number;
  dailyLossBreached: boolean;
  fetchedAt: string;
}

export const LiveOpenPositionsPanel: React.FC<LiveOpenPositionsPanelProps> = ({ accountId }) => {
  const [data, setData] = useState<PositionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLive = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const qs =
          accountId && accountId !== "ALL"
            ? `?account_id=${encodeURIComponent(accountId)}`
            : "";
        const res = await fetch(`/api/exchanges/positions${qs}`);
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (err) {
        console.error("[LiveOpenPositions] Error:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accountId]
  );

  useEffect(() => {
    setLoading(true);
    fetchLive(true);
    const interval = setInterval(() => fetchLive(true), 15000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 animate-pulse h-24" />
    );
  }

  if (!data) return null;

  const isDailyLoss = data.totalDailyPnl < 0;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 space-y-4 shadow-xl transition-colors ${
        data.dailyLossBreached
          ? "border-rose-500/70 bg-gradient-to-br from-rose-950/40 via-[#0f172a] to-[#0f172a]"
          : "border-slate-800 bg-[#0f172a]"
      }`}
    >
      {/* Daily Loss Limit Breached Alert */}
      {data.dailyLossBreached && (
        <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-rose-200 font-bold">
            <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 animate-pulse" />
            <span>
              DAILY LOSS LIMIT BREACHED ({formatCurrency(data.totalDailyPnl, true)} vs -$
              {data.dailyLossLimitUsd} limit) — STOP OPENING NEW TRADES TODAY!
            </span>
          </div>
          <Link
            href="/settings"
            className="text-[11px] text-rose-300 underline whitespace-nowrap"
          >
            Risk Guard Settings
          </Link>
        </div>
      )}

      {/* Header + Active Daily Risk Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl border ${
              data.positions.length > 0
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-slate-800/80 text-slate-400 border-slate-700"
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Live Open Positions &amp; Active Risk Monitor
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900 text-sky-300 border border-slate-700">
                {data.positions.length} Running
              </span>
              {data.positions.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                    data.totalUnrealizedPnl >= 0
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  }`}
                >
                  Live uPnL: {formatCurrency(data.totalUnrealizedPnl, true)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Auto-syncs every 15s from Binance Futures
              {data.totalAccountEquity > 0
                ? ` • Live Equity: ${formatCurrency(data.totalAccountEquity)} (Avail: ${formatCurrency(
                    data.totalAvailableBalance
                  )})`
                : ""}
            </p>
          </div>
        </div>

        {/* Right Controls: Daily Risk Budget + Ask Copilot + Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          {data.dailyLossLimitUsd > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] flex items-center gap-2.5">
              {data.dailyLossBreached ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-400">Today P&amp;L:</span>
                  <strong className={isDailyLoss ? "text-rose-400" : "text-emerald-400"}>
                    {formatCurrency(data.totalDailyPnl, true)}
                  </strong>
                  <span className="text-slate-500">/ -${data.dailyLossLimitUsd}</span>
                </div>
                <div className="w-32 h-1.5 rounded-full bg-slate-950 overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.dailyLossPctUsed >= 85
                        ? "bg-rose-500"
                        : data.dailyLossPctUsed >= 50
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, data.dailyLossPctUsed)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <Link
            href="/copilot"
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 flex items-center gap-1.5 transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            AI Copilot
          </Link>

          <button
            type="button"
            onClick={() => fetchLive(false)}
            disabled={refreshing}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh live open positions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-sky-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Open Positions Table */}
      {data.positions.length === 0 ? (
        <div className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            {data.connectedSources > 0
              ? "Currently flat — 0 open Binance Futures positions running."
              : "Connect your Binance API key in Settings to monitor live open positions here."}
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <Link href="/sentiment" className="text-amber-300 hover:underline font-medium">
              Scan Sentiment →
            </Link>
            <Link href="/checklist" className="text-sky-400 hover:underline font-medium">
              Pre-Trade Checklist →
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-3.5 py-2.5">Pair / Side</th>
                <th className="px-3.5 py-2.5">Size / Notional</th>
                <th className="px-3.5 py-2.5">Entry → Mark</th>
                <th className="px-3.5 py-2.5">Liquidation</th>
                <th className="px-3.5 py-2.5 text-right">Unrealized P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {data.positions.map((pos, i) => {
                const isProfit = pos.unrealizedPnl >= 0;
                const liqDanger =
                  pos.liquidationDistancePct !== null && pos.liquidationDistancePct < 8;
                return (
                  <tr key={`${pos.symbol}_${pos.positionSide}_${i}`} className="hover:bg-slate-800/30">
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <PairIcon symbol={pos.symbol} size="sm" showQuoteBadge />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{pos.symbol}</span>
                            <span
                              className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                pos.direction === "LONG"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-rose-500/15 text-rose-300"
                              }`}
                            >
                              {pos.direction === "LONG" ? (
                                <TrendingUp className="w-2.5 h-2.5" />
                              ) : (
                                <TrendingDown className="w-2.5 h-2.5" />
                              )}
                              {pos.direction}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-bold">
                              {pos.leverage}x
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-sans">
                            {pos.marginType} • {pos.connectionLabel}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="text-white font-semibold">{pos.positionAmt}</div>
                      <div className="text-[10px] text-slate-400">
                        {formatCurrency(pos.notionalUsd)}
                      </div>
                    </td>

                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="text-slate-300">{pos.entryPrice}</div>
                      <div className="text-[11px] text-sky-300 font-bold">→ {pos.markPrice}</div>
                    </td>

                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {pos.liquidationPrice > 0 ? (
                        <div>
                          <span className={liqDanger ? "text-rose-400 font-bold" : "text-amber-300"}>
                            {pos.liquidationPrice}
                          </span>
                          {pos.liquidationDistancePct !== null && (
                            <div
                              className={`text-[10px] flex items-center gap-1 ${
                                liqDanger ? "text-rose-400 font-bold" : "text-slate-400"
                              }`}
                            >
                              {liqDanger && <AlertTriangle className="w-3 h-3" />}
                              {pos.liquidationDistancePct}% away
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="px-3.5 py-3 whitespace-nowrap text-right">
                      <div
                        className={`text-sm font-black num-tabular ${
                          isProfit ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(pos.unrealizedPnl, true)}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          isProfit ? "text-emerald-300/80" : "text-rose-300/80"
                        }`}
                      >
                        {pos.roePct >= 0 ? "+" : ""}
                        {pos.roePct}% ROE
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
