"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  PauseCircle,
  Target,
  Crosshair,
  ShieldAlert,
  Zap,
  Copy,
  Check,
  Maximize2,
  X,
  FileText,
  Sparkles,
  ArrowRight,
  Flame,
  CheckSquare,
  Coins,
  Scale,
  Activity,
  Layers,
} from "lucide-react";
import { MarketMakerFlowResult } from "@/lib/marketMakerFlow";
import { ConfluenceSRResult, TradeGptDebateResult } from "@/lib/technicalAnalysis";
import { SentimentReport } from "@/lib/tradingMetrics";

interface BeginnerExecutiveSummaryProps {
  symbol: string;
  currentPrice: number;
  report: SentimentReport | null;
  marketMakerFlow: MarketMakerFlowResult | null;
  technicalAnalysis: {
    confluenceSR?: ConfluenceSRResult;
    tradeGptDebate?: TradeGptDebateResult;
    superTrend?: { direction: "BULL" | "BEAR"; value: number };
    rsi14?: number;
  } | null;
  fundingRatePct?: number;
  whaleRatio?: number;
  retailRatio?: number;
}

export const BeginnerExecutiveSummary: React.FC<BeginnerExecutiveSummaryProps> = ({
  symbol,
  currentPrice,
  report,
  marketMakerFlow,
  technicalAnalysis,
  fundingRatePct = 0,
  whaleRatio = 1,
  retailRatio = 1,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedCoordinates, setCopiedCoordinates] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
  });

  if (!currentPrice || currentPrice <= 0) return null;

  // Synthesize Combined Verdict
  const mmAction = marketMakerFlow?.beginnerVerdict?.action || "WAIT_STAY_OUT";
  const researchVerdict = technicalAnalysis?.tradeGptDebate?.researchManager?.verdict || "CHOP_RANGE_WAIT";
  const allowedDir = report?.allowedDirection || "NEITHER_WAIT";

  let combinedDirection: "LONG" | "SHORT" | "WAIT" = "WAIT";
  let combinedBadgeColor: "emerald" | "rose" | "amber" = "amber";
  let directionHeadline = "WAIT — NEUTRAL MARKET";
  let directionSubtext = "No clear edge detected across derivatives and smart money. Wait for clean breakout.";
  let convictionPct = 65;

  const isBullishBias =
    allowedDir === "LONG_ONLY" ||
    mmAction === "BUY_LONG" ||
    researchVerdict.includes("BULLISH");

  const isBearishBias =
    allowedDir === "SHORT_ONLY" ||
    mmAction === "SELL_SHORT" ||
    researchVerdict.includes("BEARISH");

  if (isBullishBias && !isBearishBias) {
    combinedDirection = "LONG";
    combinedBadgeColor = "emerald";
    directionHeadline = "BUY / LONG SETUP";
    directionSubtext = "Institutional whales are heavily long, order book bids are defending, and shorts are paying funding penalties.";
    convictionPct = Math.max(78, technicalAnalysis?.tradeGptDebate?.researchManager?.netConvictionPct || 82);
  } else if (isBearishBias && !isBullishBias) {
    combinedDirection = "SHORT";
    combinedBadgeColor = "rose";
    directionHeadline = "SELL / SHORT SETUP";
    directionSubtext = "Heavy overhead resistance walls, whale distribution, and retail longs are trapped at swing highs.";
    convictionPct = Math.max(78, technicalAnalysis?.tradeGptDebate?.researchManager?.netConvictionPct || 80);
  } else if (isBullishBias && isBearishBias) {
    combinedDirection = "WAIT";
    combinedBadgeColor = "amber";
    directionHeadline = "CAUTION: MIXED SIGNALS";
    directionSubtext = "Derivatives leverage and chart structure are in conflict. Wait for a confirmed 4H candle close.";
    convictionPct = 50;
  }

  // Calculate Precise Execution Targets (Entry, TP1, TP2, Stop Loss)
  const supports = technicalAnalysis?.confluenceSR?.supports || [];
  const resistances = technicalAnalysis?.confluenceSR?.resistances || [];
  const immediateSupport = supports[0]?.price || currentPrice * 0.985;
  const secondarySupport = supports[1]?.price || currentPrice * 0.965;
  const immediateResistance = resistances[0]?.price || currentPrice * 1.018;
  const secondaryResistance = resistances[1]?.price || currentPrice * 1.042;

  let entryZoneStr = "";
  let tp1Str = "";
  let tp1Gain = "";
  let tp2Str = "";
  let tp2Gain = "";
  let stopLossStr = "";
  let slLoss = "";
  let riskRewardRatio = "1 : 2.5";

  if (combinedDirection === "LONG") {
    const entryLow = Math.min(immediateSupport, currentPrice * 0.995);
    const entryHigh = currentPrice;
    entryZoneStr = `$${entryLow.toFixed(currentPrice < 1 ? 6 : 2)} – $${entryHigh.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const tp1Price = immediateResistance;
    tp1Gain = (((tp1Price - currentPrice) / currentPrice) * 100).toFixed(1);
    tp1Str = `$${tp1Price.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const maxPain = marketMakerFlow?.intelligence?.options?.maxPainPrice;
    const tp2Price = maxPain && maxPain > tp1Price ? maxPain : secondaryResistance;
    tp2Gain = (((tp2Price - currentPrice) / currentPrice) * 100).toFixed(1);
    tp2Str = `$${tp2Price.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const slPrice = Math.min(secondarySupport, currentPrice * 0.978);
    slLoss = (((slPrice - currentPrice) / currentPrice) * 100).toFixed(1);
    stopLossStr = `$${slPrice.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const risk = currentPrice - slPrice;
    const reward = tp1Price - currentPrice;
    if (risk > 0 && reward > 0) {
      riskRewardRatio = `1 : ${(reward / risk).toFixed(1)}`;
    }
  } else if (combinedDirection === "SHORT") {
    const entryLow = currentPrice;
    const entryHigh = Math.max(immediateResistance, currentPrice * 1.006);
    entryZoneStr = `$${entryLow.toFixed(currentPrice < 1 ? 6 : 2)} – $${entryHigh.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const tp1Price = immediateSupport;
    tp1Gain = (((currentPrice - tp1Price) / currentPrice) * 100).toFixed(1);
    tp1Str = `$${tp1Price.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const tp2Price = secondarySupport;
    tp2Gain = (((currentPrice - tp2Price) / currentPrice) * 100).toFixed(1);
    tp2Str = `$${tp2Price.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const slPrice = Math.max(secondaryResistance, currentPrice * 1.022);
    slLoss = (((slPrice - currentPrice) / currentPrice) * 100).toFixed(1);
    stopLossStr = `$${slPrice.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const risk = slPrice - currentPrice;
    const reward = currentPrice - tp1Price;
    if (risk > 0 && reward > 0) {
      riskRewardRatio = `1 : ${(reward / risk).toFixed(1)}`;
    }
  } else {
    entryZoneStr = "Wait for breakout";
    tp1Str = `$${immediateResistance.toFixed(currentPrice < 1 ? 6 : 2)}`;
    tp1Gain = "+1.8";
    tp2Str = `$${secondaryResistance.toFixed(currentPrice < 1 ? 6 : 2)}`;
    tp2Gain = "+4.5";
    stopLossStr = `$${immediateSupport.toFixed(currentPrice < 1 ? 6 : 2)}`;
    slLoss = "-2.0";
    riskRewardRatio = "1 : 2.0";
  }

  // Technical Highlights
  const fundingStatus =
    fundingRatePct < -0.005
      ? "Squeeze Fuel (Shorts Paying)"
      : fundingRatePct > 0.02
      ? "Overheated Longs (Cascade Risk)"
      : "Balanced / Neutral Funding";

  const fundingExplain =
    fundingRatePct < -0.005
      ? `Rate ${(fundingRatePct * 100).toFixed(3)}% means short traders pay fees every 8h. High probability of sudden upward short squeeze.`
      : fundingRatePct > 0.02
      ? `Rate +${(fundingRatePct * 100).toFixed(3)}% means long traders pay heavy fees. Market vulnerable to sudden long liquidation dump.`
      : `Rate ${(fundingRatePct * 100).toFixed(3)}% is stable with no extreme crowd crowding.`;

  const whaleStatus =
    whaleRatio > 1.25 && retailRatio < 0.95
      ? `Whales Long (${whaleRatio}x) vs Retail Short (${retailRatio}x)`
      : whaleRatio < 0.95 && retailRatio > 1.25
      ? `Retail Long (${retailRatio}x) vs Whales Short (${whaleRatio}x)`
      : `Whales ${whaleRatio}x / Retail ${retailRatio}x`;

  const whaleExplain =
    whaleRatio > 1.25 && retailRatio < 0.95
      ? "Institutional top trader accounts are heavily skewed Long while retail traders are selling. Trade on the side of the whales."
      : whaleRatio < 0.95 && retailRatio > 1.25
      ? "Retail crowd is heavily Long while whales are quietly offloading. Beware of a retail liquidation trap."
      : "Whale accounts and retail positions are relatively balanced.";

  const srExplain =
    combinedDirection === "LONG"
      ? `Price must hold above the $${immediateSupport.toFixed(currentPrice < 1 ? 4 : 2)} Volume POC floor to sustain upward momentum.`
      : combinedDirection === "SHORT"
      ? `Price is capped below $${immediateResistance.toFixed(currentPrice < 1 ? 4 : 2)} heavy overhead resistance wall.`
      : `Trading tightly inside the $${immediateSupport.toFixed(currentPrice < 1 ? 4 : 2)} to $${immediateResistance.toFixed(currentPrice < 1 ? 4 : 2)} range.`;

  const handleCopyCoordinates = () => {
    const text = `Trade Plan for ${symbol}:
- Direction: ${combinedDirection} (${directionHeadline})
- Current Price: $${currentPrice}
- Optimal Entry Zone: ${entryZoneStr}
- Take Profit 1 (TP1): ${tp1Str} (+${tp1Gain}%)
- Take Profit 2 (TP2): ${tp2Str} (+${tp2Gain}%)
- Hard Stop Loss: ${stopLossStr} (${slLoss}%)
- Risk/Reward: ${riskRewardRatio}
- Golden Rule: ${marketMakerFlow?.beginnerVerdict?.goldenRule || "Never risk more than 1-2% of account."}`;
    navigator.clipboard.writeText(text);
    setCopiedCoordinates(true);
    setTimeout(() => setCopiedCoordinates(false), 2000);
  };

  const handleSaveToNotes = async () => {
    setSavingNote(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${symbol} ${combinedDirection} Trade Plan [${new Date().toLocaleDateString()}]`,
          symbol: symbol,
          category: "STRATEGY",
          tags: ["TradePlan", symbol, combinedDirection],
          content: `### 🎯 Executive Beginner Trade Plan: ${symbol}
**Direction**: ${combinedDirection} (${directionHeadline})
**Conviction Score**: ${convictionPct}% Confluence

#### 📍 Execution Coordinates
- **Current Price**: $${currentPrice}
- **Optimal Entry Zone**: ${entryZoneStr}
- **Take Profit 1 (TP1)**: ${tp1Str} (+${tp1Gain}%)
- **Take Profit 2 (TP2)**: ${tp2Str} (+${tp2Gain}%)
- **Hard Stop-Loss**: ${stopLossStr} (${slLoss}%)
- **Risk / Reward Ratio**: ${riskRewardRatio}

#### 💡 Market Mechanics & Technical Edge
- **Funding Rate**: ${fundingStatus} (${fundingExplain})
- **Whale vs Retail**: ${whaleStatus} (${whaleExplain})
- **Key S/R Level**: ${srExplain}

#### 📋 Execution Checklist
- [ ] Confirm price enters within ${entryZoneStr}
- [ ] Set Hard Stop-Loss immediately at ${stopLossStr}
- [ ] Close 50% position at TP1 (${tp1Str}) and move SL to breakeven
- [ ] Let remainder run to TP2 (${tp2Str})`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNote(false);
    }
  };

  const toggleCheckStep = (step: number) => {
    setCheckedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  return (
    <>
      {/* ========================================================= */}
      {/* MASTER EXECUTIVE COMMAND DECK (PRO VISUAL HIERARCHY)      */}
      {/* ========================================================= */}
      <div className="rounded-3xl border border-slate-800 bg-[#0c1322] p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
        {/* Subtle Ambient Radial Glow */}
        <div
          className={`absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-20 ${
            combinedBadgeColor === "emerald"
              ? "bg-emerald-500"
              : combinedBadgeColor === "rose"
              ? "bg-rose-500"
              : "bg-amber-500"
          }`}
        />

        {/* ========================================================= */}
        {/* LEVEL 1: PRIMARY ANCHOR (What is this & What to do)       */}
        {/* ========================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          {/* Asset Identity & Live Price (Dominant Typography) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                LIVE ASSET
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Binance Futures USD-M
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3 pt-1">
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {symbol}
              </h1>
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tracking-tight">
                ${currentPrice.toLocaleString()}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Cross-analyzed with 5 Tier-1 Exchanges, Deribit Options, Order Book Depth &amp; Trend Confluence.
            </p>
          </div>

          {/* Master Signal Decision Box (Large, Unmissable Badge) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div
              className={`p-5 rounded-2xl border flex items-center gap-4 shadow-xl ${
                combinedBadgeColor === "emerald"
                  ? "bg-emerald-950/40 border-emerald-500/50 shadow-emerald-950/30"
                  : combinedBadgeColor === "rose"
                  ? "bg-rose-950/40 border-rose-500/50 shadow-rose-950/30"
                  : "bg-amber-950/40 border-amber-500/50 shadow-amber-950/30"
              }`}
            >
              <div
                className={`p-3 rounded-xl border ${
                  combinedBadgeColor === "emerald"
                    ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30"
                    : combinedBadgeColor === "rose"
                    ? "bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30"
                    : "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30"
                }`}
              >
                {combinedDirection === "LONG" ? (
                  <TrendingUp className="w-8 h-8 stroke-[2.5]" />
                ) : combinedDirection === "SHORT" ? (
                  <TrendingDown className="w-8 h-8 stroke-[2.5]" />
                ) : (
                  <PauseCircle className="w-8 h-8 stroke-[2.5]" />
                )}
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block">
                  Action Verdict
                </span>
                <span
                  className={`text-2xl sm:text-3xl font-black tracking-tight block ${
                    combinedBadgeColor === "emerald"
                      ? "text-emerald-400"
                      : combinedBadgeColor === "rose"
                      ? "text-rose-400"
                      : "text-amber-300"
                  }`}
                >
                  {directionHeadline}
                </span>
                <span className="text-xs font-mono font-bold text-slate-300 block mt-0.5">
                  {convictionPct}% Net Confluence Agreement
                </span>
              </div>
            </div>

            {/* Primary Action Button (Prominent, High-Contrast) */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Maximize2 className="w-4 h-4 stroke-[2.5]" />
              <span>Beginner Trade Plan</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* LEVEL 2: WHERE TO TRADE (Large Target Numbers)            */}
        {/* ========================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-sky-400" />
              Where To Trade (Execution Coordinates)
            </span>
            <span className="text-xs font-mono font-bold text-sky-300 bg-sky-950/70 border border-sky-800/50 px-2.5 py-0.5 rounded-full">
              Risk/Reward {riskRewardRatio}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Optimal Entry Zone */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Optimal Entry Zone
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-sky-400 tracking-tight">
                {entryZoneStr}
              </div>
              <span className="text-xs text-slate-400 block">
                Wait for price to pull into this range
              </span>
            </div>

            {/* 2. Hard Stop-Loss */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Safety Stop-Loss
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 tracking-tight flex items-center gap-2">
                {stopLossStr}
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {slLoss}%
                </span>
              </div>
              <span className="text-xs text-slate-400 block">
                Never trade without hard invalidation
              </span>
            </div>

            {/* 3. Take Profit 1 */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Take Profit 1 (TP1)
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight flex items-center gap-2">
                {tp1Str}
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  +{tp1Gain}%
                </span>
              </div>
              <span className="text-xs text-slate-400 block">
                Close 50% &amp; move Stop to Breakeven
              </span>
            </div>

            {/* 4. Take Profit 2 */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Take Profit 2 (TP2)
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300 tracking-tight flex items-center gap-2">
                {tp2Str}
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  +{tp2Gain}%
                </span>
              </div>
              <span className="text-xs text-slate-400 block">
                Ride remainder to institutional target
              </span>
            </div>
          </div>

          {/* Quick Action Tools Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-300 font-medium">
              <strong className="text-white mr-1.5">Executive Thesis:</strong>
              {directionSubtext}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCoordinates}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedCoordinates ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{copiedCoordinates ? "Plan Copied!" : "Copy Targets"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToNotes}
                disabled={savingNote}
                className="px-3.5 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-xs font-bold text-sky-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {noteSaved ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>{savingNote ? "Saving..." : noteSaved ? "Saved to Notes!" : "Save Plan to Notes"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* LEVEL 3: BEGINNER MARKET CHEAT-SHEET (4 Clear Pillars)    */}
        {/* ========================================================= */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Beginner Market Cheat-Sheet (Why the Market Moves)
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Funding Rate */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Funding Rate
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono ${
                    fundingRatePct < -0.005
                      ? "bg-sky-500/20 text-sky-300"
                      : fundingRatePct > 0.02
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {(fundingRatePct * 100).toFixed(3)}%
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {fundingStatus}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {fundingExplain}
              </p>
            </div>

            {/* 2. Whale vs Retail Positioning */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Whale vs Retail
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  {whaleRatio}x Long
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {whaleStatus}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {whaleExplain}
              </p>
            </div>

            {/* 3. Confluence S/R Floor */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Key S/R Floor
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                  ${immediateSupport.toFixed(currentPrice < 1 ? 4 : 0)}
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                Support Defense Zone
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {srExplain}
              </p>
            </div>

            {/* 4. Institutional Magnet (Options / MM) */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Institutional Flow
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                  {marketMakerFlow?.intelligence?.options?.available ? "Deribit" : "Cross-Ex"}
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {marketMakerFlow?.intelligence?.options?.available
                  ? `Max Pain: $${marketMakerFlow.intelligence.options.maxPainPrice.toLocaleString()}`
                  : `${((marketMakerFlow?.intelligence?.totalMonitoredOiUsd || 0) / 1e6).toFixed(0)}M Monitored OI`}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {marketMakerFlow?.intelligence?.options?.available
                  ? `Option market makers face lowest payout near $${marketMakerFlow.intelligence.options.maxPainPrice.toLocaleString()}, pulling price like a magnet.`
                  : "Tracks open interest across Binance, Bybit, OKX, Bitget & Gate.io to identify whale inventory changes."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* POP-UP MODAL: STEP-BY-STEP BEGINNER GAMEPLAN              */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl bg-[#0f172a] border border-slate-700 shadow-2xl p-6 sm:p-8 space-y-6 text-white max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-inner">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Beginner Execution Gameplan: {symbol}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Step-by-step gameplan designed to protect your capital and eliminate emotional errors
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verdict Card */}
            <div
              className={`p-5 rounded-2xl border flex items-center justify-between gap-4 shadow-lg ${
                combinedBadgeColor === "emerald"
                  ? "bg-emerald-950/40 border-emerald-500/40"
                  : combinedBadgeColor === "rose"
                  ? "bg-rose-950/40 border-rose-500/40"
                  : "bg-amber-950/40 border-amber-500/40"
              }`}
            >
              <div>
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                  Recommended Stance
                </span>
                <span
                  className={`text-2xl font-black ${
                    combinedBadgeColor === "emerald"
                      ? "text-emerald-400"
                      : combinedBadgeColor === "rose"
                      ? "text-rose-400"
                      : "text-amber-400"
                  }`}
                >
                  {directionHeadline}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono uppercase text-slate-400 block">
                  Net Conviction
                </span>
                <span className="text-xl font-mono font-black text-white">
                  {convictionPct}% Confluence
                </span>
              </div>
            </div>

            {/* Exact Targets Grid (Large Numbers) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                1. Exact Execution Numbers
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    Entry Zone
                  </span>
                  <span className="text-base sm:text-lg font-mono font-black text-sky-400 block">
                    {entryZoneStr}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    Stop-Loss
                  </span>
                  <span className="text-base sm:text-lg font-mono font-black text-rose-400 block">
                    {stopLossStr}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    Take Profit 1
                  </span>
                  <span className="text-base sm:text-lg font-mono font-black text-emerald-400 block">
                    {tp1Str}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    Take Profit 2
                  </span>
                  <span className="text-base sm:text-lg font-mono font-black text-emerald-300 block">
                    {tp2Str}
                  </span>
                </div>
              </div>
            </div>

            {/* Step-by-Step Interactive Checklist */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                2. Step-by-Step Execution Checklist
              </h4>
              <div className="space-y-2 text-xs">
                <div
                  onClick={() => toggleCheckStep(1)}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3.5 cursor-pointer transition-colors ${
                    checkedSteps[1]
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                      checkedSteps[1]
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-600 bg-slate-950"
                    }`}
                  >
                    {checkedSteps[1] && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-sm">
                    <strong>Step 1: Wait for entry price.</strong> Never chase a moving candle. Wait patiently for price to enter the zone ({entryZoneStr}).
                  </span>
                </div>

                <div
                  onClick={() => toggleCheckStep(2)}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3.5 cursor-pointer transition-colors ${
                    checkedSteps[2]
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                      checkedSteps[2]
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-600 bg-slate-950"
                    }`}
                  >
                    {checkedSteps[2] && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-sm">
                    <strong>Step 2: Place Hard Stop-Loss immediately.</strong> Put your stop order at {stopLossStr}. If price touches it, accept the small loss and walk away.
                  </span>
                </div>

                <div
                  onClick={() => toggleCheckStep(3)}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3.5 cursor-pointer transition-colors ${
                    checkedSteps[3]
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                      checkedSteps[3]
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-600 bg-slate-950"
                    }`}
                  >
                    {checkedSteps[3] && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-sm">
                    <strong>Step 3: Secure 50% Profit at TP1.</strong> When price hits {tp1Str}, sell half your position and immediately move Stop-Loss to Breakeven (risk-free).
                  </span>
                </div>

                <div
                  onClick={() => toggleCheckStep(4)}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3.5 cursor-pointer transition-colors ${
                    checkedSteps[4]
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                      checkedSteps[4]
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-600 bg-slate-950"
                    }`}
                  >
                    {checkedSteps[4] && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-sm">
                    <strong>Step 4: Ride the remaining 50% to TP2.</strong> Let the runner position reach {tp2Str} to capture maximum upside.
                  </span>
                </div>
              </div>
            </div>

            {/* Beginner Golden Rules */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1.5">
              <strong className="text-amber-300 block font-bold text-sm">
                ⚠️ Beginner Golden Rules (Risk Management 101):
              </strong>
              <p className="text-xs leading-relaxed text-amber-200/90">
                1. Never risk more than 1% to 2% of your entire account on this single trade.
              </p>
              <p className="text-xs leading-relaxed text-amber-200/90">
                2. Never average down or move your stop-loss further away if the trade goes against you.
              </p>
              <p className="text-xs leading-relaxed text-amber-200/90">
                3. Market makers profit by exploiting impatient retail traders. Patience is your actual edge.
              </p>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCoordinates}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedCoordinates ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{copiedCoordinates ? "Plan Copied!" : "Copy Targets"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveToNotes}
                  disabled={savingNote}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-sky-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {noteSaved ? (
                    <Check className="w-4 h-4 text-emerald-200" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>{savingNote ? "Saving..." : noteSaved ? "Saved to Notes!" : "Save Plan to Notes"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/checklist?symbol=${encodeURIComponent(symbol)}&direction=${combinedDirection}`}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-amber-500/20"
                >
                  <CheckSquare className="w-4 h-4 stroke-[2.5]" />
                  <span>Pre-Trade Checklist</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
