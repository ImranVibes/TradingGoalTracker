"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import { BinancePineChart } from "@/components/chart/BinancePineChart";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { CandlestickChart, Code2, Search, LineChart } from "lucide-react";

const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"];
const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XAUUSDT", "XAGUSDT"];

export default function ChartPage() {
  const [chartMode, setChartMode] = useState<"tradingview" | "binance">("binance");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [symbolInput, setSymbolInput] = useState("BTCUSDT");
  const [interval, setInterval] = useState("15m");
  const [quickSymbols, setQuickSymbols] = useState<string[]>(DEFAULT_SYMBOLS);

  // Global Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // Pull user's actual traded symbols into the quick-switch bar
  const loadRecentSymbols = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      if (data.success && Array.isArray(data.trades)) {
        const traded = Array.from(
          new Set(
            data.trades
              .map((t: any) =>
                String(t.symbol || "")
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
              )
              .filter((s: string) => s.length >= 4 && s.length <= 16)
          )
        ) as string[];
        const merged = Array.from(new Set([...traded.slice(0, 8), ...DEFAULT_SYMBOLS])).slice(0, 10);
        setQuickSymbols(merged);
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    loadRecentSymbols();
  }, [loadRecentSymbols]);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = symbolInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length >= 3) {
      setSymbol(cleaned);
      setSymbolInput(cleaned);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={loadRecentSymbols}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] mx-auto w-full space-y-4">
          {/* Top Bar: Chart Mode Tabs + Symbol + Timeframe */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-3.5 space-y-3 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Mode Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start">
                <button
                  type="button"
                  onClick={() => setChartMode("tradingview")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    chartMode === "tradingview"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <LineChart className="w-3.5 h-3.5" />
                  TradingView Chart
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode("binance")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    chartMode === "binance"
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Binance Live + Pine Script
                </button>
              </div>

              {/* Symbol Input + Timeframes */}
              <div className="flex flex-wrap items-center gap-2.5">
                <form onSubmit={handleSymbolSubmit} className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
                  <input
                    type="text"
                    value={symbolInput}
                    onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                    placeholder="Symbol (e.g. BTCUSDT)"
                    className="w-40 rounded-xl bg-slate-900 border border-slate-700 pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="ml-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    Go
                  </button>
                </form>

                {/* Timeframe Pills */}
                <div className="flex items-center gap-0.5 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setInterval(tf)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors ${
                        interval === tf
                          ? "bg-slate-800 text-sky-300 border border-slate-700"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick-Switch Pair Pills (Your Traded Pairs + Majors) */}
            <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-slate-800/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mr-1">
                <CandlestickChart className="w-3 h-3 text-sky-400" /> Pairs:
              </span>
              {quickSymbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => {
                    setSymbol(sym);
                    setSymbolInput(sym);
                  }}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors ${
                    symbol === sym
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Active Chart View */}
          {chartMode === "tradingview" ? (
            <TradingViewChart symbol={symbol} interval={interval} />
          ) : (
            <BinancePineChart symbol={symbol} interval={interval} />
          )}
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={loadRecentSymbols}
      />

      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={() => {}}
      />

      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
