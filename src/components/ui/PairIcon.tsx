"use client";

import React, { useState, useEffect } from "react";
import { useCoinIcons, parsePairSymbol } from "../providers/CoinIconProvider";
import { cn } from "@/lib/utils";

interface PairIconProps {
  symbol: string;
  size?: "xs" | "sm" | "md" | "lg";
  showQuoteBadge?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: { box: "w-4 h-4", text: "text-[8px]", quote: "w-2.5 h-2.5 -bottom-0.5 -right-0.5" },
  sm: { box: "w-6 h-6", text: "text-[9px]", quote: "w-3 h-3 -bottom-0.5 -right-0.5" },
  md: { box: "w-7 h-7", text: "text-[10px]", quote: "w-3.5 h-3.5 -bottom-0.5 -right-0.5" },
  lg: { box: "w-9 h-9", text: "text-xs", quote: "w-4 h-4 -bottom-0.5 -right-0.5" },
};

const GRADIENT_PALETTE = [
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-violet-600",
];

function getGradientForSymbol(sym: string): string {
  let hash = 0;
  for (let i = 0; i < sym.length; i++) {
    hash = sym.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PALETTE[Math.abs(hash) % GRADIENT_PALETTE.length];
}

const SPECIAL_BADGES: Record<
  string,
  { bg: string; label: string; ring: string; textColor: string }
> = {
  XAU: {
    bg: "bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700",
    label: "Au",
    ring: "ring-amber-400/50",
    textColor: "text-slate-950 font-black",
  },
  XAG: {
    bg: "bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600",
    label: "Ag",
    ring: "ring-slate-300/50",
    textColor: "text-slate-950 font-black",
  },
  USOIL: {
    bg: "bg-gradient-to-br from-zinc-700 to-zinc-950",
    label: "OIL",
    ring: "ring-amber-500/40",
    textColor: "text-amber-300 font-bold",
  },
  WTI: {
    bg: "bg-gradient-to-br from-zinc-700 to-zinc-950",
    label: "WTI",
    ring: "ring-amber-500/40",
    textColor: "text-amber-300 font-bold",
  },
  EUR: {
    bg: "bg-gradient-to-br from-blue-600 to-indigo-700",
    label: "€",
    ring: "ring-blue-400/40",
    textColor: "text-amber-300 font-black",
  },
  GBP: {
    bg: "bg-gradient-to-br from-indigo-600 to-rose-600",
    label: "£",
    ring: "ring-rose-400/40",
    textColor: "text-white font-black",
  },
  USD: {
    bg: "bg-gradient-to-br from-emerald-600 to-green-800",
    label: "$",
    ring: "ring-emerald-400/40",
    textColor: "text-white font-black",
  },
  JPY: {
    bg: "bg-gradient-to-br from-rose-500 to-red-700",
    label: "¥",
    ring: "ring-rose-400/40",
    textColor: "text-white font-black",
  },
  AUD: {
    bg: "bg-gradient-to-br from-sky-600 to-blue-800",
    label: "A$",
    ring: "ring-sky-400/40",
    textColor: "text-white font-bold",
  },
  CAD: {
    bg: "bg-gradient-to-br from-red-600 to-rose-700",
    label: "C$",
    ring: "ring-red-400/40",
    textColor: "text-white font-bold",
  },
  CHF: {
    bg: "bg-gradient-to-br from-red-600 to-red-800",
    label: "Fr",
    ring: "ring-red-400/40",
    textColor: "text-white font-bold",
  },
  NAS100: {
    bg: "bg-gradient-to-br from-cyan-500 to-blue-700",
    label: "NQ",
    ring: "ring-cyan-400/40",
    textColor: "text-white font-black",
  },
  US30: {
    bg: "bg-gradient-to-br from-blue-600 to-slate-800",
    label: "30",
    ring: "ring-blue-400/40",
    textColor: "text-white font-black",
  },
};

export const PairIcon: React.FC<PairIconProps> = ({
  symbol,
  size = "sm",
  showQuoteBadge = false,
  className,
}) => {
  const { getAssetIcon } = useCoinIcons();
  const [imgError, setImgError] = useState(false);
  const [quoteError, setQuoteError] = useState(false);

  const { base, lookupBase, quote } = parsePairSymbol(symbol);
  const baseUrl = getAssetIcon(lookupBase) || getAssetIcon(base);
  const quoteUrl = showQuoteBadge && quote ? getAssetIcon(quote) : null;

  useEffect(() => {
    setImgError(false);
    setQuoteError(false);
  }, [symbol, baseUrl, quoteUrl]);

  const sz = SIZE_MAP[size];
  const special = SPECIAL_BADGES[lookupBase] || SPECIAL_BADGES[base];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center flex-shrink-0", sz.box, className)}
      title={symbol}
    >
      {baseUrl && !imgError ? (
        <img
          src={baseUrl}
          alt={base || symbol}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={cn(
            "rounded-full object-cover bg-slate-900 ring-1 ring-slate-700/80 shadow-sm",
            sz.box
          )}
        />
      ) : special ? (
        <div
          className={cn(
            "rounded-full flex items-center justify-center ring-1 shadow-sm select-none",
            sz.box,
            sz.text,
            special.bg,
            special.ring,
            special.textColor
          )}
        >
          {special.label}
        </div>
      ) : (
        <div
          className={cn(
            "rounded-full flex items-center justify-center bg-gradient-to-br text-white font-mono font-bold ring-1 ring-white/15 shadow-sm select-none",
            sz.box,
            sz.text,
            getGradientForSymbol(lookupBase || symbol || "?")
          )}
        >
          {(lookupBase || symbol || "?").slice(0, 3)}
        </div>
      )}

      {showQuoteBadge && quoteUrl && !quoteError && (
        <img
          src={quoteUrl}
          alt={quote || ""}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setQuoteError(true)}
          className={cn(
            "absolute rounded-full object-cover bg-[#0f172a] ring-2 ring-[#0f172a]",
            sz.quote
          )}
        />
      )}
    </div>
  );
};
