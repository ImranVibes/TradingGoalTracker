"use client";

import React from "react";
import { Trade } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { TrendingUp, TrendingDown, ArrowUpRight, HelpCircle } from "lucide-react";

interface RecentTradesTableProps {
  trades: Trade[];
  onSelectTrade: (trade: Trade) => void;
  onOpenNewTrade: () => void;
}

export const RecentTradesTable: React.FC<RecentTradesTableProps> = ({
  trades,
  onSelectTrade,
  onOpenNewTrade,
}) => {
  if (trades.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-8 text-center">
        <p className="text-sm font-semibold text-slate-300">No trades recorded yet</p>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Start journaling your currency trades, entry reasons, and profit/loss autopsy.
        </p>
        <button
          onClick={onOpenNewTrade}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20 transition-all"
        >
          + Log Your First Trade
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
              <th className="px-4 py-3">Currency / Pair</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Prices (In / Out)</th>
              <th className="px-4 py-3">Setup & Reason</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Profit / Loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {trades.map((trade) => {
              const isProfit = trade.pnl > 0;
              const isLoss = trade.pnl < 0;

              return (
                <tr
                  key={trade.id}
                  onClick={() => onSelectTrade(trade)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  {/* Currency Symbol */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-white group-hover:text-sky-400 transition-colors">
                        {trade.symbol}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                        {trade.market}
                      </span>
                      {trade.signal_provider && trade.signal_provider.toLowerCase() !== "self" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 font-medium">
                          📡 {trade.signal_provider}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-medium">
                          Self
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Direction */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
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
                  <td className="px-4 py-3.5 font-mono text-slate-300 whitespace-nowrap">
                    <div>
                      {trade.entry_price}{" "}
                      <span className="text-slate-500">→</span>{" "}
                      {trade.exit_price ?? <span className="text-slate-500 italic">open</span>}
                    </div>
                  </td>

                  {/* Reason & Strategy */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <div className="text-slate-200 font-semibold truncate">
                      {trade.strategy || "Manual"}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {trade.reason_entry || "No entry notes"}
                    </p>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                    {formatDate(trade.trade_date)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
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
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
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
