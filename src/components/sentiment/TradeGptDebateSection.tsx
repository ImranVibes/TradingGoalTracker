"use client";

import React from "react";
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Target,
  Sparkles,
  Bot,
  Compass,
} from "lucide-react";
import { TradeGptDebate } from "@/lib/technicalAnalysis";

interface TradeGptDebateSectionProps {
  symbol: string;
  currentPrice: number;
  debate: TradeGptDebate | null;
}

export const TradeGptDebateSection: React.FC<TradeGptDebateSectionProps> = ({
  symbol,
  currentPrice,
  debate,
}) => {
  if (!debate) return null;

  const {
    netEdge,
    bullScore,
    bearScore,
    bullishArguments,
    bearishArguments,
    researchManagerVerdict,
  } = debate;

  const isBullDominant = bullScore > bearScore;

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#0c1322] p-6 sm:p-8 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-inner">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                TradeGPT Dual-Thesis Debate
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-500/15 border border-violet-500/30 text-violet-300">
                Institutional AI Desk
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Simulates a live multi-analyst trading desk: Bull Advocate vs. Bear Advocate with Head of Research decision
            </p>
          </div>
        </div>

        {/* Conviction Bar */}
        <div className="flex items-center gap-3 min-w-[240px]">
          <span className="text-xs font-mono font-black text-emerald-400">{bullScore}% Bull</span>
          <div className="flex-1 h-3.5 rounded-full bg-slate-950 p-0.5 flex overflow-hidden border border-slate-800">
            <div
              className="bg-emerald-500 rounded-l-full transition-all duration-500"
              style={{ width: `${bullScore}%` }}
            />
            <div
              className="bg-rose-500 rounded-r-full transition-all duration-500"
              style={{ width: `${bearScore}%` }}
            />
          </div>
          <span className="text-xs font-mono font-black text-rose-400">{bearScore}% Bear</span>
        </div>
      </div>

      {/* Head of Research / Lead Verdict Card */}
      <div
        className={`p-6 rounded-2xl border transition-all space-y-3 ${
          netEdge === "BULLISH"
            ? "bg-gradient-to-r from-emerald-950/40 via-slate-900 to-[#0c1322] border-emerald-500/40"
            : netEdge === "BEARISH"
            ? "bg-gradient-to-r from-rose-950/40 via-slate-900 to-[#0c1322] border-rose-500/40"
            : "bg-gradient-to-r from-amber-950/40 via-slate-900 to-[#0c1322] border-amber-500/40"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-sky-400" />
            <span className="text-xs uppercase tracking-widest font-bold text-slate-300">
              Chief Research Manager Decision
            </span>
          </div>

          <span
            className={`px-3.5 py-1 rounded-full text-xs font-black tracking-wide border ${
              netEdge === "BULLISH"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                : netEdge === "BEARISH"
                ? "bg-rose-500/20 text-rose-300 border-rose-400/40"
                : "bg-amber-500/20 text-amber-300 border-amber-400/40"
            }`}
          >
            {researchManagerVerdict.headline}
          </span>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed font-medium">
          {researchManagerVerdict.actionPlan}
        </p>

        {/* 4-Box Key Execution Targets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Optimal Long Zone
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-emerald-400 truncate block">
              {researchManagerVerdict.optimalLongZone}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Optimal Short Zone
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-rose-400 truncate block">
              {researchManagerVerdict.optimalShortZone}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Key Trend Pivot
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-sky-400 truncate block">
              ${researchManagerVerdict.keyPivotLevel.toLocaleString()}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Hard Invalidation
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-amber-400 truncate block">
              ${researchManagerVerdict.invalidationLevel.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Debate Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BULL ADVOCATE */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-900/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-900/30">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-emerald-300">
                Bull Advocate ({bullishArguments.length} Arguments)
              </span>
            </div>
            <span className="text-xs font-mono font-black text-emerald-400">
              {bullScore}% Weight
            </span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {bullishArguments.length > 0 ? (
              bullishArguments.map((arg, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/70 border border-emerald-950/50 space-y-1 hover:border-emerald-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{arg.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                      {arg.indicator}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{arg.detail}</p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                No dominant bullish technical or flow catalysts detected on this timeframe.
              </div>
            )}
          </div>
        </div>

        {/* BEAR ADVOCATE */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-rose-900/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-rose-900/30">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-rose-300">
                Bear Advocate ({bearishArguments.length} Arguments)
              </span>
            </div>
            <span className="text-xs font-mono font-black text-rose-400">
              {bearScore}% Weight
            </span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {bearishArguments.length > 0 ? (
              bearishArguments.map((arg, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/70 border border-rose-950/50 space-y-1 hover:border-rose-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{arg.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30">
                      {arg.indicator}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{arg.detail}</p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                No dominant bearish technical or flow catalysts detected on this timeframe.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
