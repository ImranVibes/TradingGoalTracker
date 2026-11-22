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
  Scale,
  Flame,
  CheckSquare,
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
  let directionHeadline = "WAIT — MARKET IN NEUTRAL CHOP";
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
    directionHeadline = "BUY / LONG SETUP (WHALE-SUPPORTED)";
    convictionPct = Math.max(78, technicalAnalysis?.tradeGptDebate?.researchManager?.netConvictionPct || 82);
  } else if (isBearishBias && !isBullishBias) {
    combinedDirection = "SHORT";
    combinedBadgeColor = "rose";
    directionHeadline = "SELL / SHORT SETUP (DISTRIBUTION RISK)";
    convictionPct = Math.max(78, technicalAnalysis?.tradeGptDebate?.researchManager?.netConvictionPct || 80);
  } else if (isBullishBias && isBearishBias) {
    // Conflict between technical and sentiment/MM
    combinedDirection = "WAIT";
    combinedBadgeColor = "amber";
    directionHeadline = "CAUTION: MIXED SIGNALS — WAIT FOR BREAKOUT";
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
  let tp2Str = "";
  let stopLossStr = "";
  let riskRewardRatio = "1 : 2.5";

  if (combinedDirection === "LONG") {
    const entryLow = Math.min(immediateSupport, currentPrice * 0.995);
    const entryHigh = currentPrice;
    entryZoneStr = `$${entryLow.toFixed(currentPrice < 1 ? 6 : 2)} – $${entryHigh.toFixed(currentPrice < 1 ? 6 : 2)}`;

    const tp1Price = immediateResistance;
    const tp1Gain = (((tp1Price - currentPrice) / currentPrice) * 100).toFixed(1);
    tp1Str = `$${tp1Price.toFixed(currentPrice < 1 ? 6 : 2)} (+${tp1Gain}%)`;

    const maxPain = marketMakerFlow?.intelligence?.options?.maxPainPrice;
    const tp2Price = maxPain && maxPain > tp1Price ? maxPain : secondaryResistance;
    const tp2Gain = (((tp2Price - currentPrice) / currentPrice) * 100).toFixed(1);
    tp2Str = `$${tp2Price.toFixed(currentPrice < 1 ? 6 : 2)} (+${tp2Gain}%)`;

    const slPrice = Math.min(secondarySupport, currentPrice * 0.978);
    const slLoss = (((slPrice - currentPrice) / currentPrice) * 100).toFixed(1);
    stopLossStr = `$${slPrice.toFixed(currentPrice < 1 ? 6 : 2)} (${slLoss}%)`;

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
    const tp1Gain = (((currentPrice - tp1Price) / currentPrice) * 100).toFixed(1);
    tp1Str = `$${tp1Price.toFixed(currentPrice < 1 ? 6 : 2)} (+${tp1Gain}%)`;

    const tp2Price = secondarySupport;
    const tp2Gain = (((currentPrice - tp2Price) / currentPrice) * 100).toFixed(1);
    tp2Str = `$${tp2Price.toFixed(currentPrice < 1 ? 6 : 2)} (+${tp2Gain}%)`;

    const slPrice = Math.max(secondaryResistance, currentPrice * 1.022);
    const slLoss = (((slPrice - currentPrice) / currentPrice) * 100).toFixed(1);
    stopLossStr = `$${slPrice.toFixed(currentPrice < 1 ? 6 : 2)} (+${slLoss}%)`;

    const risk = slPrice - currentPrice;
    const reward = currentPrice - tp1Price;
    if (risk > 0 && reward > 0) {
      riskRewardRatio = `1 : ${(reward / risk).toFixed(1)}`;
    }
  } else {
    entryZoneStr = "Wait for clean breakout confirmation";
    tp1Str = `$${immediateResistance.toFixed(currentPrice < 1 ? 6 : 2)}`;
    tp2Str = `$${secondaryResistance.toFixed(currentPrice < 1 ? 6 : 2)}`;
    stopLossStr = `$${immediateSupport.toFixed(currentPrice < 1 ? 6 : 2)}`;
    riskRewardRatio = "N/A";
  }

  // Technical Highlights
  const fundingNote =
    fundingRatePct < -0.005
      ? `Negative (${(fundingRatePct * 100).toFixed(3)}%) → Shorts paying longs (Squeeze Fuel)`
      : fundingRatePct > 0.02
      ? `Overheated (+${(fundingRatePct * 100).toFixed(3)}%) → Longs paying shorts (Cascade Risk)`
      : `Neutral (${(fundingRatePct * 100).toFixed(3)}%) → Balanced funding`;

  const whaleNote =
    whaleRatio > 1.25 && retailRatio < 0.95
      ? `Whales Long (${whaleRatio}x) vs Retail Short (${retailRatio}x) → Smart money bidding`
      : whaleRatio < 0.95 && retailRatio > 1.25
      ? `Retail Long (${retailRatio}x) vs Whales Short (${whaleRatio}x) → Retail trap risk`
      : `Whales ${whaleRatio}x / Retail ${retailRatio}x → No extreme divergence`;

  const keyLevelNote =
    combinedDirection === "LONG"
      ? `Must hold above Support $${immediateSupport.toFixed(currentPrice < 1 ? 4 : 2)}`
      : combinedDirection === "SHORT"
      ? `Must stay capped below Resistance $${immediateResistance.toFixed(currentPrice < 1 ? 4 : 2)}`
      : `Trading between $${immediateSupport.toFixed(currentPrice < 1 ? 4 : 2)} and $${immediateResistance.toFixed(currentPrice < 1 ? 4 : 2)}`;

  const mmOrOptionsNote = marketMakerFlow?.intelligence?.options?.available
    ? `Deribit Max Pain: $${marketMakerFlow.intelligence.options.maxPainPrice.toLocaleString()} (P/C ${marketMakerFlow.intelligence.options.putCallRatio})`
    : marketMakerFlow?.marketMakerState === "SHORT_SQUEEZE_FUEL"
    ? "Violent short squeeze springboard detected across exchanges"
    : marketMakerFlow?.marketMakerState === "WHALE_DUMP_ALERT"
    ? "Large ask walls absorbing bids — smart money distributing"
    : `5-Exchange Leverage: $${((marketMakerFlow?.intelligence?.totalMonitoredOiUsd || 0) / 1e6).toFixed(0)}M active`;

  const handleCopyCoordinates = () => {
    const text = `Trade Plan for ${symbol}:
- Direction: ${combinedDirection} (${directionHeadline})
- Current Price: $${currentPrice}
- Optimal Entry Zone: ${entryZoneStr}
- Take Profit 1 (TP1): ${tp1Str}
- Take Profit 2 (TP2): ${tp2Str}
- Hard Stop Loss: ${stopLossStr}
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
- **Take Profit 1 (TP1)**: ${tp1Str}
- **Take Profit 2 (TP2)**: ${tp2Str}
- **Hard Stop-Loss**: ${stopLossStr}
- **Risk / Reward Ratio**: ${riskRewardRatio}

#### 💡 Market Mechanics & Technical Edge
- **Funding Rate**: ${fundingNote}
- **Whale vs Retail**: ${whaleNote}
- **Key S/R Level**: ${keyLevelNote}
- **Institutional Magnet**: ${mmOrOptionsNote}

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
      {/* TOP EXECUTIVE SUMMARY CARD */}
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-2xl relative overflow-hidden space-y-4">
        {/* Glow Accent */}
        <div
          className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-10 ${
            combinedBadgeColor === "emerald"
              ? "bg-emerald-500"
              : combinedBadgeColor === "rose"
              ? "bg-rose-500"
              : "bg-amber-500"
          }`}
        />

        {/* Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Executive Beginner Trade Brief
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {symbol}
                </span>
                <span className="font-mono text-xs font-bold text-white">
                  ${currentPrice.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                All-in-one synthesis of Technical Analysis, Market Maker Leverage &amp; Smart Money positioning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Open Beginner Pop-Up</span>
            </button>
          </div>
        </div>

        {/* 3-Column Beginner Core Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Column 1: WHAT TO TRADE & DIRECTION (4 Cols) */}
          <div className="lg:col-span-4 rounded-xl bg-slate-950/60 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Direction &amp; Conviction
              </span>

              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl border ${
                    combinedBadgeColor === "emerald"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : combinedBadgeColor === "rose"
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {combinedDirection === "LONG" ? (
                    <TrendingUp className="w-6 h-6" />
                  ) : combinedDirection === "SHORT" ? (
                    <TrendingDown className="w-6 h-6" />
                  ) : (
                    <PauseCircle className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div
                    className={`text-lg font-black tracking-tight leading-tight ${
                      combinedBadgeColor === "emerald"
                        ? "text-emerald-400"
                        : combinedBadgeColor === "rose"
                        ? "text-rose-400"
                        : "text-amber-300"
                    }`}
                  >
                    {directionHeadline}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-400">
                      Conviction:
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      {convictionPct}% Confluence
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plain English "What to do right now" */}
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5">
              <strong className="text-white block text-[11px] mb-0.5">
                Beginner Action Directive:
              </strong>
              {combinedDirection === "LONG"
                ? `Smart money whales are biased Long and order book walls support price. Look to enter Long within the green zone.`
                : combinedDirection === "SHORT"
                ? `Heavy overhead selling walls and whale distribution indicate downside pressure. Look to enter Short near resistance.`
                : `Market is consolidating without clear edge. Stay out and wait for a clean 4H candle confirmation.`}
            </p>
          </div>

          {/* Column 2: WHERE TO TRADE (EXECUTION COORDINATES) (4 Cols) */}
          <div className="lg:col-span-4 rounded-xl bg-slate-950/60 border border-slate-800 p-4 space-y-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                Where To Trade (Targets)
              </span>
              <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">
                R:R {riskRewardRatio}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Optimal Entry
                </span>
                <span className="text-xs font-mono font-bold text-sky-300 block truncate">
                  {entryZoneStr}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Hard Stop-Loss
                </span>
                <span className="text-xs font-mono font-bold text-rose-400 block truncate">
                  {stopLossStr}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Take Profit 1 (TP1)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 block truncate">
                  {tp1Str}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Take Profit 2 (TP2)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-300 block truncate">
                  {tp2Str}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyCoordinates}
                className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                {copiedCoordinates ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
                <span>{copiedCoordinates ? "Copied!" : "Copy Targets"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToNotes}
                disabled={savingNote}
                className="flex-1 py-1 px-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-[11px] text-sky-200 flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                {noteSaved ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <FileText className="w-3 h-3 text-sky-400" />
                )}
                <span>{savingNote ? "Saving..." : noteSaved ? "Saved to Notes!" : "Save Plan to Notes"}</span>
              </button>
            </div>
          </div>

          {/* Column 3: BEGINNER MARKET CHEAT-SHEET (4 Cols) */}
          <div className="lg:col-span-4 rounded-xl bg-slate-950/60 border border-slate-800 p-4 space-y-2 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-800/70 pb-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Beginner Market Cheat-Sheet
            </span>

            <div className="space-y-1.5 text-xs">
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-amber-300 uppercase block">
                    Funding Rate
                  </span>
                  <span className="text-[11px] text-slate-300 leading-tight block">
                    {fundingNote}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-emerald-300 uppercase block">
                    Whale vs Retail
                  </span>
                  <span className="text-[11px] text-slate-300 leading-tight block">
                    {whaleNote}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-sky-300 uppercase block">
                    Confluence S/R Level
                  </span>
                  <span className="text-[11px] text-slate-300 leading-tight block">
                    {keyLevelNote}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-purple-300 uppercase block">
                    Institutional Flow
                  </span>
                  <span className="text-[11px] text-slate-300 leading-tight block truncate max-w-[280px]">
                    {mmOrOptionsNote}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BEGINNER QUICK TRADE PLAN POP-UP MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl bg-[#0f172a] border border-slate-700 shadow-2xl p-6 space-y-5 text-white max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Beginner Trade Execution Gameplan: {symbol}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Step-by-step instructions designed to protect your capital and maximize edge
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verdict Card */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                combinedBadgeColor === "emerald"
                  ? "bg-emerald-950/40 border-emerald-500/40"
                  : combinedBadgeColor === "rose"
                  ? "bg-rose-950/40 border-rose-500/40"
                  : "bg-amber-950/40 border-amber-500/40"
              }`}
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Recommended Stance
                </span>
                <span
                  className={`text-xl font-black ${
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
                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                  Net Conviction
                </span>
                <span className="text-lg font-mono font-bold text-white">
                  {convictionPct}% Confluence
                </span>
              </div>
            </div>

            {/* Exact Coordinates Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Exact Execution Numbers
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    Entry Zone
                  </span>
                  <span className="text-sm font-mono font-bold text-sky-400 block mt-0.5">
                    {entryZoneStr}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    Hard Stop-Loss
                  </span>
                  <span className="text-sm font-mono font-bold text-rose-400 block mt-0.5">
                    {stopLossStr}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    Take Profit 1
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400 block mt-0.5">
                    {tp1Str}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    Take Profit 2
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-300 block mt-0.5">
                    {tp2Str}
                  </span>
                </div>
              </div>
            </div>

            {/* Step-by-Step Interactive Checklist */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Step-by-Step Beginner Execution Checklist
              </h4>
              <div className="space-y-2 text-xs">
                <div
                  onClick={() => toggleCheckStep(1)}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                    checkedSteps[1]
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      checkedSteps[1]
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-600"
                    }`}
                  >
                    {checkedSteps[1] && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span>
                    <strong>Step 1: Wait for entry price.</strong> Do NOT FOMO enter immediately. Wait for price to touch the entry zone ({entryZoneStr}).
                  </span>
                </div>

                <div
                  onClick={() => toggleCheckStep(2)}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                    checkedSteps[2]
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      checkedSteps[2]
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-600"
                    }`}
                  >
                    {checkedSteps[2] && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span>
                    <strong>Step 2: Place Hard Stop-Loss immediately.</strong> Put your Stop-Loss at {stopLossStr}. If price hits this level, exit with zero questions.
                  </span>
                </div>

                <div
                  onClick={() => toggleCheckStep(3)}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                    checkedSteps[3]
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      checkedSteps[3]
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-600"
                    }`}
                  >
                    {checkedSteps[3] && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span>
                    <strong>Step 3: Secure 50% Profit at TP1.</strong> When price hits TP1 ({tp1Str}), sell half your position and immediately move Stop-Loss to Breakeven (risk-free).
                  </span>
                </div>

                <div
                  onClick={() => toggleCheckStep(4)}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                    checkedSteps[4]
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      checkedSteps[4]
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-600"
                    }`}
                  >
                    {checkedSteps[4] && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span>
                    <strong>Step 4: Ride the remaining 50% to TP2.</strong> Let the runner position hit TP2 ({tp2Str}) to maximize profits.
                  </span>
                </div>
              </div>
            </div>

            {/* Beginner Golden Rules */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
              <strong className="text-amber-300 block font-bold">
                ⚠️ Beginner Golden Rules:
              </strong>
              <p>1. Never risk more than 1% to 2% of your entire account on this single trade.</p>
              <p>2. Never average down or move your stop-loss further away if the trade goes against you.</p>
              <p>3. Whales make money by trapping impatient retail traders. Patience is your real edge.</p>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCoordinates}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
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
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-sky-600/30 transition-all cursor-pointer disabled:opacity-50"
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
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-amber-500/20"
                >
                  <CheckSquare className="w-4 h-4" />
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
