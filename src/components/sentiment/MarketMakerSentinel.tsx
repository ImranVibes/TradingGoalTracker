"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Flame,
  Activity,
  Layers,
  Bot,
  Copy,
  Check,
  ExternalLink,
  Info,
  Sparkles,
  Zap,
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
  const [showAiBreakdown, setShowAiBreakdown] = useState(false);

  if (!flow) return null;

  const {
    exchanges,
    marketMakerState,
    stateTitle,
    stateDescription,
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
          card: "bg-emerald-950/30 border-emerald-500/40",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          text: "text-emerald-400",
          icon: TrendingUp,
        };
      case "rose":
        return {
          card: "bg-rose-950/30 border-rose-500/40",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          text: "text-rose-400",
          icon: TrendingDown,
        };
      default:
        return {
          card: "bg-amber-950/30 border-amber-500/40",
          badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          text: "text-amber-400",
          icon: Activity,
        };
    }
  };

  const style = getBadgeStyle();
  const ActionIcon = style.icon;

  const formatMillions = (usd: number) => {
    if (!usd) return "$0";
    if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
    if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
    if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
    return `$${usd.toFixed(0)}`;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-5 shadow-xl">
      {/* Header with Live Status Alert */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
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
              Tracks real-time leverage across Binance, OKX &amp; Bybit to spot market maker dumps before retail feels the crash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
              marketMakerState === "WHALE_DUMP_ALERT"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                : marketMakerState === "INSTITUTIONAL_ACCUMULATION"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : marketMakerState === "SHORT_SQUEEZE_FUEL"
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}
          >
            {stateTitle}
          </span>
        </div>
      </div>

      {/* Beginner-Friendly Action Decision Card */}
      <div className={`p-4 rounded-xl border ${style.card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${style.badge}`}>
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
            <span className="text-[10px] font-mono uppercase text-slate-400">Risk Level:</span>
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
        <p className="text-xs text-slate-200 leading-relaxed font-medium bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <strong className="text-white block mb-0.5">What is happening in plain English:</strong>
          {beginnerVerdict.plainEnglishWhy}
        </p>

        {/* Rules and Entry/Exit Guidance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Golden Rule
            </span>
            <span className="text-[11px] text-slate-300 font-medium leading-tight block">
              {beginnerVerdict.goldenRule}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Optimal Entry Zone
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 block">
              {beginnerVerdict.suggestedEntryRange}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Safety Stop-Loss Price
            </span>
            <span className="text-xs font-mono font-bold text-rose-400 block">
              {beginnerVerdict.suggestedStopLoss}
            </span>
          </div>
        </div>
      </div>

      {/* Cross-Exchange Open Interest (Derivatives Leverage) Grid */}
      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            Cross-Exchange Futures Open Interest (Live Leverage Tracker)
          </span>
          <span className="font-mono text-white text-xs">
            Total Monitored:{" "}
            <strong className="text-sky-400">{formatMillions(exchanges.totalMonitoredOiUsd)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Binance */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Binance Futures
              </span>
              <span
                className={`text-[10px] font-mono font-bold ${
                  exchanges.binanceOiChange24hPct >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {exchanges.binanceOiChange24hPct >= 0 ? "+" : ""}
                {exchanges.binanceOiChange24hPct}% (24h)
              </span>
            </div>
            <div className="text-base font-black font-mono text-white">
              {formatMillions(exchanges.binanceOiUsd)}
            </div>
            <div className="text-[10px] text-slate-400">Largest global liquidity pool</div>
          </div>

          {/* OKX */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                OKX Swap
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {exchanges.okxInstrumentId || "Active"}
              </span>
            </div>
            <div className="text-base font-black font-mono text-white">
              {exchanges.okxOiUsd > 0 ? formatMillions(exchanges.okxOiUsd) : "Live Tracking"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {exchanges.okxOiContracts > 0
                ? `${exchanges.okxOiContracts.toLocaleString()} contracts`
                : "Institutional routing"}
            </div>
          </div>

          {/* Bybit */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                Bybit Linear
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {exchanges.bybitSymbol || "Active"}
              </span>
            </div>
            <div className="text-base font-black font-mono text-white">
              {exchanges.bybitOiUsd > 0 ? formatMillions(exchanges.bybitOiUsd) : "Live Tracking"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {exchanges.bybitOiContracts > 0
                ? `${exchanges.bybitOiContracts.toLocaleString()} contracts`
                : "Active perp linear"}
            </div>
          </div>
        </div>
      </div>

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
            Want a deeper AI breakdown of what Market Makers are doing with this coin?
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
            title="Copy snapshot prompt for AI"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Prompt Copied!" : "Copy MM Prompt"}</span>
          </button>

          <Link
            href="/copilot"
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-violet-500/20 transition-all"
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
