"use client";

import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Trade, Cashflow } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowDownLeft, ShoppingBag, PlusCircle } from "lucide-react";

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateKey: string;
  trades: Trade[];
  cashflows: Cashflow[];
  onOpenTradeModalForDate: (date: string) => void;
  onSelectTrade: (trade: Trade) => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  isOpen,
  onClose,
  dateKey,
  trades,
  cashflows,
  onOpenTradeModalForDate,
  onSelectTrade,
}) => {
  if (!dateKey) return null;

  const dayTrades = trades.filter((t) => t.trade_date.startsWith(dateKey));
  const dayCashflows = cashflows.filter((c) => c.date.startsWith(dateKey));

  let dayProfit = 0;
  let dayLoss = 0;
  for (const t of dayTrades) {
    if (t.pnl > 0) dayProfit += t.pnl;
    else if (t.pnl < 0) dayLoss += Math.abs(t.pnl);
  }
  const netDayPnl = dayProfit - dayLoss;

  const dayWithdrawn = dayCashflows
    .filter((c) => c.type === "WITHDRAWAL")
    .reduce((sum, c) => sum + c.amount, 0);

  const daySpent = dayCashflows
    .filter((c) => c.type === "EXPENSE")
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Daily Financial Ledger: ${formatDate(dateKey)}`}
      subtitle="Complete breakdown of daily earnings, losses, withdrawals, and spendings"
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Daily Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`p-3.5 rounded-2xl border ${
              netDayPnl > 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : netDayPnl < 0
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-slate-900 border-slate-800 text-slate-300"
            }`}
          >
            <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">
              Net Day PnL
            </div>
            <div className="text-xl font-black font-mono mt-0.5 num-tabular">
              {formatCurrency(netDayPnl, true)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400">
              Day Profit
            </div>
            <div className="text-xl font-black font-mono text-emerald-400 mt-0.5 num-tabular">
              {formatCurrency(dayProfit, true)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-rose-400">
              Day Loss
            </div>
            <div className="text-xl font-black font-mono text-rose-400 mt-0.5 num-tabular">
              {formatCurrency(dayLoss > 0 ? -dayLoss : 0)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-400">
              Withdrawn / Spent
            </div>
            <div className="text-sm font-mono font-bold text-white mt-1">
              Out: {formatCurrency(dayWithdrawn + daySpent)}
            </div>
          </div>
        </div>

        {/* Day Trades Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Trades Taken on this Day ({dayTrades.length})
            </h4>
            <Button
              size="sm"
              variant="outline"
              icon={<PlusCircle className="w-3.5 h-3.5 text-sky-400" />}
              onClick={() => {
                onClose();
                onOpenTradeModalForDate(dateKey);
              }}
            >
              Add Trade for this Day
            </Button>
          </div>

          {dayTrades.length === 0 ? (
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 text-center text-slate-500 text-xs">
              No trades logged on this date.
            </div>
          ) : (
            <div className="space-y-2">
              {dayTrades.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    onClose();
                    onSelectTrade(t);
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-slate-700 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        t.direction === "LONG"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {t.direction === "LONG" ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white">{t.symbol}</span>
                        <Badge
                          variant={t.pnl > 0 ? "profit" : t.pnl < 0 ? "loss" : "neutral"}
                          size="sm"
                        >
                          {t.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {t.reason_entry || "No notes"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-mono font-bold num-tabular ${
                        t.pnl > 0 ? "text-emerald-400" : t.pnl < 0 ? "text-rose-400" : "text-slate-300"
                      }`}
                    >
                      {formatCurrency(t.pnl, true)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      @ {t.entry_price} → {t.exit_price ?? "open"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day Cashflow Transactions */}
        {dayCashflows.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Cashflow & Spending on this Day ({dayCashflows.length})
            </h4>
            <div className="space-y-2">
              {dayCashflows.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-1.5 rounded-lg ${
                        c.type === "WITHDRAWAL"
                          ? "bg-amber-500/10 text-amber-400"
                          : c.type === "EXPENSE"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {c.type === "WITHDRAWAL" ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ShoppingBag className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{c.category}</div>
                      <p className="text-xs text-slate-400">{c.description}</p>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold text-white">
                    {formatCurrency(c.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Close Ledger
          </Button>
        </div>
      </div>
    </Modal>
  );
};
