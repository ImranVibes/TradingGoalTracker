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
  ShieldAlert,
} from "lucide-react";
import { MarketMakerFlowResult } from "@/lib/marketMakerFlow";
import { SignalSentimentBadge, SignalSentimentType } from "./SignalSentimentBadge";

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
          card: "bg-emerald-950/20 border-emerald-500/40",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          text: "text-emerald-400",
          icon: TrendingUp,
        };
      case "rose":
        return {
          card: "bg-rose-950/20 border-rose-500/40",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          text: "text-rose-400",
          icon: TrendingDown,
        };
      case "purple":
        return {
          card: "bg-purple-950/20 border-purple-500/40",
          badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          text: "text-purple-400",
          icon: Compass,
        };
      default:
        return {
          card: "bg-amber-950/20 border-amber-500/40",
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

  const mmSentiment: SignalSentimentType =
    marketMakerState === "WHALE_DUMP_ALERT"
      ? "TOO_MUCH_BEARISH"
      : marketMakerState === "INSTITUTIONAL_ACCUMULATION"
      ? "TOO_MUCH_BULLISH"
      : marketMakerState === "SHORT_SQUEEZE_FUEL"
      ? "HIGHLY_BULLISH"
      : marketMakerState === "OPTIONS_GRAVITY_PULL"
      ? (intelligence.options && intelligence.options.maxPainDistancePct > 2
          ? "HIGHLY_BULLISH"
          : intelligence.options && intelligence.options.maxPainDistancePct < -2
          ? "HIGHLY_BEARISH"
          : "BALANCED")
      : "BALANCED";

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#0c1322] p-6 sm:p-8 space-y-6 shadow-2xl">
      {/* ========================================================= */}
      {/* SECTION HEADER: Large Clear Hierarchy                     */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Cross-Exchange Whale Sentinel
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/15 border border-orange-500/30 text-orange-300">
                Institutional Flow
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Real-time leverage and liquidity across Binance, OKX, Bybit, Bitget, Gate.io, Deribit Options &amp; Upbit Korea
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SignalSentimentBadge
            sentiment={mmSentiment}
            subLabel="MM Flow Verdict"
          />
          <span
            className={`px-4 py-2 rounded-2xl text-xs font-bold border flex items-center gap-2 shadow-sm ${
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
            <ActionIcon className="w-3.5 h-3.5" />
            {stateTitle}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TOTAL MONITORED LEVERAGE BANNER                           */}
      {/* ========================================================= */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-950/40 via-slate-900/60 to-slate-950/80 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-sky-300 block">
            Global Monitored Futures Open Interest
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight mt-0.5">
            {formatMillions(intelligence.totalMonitoredOiUsd)}{" "}
            <span className="text-sm font-semibold text-slate-400 font-sans">
              across 5 Tier-1 Exchanges
            </span>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
          {beginnerVerdict.plainEnglishWhy}
        </p>
      </div>

      {/* ========================================================= */}
      {/* 5 TIER-1 EXCHANGES OPEN INTEREST (Large Typographic Scale) */}
      {/* ========================================================= */}
      <div className="space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          5 Tier-1 Exchanges Derivatives Leverage Breakdown
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Binance */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
                Binance Futures
              </span>
              {intelligence.binance.change24hPct !== undefined && (
                <span
                  className={`text-xs font-mono font-bold ${
                    intelligence.binance.change24hPct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {intelligence.binance.change24hPct >= 0 ? "+" : ""}
                  {intelligence.binance.change24hPct}%
                </span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              {formatMillions(intelligence.binance.oiUsd)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {intelligence.binance.identifier || symbol}
            </div>
          </div>

          {/* 2. Bybit */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-sm shadow-orange-400/50"></span>
                Bybit Linear
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {intelligence.bybit.identifier ? "Live" : "No Perp"}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              {intelligence.bybit.oiUsd > 0 ? formatMillions(intelligence.bybit.oiUsd) : "Tracking"}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {intelligence.bybit.oiContracts > 0
                ? `${intelligence.bybit.oiContracts.toLocaleString()} contracts`
                : "Linear Perp"}
            </div>
          </div>

          {/* 3. OKX */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50"></span>
                OKX Swap
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {intelligence.okx.identifier ? "Live" : "No Swap"}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              {intelligence.okx.oiUsd > 0 ? formatMillions(intelligence.okx.oiUsd) : "Tracking"}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {intelligence.okx.oiContracts > 0
                ? `${intelligence.okx.oiContracts.toLocaleString()} contracts`
                : "Swap pool"}
            </div>
          </div>

          {/* 4. Bitget */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
                Bitget Mix
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {intelligence.bitget.identifier ? "Live" : "No Perp"}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              {intelligence.bitget.oiUsd > 0 ? formatMillions(intelligence.bitget.oiUsd) : "Tracking"}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {intelligence.bitget.oiContracts > 0
                ? `${intelligence.bitget.oiContracts.toLocaleString()} tokens`
                : "USDT Futures"}
            </div>
          </div>

          {/* 5. Gate.io */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
                Gate.io
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {intelligence.gate.identifier ? "Live" : "No Perp"}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              {intelligence.gate.oiUsd > 0 ? formatMillions(intelligence.gate.oiUsd) : "Tracking"}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {intelligence.gate.oiContracts > 0
                ? `${intelligence.gate.oiContracts.toLocaleString()} contracts`
                : "USDT Futures"}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DERIBIT OPTIONS & UPBIT KOREA KIMCHI PREMIUM              */}
      {/* ========================================================= */}
      {(intelligence.options || intelligence.upbit) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Deribit Institutional Options Card */}
          {intelligence.options && (
            <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Target className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-bold text-white">
                    Deribit Institutional Options ({intelligence.options.currency})
                  </span>
                </div>
                <SignalSentimentBadge
                  sentiment={
                    intelligence.options.sentiment === "BULLISH_CALL_DOMINANT"
                      ? intelligence.options.putCallRatio < 0.6
                        ? "TOO_MUCH_BULLISH"
                        : "HIGHLY_BULLISH"
                      : intelligence.options.sentiment === "BEARISH_PUT_HEDGING"
                      ? intelligence.options.putCallRatio > 1.4
                        ? "TOO_MUCH_BEARISH"
                        : "HIGHLY_BEARISH"
                      : "BALANCED"
                  }
                  size="sm"
                  subLabel="Options Bias"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Max Pain Strike (MM Magnet)
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-purple-300 tracking-tight flex items-baseline gap-2">
                    ${intelligence.options.maxPainPrice.toLocaleString()}
                    <span
                      className={`text-xs font-bold ${
                        intelligence.options.maxPainDistancePct >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      ({intelligence.options.maxPainDistancePct >= 0 ? "+" : ""}
                      {intelligence.options.maxPainDistancePct}%)
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 block">
                    Price where option sellers pay minimum cash
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Put / Call Volume Ratio
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    {intelligence.options.putCallRatio}
                  </div>
                  <span className="text-xs text-slate-400 block font-mono">
                    {intelligence.options.totalPutVolume.toLocaleString()} P / {intelligence.options.totalCallVolume.toLocaleString()} C
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Upbit South Korea Kimchi Premium Card */}
          {intelligence.upbit && (
            <div className="p-5 rounded-2xl bg-sky-950/20 border border-sky-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-5 h-5 text-sky-400" />
                  <span className="text-sm font-bold text-white">
                    Upbit Korea Spot &amp; Kimchi Premium Spread
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold border ${
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

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Kimchi Premium Spread
                  </span>
                  <div
                    className={`text-xl sm:text-2xl font-black font-mono tracking-tight flex items-center gap-1.5 ${
                      intelligence.upbit.kimchiPremiumPct >= 0 ? "text-amber-300" : "text-sky-300"
                    }`}
                  >
                    {intelligence.upbit.kimchiPremiumPct >= 0 ? (
                      <ArrowUpRight className="w-5 h-5 text-amber-400" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-sky-400" />
                    )}
                    {intelligence.upbit.kimchiPremiumPct >= 0 ? "+" : ""}
                    {intelligence.upbit.kimchiPremiumPct}%
                  </div>
                  <span className="text-xs text-slate-400 block">
                    {intelligence.upbit.kimchiPremiumPct >= 3.0
                      ? "Korean retail FOMO premium"
                      : "Korean price aligned with global"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Upbit Live Price (USD Converted)
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    ${intelligence.upbit.priceUsd.toLocaleString()}
                  </div>
                  <span className="text-xs text-slate-400 block font-mono">
                    ₩{intelligence.upbit.priceKrw.toLocaleString()} (Rate: ₩{intelligence.upbit.usdtKrwRate})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1-CLICK AI COPILOT EXPORT                                 */}
      {/* ========================================================= */}
      <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-violet-400" />
          <span className="text-xs sm:text-sm text-slate-300 font-medium">
            Need an instant AI strategic review of this token&apos;s institutional flow?
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-bold text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
            title="Copy snapshot prompt for AI"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Prompt Copied!" : "Copy MM Prompt"}</span>
          </button>

          <Link
            href="/copilot"
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-violet-500/20 transition-all cursor-pointer"
          >
            <Bot className="w-4 h-4" />
            <span>Open AI Copilot</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </Link>
        </div>
      </div>
    </div>
  );
};
