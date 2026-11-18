"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradingCalendar } from "@/components/calendar/TradingCalendar";
import { DayDetailModal } from "@/components/calendar/DayDetailModal";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { TradeDetailModal } from "@/components/journal/TradeDetailModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { useAccounts } from "@/components/providers/AccountProvider";
import { DailySummary, Trade, Cashflow } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarDays, Layers } from "lucide-react";

export default function CalendarPage() {
  const { activeAccountId, activeAccount } = useAccounts();
  const [summaries, setSummaries] = useState<Record<string, DailySummary>>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeModalDate, setTradeModalDate] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const accParam =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const [sumRes, tradesRes, cashRes] = await Promise.all([
        fetch(`/api/daily${accParam}`).then((r) => r.json()),
        fetch(`/api/trades${accParam}`).then((r) => r.json()),
        fetch(`/api/cashflow${accParam}`).then((r) => r.json()),
      ]);

      if (sumRes.success) setSummaries(sumRes.summaries);
      if (tradesRes.success) setTrades(tradesRes.trades);
      if (cashRes.success) setCashflows(cashRes.cashflows);
    } catch (err) {
      console.error(err);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sorted list of days that have activity
  const activeDays = Object.values(summaries).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => {
          setTradeModalDate(null);
          setIsTradeModalOpen(true);
        }}
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
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Daily Earnings & Calendar Ledger
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    <Layers className="w-3 h-3" />
                    {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Track how much you made and lost each day, with withdrawals and spendings. Click any date to drill in.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Trading Calendar Heatmap */}
          <TradingCalendar
            summaries={summaries}
            onSelectDay={(dateKey) => setSelectedDate(dateKey)}
          />

          {/* Chronological Daily Ledger */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] shadow-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Daily Earnings History
                </h3>
                <p className="text-xs text-slate-400">
                  Chronological record of daily PnL, wins/losses, and withdrawals
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {activeDays.length} trading days recorded
              </span>
            </div>

            {activeDays.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No trading days recorded yet. Log trades to see daily summaries automatically populate.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Trades</th>
                      <th className="px-4 py-3">Win Rate</th>
                      <th className="px-4 py-3">Record (W / L / BE)</th>
                      <th className="px-4 py-3">Withdrawn</th>
                      <th className="px-4 py-3">Spent</th>
                      <th className="px-4 py-3 text-right">Net Daily PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeDays.map((d) => {
                      const isProfit = d.total_pnl > 0;
                      const isLoss = d.total_pnl < 0;

                      return (
                        <tr
                          key={d.date}
                          onClick={() => setSelectedDate(d.date)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                            {formatDate(d.date)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-300">
                            {d.total_trades}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-semibold text-slate-200">
                            {d.win_rate}%
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-400">
                            <span className="text-emerald-400 font-bold">{d.wins}W</span> /{" "}
                            <span className="text-rose-400 font-bold">{d.losses}L</span> /{" "}
                            <span className="text-slate-400">{d.breakeven}BE</span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-amber-400">
                            {d.total_withdrawn > 0 ? formatCurrency(d.total_withdrawn) : "-"}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-400">
                            {d.total_spent > 0 ? formatCurrency(d.total_spent) : "-"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-sm num-tabular whitespace-nowrap">
                            <span
                              className={
                                isProfit
                                  ? "text-emerald-400"
                                  : isLoss
                                  ? "text-rose-400"
                                  : "text-slate-300"
                              }
                            >
                              {formatCurrency(d.total_pnl, true)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Day Detail Ledger Modal */}
      <DayDetailModal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        dateKey={selectedDate || ""}
        trades={trades}
        cashflows={cashflows}
        onOpenTradeModalForDate={(dt) => {
          setTradeModalDate(dt);
          setIsTradeModalOpen(true);
        }}
        onSelectTrade={(t) => setSelectedTrade(t)}
      />

      <TradeDetailModal
        trade={selectedTrade}
        isOpen={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onEdit={(t) => {
          setSelectedTrade(null);
          setIsTradeModalOpen(true);
        }}
        onDelete={async (id) => {
          await fetch(`/api/trades/${id}`, { method: "DELETE" });
          await fetchData();
        }}
      />

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => {
          setIsTradeModalOpen(false);
          setTradeModalDate(null);
        }}
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
