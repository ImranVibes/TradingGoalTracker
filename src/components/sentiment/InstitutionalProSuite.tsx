"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Compass,
  Cpu,
  DollarSign,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

interface ProAnalyticsResponse {
  success: boolean;
  symbol: string;
  currentPrice: number;
  cvd: {
    totalTakerBuyUsd: number;
    totalTakerSellUsd: number;
    netDeltaUsd: number;
    cvdSeries: {
      time: string;
      timestamp: number;
      close: number;
      deltaUsd: number;
      cvdUsd: number;
      isBuyerDominant: boolean;
    }[];
    divergence: "BEARISH_ABSORPTION" | "BULLISH_ABSORPTION" | "NEUTRAL_ALIGNED";
    signalHeadline: string;
  };
  fvg: {
    totalFound: number;
    unmitigatedCount: number;
    nearestMagnetFvg: {
      id: string;
      type: "BULLISH_FVG" | "BEARISH_FVG";
      top: number;
      bottom: number;
      midpoint: number;
      sizeUsd: number;
      pct: number;
      mitigated: boolean;
      distancePct: number;
      time: string;
    } | null;
    activeFvgs: {
      id: string;
      type: "BULLISH_FVG" | "BEARISH_FVG";
      top: number;
      bottom: number;
      midpoint: number;
      sizeUsd: number;
      pct: number;
      mitigated: boolean;
      distancePct: number;
      time: string;
    }[];
  };
  smc: {
    structureState: "BULLISH_EXPANSION" | "BEARISH_EXPANSION";
    bslPrice: number;
    sslPrice: number;
    demandOrderBlock: { top: number; bottom: number; time: string } | null;
    supplyOrderBlock: { top: number; bottom: number; time: string } | null;
    bosBreakLevel: number;
  };
  rsi: {
    rsi15m: { value: number; regime: { label: string; color: string } };
    rsi1h: { value: number; regime: { label: string; color: string } };
    rsi4h: { value: number; regime: { label: string; color: string } };
    confluenceSignal: string;
  };
  okx: {
    connected: boolean;
    okxInstId: string;
    binanceFundingPct: number;
    okxFundingPct: number;
    fundingSpreadPct: number;
    priceBasisSpreadUsd: number;
  };
  apy: {
    binanceAnnualizedApy: number;
    okxAnnualizedApy: number;
    spreadAnnualizedApy: number;
    arbitrageRecommendation: string;
  };
  roi: {
    bias: "LONG" | "SHORT";
    plannedEntry: number;
    plannedSl: number;
    plannedTp: number;
    riskRewardRatio: number;
    baseUnleveragedRoiPct: number;
    baseRiskPct: number;
    mathematicalExpectancy: number;
    leverageTiers: {
      leverage: number;
      projectedRoiPct: number;
      projectedRiskPct: number;
    }[];
  };
}

interface InstitutionalProSuiteProps {
  symbol: string;
  currentPrice: number;
}

