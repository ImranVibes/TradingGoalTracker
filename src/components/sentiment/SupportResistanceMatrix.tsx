"use client";

import React from "react";
import {
  Layers,
  Activity,
  BarChart2,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Zap,
  Target,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface SupportResistanceLevel {
  price: number;
  type: "SUPPORT" | "RESISTANCE";
  strength: "ULTRA_STRONG" | "STRONG" | "MODERATE";
  sources: string[];
  touchCount: number;
  distancePct: number;
}

interface SupportResistanceMatrixProps {
  currentPrice: number;
  symbol: string;
  data: {
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
      bandwidthPct: number;
      percentB: number;
      isSqueeze: boolean;
    } | null;
    volumeProfile: {
      poc: number;
      vah: number;
      val: number;
      totalVolume: number;
      profileBins: { price: number; volume: number; isPOC: boolean; inValueArea: boolean }[];
    } | null;
    superTrend: {
      value: number;
      direction: "BULLISH" | "BEARISH";
    } | null;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
      cross: string;
    } | null;
    rsi14: number | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    confluenceSR: {
      supportLadder: SupportResistanceLevel[];
      resistanceLadder: SupportResistanceLevel[];
      nearestSupport: SupportResistanceLevel | null;
      nearestResistance: SupportResistanceLevel | null;
      rangeLocation: string;
    } | null;
  } | null;
}

