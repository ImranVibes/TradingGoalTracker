"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  Crosshair,
  ExternalLink,
  Flame,
  Globe,
  HelpCircle,
  Info,
  Layers,
  Radio,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

interface MacroIntelligenceResponse {
  success: boolean;
  symbol: string;
  binancePrice: number;
  fearGreed: {
    score: number;
    classification: string;
    yesterdayScore: number;
    lastWeekScore: number;
    trend: string;
    interpretation: string;
  };
  crossExchange: {
    highestQuote: { exchange: string; price: number } | null;
    lowestQuote: { exchange: string; price: number } | null;
    maxSpreadUsd: number;
    maxSpreadPct: number;
    quotes: {
      exchange: string;
      price: number;
      volume24hUsd: number;
      fundingRate8hPct?: number;
      spreadVsBinanceUsd: number;
      spreadVsBinancePct: number;
      status: string;
      note?: string;
    }[];
  };
  btcCorrelation: {
    btc24hPct: number;
    avgAlt24hPct: number;
    relativeStrengthSpread: number;
    strengthScore: number;
    regime: string;
    regimeHeadline: string;
    tacticalAdvice: string;
    altBasket: { symbol: string; change24hPct: number; spreadVsBtcPct: number }[];
  };
  anomalies: {
    id: string;
    severity: "CRITICAL" | "ELEVATED" | "INFO";
    type: string;
    title: string;
    description: string;
    metric: string;
  }[];
  forwardForecast: {
    timeHorizon: string;
    primaryScenario: string;
    probabilityPct: number;
    predictedDirection: string;
    targetPriceMagnet: number;
    invalidationPrice: number;
    thesisReasoning: string;
    proTraderRule: string;
  };
}

interface MacroMarketIntelligenceProps {
  symbol: string;
  currentPrice: number;
}

