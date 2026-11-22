"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  TrendingDown,
  TrendingUp,
  Activity,
  Layers,
  Bot,
  Copy,
  Check,
  ExternalLink,
  Zap,
  Globe,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  Scale,
} from "lucide-react";
import { MarketMakerFlowResult } from "@/lib/marketMakerFlow";

interface MarketMakerSentinelProps {
  flow: MarketMakerFlowResult | null;
  symbol: string;
  currentPrice: number;
}

export const MarketMakerSentinel: React.FC<MarketMakerSentinelProps> = ({
  flow,
  symbol,
  currentPrice,
}) => {
  const [copied, setCopied] = useState(false);

  if (!flow) return null;

  const {
    intelligence,
    marketMakerState,
    stateTitle,
    beginnerVerdict,
    smartMoneyMetrics,
    aiPromptDigest,
  } = flow;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiPromptDigest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeStyle = () => {
    switch (beginnerVerdict.actionBadgeColor) {
      case "emerald":
        return {
          card: "bg-emerald-950/25 border-emerald-500/40",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          text: "text-emerald-400",
          icon: TrendingUp,
        };
      case "rose":
        return {
          card: "bg-rose-950/25 border-rose-500/40",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          text: "text-rose-400",
          icon: TrendingDown,
        };
      case "purple":
        return {
          card: "bg-purple-950/25 border-purple-500/40",
          badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          text: "text-purple-400",
          icon: Compass,
        };
      default:
        return {
          card: "bg-amber-950/25 border-amber-500/40",
          badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          text: "text-amber-400",
          icon: Activity,
        };
    }
  };

  const style = getBadgeStyle();
  const ActionIcon = style.icon;

  const formatMillions = (usd: number) => {
    if (!usd || usd <= 0) return "$0";
    if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
    if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
    if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
    return `$${usd.toFixed(0)}`;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-5 shadow-2xl">
      {/* Header with Live Status Alert */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Market Maker &amp; Cross-Exchange Whale Sentinel
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 border border-orange-500/30 text-orange-300">
                Institutional Flow
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Real-time intelligence from 5 Tier-1 derivatives exchanges, Deribit Options &amp; Upbit Korea Arbitrage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
              marketMakerState === "WHALE_DUMP_ALERT"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                : marketMakerState === "INSTITUTIONAL_ACCUMULATION"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : marketMakerState === "SHORT_SQUEEZE_FUEL"
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                : marketMakerState === "OPTIONS_GRAVITY_PULL"
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}
          >
            {stateTitle}
          </span>
        </div>
      </div>

      {/* Beginner-Friendly Action Decision Card */}
      <div className={`p-4 rounded-xl border ${style.card} space-y-3.5 shadow-lg`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border ${style.badge}`}>
              <ActionIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Beginner Action Directive
              </span>
              <span className={`text-base font-black tracking-wide ${style.text}`}>
                {beginnerVerdict.actionHeadline}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-slate-400">Risk Tier:</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                beginnerVerdict.riskTier === "HIGH" || beginnerVerdict.riskTier === "EXTREME"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  : beginnerVerdict.riskTier === "MODERATE"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              }`}
            >
              {beginnerVerdict.riskTier} RISK
            </span>
          </div>
        </div>

        {/* Plain English "Why" explanation */}
        <p className="text-xs text-slate-200 leading-relaxed font-medium bg-slate-950/70 border border-slate-800 rounded-xl p-3 shadow-inner">
          <strong className="text-white block mb-0.5">What is happening in plain English:</strong>
          {beginnerVerdict.plainEnglishWhy}
        </p>

        {/* Rules and Entry/Exit Guidance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Golden Rule
            </span>
            <span className="text-[11px] text-slate-300 font-medium leading-tight block">
              {beginnerVerdict.goldenRule}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Optimal Entry Zone
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 block">
              {beginnerVerdict.suggestedEntryRange}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Safety Stop-Loss Price
            </span>
            <span className="text-xs font-mono font-bold text-rose-400 block">
              {beginnerVerdict.suggestedStopLoss}
            </span>
          </div>
        </div>
      </div>

      {/* Cross-Exchange Open Interest (5 Tier-1 Exchanges) */}
      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            5 Tier-1 Exchanges Futures Open Interest (Global Leverage Monitor)
          </span>
          <span className="font-mono text-white text-xs">
            Total Monitored Leverage:{" "}
            <strong className="text-sky-400 font-black">
              {formatMillions(intelligence.totalMonitoredOiUsd)}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* 1. Binance */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
                Binance
              </span>
              {intelligence.binance.change24hPct !== undefined && (
                <span
                  className={`text-[10px] font-mono font-bold ${
                    intelligence.binance.change24hPct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {intelligence.binance.change24hPct >= 0 ? "+" : ""}
                  {intelligence.binance.change24hPct}%
                </span>
              )}
            </div>
            <div className="text-sm font-black font-mono text-white">
              {formatMillions(intelligence.binance.oiUsd)}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {intelligence.binance.identifier || symbol}
            </div>
          </div>

          {/* 2. OKX */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50"></span>
                OKX Swap
              </span>
              <span className="text-[9px] font-mono text-slate-400 truncate max-w-[65px]">
                {intelligence.okx.identifier ? "Linked" : "No Swap"}
              </span>
            </div>
            <div className="text-sm font-black font-mono text-white">
              {intelligence.okx.oiUsd > 0 ? formatMillions(intelligence.okx.oiUsd) : "Tracking"}
            </div>
            <div className="text-[10px] text-slate-400 truncate font-mono">
              {intelligence.okx.oiContracts > 0
                ? `${intelligence.okx.oiContracts.toLocaleString()} c`
                : "Active pool"}
            </div>
          </div>

          {/* 3. Bybit */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 shadow-sm shadow-orange-400/50"></span>
                Bybit Linear
              </span>
              <span className="text-[9px] font-mono text-slate-400 truncate max-w-[65px]">
                {intelligence.bybit.identifier ? "Linked" : "No Perp"}
              </span>
            </div>
            <div className="text-sm font-black font-mono text-white">
              {intelligence.bybit.oiUsd > 0 ? formatMillions(intelligence.bybit.oiUsd) : "Tracking"}
            </div>
            <div className="text-[10px] text-slate-400 truncate font-mono">
              {intelligence.bybit.oiContracts > 0
                ? `${intelligence.bybit.oiContracts.toLocaleString()} c`
                : "Perp linear"}
            </div>
          </div>

          {/* 4. Bitget */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
                Bitget Mix
              </span>
              <span className="text-[9px] font-mono text-slate-400 truncate max-w-[65px]">
                {intelligence.bitget.identifier ? "Linked" : "No Perp"}
              </span>
            </div>
            <div className="text-sm font-black font-mono text-white">
              {intelligence.bitget.oiUsd > 0 ? formatMillions(intelligence.bitget.oiUsd) : "Tracking"}
            </div>
            <div className="text-[10px] text-slate-400 truncate font-mono">
              {intelligence.bitget.oiContracts > 0
                ? `${intelligence.bitget.oiContracts.toLocaleString()} c`
                : "Futures pool"}
            </div>
          </div>

          {/* 5. Gate.io */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
                Gate.io
              </span>
              <span className="text-[9px] font-mono text-slate-400 truncate max-w-[65px]">
                {intelligence.gate.identifier ? "Linked" : "No Perp"}
              </span>
            </div>
            <div className="text-sm font-black font-mono text-white">
              {intelligence.gate.oiUsd > 0 ? formatMillions(intelligence.gate.oiUsd) : "Tracking"}
            </div>
            <div className="text-[10px] text-slate-400 truncate font-mono">
              {intelligence.gate.oiContracts > 0
                ? `${intelligence.gate.oiContracts.toLocaleString()} c`
                : "USDT contract"}
            </div>
          </div>
        </div>
      </div>

      {/* Specialized Institutional Panels: Deribit Options & Upbit Korea Arbitrage */}
      {(intelligence.options || intelligence.upbit) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Deribit Institutional Options Card */}
          {intelligence.options && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">
                    Deribit Institutional Options ({intelligence.options.currency})
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    intelligence.options.sentiment === "BULLISH_CALL_DOMINANT"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : intelligence.options.sentiment === "BEARISH_PUT_HEDGING"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {intelligence.options.sentiment.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Max Pain Strike (MM Magnet)
                  </span>
                  <div className="text-sm font-black font-mono text-purple-300 flex items-center gap-1.5 mt-0.5">
                    ${intelligence.options.maxPainPrice.toLocaleString()}
                    <span
                      className={`text-[10px] font-bold ${
                        intelligence.options.maxPainDistancePct >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      ({intelligence.options.maxPainDistancePct >= 0 ? "+" : ""}
                      {intelligence.options.maxPainDistancePct}%)
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    Strike where MM options payout is minimized
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Put / Call Volume Ratio
                  </span>
                  <div className="text-sm font-black font-mono text-white flex items-center gap-1.5 mt-0.5">
                    {intelligence.options.putCallRatio}
                    <span className="text-[10px] font-normal text-slate-400">
                      ({intelligence.options.totalPutVolume.toLocaleString()} P /{" "}
                      {intelligence.options.totalCallVolume.toLocaleString()} C)
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    {intelligence.options.putCallRatio > 1.0
                      ? "Institutions buying put hedges"
                      : "Aggressive bullish call flow"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Upbit South Korea Kimchi Premium Card */}
          {intelligence.upbit && (
            <div className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">
                    Upbit Korea Spot &amp; Kimchi Premium Spread
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    intelligence.upbit.signal === "EXTREME_RETAIL_FOMO"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                      : intelligence.upbit.signal === "MODERATE_PREMIUM"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : intelligence.upbit.signal === "PANIC_DISCOUNT"
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {intelligence.upbit.signal.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Kimchi Premium Spread
                  </span>
                  <div
                    className={`text-sm font-black font-mono flex items-center gap-1.5 mt-0.5 ${
                      intelligence.upbit.kimchiPremiumPct >= 0 ? "text-amber-300" : "text-sky-300"
                    }`}
                  >
                    {intelligence.upbit.kimchiPremiumPct >= 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-sky-400" />
                    )}
                    {intelligence.upbit.kimchiPremiumPct >= 0 ? "+" : ""}
                    {intelligence.upbit.kimchiPremiumPct}%
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    {intelligence.upbit.kimchiPremiumPct >= 3.0
                      ? "Korean retail FOMO (overheated)"
                      : "Korean market aligned with global"}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Upbit Live Price (USD Converted)
                  </span>
                  <div className="text-sm font-black font-mono text-white mt-0.5">
                    ${intelligence.upbit.priceUsd.toLocaleString()}
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                    ₩{intelligence.upbit.priceKrw.toLocaleString()} (Rate: ₩
                    {intelligence.upbit.usdtKrwRate})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Smart Money Flow Diagnostics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Whale vs. Retail Divergence
            </span>
            <span className="font-bold text-white">{smartMoneyMetrics.whaleVsRetailSignal}</span>
          </div>
          <div className="text-right font-mono text-[11px]">
            <div className="text-emerald-400">Whale {smartMoneyMetrics.whaleRatio}x</div>
            <div className="text-slate-400">Retail {smartMoneyMetrics.retailRatio}x</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Funding Pressure
            </span>
            <span className="font-bold text-white">{smartMoneyMetrics.fundingSignal}</span>
          </div>
          <span className="font-mono text-xs text-sky-400">
            {flow.marketMakerState === "SHORT_SQUEEZE_FUEL" ? "Squeeze Alert" : "Stable"}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Order Book Wall Defense
            </span>
            <span className="font-bold text-white">{smartMoneyMetrics.orderBookImbalance}</span>
          </div>
          <span className="font-mono text-xs text-amber-400">Top 50 Depth</span>
        </div>
      </div>

      {/* 1-Click "Ask AI Copilot to Analyze Market Maker Data" Action */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-400" />
          <span className="text-xs text-slate-300">
            Need an instant AI strategic review of this token&apos;s institutional flow?
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copy snapshot prompt for AI"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Prompt Copied!" : "Copy MM Prompt"}</span>
          </button>

          <Link
            href="/copilot"
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-violet-500/20 transition-all cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Open AI Copilot</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </Link>
        </div>
      </div>
    </div>
  );
};
