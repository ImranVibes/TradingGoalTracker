"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { PairIcon } from "@/components/ui/PairIcon";
import { SupportResistanceMatrix } from "@/components/sentiment/SupportResistanceMatrix";
import { TradeGptDebateSection } from "@/components/sentiment/TradeGptDebateSection";
import { MarketMakerSentinel } from "@/components/sentiment/MarketMakerSentinel";
import { BeginnerExecutiveSummary } from "@/components/sentiment/BeginnerExecutiveSummary";
import {
  evaluateMarketSentiment,
  SentimentInput,
} from "@/lib/tradingMetrics";
import {
  Compass,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  PauseCircle,
  Sliders,
  CheckSquare,
  ArrowRight,
  Info,
  Flame,
  ShieldAlert,
  Layers,
  Bot,
} from "lucide-react";

const QUICK_PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "NEARUSDT", "QNTUSDT", "ZECUSDT", "DOGEUSDT"];

interface LiveMarketSnapshot {
  lastPrice: number;
  markPrice: number;
  high24h: number;
  low24h: number;
  quoteVolume24h: number;
  openInterestUsd: number;
  oiChange4hPct: number;
  oiChange24hPct: number;
  nextFundingTime: string | null;
  whaleLongPct: number;
  retailLongPct: number;
  ema50: number | null;
  ema200: number | null;
  fearGreedLabel: string;
}