export const MacroMarketIntelligence: React.FC<MacroMarketIntelligenceProps> = ({
  symbol,
  currentPrice: initialPrice,
}) => {
  const [data, setData] = useState<MacroIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"FORECAST" | "ANOMALIES" | "CROSS_EXCHANGE" | "BTC_CORRELATION">("FORECAST");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const fetchMacroData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/market/macro-intelligence?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MacroIntelligenceResponse = await res.json();
      if (!json.success) throw new Error("Failed to load macro intelligence data");
      setData(json);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error("Macro intelligence fetch error:", err);
      setError(err.message || "Failed to query macro intelligence");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchMacroData();
    const interval = setInterval(fetchMacroData, 30_000);
    return () => clearInterval(interval);
  }, [fetchMacroData]);

  const formatMillions = (usd: number) => {
    if (!usd || usd === 0) return "$0";
    if (Math.abs(usd) >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
    if (Math.abs(usd) >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
    if (Math.abs(usd) >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const currentPrice = data?.binancePrice || initialPrice || 0;

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#0c1322] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ========================================================= */}
      {/* 1. HEADER & GLOBAL TELEMETRY SUMMARY                       */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/90 relative z-10">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Macro Market Intelligence
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-xs text-slate-400 font-medium font-mono">
              1h-4h Predictive Engine • Anomaly Radar • Cross-Exchange Matrix • BTC Correlation
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Forward Outlook & Institutional Telemetry
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
              {symbol}
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
            Synthesizes historical market structure, order book liquidity sweeps, multi-exchange prices, and Bitcoin-to-altcoin capital flow to forecast high-probability 1h–4h market trajectory.
          </p>
        </div>

        {/* Global Fear & Greed Mini Pill */}
        <div className="flex items-center gap-3 self-start lg:self-center">
          {data?.fearGreed && (
            <div className="px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2.5">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block font-mono">
                  Fear & Greed
                </span>
                <span className="text-xs font-black text-white">
                  {data.fearGreed.classification} ({data.fearGreed.score}/100)
                </span>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  data.fearGreed.score <= 25
                    ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                    : data.fearGreed.score >= 75
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                }`}
              />
            </div>
          )}

          <button
            type="button"
            onClick={fetchMacroData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Macro Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. NAVIGATION TABS                                         */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center gap-2 relative z-10 border-b border-slate-800/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("FORECAST")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "FORECAST"
              ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Crosshair className="w-4 h-4" />
          <span>1h–4h Predictive Outlook</span>
          {data?.forwardForecast && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950/60 text-amber-300 font-bold">
              {data.forwardForecast.probabilityPct}%
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ANOMALIES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "ANOMALIES"
              ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Market Anomaly Detector</span>
          {data?.anomalies && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                data.anomalies.some((a) => a.severity === "CRITICAL")
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {data.anomalies.filter((a) => a.severity !== "INFO").length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CROSS_EXCHANGE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "CROSS_EXCHANGE"
              ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Cross-Exchange Monitor</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-sky-400">
            {data?.crossExchange?.quotes?.length || 0} Exchanges
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("BTC_CORRELATION")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "BTC_CORRELATION"
              ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>BTC Correlation & Altcoin Score</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. TAB 1: 1H-4H PREDICTIVE FORWARD OUTLOOK                 */}
      {/* ========================================================= */}
      {activeTab === "FORECAST" && data?.forwardForecast && (
        <div className="space-y-5 relative z-10">
          <div
            className={`p-6 sm:p-7 rounded-2xl border transition-all ${
              data.forwardForecast.predictedDirection === "BULLISH_REVERSAL"
                ? "bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.12)]"
                : data.forwardForecast.predictedDirection === "BEARISH_PULLBACK"
                ? "bg-rose-950/20 border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.12)]"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider font-mono border ${
                      data.forwardForecast.predictedDirection === "BULLISH_REVERSAL"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : data.forwardForecast.predictedDirection === "BEARISH_PULLBACK"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {data.forwardForecast.predictedDirection.replace(/_/g, " ")}
                  </span>

                  <span className="text-xs font-mono font-bold text-amber-400 px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    Confidence: {data.forwardForecast.probabilityPct}% Probability
                  </span>

                  <span className="text-slate-500 text-xs">•</span>
                  <span className="text-xs text-slate-400 font-mono">{data.forwardForecast.timeHorizon}</span>
                </div>

                <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                  {data.forwardForecast.primaryScenario}
                </h4>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  {data.forwardForecast.thesisReasoning}
                </p>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                  <strong className="text-amber-300 uppercase tracking-wider block font-bold text-[11px] mb-0.5">
                    Professional Trader Execution Rule:
                  </strong>
                  {data.forwardForecast.proTraderRule}
                </div>
              </div>

              {/* Price Targets & Invalidation Box */}
              <div className="min-w-[260px] p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5 self-stretch lg:self-auto flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                  Forward Trajectory Blueprint
                </span>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 block">Primary Target Magnet:</span>
                  <div className="text-2xl font-black font-mono num-tabular text-emerald-400">
                    ${data.forwardForecast.targetPriceMagnet.toLocaleString()}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {data.forwardForecast.targetPriceMagnet > currentPrice ? "Upper Liquidity Pool" : "Lower Demand Imbalance"}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block">Thesis Invalidation Level:</span>
                  <div className="text-lg font-black font-mono num-tabular text-rose-400">
                    ${data.forwardForecast.invalidationPrice.toLocaleString()}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    1h close beyond this invalidates scenario
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. TAB 2: MARKET ANOMALY DETECTOR                          */}
      {/* ========================================================= */}
      {activeTab === "ANOMALIES" && data?.anomalies && (
        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Active Market Anomalies Detected ({data.anomalies.length})
            </span>
            <span className="text-xs font-mono text-slate-400">
              Scans volume spikes, funding traps, and cross-exchange price breaks
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.anomalies.map((anom) => (
              <div
                key={anom.id}
                className={`p-5 rounded-2xl border transition-all space-y-2.5 ${
                  anom.severity === "CRITICAL"
                    ? "bg-rose-950/20 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                    : anom.severity === "ELEVATED"
                    ? "bg-amber-950/20 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    : "bg-slate-950/70 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono border ${
                      anom.severity === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : anom.severity === "ELEVATED"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {anom.severity} ANOMALY
                  </span>

                  <span className="text-xs font-mono font-bold text-slate-300">
                    {anom.metric}
                  </span>
                </div>

                <h4 className="text-base font-black text-white">{anom.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{anom.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TAB 3: CROSS-EXCHANGE LIVE MONITOR                      */}
      {/* ========================================================= */}
      {activeTab === "CROSS_EXCHANGE" && data?.crossExchange && (
        <div className="space-y-4 relative z-10">
          {/* Arbitrage Banner */}
          {data.crossExchange.maxSpreadPct >= 0.15 && (
            <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Scale className="w-5 h-5 text-sky-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-slate-200">
                  Cross-Exchange Arbitrage Spread:{" "}
                  <strong className="text-sky-300 font-mono num-tabular">
                    {data.crossExchange.maxSpreadPct}% (${data.crossExchange.maxSpreadUsd.toFixed(2)})
                  </strong>{" "}
                  between {data.crossExchange.lowestQuote?.exchange} and {data.crossExchange.highestQuote?.exchange}.
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                Real-Time Parity Watch
              </span>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 tracking-wider font-mono">
                <tr>
                  <th className="py-3 px-4">Exchange</th>
                  <th className="py-3 px-4">Live Price (USD)</th>
                  <th className="py-3 px-4">Spread vs Binance</th>
                  <th className="py-3 px-4">8h Funding Rate</th>
                  <th className="py-3 px-4">24h Volume</th>
                  <th className="py-3 px-4">Parity Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono num-tabular">
                {data.crossExchange.quotes.map((q) => (
                  <tr key={q.exchange} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-bold font-sans text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {q.exchange}
                    </td>
                    <td className="py-3 px-4 text-sm font-black text-white">
                      ${q.price.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {q.exchange === "Binance" ? (
                        <span className="text-slate-500 font-bold">Benchmark (0.00%)</span>
                      ) : (
                        <span
                          className={`font-bold ${
                            q.spreadVsBinancePct > 0
                              ? "text-rose-400"
                              : q.spreadVsBinancePct < 0
                              ? "text-emerald-400"
                              : "text-slate-400"
                          }`}
                        >
                          {q.spreadVsBinancePct > 0 ? `+${q.spreadVsBinancePct}%` : `${q.spreadVsBinancePct}%`} ($
                          {q.spreadVsBinanceUsd})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {q.fundingRate8hPct !== undefined ? (
                        <span
                          className={`font-bold ${
                            q.fundingRate8hPct >= 0 ? "text-slate-300" : "text-amber-400"
                          }`}
                        >
                          {q.fundingRate8hPct >= 0
                            ? `+${q.fundingRate8hPct.toFixed(4)}%`
                            : `${q.fundingRate8hPct.toFixed(4)}%`}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{formatMillions(q.volume24hUsd)}</td>
                    <td className="py-3 px-4 font-sans text-xs">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          q.status === "DEVIATION"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {q.note || "Aligned"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. TAB 4: BTC CORRELATION & ALTCOIN STRENGTH               */}
      {/* ========================================================= */}
      {activeTab === "BTC_CORRELATION" && data?.btcCorrelation && (
        <div className="space-y-5 relative z-10">
          {/* Executive Regime Banner */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">
                  Market Capital Flow Regime
                </span>
                <h4 className="text-lg font-black text-white">
                  {data.btcCorrelation.regimeHeadline}
                </h4>
                <p className="text-xs text-slate-300">
                  <strong className="text-white">Tactical Advice:</strong> {data.btcCorrelation.tacticalAdvice}
                </p>
              </div>

              {/* Altcoin Strength Score Gauge */}
              <div className="min-w-[200px] p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 flex flex-col justify-center">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Altcoin Strength</span>
                  <span
                    className={`font-mono font-black ${
                      data.btcCorrelation.strengthScore >= 60
                        ? "text-emerald-400"
                        : data.btcCorrelation.strengthScore <= 40
                        ? "text-rose-400"
                        : "text-amber-400"
                    }`}
                  >
                    {data.btcCorrelation.strengthScore}/100
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      data.btcCorrelation.strengthScore >= 60
                        ? "bg-emerald-500"
                        : data.btcCorrelation.strengthScore <= 40
                        ? "bg-rose-500"
                        : "bg-amber-400"
                    }`}
                    style={{ width: `${data.btcCorrelation.strengthScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  {data.btcCorrelation.strengthScore <= 40
                    ? "Altcoins Weak / High Beta Risk"
                    : data.btcCorrelation.strengthScore >= 60
                    ? "Altcoin Outperformance Active"
                    : "Balanced Lockstep Correlation"}
                </span>
              </div>
            </div>
          </div>

          {/* Individual Altcoin vs BTC Performance Matrix */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              24h Performance vs Bitcoin (BTC: {data.btcCorrelation.btc24hPct >= 0 ? `+${data.btcCorrelation.btc24hPct}%` : `${data.btcCorrelation.btc24hPct}%`})
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {data.btcCorrelation.altBasket.map((coin) => (
                <div
                  key={coin.symbol}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center space-y-1 font-mono num-tabular"
                >
                  <span className="text-xs font-bold text-slate-300 block font-sans">
                    {coin.symbol.replace("USDT", "")}
                  </span>
                  <div
                    className={`text-sm font-black ${
                      coin.change24hPct >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {coin.change24hPct >= 0 ? `+${coin.change24hPct}%` : `${coin.change24hPct}%`}
                  </div>
                  <span
                    className={`text-[10px] block ${
                      coin.spreadVsBtcPct >= 0 ? "text-emerald-300 font-bold" : "text-slate-400"
                    }`}
                  >
                    vs BTC: {coin.spreadVsBtcPct >= 0 ? `+${coin.spreadVsBtcPct}%` : `${coin.spreadVsBtcPct}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
