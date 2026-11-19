"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import { BinancePineChart } from "@/components/chart/BinancePineChart";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { PairIcon } from "@/components/ui/PairIcon";
import {
  CandlestickChart,
  Code2,
  Search,
  LineChart,
  Maximize2,
  Minimize2,
  Plus,
  Flame,
} from "lucide-react";

const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w"];
const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XAUUSDT", "XAGUSDT"];

export default function ChartPage() {
  const [chartMode, setChartMode] = useState<"tradingview" | "binance">("tradingview");
  const [symbol, setSymbol] = useState("XAUUSDT");
  const [symbolInput, setSymbolInput] = useState("XAUUSDT");
  const [interval, setInterval] = useState("15m");
  const [usePerp, setUsePerp] = useState(true);
  const [quickSymbols, setQuickSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const chartCardRef = useRef<HTMLDivElement | null>(null);

  // Global Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (chartCardRef.current) {
          await chartCardRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

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

  const selectSymbol = (sym: string) => {
    const cleaned = sym.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setSymbol(cleaned);
    setSymbolInput(cleaned);
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

        <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-[1750px] mx-auto w-full space-y-3">
          {/* Main Chart Container Card with TradingView-style Single Top Bar */}
          <div
            ref={chartCardRef}
            className={`flex flex-col rounded-2xl border border-slate-800 bg-[#090d16] shadow-2xl overflow-hidden transition-all ${
              isFullscreen ? "p-3 bg-[#090d16] h-screen w-screen" : "w-full"
            }`}
          >
            {/* Primary TradingView-Style Integrated Navigation Bar */}
            <div className="px-3 sm:px-4 py-2 bg-[#0c1222] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              {/* Left Side: Symbol Selector directly followed by Timeframe Toolbar (TradingView UX) */}
              <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
                {/* Symbol Search Form */}
                <form onSubmit={handleSymbolSubmit} className="flex items-center gap-1.5">
                  <PairIcon symbol={symbol} size="sm" showQuoteBadge />
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={symbolInput}
                      onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                      placeholder="Symbol"
                      className="w-32 sm:w-36 rounded-lg bg-slate-900 border border-slate-700 pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    Go
                  </button>
                </form>

                {/* Vertical Divider */}
                <div className="hidden sm:block w-px h-6 bg-slate-800" />

                {/* Timeframes Bar - Sits directly beside symbol on the right (TradingView layout) */}
                <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800/90 overflow-x-auto">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setInterval(tf)}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
                        interval === tf
                          ? "bg-sky-500 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                      }`}
                      title={`Timeframe ${tf}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Vertical Divider */}
                <div className="hidden md:block w-px h-6 bg-slate-800" />

                {/* Chart Engine Switcher */}
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setChartMode("tradingview")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      chartMode === "tradingview"
                        ? "bg-sky-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="TradingView advanced interactive charting engine"
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    TradingView
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode("binance")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      chartMode === "binance"
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Binance Live WebSocket + Custom Pine Script Indicator Studio"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    Binance Live + Pine
                  </button>
                </div>
              </div>

              {/* Right Side: Market Contract Type + Fullscreen + Log Trade */}
              <div className="flex items-center flex-wrap gap-2">
                {/* Contract Toggle */}
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUsePerp(true)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                      usePerp ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Futures (.P)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsePerp(false)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                      !usePerp ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Spot
                  </button>
                </div>

                {/* Fullscreen Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Chart"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Quick Log Trade */}
                <button
                  type="button"
                  onClick={() => setIsTradeModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Trade</span>
                </button>
              </div>
            </div>

            {/* Quick-Switch Watchlist Strip (User Traded Coins + Majors) */}
            <div className="px-3 sm:px-4 py-1.5 bg-[#090d16] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mr-1 shrink-0">
                <Flame className="w-3 h-3 text-amber-400" /> Watchlist:
              </span>
              {quickSymbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => selectSymbol(sym)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold border transition-all shrink-0 ${
                    symbol === sym
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm"
                      : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                  }`}
                >
                  <PairIcon symbol={sym} size="xs" />
                  {sym}
                </button>
              ))}
            </div>

            {/* Chart View (TradingView or Binance Pine Script Engine) */}
            <div className="flex-1 w-full bg-[#090d16] flex flex-col">
              {chartMode === "tradingview" ? (
                <TradingViewChart
                  symbol={symbol}
                  interval={interval}
                  usePerp={usePerp}
                  onTogglePerp={setUsePerp}
                />
              ) : (
                <BinancePineChart
                  symbol={symbol}
                  interval={interval}
                  usePerp={usePerp}
                  onTogglePerp={setUsePerp}
                />
              )}
            </div>
          </div>
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