export const InstitutionalProSuite: React.FC<InstitutionalProSuiteProps> = ({
  symbol,
  currentPrice: propPrice,
}) => {
  const [data, setData] = useState<ProAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"CVD" | "SMC_FVG" | "RSI" | "OKX_APY" | "ROI">("CVD");
  const [selectedLeverage, setSelectedLeverage] = useState<number>(10);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const fetchProData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/market/pro-analytics?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json: ProAnalyticsResponse = await res.json();
      if (!json.success) throw new Error("Failed to load pro analytics data");
      setData(json);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error("Pro analytics fetch error:", err);
      setError(err.message || "Failed to query institutional analytics");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchProData();
    const interval = setInterval(fetchProData, 25_000);
    return () => clearInterval(interval);
  }, [fetchProData]);

  const formatMillions = (usd: number) => {
    if (!usd || usd === 0) return "$0";
    if (Math.abs(usd) >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
    if (Math.abs(usd) >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
    if (Math.abs(usd) >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const currentPrice = data?.currentPrice || propPrice || 0;

  // Active leverage calculation
  const currentLeverageTier = useMemo(() => {
    if (!data?.roi?.leverageTiers) return null;
    return (
      data.roi.leverageTiers.find((t) => t.leverage === selectedLeverage) ||
      data.roi.leverageTiers[2]
    );
  }, [data?.roi?.leverageTiers, selectedLeverage]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#0c1322] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ========================================================= */}
      {/* 1. HEADER & SUITE SELECTOR                                 */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/90 relative z-10">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Institutional Pro Suite
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-xs text-slate-400 font-medium font-mono">
              CVD • FVG • SMC • RSI • OKX • APY • ROI
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Smart Money & Order Flow Intelligence
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
              {symbol}
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
            Institutional order flow telemetry: Cumulative Volume Delta, Fair Value Gap imbalances, Smart Money Market Structure, cross-exchange OKX funding, and mathematical ROI expectancy.
          </p>
        </div>

        {/* Refresh & Status */}
        <div className="flex items-center gap-2 self-start lg:self-center">
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            Updated {lastRefreshedAt.toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={fetchProData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Pro Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. NAVIGATION TABS                                         */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center gap-2 relative z-10 border-b border-slate-800/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("CVD")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "CVD"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>CVD Order Flow</span>
          {data?.cvd?.divergence !== "NEUTRAL_ALIGNED" && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SMC_FVG")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "SMC_FVG"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>SMC & FVG Imbalance</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
            {data?.fvg?.unmitigatedCount || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RSI")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "RSI"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>RSI Momentum Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("OKX_APY")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "OKX_APY"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>OKX & APY Arbitrage</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400">
            {data?.apy?.binanceAnnualizedApy || 0}%
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ROI")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "ROI"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>ROI & Expectancy</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. TAB 1: CVD (CUMULATIVE VOLUME DELTA)                   */}
      {/* ========================================================= */}
      {activeTab === "CVD" && data?.cvd && (
        <div className="space-y-5 relative z-10">
          {/* Divergence Alert Banner */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              data.cvd.divergence === "BEARISH_ABSORPTION"
                ? "bg-rose-950/30 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                : data.cvd.divergence === "BULLISH_ABSORPTION"
                ? "bg-emerald-950/30 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl mt-0.5 ${
                  data.cvd.divergence === "BEARISH_ABSORPTION"
                    ? "bg-rose-500/20 text-rose-400"
                    : data.cvd.divergence === "BULLISH_ABSORPTION"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {data.cvd.divergence === "BEARISH_ABSORPTION" ? (
                  <TrendingDown className="w-5 h-5" />
                ) : data.cvd.divergence === "BULLISH_ABSORPTION" ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <Activity className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-mono">
                  Delta Divergence Telemetry
                </span>
                <h4 className="text-sm sm:text-base font-black text-white leading-snug">
                  {data.cvd.signalHeadline}
                </h4>
                <p className="text-xs text-slate-400">
                  {data.cvd.divergence === "BEARISH_ABSORPTION"
                    ? "Market buyers are executing aggressively, but price is failing to expand upward because institutional limit sell walls are absorbing all demand."
                    : data.cvd.divergence === "BULLISH_ABSORPTION"
                    ? "Market sellers are dumping into bids, but price refuses to collapse because institutional limit buy walls are soaking up inventory."
                    : "Taker market buy and sell volume matches price action normally without hidden absorption anomalies."}
                </p>
              </div>
            </div>
          </div>

          {/* CVD Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Total Aggressive Taker Buy
              </span>
              <div className="text-xl font-black font-mono num-tabular text-emerald-400">
                {formatMillions(data.cvd.totalTakerBuyUsd)}
              </div>
              <span className="text-[11px] text-slate-400 block">Market orders lifting asks</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Total Aggressive Taker Sell
              </span>
              <div className="text-xl font-black font-mono num-tabular text-rose-400">
                {formatMillions(data.cvd.totalTakerSellUsd)}
              </div>
              <span className="text-[11px] text-slate-400 block">Market orders hitting bids</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Net Volume Delta (Session)
              </span>
              <div
                className={`text-xl font-black font-mono num-tabular ${
                  data.cvd.netDeltaUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {data.cvd.netDeltaUsd >= 0 ? `+${formatMillions(data.cvd.netDeltaUsd)}` : formatMillions(data.cvd.netDeltaUsd)}
              </div>
              <span className="text-[11px] text-slate-400 block">
                {data.cvd.netDeltaUsd >= 0 ? "Net buying aggression" : "Net selling aggression"}
              </span>
            </div>
          </div>

          {/* Real Candle-by-Candle CVD Stream */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              15-Minute Candle Delta Stream (Latest 15 Intervals)
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
              {data.cvd.cvdSeries.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-center space-y-1 transition-all ${
                    item.isBuyerDominant
                      ? "bg-emerald-950/20 border-emerald-500/30"
                      : "bg-rose-950/20 border-rose-500/30"
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-400 block">{item.time}</span>
                  <div
                    className={`text-xs font-black font-mono num-tabular ${
                      item.isBuyerDominant ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {item.deltaUsd >= 0 ? `+${formatMillions(item.deltaUsd)}` : formatMillions(item.deltaUsd)}
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 block">
                    ${item.close.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. TAB 2: SMC & FVG (FAIR VALUE GAPS & ORDER BLOCKS)       */}
      {/* ========================================================= */}
      {activeTab === "SMC_FVG" && data && (
        <div className="space-y-5 relative z-10">
          {/* Market Structure & Key Liquidity Targets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                SMC Market Structure
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase font-mono border ${
                    data.smc.structureState === "BULLISH_EXPANSION"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  }`}
                >
                  {data.smc.structureState.replace("_", " ")}
                </span>
              </div>
              <span className="text-xs text-slate-400 block">
                {data.smc.structureState === "BULLISH_EXPANSION"
                  ? "Higher highs and higher lows confirming institutional accumulation."
                  : "Lower highs and lower lows confirming institutional distribution."}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                BSL (Buy-Side Liquidity Pool)
              </span>
              <div className="text-xl font-black font-mono num-tabular text-amber-400">
                ${data.smc.bslPrice.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 block">
                Retail short stops cluster here — prime sweep target
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                SSL (Sell-Side Liquidity Pool)
              </span>
              <div className="text-xl font-black font-mono num-tabular text-cyan-400">
                ${data.smc.sslPrice.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 block">
                Retail long stops cluster here — prime flush target
              </span>
            </div>
          </div>

          {/* Institutional Order Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Demand OB */}
            <div className="p-5 rounded-2xl bg-emerald-950/15 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Institutional Demand Order Block
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {data.smc.demandOrderBlock?.time}
                </span>
              </div>
              <div className="text-2xl font-black font-mono num-tabular text-white tracking-tight">
                ${data.smc.demandOrderBlock?.bottom.toLocaleString()} - $
                {data.smc.demandOrderBlock?.top.toLocaleString()}
              </div>
              <p className="text-xs text-slate-300">
                Origin of major upward expansion. Smart money heavily defends this zone on pullbacks.
              </p>
            </div>

            {/* Supply OB */}
            <div className="p-5 rounded-2xl bg-rose-950/15 border border-rose-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Institutional Supply Order Block
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {data.smc.supplyOrderBlock?.time}
                </span>
              </div>
              <div className="text-2xl font-black font-mono num-tabular text-white tracking-tight">
                ${data.smc.supplyOrderBlock?.bottom.toLocaleString()} - $
                {data.smc.supplyOrderBlock?.top.toLocaleString()}
              </div>
              <p className="text-xs text-slate-300">
                Origin of aggressive drop. Institutional sell orders rest in this zone.
              </p>
            </div>
          </div>

          {/* Unmitigated Fair Value Gaps (FVG) Map */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Unmitigated Fair Value Gaps (1h Imbalance Zones)
              </span>
              <span className="text-xs font-mono text-slate-400">
                {data.fvg.unmitigatedCount} active gap{data.fvg.unmitigatedCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.fvg.activeFvgs.map((fvg) => (
                <div
                  key={fvg.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    fvg.type === "BULLISH_FVG"
                      ? "bg-emerald-950/20 border-emerald-500/30"
                      : "bg-rose-950/20 border-rose-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded ${
                        fvg.type === "BULLISH_FVG"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {fvg.type === "BULLISH_FVG" ? "Bullish FVG" : "Bearish FVG"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{fvg.time}</span>
                  </div>

                  <div className="mt-2 text-sm font-black font-mono num-tabular text-white">
                    ${fvg.bottom.toLocaleString()} - ${fvg.top.toLocaleString()}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Gap: ${Math.round(fvg.sizeUsd).toLocaleString()} ({fvg.pct}%)</span>
                    <span
                      className={fvg.distancePct >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}
                    >
                      {fvg.distancePct >= 0 ? `+${fvg.distancePct}%` : `${fvg.distancePct}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TAB 3: RSI MOMENTUM MATRIX                              */}
      {/* ========================================================= */}
      {activeTab === "RSI" && data?.rsi && (
        <div className="space-y-5 relative z-10">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                Multi-Timeframe Confluence Signal
              </span>
              <h4 className="text-base font-black text-white mt-0.5">
                {data.rsi.confluenceSignal.replace(/_/g, " ")}
              </h4>
            </div>
            <span className="text-xs text-slate-400 max-w-sm text-right">
              Aligned momentum across 15m, 1h, and 4h periods filters out fake intraday chop.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 15m RSI */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  15-Minute Scalp RSI
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                    data.rsi.rsi15m.regime.color === "emerald"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : data.rsi.rsi15m.regime.color === "rose"
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {data.rsi.rsi15m.regime.label}
                </span>
              </div>
              <div className="text-3xl font-black font-mono num-tabular text-white">
                {data.rsi.rsi15m.value}
              </div>
              {/* Progress bar */}
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    data.rsi.rsi15m.value >= 70
                      ? "bg-rose-500"
                      : data.rsi.rsi15m.value <= 30
                      ? "bg-emerald-500"
                      : "bg-sky-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, data.rsi.rsi15m.value))}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 block">Short-term micro momentum</span>
            </div>

            {/* 1h RSI */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  1-Hour Intraday RSI
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                    data.rsi.rsi1h.regime.color === "emerald"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : data.rsi.rsi1h.regime.color === "rose"
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {data.rsi.rsi1h.regime.label}
                </span>
              </div>
              <div className="text-3xl font-black font-mono num-tabular text-white">
                {data.rsi.rsi1h.value}
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    data.rsi.rsi1h.value >= 70
                      ? "bg-rose-500"
                      : data.rsi.rsi1h.value <= 30
                      ? "bg-emerald-500"
                      : "bg-sky-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, data.rsi.rsi1h.value))}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 block">Primary trend conviction gauge</span>
            </div>

            {/* 4h RSI */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  4-Hour Macro RSI
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                    data.rsi.rsi4h.regime.color === "emerald"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : data.rsi.rsi4h.regime.color === "rose"
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {data.rsi.rsi4h.regime.label}
                </span>
              </div>
              <div className="text-3xl font-black font-mono num-tabular text-white">
                {data.rsi.rsi4h.value}
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    data.rsi.rsi4h.value >= 70
                      ? "bg-rose-500"
                      : data.rsi.rsi4h.value <= 30
                      ? "bg-emerald-500"
                      : "bg-sky-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, data.rsi.rsi4h.value))}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 block">Structural institutional bias</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. TAB 4: OKX & APY FUNDING ARBITRAGE                      */}
      {/* ========================================================= */}
      {activeTab === "OKX_APY" && data && (
        <div className="space-y-5 relative z-10">
          {/* Arbitrage Recommendation Card */}
          <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4" />
              Annualized Yield & Arbitrage Blueprint
            </span>
            <p className="text-sm font-semibold text-white leading-relaxed">
              {data.apy.arbitrageRecommendation}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Binance Perp Funding & APY */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Binance Futures 8h Funding
              </span>
              <div className="text-2xl font-black font-mono num-tabular text-white">
                {data.okx.binanceFundingPct >= 0
                  ? `+${data.okx.binanceFundingPct.toFixed(4)}%`
                  : `${data.okx.binanceFundingPct.toFixed(4)}%`}
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Annualized APY:</span>
                <span className="text-emerald-400 font-bold font-mono num-tabular">
                  {data.apy.binanceAnnualizedApy}%
                </span>
              </div>
            </div>

            {/* OKX Swap Funding & APY */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                OKX Swap 8h Funding
              </span>
              <div className="text-2xl font-black font-mono num-tabular text-white">
                {data.okx.okxFundingPct >= 0
                  ? `+${data.okx.okxFundingPct.toFixed(4)}%`
                  : `${data.okx.okxFundingPct.toFixed(4)}%`}
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Annualized APY:</span>
                <span className="text-emerald-400 font-bold font-mono num-tabular">
                  {data.apy.okxAnnualizedApy}%
                </span>
              </div>
            </div>

            {/* Spread & Basis Arbitrage */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Cross-Exchange Spread
              </span>
              <div className="text-2xl font-black font-mono num-tabular text-purple-400">
                {data.okx.fundingSpreadPct >= 0
                  ? `+${data.okx.fundingSpreadPct.toFixed(4)}%`
                  : `${data.okx.fundingSpreadPct.toFixed(4)}%`}
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Price Basis:</span>
                <span className="text-slate-200 font-bold font-mono num-tabular">
                  ${data.okx.priceBasisSpreadUsd}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. TAB 5: ROI & TRADE EXPECTANCY CALCULATOR                */}
      {/* ========================================================= */}
      {activeTab === "ROI" && data?.roi && (
        <div className="space-y-5 relative z-10">
          {/* Header setup review */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase font-mono border ${
                    data.roi.bias === "LONG"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  }`}
                >
                  SMC Plan: {data.roi.bias}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Risk-to-Reward: <strong className="text-white">1:{data.roi.riskRewardRatio}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono num-tabular pt-1">
                <span>Entry: <strong className="text-white">${data.roi.plannedEntry.toLocaleString()}</strong></span>
                <span>Stop-Loss: <strong className="text-rose-400">${data.roi.plannedSl.toLocaleString()}</strong></span>
                <span>Target: <strong className="text-emerald-400">${data.roi.plannedTp.toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Leverage Selector Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold px-2 uppercase">Leverage:</span>
              {[1, 5, 10, 20].map((lev) => (
                <button
                  key={lev}
                  type="button"
                  onClick={() => setSelectedLeverage(lev)}
                  className={`px-3 py-1 rounded-lg text-xs font-black font-mono transition-all cursor-pointer ${
                    selectedLeverage === lev
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          {/* Big ROI & Expectancy Display */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
                Projected Net ROI ({selectedLeverage}x Leverage)
              </span>
              <div className="text-3xl font-black font-mono num-tabular text-emerald-400 tracking-tight">
                +{currentLeverageTier?.projectedRoiPct || 0}%
              </div>
              <span className="text-xs text-slate-300 block">
                Targeting major liquidity pool sweep
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/40 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 block">
                Maximum Risk at Stop ({selectedLeverage}x Leverage)
              </span>
              <div className="text-3xl font-black font-mono num-tabular text-rose-400 tracking-tight">
                -{currentLeverageTier?.projectedRiskPct || 0}%
              </div>
              <span className="text-xs text-slate-300 block">
                Invalidation beyond institutional order block
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/40 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 block">
                Mathematical Expectancy (EV)
              </span>
              <div className="text-3xl font-black font-mono num-tabular text-purple-300 tracking-tight">
                +{data.roi.mathematicalExpectancy}%
              </div>
              <span className="text-xs text-slate-300 block">
                Positive statistical edge per trade
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
