"use client";

import React, { useState } from "react";
import { DailySummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";

interface TradingCalendarProps {
  summaries: Record<string, DailySummary>;
  onSelectDay: (dateKey: string) => void;
}

export const TradingCalendar: React.FC<TradingCalendarProps> = ({ summaries, onSelectDay }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Compute month totals
  const currentMonthPrefix = format(currentDate, "yyyy-MM");
  let monthProfit = 0;
  let monthLoss = 0;
  let monthTrades = 0;
  let monthWins = 0;

  for (const [date, s] of Object.entries(summaries)) {
    if (date.startsWith(currentMonthPrefix)) {
      if (s.total_pnl > 0) monthProfit += s.total_pnl;
      else if (s.total_pnl < 0) monthLoss += Math.abs(s.total_pnl);
      monthTrades += s.total_trades;
      monthWins += s.wins;
    }
  }

  const netMonthPnl = monthProfit - monthLoss;
  const monthWinRate = monthTrades > 0 ? Number(((monthWins / monthTrades) * 100).toFixed(1)) : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 sm:p-6 shadow-xl">
      {/* Calendar Header with Monthly Performance Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                onClick={prevMonth}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goToToday}
                className="px-2 py-0.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Click any calendar day to inspect detailed earnings, losses, and trade reviews
          </p>
        </div>

        {/* Month Quick Rollup Cards */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Month PnL
            </div>
            <div
              className={`text-base font-bold font-mono num-tabular ${
                netMonthPnl > 0 ? "text-emerald-400" : netMonthPnl < 0 ? "text-rose-400" : "text-slate-300"
              }`}
            >
              {formatCurrency(netMonthPnl, true)}
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Win Rate
            </div>
            <div className="text-base font-bold font-mono text-white num-tabular">
              {monthWinRate}%
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Total Trades
            </div>
            <div className="text-base font-bold font-mono text-sky-400 num-tabular">
              {monthTrades}
            </div>
          </div>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const summary = summaries[dateKey];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isCurrentDay = isToday(day);

          const hasPnl = summary && summary.total_trades > 0;
          const isProfit = summary && summary.total_pnl > 0;
          const isLoss = summary && summary.total_pnl < 0;

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDay(dateKey)}
              className={`min-h-[90px] sm:min-h-[105px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                !isCurrentMonth
                  ? "opacity-30 bg-slate-950/40 border-slate-900"
                  : isProfit
                  ? "bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-950/30"
                  : isLoss
                  ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60 hover:shadow-lg hover:shadow-rose-950/30"
                  : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900"
              } ${isCurrentDay ? "ring-2 ring-sky-500/50" : ""}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold font-mono ${
                    isCurrentDay
                      ? "text-sky-400 bg-sky-500/20 px-1.5 py-0.5 rounded"
                      : isCurrentMonth
                      ? "text-slate-300"
                      : "text-slate-600"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {summary && (summary.total_withdrawn > 0 || summary.total_spent > 0) && (
                  <span
                    title={`Outflow: ${formatCurrency(summary.total_withdrawn + summary.total_spent)}`}
                    className="flex items-center text-[10px] text-amber-400"
                  >
                    <ArrowDownLeft className="w-3 h-3" />
                  </span>
                )}
              </div>

              {/* Day PnL Badge */}
              <div className="my-auto text-center">
                {hasPnl ? (
                  <div>
                    <div
                      className={`text-xs sm:text-sm font-black font-mono tracking-tight num-tabular ${
                        isProfit ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-slate-300"
                      }`}
                    >
                      {formatCurrency(summary.total_pnl, true)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {summary.total_trades} {summary.total_trades === 1 ? "trade" : "trades"} (
                      {summary.wins}W / {summary.losses}L)
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-600 font-mono select-none">-</span>
                )}
              </div>

              {/* Bottom Outflow Mini Label */}
              <div className="text-[10px] text-slate-500 font-mono truncate">
                {summary && summary.total_withdrawn > 0 && (
                  <span className="text-amber-400/90 font-medium">
                    W: {formatCurrency(summary.total_withdrawn)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