function formatCompactUsd(val: number): string {
  if (!val) return "$0";
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export default function SentimentPage() {
  const [symbolInput, setSymbolInput] = useState("BTCUSDT");
  const [activeSymbol, setActiveSymbol] = useState("BTCUSDT");
  const [quickPairs, setQuickPairs] = useState<string[]>(QUICK_PAIRS);

  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [market, setMarket] = useState<LiveMarketSnapshot | null>(null);
  const [orderBook, setOrderBook] = useState<{
    bidDepthUsd: number;
    askDepthUsd: number;
    bidPressurePct: number;
    askPressurePct: number;
    signal: string;
    biggestBidWall: { price: number; usd: number } | null;
    biggestAskWall: { price: number; usd: number } | null;
  } | null>(null);
  const [tokenAudit, setTokenAudit] = useState<{
    baseAsset: string;
    isMainSpotListed: boolean;
    isAlphaToken: boolean;
    chainName: string | null;
    contractAddress: string | null;
    oiToVolRatio: number;
    overallRiskTier: "LOW" | "MODERATE" | "HIGH";
    flags: { severity: "LOW" | "MEDIUM" | "HIGH"; title: string; detail: string }[];
  } | null>(null);
  const [trendingMovers, setTrendingMovers] = useState<
    { symbol: string; lastPrice: number; priceChangePct: number; quoteVolumeUsd: number }[]
  >([]);
  const [technicalAnalysis, setTechnicalAnalysis] = useState<any | null>(null);
  const [marketMakerFlow, setMarketMakerFlow] = useState<any | null>(null);

  // Editable Sentiment Inputs (auto-filled from Binance Live, or manually edited anytime)
  const [input, setInput] = useState<SentimentInput>({
    symbol: "BTCUSDT",
    priceChange24hPct: 0,
    oiChangePct: 0,
    fundingRatePct: 0.01,
    whaleLongShortRatio: 1.0,
    retailLongShortRatio: 1.0,
    takerBuySellRatio: 1.0,
    htfTrend: "NEUTRAL",
    fearGreedIndex: 50,
    newsRisk: "CLEAR",
  });

  // Global Navbar Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const fetchLiveSentiment = useCallback(async (targetSym: string) => {
    const clean = targetSym.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "BTCUSDT";
    setActiveSymbol(clean);
    setSymbolInput(clean);
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/binance/sentiment?symbol=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!data.success) {
        setFetchError(data.error || "Could not fetch live futures data — you can still enter values manually below.");
        setMarket(null);
        setOrderBook(null);
        setTokenAudit(null);
        setTechnicalAnalysis(null);
        setMarketMakerFlow(null);
        if (Array.isArray(data.trendingMovers)) setTrendingMovers(data.trendingMovers);
        setInput((prev) => ({ ...prev, symbol: clean }));
        return;
      }
      setMarket(data.market);
      setOrderBook(data.orderBook || null);
      setTokenAudit(data.tokenAudit || null);
      setTechnicalAnalysis(data.technicalAnalysis || null);
      setMarketMakerFlow(data.marketMakerFlow || null);
      if (Array.isArray(data.trendingMovers)) setTrendingMovers(data.trendingMovers);
      setInput(data.input);
      setLastFetchedAt(data.fetchedAt);
    } catch (err: any) {
      setFetchError(err.message || "Network error fetching Binance data");
    } finally {
      setFetching(false);
    }
  }, []);

  // Load user's traded pairs into quick-switch pills + auto-load BTCUSDT on mount
  useEffect(() => {
    fetchLiveSentiment("BTCUSDT");
    fetch("/api/trades")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.trades)) {
          const userPairs = Array.from(
            new Set(
              data.trades
                .map((t: any) => String(t.symbol || "").toUpperCase())
                .filter((s: string) => s.endsWith("USDT") || s.endsWith("USDC"))
            )
          ) as string[];
          const merged = Array.from(new Set([...userPairs.slice(0, 8), ...QUICK_PAIRS])).slice(0, 12);
          setQuickPairs(merged);
        }
      })
      .catch(() => {});
  }, [fetchLiveSentiment]);

  // Real-time recalculated report whenever live data loads OR user edits any input manually
  const report = useMemo(() => evaluateMarketSentiment(input), [input]);

  // Visual gauge marker position (0% = -100, 50% = 0, 100% = +100)
  const gaugePct = Math.max(2, Math.min(98, ((report.score + 100) / 200) * 100));

  const zoneStyles = {
    EXTREME_BULLISH: {
      border: "border-emerald-400/60",
      bg: "bg-gradient-to-br from-emerald-500/20 via-emerald-950/30 to-[#0f172a]",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
      headline: "text-emerald-300",
    },
    BULLISH: {
      border: "border-emerald-500/40",
      bg: "bg-gradient-to-br from-emerald-500/12 via-slate-900 to-[#0f172a]",
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      headline: "text-emerald-400",
    },
    NEUTRAL: {
      border: "border-amber-500/40",
      bg: "bg-gradient-to-br from-amber-500/10 via-slate-900 to-[#0f172a]",
      badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      headline: "text-amber-300",
    },
    BEARISH: {
      border: "border-rose-500/40",
      bg: "bg-gradient-to-br from-rose-500/12 via-slate-900 to-[#0f172a]",
      badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      headline: "text-rose-400",
    },
    EXTREME_BEARISH: {
      border: "border-rose-400/60",
      bg: "bg-gradient-to-br from-rose-500/20 via-rose-950/30 to-[#0f172a]",
      badge: "bg-rose-500/20 text-rose-300 border-rose-400/40",
      headline: "text-rose-300",
    },
  }[report.zone];

  const checklistHref = `/checklist?symbol=${encodeURIComponent(activeSymbol)}&direction=${
    report.allowedDirection === "SHORT_ONLY" ? "SHORT" : "LONG"
  }&verdict=${encodeURIComponent(`${report.zoneLabel} (${report.score > 0 ? "+" : ""}${report.score})`)}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={() => fetchLiveSentiment(activeSymbol)}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Market Sentiment & Direction Detector
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auto-fetches live Binance Futures Open Interest, Funding Rate, Whale vs. Retail Ratios & 4H Trend — or adjust any input manually to lock your allowed trade direction.
                </p>
              </div>
            </div>

            <Link
              href={checklistHref}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition-all inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <CheckSquare className="w-4 h-4" />
              Open Pre-Trade Checklist
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Live Symbol Fetch Bar */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 space-y-3 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchLiveSentiment(symbolInput);
                }}
                className="flex items-center gap-2 flex-1 max-w-md"
              >
                <PairIcon symbol={activeSymbol} size="md" showQuoteBadge />
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={symbolInput}
                    onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                    placeholder="Enter Binance Futures symbol (e.g. BTCUSDT)"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 pl-8 pr-3 py-2 text-xs font-mono font-bold text-white uppercase focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={fetching}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin" : ""}`} />
                  {fetching ? "Fetching..." : "Auto-Fetch Live"}
                </button>
              </form>

              {market && (
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 mr-1.5">Price:</span>
                    <strong className="text-white">${market.lastPrice.toLocaleString()}</strong>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 mr-1.5">OI:</span>
                    <strong className="text-sky-300">{formatCompactUsd(market.openInterestUsd)}</strong>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 mr-1.5">24h Vol:</span>
                    <strong className="text-slate-200">{formatCompactUsd(market.quoteVolume24h)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Pair Selector */}
            <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                Quick Scan:
              </span>
              {quickPairs.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => fetchLiveSentiment(sym)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors ${
                    activeSymbol === sym
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <PairIcon symbol={sym} size="xs" />
                  {sym}
                </button>
              ))}
            </div>

            {fetchError && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                {fetchError}
              </div>
            )}
          </div>

          {/* BEGINNER EXECUTIVE SUMMARY & QUICK TRADE PLAN */}
          <BeginnerExecutiveSummary
            symbol={activeSymbol}
            currentPrice={market?.lastPrice || 0}
            report={report}
            marketMakerFlow={marketMakerFlow}
            technicalAnalysis={technicalAnalysis}
            fundingRatePct={input.fundingRatePct}
            whaleRatio={marketMakerFlow?.smartMoneyMetrics?.whaleRatio}
            retailRatio={marketMakerFlow?.smartMoneyMetrics?.retailRatio}
          />

          {/* ALGORITHMIC SENTIMENT SPECTRUM & RULE ENGINE */}
          <div className={`rounded-3xl border p-6 sm:p-8 shadow-2xl space-y-6 ${zoneStyles.border} ${zoneStyles.bg}`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${zoneStyles.badge}`}>
                    {report.zoneLabel}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-900/80 text-slate-300 border border-slate-700/80">
                    Confluence Agreement: {report.confidencePct}%
                  </span>
                  {lastFetchedAt && (
                    <span className="text-xs text-slate-400 font-mono">
                      Live synced {new Date(lastFetchedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {report.allowedDirection === "LONG_ONLY" ? (
                    <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <TrendingUp className="w-8 h-8 stroke-[2.5]" />
                    </div>
                  ) : report.allowedDirection === "SHORT_ONLY" ? (
                    <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <TrendingDown className="w-8 h-8 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <PauseCircle className="w-8 h-8 stroke-[2.5]" />
                    </div>
                  )}

                  <div>
                    <span className="text-xs uppercase tracking-widest text-slate-400 font-bold block">
                      Algorithmic Sentiment Filter
                    </span>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${zoneStyles.headline}`}>
                      {report.directionHeadline}
                    </h2>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
                  <strong className="text-white">Strict Rule:</strong> {report.strictRule}
                </p>
              </div>

              {/* Big Score Readout */}
              <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-2 p-5 rounded-3xl bg-slate-950/80 border border-slate-800 min-w-[190px]">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Sentiment Score
                </span>
                <span className={`text-4xl sm:text-5xl font-black font-mono num-tabular ${zoneStyles.headline}`}>
                  {report.score > 0 ? `+${report.score}` : report.score}
                </span>
                <span className="text-xs font-mono text-slate-500">Scale: -100 to +100</span>
              </div>
            </div>

            {/* 5-Zone Spectrum Gauge */}
            <div className="space-y-2">
              <div className="relative h-4 rounded-full overflow-hidden bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-500 p-0.5 shadow-inner">
                {/* Zone dividers */}
                <div className="absolute inset-0 flex pointer-events-none">
                  <div className="w-[20%] border-r border-slate-950/60" />
                  <div className="w-[20%] border-r border-slate-950/60" />
                  <div className="w-[20%] border-r border-slate-950/60" />
                  <div className="w-[20%] border-r border-slate-950/60" />
                  <div className="w-[20%]" />
                </div>
                {/* Pointer */}
                <div
                  className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.95)] transition-all duration-300"
                  style={{ left: `calc(${gaugePct}% - 4px)` }}
                />
              </div>
              <div className="grid grid-cols-5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <span className="text-rose-400">Too Bearish</span>
                <span className="text-rose-300 text-center">Bearish</span>
                <span className="text-amber-300 text-center">Neutral</span>
                <span className="text-emerald-300 text-center">Bullish</span>
                <span className="text-emerald-400 text-right">Too Bullish</span>
              </div>
            </div>

            {/* Crowded Squeeze Warning if Triggered */}
            {report.squeezeWarning && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-200">
                <Flame className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 uppercase tracking-wider text-[11px] block">
                    Crowded Leverage / Squeeze Warning
                  </strong>
                  {report.squeezeWarning}
                </div>
              </div>
            )}
          </div>

          {/* 1. Market Maker & Cross-Exchange Whale Sentinel */}
          <MarketMakerSentinel
            flow={marketMakerFlow}
            symbol={activeSymbol}
            currentPrice={market?.lastPrice || 0}
          />

          {/* 2. Automated Support & Resistance Confluence Ladder */}
          <SupportResistanceMatrix
            currentPrice={market?.lastPrice || 0}
            symbol={activeSymbol}
            data={technicalAnalysis}
          />

          {/* 3. TradeGPT Dual-Thesis Debate & Research Manager Synthesis */}
          <TradeGptDebateSection
            symbol={activeSymbol}
            currentPrice={market?.lastPrice || 0}
            debate={technicalAnalysis?.tradeGptDebate || null}
          />

          {/* 2-Column Interactive Inputs (Left) + Factor Breakdown (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Interactive / Manual Override Panel */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    Market Inputs (Auto-Filled / Editable)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Auto-populated from Binance live data — override any number manually for Forex, Gold, or custom analysis.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    24h Price Change (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={input.priceChange24hPct}
                    onChange={(e) =>
                      setInput((p) => ({ ...p, priceChange24hPct: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Open Interest Change (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={input.oiChangePct}
                    onChange={(e) =>
                      setInput((p) => ({ ...p, oiChangePct: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Funding Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={input.fundingRatePct}
                    onChange={(e) =>
                      setInput((p) => ({ ...p, fundingRatePct: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Baseline ~0.01% • Extreme &gt;0.05%</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Taker Buy/Sell Ratio
                  </label>
                  <input
                    type="number"
                    step="0.02"
                    value={input.takerBuySellRatio}
                    onChange={(e) =>
                      setInput((p) => ({ ...p, takerBuySellRatio: parseFloat(e.target.value) || 1 }))
                    }
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">&gt;1.05 Buyers • &lt;0.95 Sellers</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Whale / Top Trader L/S Ratio
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={input.whaleLongShortRatio}
                    onChange={(e) =>
                      setInput((p) => ({ ...p, whaleLongShortRatio: parseFloat(e.target.value) || 1 }))
                    }
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                  />
                  {market && (
                    <span className="text-[10px] text-sky-400">Whales {market.whaleLongPct}% Long</span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Retail Global L/S Ratio
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={input.retailLongShortRatio}
                    onChange={(e) =>
                      setInput((p) => ({ ...p, retailLongShortRatio: parseFloat(e.target.value) || 1 }))
                    }
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
                  />
                  {market && (
                    <span className="text-[10px] text-slate-400">Retail {market.retailLongPct}% Long</span>
                  )}
                </div>
              </div>

              {/* Higher-Timeframe Trend */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Higher-Timeframe Trend (4H / 1D Price Action)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["BEARISH", "NEUTRAL", "BULLISH"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInput((p) => ({ ...p, htfTrend: t }))}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                        input.htfTrend === t
                          ? t === "BULLISH"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                            : t === "BEARISH"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fear & Greed + Macro News */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Fear & Greed Index ({input.fearGreedIndex}/100)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={input.fearGreedIndex}
                    onChange={(e) =>
                      setInput((p) => ({ ...p, fearGreedIndex: parseInt(e.target.value, 10) || 50 }))
                    }
                    className="w-full accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0 Fear</span>
                    <span>{market?.fearGreedLabel || "Neutral"}</span>
                    <span>100 Greed</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    News / Macro Event Filter
                  </label>
                  <select
                    value={input.newsRisk}
                    onChange={(e) =>
                      setInput((p) => ({
                        ...p,
                        newsRisk: e.target.value as SentimentInput["newsRisk"],
                      }))
                    }
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                  >
                    <option value="CLEAR">Clear (No Red-Folder News)</option>
                    <option value="BULLISH_CATALYST">Bullish News Catalyst</option>
                    <option value="BEARISH_CATALYST">Bearish News Catalyst</option>
                    <option value="HIGH_VOLATILITY_WAIT">CPI / FOMC Imminent (Wait!)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Institutional Factor-by-Factor Breakdown */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Why This Direction? 6-Factor Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Every factor scores independently so you can see exactly where institutional pressure sits.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {report.factors.map((f) => {
                  const badgeStyle =
                    f.signal === "BULLISH"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : f.signal === "BEARISH"
                      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      : f.signal === "WARNING"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700";

                  return (
                    <div
                      key={f.name}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{f.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}>
                            {f.signal}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-slate-400 text-[11px]">{f.valueLabel}</span>
                          <span
                            className={`font-black px-2 py-0.5 rounded bg-slate-950 border border-slate-800 ${
                              f.score > 0
                                ? "text-emerald-400"
                                : f.score < 0
                                ? "text-rose-400"
                                : "text-slate-400"
                            }`}
                          >
                            {f.score > 0 ? `+${f.score}` : f.score} / ±{f.maxWeight}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{f.explanation}</p>
                    </div>
                  );
                })}
              </div>

              {/* Educational Cheat Sheet */}
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  How Professional Futures Traders Read This:
                </div>
                <p>
                  <strong className="text-white">1. Price ↑ + OI ↑</strong> = Real longs entering.{" "}
                  <strong className="text-white">Price ↓ + OI ↑</strong> = Real shorts piling in.{" "}
                  <strong className="text-white">2. Whales vs. Retail:</strong> Follow Top Trader Positions when they diverge from Retail.{" "}
                  <strong className="text-white">3. Extreme Funding (&gt; +0.05% or &lt; -0.04%):</strong> Never chase — wait for a squeeze pullback first!
                </p>
              </div>
            </div>
          </div>

          {/* BINANCE SKILLS HUB INTELLIGENCE LAYER: Order Book Whale Walls + Token Security Audit + Trending Spikes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Order-Book Whale Walls & Bid/Ask Pressure */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    Order-Book Depth &amp; Whale Walls (Top 50 Levels)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Live Binance Futures orderbook liquidity imbalance &amp; largest institutional bid/ask walls
                  </p>
                </div>
                {orderBook && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      orderBook.signal === "BUY_WALL_DOMINANT"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : orderBook.signal === "SELL_WALL_DOMINANT"
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {orderBook.signal.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              {orderBook ? (
                <div className="space-y-3">
                  {/* Pressure Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono font-bold">
                      <span className="text-emerald-400">
                        Bids {orderBook.bidPressurePct}% ({formatCompactUsd(orderBook.bidDepthUsd)})
                      </span>
                      <span className="text-rose-400">
                        Asks {orderBook.askPressurePct}% ({formatCompactUsd(orderBook.askDepthUsd)})
                      </span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex bg-slate-900 border border-slate-800">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${orderBook.bidPressurePct}%` }}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all duration-300"
                        style={{ width: `${orderBook.askPressurePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Biggest Bid & Ask Walls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25">
                      <span className="text-[10px] font-sans font-bold uppercase text-emerald-300 block">
                        Largest Bid Whale Wall (Support)
                      </span>
                      {orderBook.biggestBidWall ? (
                        <>
                          <div className="text-base font-black text-white mt-0.5">
                            ${orderBook.biggestBidWall.price.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-emerald-400">
                            Wall Size: {formatCompactUsd(orderBook.biggestBidWall.usd)}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/25">
                      <span className="text-[10px] font-sans font-bold uppercase text-rose-300 block">
                        Largest Ask Whale Wall (Resistance)
                      </span>
                      {orderBook.biggestAskWall ? (
                        <>
                          <div className="text-base font-black text-white mt-0.5">
                            ${orderBook.biggestAskWall.price.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-rose-400">
                            Wall Size: {formatCompactUsd(orderBook.biggestAskWall.usd)}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Fetch a Binance Futures pair above to inspect live orderbook whale walls.
                </div>
              )}
            </div>

            {/* Token Security, Liquidity & Listing Risk Audit */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    Token Security, Liquidity &amp; Listing Audit
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Flags Binance Alpha / Futures-only coins, thin liquidity, squeeze coils &amp; volatility traps
                  </p>
                </div>
                {tokenAudit && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                      tokenAudit.overallRiskTier === "HIGH"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : tokenAudit.overallRiskTier === "MODERATE"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {tokenAudit.overallRiskTier} RISK
                  </span>
                )}
              </div>

              {tokenAudit ? (
                <div className="space-y-2">
                  {tokenAudit.chainName && tokenAudit.contractAddress && (
                    <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex flex-wrap items-center justify-between gap-1">
                      <span>
                        Chain: <strong className="text-sky-300">{tokenAudit.chainName}</strong>
                      </span>
                      <span className="text-slate-400 truncate max-w-[260px]" title={tokenAudit.contractAddress}>
                        Contract: {tokenAudit.contractAddress}
                      </span>
                    </div>
                  )}

                  {tokenAudit.flags.map((f, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs ${
                        f.severity === "HIGH"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                          : f.severity === "MEDIUM"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                          : "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
                      }`}
                    >
                      <div className="font-bold">{f.title}</div>
                      <div className="text-[11px] opacity-85 mt-0.5">{f.detail}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Token listing &amp; risk audit will appear after scanning a coin.
                </div>
              )}
            </div>
          </div>

          {/* Trending Binance Futures Volume Spikes Radar */}
          {trendingMovers.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    Hot Binance Futures Volume &amp; Momentum Spikes
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Click any trending mover to immediately run full Sentiment + Order-Book Whale Wall + Security Audit
                  </p>
                </div>
                <Link
                  href="/copilot"
                  className="text-xs font-semibold text-violet-300 hover:underline flex items-center gap-1"
                >
                  <Bot className="w-3.5 h-3.5" /> Ask AI Copilot →
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {trendingMovers.map((m) => (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() => fetchLiveSentiment(m.symbol)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                      activeSymbol === m.symbol
                        ? "bg-amber-500/15 border-amber-500/50"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PairIcon symbol={m.symbol} size="sm" />
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-xs text-white truncate">
                          {m.symbol}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Vol {formatCompactUsd(m.quoteVolumeUsd)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-mono font-black text-xs flex-shrink-0 ${
                        m.priceChangePct >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {m.priceChangePct >= 0 ? "+" : ""}
                      {m.priceChangePct}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => {}}
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
