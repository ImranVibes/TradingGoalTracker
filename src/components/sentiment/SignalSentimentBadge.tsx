"use client";

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Flame,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

export type SignalSentimentType =
  | "EXTREME_BULLISH"
  | "TOO_MUCH_BULLISH"
  | "HIGHLY_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BALANCED"
  | "BEARISH"
  | "HIGHLY_BEARISH"
  | "EXTREME_BEARISH"
  | "TOO_MUCH_BEARISH";

interface SignalSentimentBadgeProps {
  sentiment: SignalSentimentType;
  score?: number | string;
  label?: string;
  subLabel?: string;
  size?: "sm" | "md";
}

export const SignalSentimentBadge: React.FC<SignalSentimentBadgeProps> = ({
  sentiment,
  score,
  label,
  subLabel,
  size = "md",
}) => {
  const normalized = sentiment.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case "EXTREME_BULLISH":
      case "TOO_MUCH_BULLISH":
        return {
          bg: "bg-emerald-950/40 border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.25)]",
          text: "text-emerald-300",
          pill: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300",
          icon: Flame,
          displayLabel: label || "TOO MUCH BULLISH",
        };
      case "HIGHLY_BULLISH":
      case "BULLISH":
        return {
          bg: "bg-emerald-950/30 border-emerald-500/40",
          text: "text-emerald-400",
          pill: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
          icon: TrendingUp,
          displayLabel: label || (normalized === "HIGHLY_BULLISH" ? "HIGHLY BULLISH" : "BULLISH"),
        };
      case "BEARISH":
      case "HIGHLY_BEARISH":
        return {
          bg: "bg-rose-950/30 border-rose-500/40",
          text: "text-rose-400",
          pill: "bg-rose-500/15 border-rose-500/30 text-rose-300",
          icon: TrendingDown,
          displayLabel: label || (normalized === "HIGHLY_BEARISH" ? "HIGHLY BEARISH" : "BEARISH"),
        };
      case "EXTREME_BEARISH":
      case "TOO_MUCH_BEARISH":
        return {
          bg: "bg-rose-950/50 border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse",
          text: "text-rose-200",
          pill: "bg-rose-600/30 border-rose-400/60 text-rose-200",
          icon: ShieldAlert,
          displayLabel: label || "TOO MUCH BEARISH",
        };
      case "NEUTRAL":
      case "BALANCED":
      default:
        return {
          bg: "bg-amber-950/20 border-amber-500/30",
          text: "text-amber-300",
          pill: "bg-amber-500/15 border-amber-500/30 text-amber-300",
          icon: Activity,
          displayLabel: label || "NEUTRAL / BALANCED",
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase font-mono tracking-wider ${style.bg} ${style.text}`}
      >
        <Icon className="w-3 h-3" />
        <span>{style.displayLabel}</span>
        {score !== undefined && <span className="opacity-80">({score})</span>}
      </span>
    );
  }

  return (
    <div
      className={`px-3 py-1.5 rounded-2xl border flex items-center gap-2 transition-all ${style.bg}`}
    >
      <div className="text-right flex flex-col">
        <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold font-mono">
          {subLabel || "Signal Verdict"}
        </span>
        <span className={`text-xs font-black uppercase tracking-wider font-mono flex items-center gap-1 ${style.text}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{style.displayLabel}</span>
          {score !== undefined && <span className="opacity-90">({score})</span>}
        </span>
      </div>
    </div>
  );
};
