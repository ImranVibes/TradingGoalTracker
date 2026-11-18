"use client";

import React, { useState, useEffect } from "react";
import { Trade } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { PairIcon } from "../ui/PairIcon";
import { TrendingUp, TrendingDown, Radio, User } from "lucide-react";

interface RecentTradesTableProps {
  trades: Trade[];
  onSelectTrade: (trade: Trade) => void;
  onOpenNewTrade: () => void;
  onUpdated?: () => void;
}

export const RecentTradesTable: React.FC<RecentTradesTableProps> = ({
  trades,
  onSelectTrade,
  onOpenNewTrade,
  onUpdated,
}) => {
  const [providers, setProviders] = useState<string[]>([]);
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.providers)) {
          setProviders(
            data.providers
              .map((p: any) => p.name?.trim())
              .filter((n: string) => Boolean(n && n.toLowerCase() !== "self"))
          );
        }
      })
      .catch(() => {});
  }, [trades.length]);

  const allProviders = Array.from(
    new Set([
      ...providers,
      ...trades
        .map((t) => t.signal_provider?.trim())
        .filter((p): p is string => Boolean(p && p.toLowerCase() !== "self")),
    ])
  );

  const handleQuickAssign = async (tradeId: string, providerName: string) => {
    const clean = providerName.trim() || "Self";
    setLocalOverrides((prev) => ({ ...prev, [tradeId]: clean }));
    try {
      await fetch(`/api/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal_provider: clean }),
      });
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  if (trades.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-8 text-center">
        <p className="text-sm font-semibold text-slate-300">No positions recorded yet</p>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Log your first trade or sync closed positions from Binance/Bybit in Settings.
        </p>
        <button
          onClick={onOpenNewTrade}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20 transition-all"
        >
          + Log Your First Position
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f172a] shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Trader / Source</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Prices (In / Out)</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Net P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {trades.map((trade) => {
              const isProfit = trade.pnl > 0;
              const isLoss = trade.pnl < 0;
              const activeProvider = localOverrides[trade.id] ?? trade.signal_provider ?? "Self";
              const isExternal = activeProvider.toLowerCase() !== "self";

              return (
                <tr
                  key={trade.id}
                  onClick={() => onSelectTrade(trade)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  {/* Symbol */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <PairIcon symbol={trade.symbol} size="sm" showQuoteBadge />
                      <span className="font-mono font-bold text-sm text-white group-hover:text-sky-400 transition-colors">
                        {trade.symbol}
                      </span>
                      {trade.exchange && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                          {trade.exchange}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 1-Click Inline Trader Assignment */}
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                        isExternal
                          ? "bg-violet-500/15 text-violet-200 border-violet-500/40"
                          : "bg-slate-800/80 text-slate-300 border-slate-700"
                      }`}
                    >
                      {isExternal ? (
                        <Radio className="w-2.5 h-2.5 text-violet-400" />
                      ) : (
                        <User className="w-2.5 h-2.5 text-slate-400" />
                      )}
                      <select
                        value={activeProvider}
                        onChange={(e) => {
                          if (e.target.value === "__NEW__") {
                            const custom = prompt("Enter new trader / signal provider name:");
                            if (custom && custom.trim()) {
                              handleQuickAssign(trade.id, custom.trim());
                            }
                          } else {
                            handleQuickAssign(trade.id, e.target.value);
                          }
                        }}
                        className="bg-transparent focus:outline-none cursor-pointer text-[11px]"
                        title="1-click assign to a trader"
                      >
                        <option value="Self" className="bg-slate-900 text-white">
                          Self
                        </option>
                        {allProviders.map((p) => (
                          <option key={p} value={p} className="bg-slate-900 text-white">
                            {p}
                          </option>
                        ))}
                        <option value="__NEW__" className="bg-slate-900 text-sky-400">
                          + New Trader...
                        </option>
                      </select>
                    </div>
                  </td>

                  {/* Direction */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                        trade.direction === "LONG" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {trade.direction === "LONG" ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {trade.direction}
                    </span>
                  </td>

                  {/* Prices */}
                  <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                    {trade.entry_price ? (
                      <div>
                        {trade.entry_price}{" "}
                        <span className="text-slate-500">→</span>{" "}
                        {trade.exit_price ?? <span className="text-slate-500 italic">open</span>}
                      </div>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                    {formatDate(trade.trade_date)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
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
                  </td>

                  {/* Realized PnL */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div
                      className={`font-mono font-bold text-sm num-tabular ${
                        isProfit ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-slate-300"
                      }`}
                    >
                      {formatCurrency(trade.pnl, true)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