export const SupportResistanceMatrix: React.FC<SupportResistanceMatrixProps> = ({
  currentPrice,
  symbol,
  data,
}) => {
  if (!data) return null;

  const { bollinger, volumeProfile, superTrend, macd, rsi14, ema20, ema50, ema200, confluenceSR } = data;

  const getStrengthBadge = (strength: SupportResistanceLevel["strength"]) => {
    switch (strength) {
      case "ULTRA_STRONG":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "STRONG":
        return "bg-sky-500/20 text-sky-300 border-sky-500/40";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            Automated Support &amp; Resistance Confluence Ladder
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real multi-touch swing pivots, Bollinger Bands volatility boundaries, Volume Profile POC, and live order book walls
          </p>
        </div>

        {confluenceSR?.rangeLocation && (
          <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span>{confluenceSR.rangeLocation}</span>
          </div>
        )}
      </div>

      {/* S/R Price Ladder & Proximity Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Visual Ladder */}
        <div className="lg:col-span-7 space-y-2">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Level &amp; Type</span>
            <span>Confluence Sources &amp; Strength</span>
          </div>

          {/* Resistances (Top to Bottom, closest to current price last) */}
          <div className="space-y-1.5">
            {confluenceSR?.resistanceLadder
              .slice(0, 3)
              .reverse()
              .map((res, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/40 flex items-center justify-between gap-3 text-xs hover:border-rose-700/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-[10px] font-mono">
                      R{confluenceSR.resistanceLadder.length - idx}
                    </span>
                    <div>
                      <div className="font-mono font-bold text-rose-300">
                        ${res.price.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-rose-400/80 font-mono">
                        +{res.distancePct}% above current
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[60%]">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getStrengthBadge(res.strength)}`}>
                      {res.strength.replace("_", " ")}
                    </span>
                    {res.sources.map((src, sIdx) => (
                      <span
                        key={sIdx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 truncate"
                        title={src}
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {/* CURRENT MARKET PRICE BAR */}
          <div className="p-3 rounded-xl bg-slate-900 border-2 border-sky-500/50 shadow-md shadow-sky-500/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Current Market Price
                </span>
                <div className="text-base font-black font-mono text-white">
                  ${currentPrice.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] font-mono">
              {confluenceSR?.nearestResistance && (
                <div className="text-rose-400">
                  Next R: ${confluenceSR.nearestResistance.price.toLocaleString()} (+{confluenceSR.nearestResistance.distancePct}%)
                </div>
              )}
              {confluenceSR?.nearestSupport && (
                <div className="text-emerald-400">
                  Next S: ${confluenceSR.nearestSupport.price.toLocaleString()} ({confluenceSR.nearestSupport.distancePct}%)
                </div>
              )}
            </div>
          </div>

          {/* Supports (Nearest to furthest down) */}
          <div className="space-y-1.5">
            {confluenceSR?.supportLadder.slice(0, 3).map((sup, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex items-center justify-between gap-3 text-xs hover:border-emerald-700/60 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-[10px] font-mono">
                    S{idx + 1}
                  </span>
                  <div>
                    <div className="font-mono font-bold text-emerald-300">
                      ${sup.price.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-400/80 font-mono">
                      {sup.distancePct}% below current
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[60%]">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getStrengthBadge(sup.strength)}`}>
                    {sup.strength.replace("_", " ")}
                  </span>
                  {sup.sources.map((src, sIdx) => (
                    <span
                      key={sIdx}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 truncate"
                      title={src}
                    >
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indicators Breakdown: Bollinger Bands + Volume Profile + Momentum */}
        <div className="lg:col-span-5 space-y-3">
          {/* Bollinger Bands Panel */}
          {bollinger && (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  Bollinger Bands (20, 2)
                </span>
                {bollinger.isSqueeze ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400 animate-pulse" /> Squeeze Coiled
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">
                    Bandwidth: {bollinger.bandwidthPct}%
                  </span>
                )}
              </div>

              {/* %B Relative Position Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Lower: ${bollinger.lower.toLocaleString()}</span>
                  <span className="text-sky-300 font-semibold">%B: {(bollinger.percentB * 100).toFixed(0)}%</span>
                  <span>Upper: ${bollinger.upper.toLocaleString()}</span>
                </div>
                <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-sky-400 to-rose-500 rounded-full transition-all"
                    style={{ width: `${Math.max(5, Math.min(95, bollinger.percentB * 100))}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 text-center font-mono">
                  20 SMA Mean Pivot: <strong className="text-slate-200">${bollinger.middle.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Volume Profile Panel */}
          {volumeProfile && volumeProfile.poc > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
                  Volume Profile (Fixed Range)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Total Vol: {volumeProfile.totalVolume.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block">VAL (70% Low)</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ${volumeProfile.val.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[9px] uppercase tracking-wider text-amber-300 block font-bold">POC (Control)</span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    ${volumeProfile.poc.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block">VAH (70% High)</span>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    ${volumeProfile.vah.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Mini Profile Visualization */}
              <div className="flex items-end gap-0.5 h-8 pt-1">
                {volumeProfile.profileBins.slice(0, 36).map((bin, bIdx) => (
                  <div
                    key={bIdx}
                    className={`flex-1 rounded-xs transition-all ${
                      bin.isPOC
                        ? "bg-amber-400 h-full shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                        : bin.inValueArea
                        ? "bg-sky-500/60 h-[70%]"
                        : "bg-slate-700/50 h-[35%]"
                    }`}
                    title={`$${bin.price.toLocaleString()} - Vol ${bin.volume}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SuperTrend, MACD, and EMA Ribbon Summary */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                SuperTrend (10, 3)
              </span>
              {superTrend ? (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-black font-mono ${
                      superTrend.direction === "BULLISH" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {superTrend.direction}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (${superTrend.value.toLocaleString()})
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 font-mono">Calculating...</span>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                MACD (12, 26, 9)
              </span>
              {macd ? (
                <div className="flex items-center gap-1.5 font-mono">
                  <span
                    className={`font-black ${
                      macd.histogram >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {macd.cross.replace(/_/g, " ")}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 font-mono">Calculating...</span>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                RSI (14) Momentum
              </span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-white font-bold">{rsi14 ?? 50}</span>
                <span
                  className={`text-[10px] font-semibold ${
                    (rsi14 ?? 50) >= 70
                      ? "text-rose-400"
                      : (rsi14 ?? 50) <= 30
                      ? "text-emerald-400"
                      : "text-slate-400"
                  }`}
                >
                  {(rsi14 ?? 50) >= 70 ? "Overbought" : (rsi14 ?? 50) <= 30 ? "Oversold" : "Neutral"}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                4H EMA Alignment
              </span>
              <div className="text-[10px] font-mono text-slate-300">
                {ema20 && ema50 ? (
                  ema20 > ema50 ? (
                    <span className="text-emerald-400 font-bold">20 &gt; 50 (Bullish)</span>
                  ) : (
                    <span className="text-rose-400 font-bold">20 &lt; 50 (Bearish)</span>
                  )
                ) : (
                  "Aligned"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
