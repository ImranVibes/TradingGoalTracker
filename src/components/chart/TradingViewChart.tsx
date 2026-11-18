"use client";

import React, { useEffect, useRef, useState } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval: string;
}

const TV_INTERVAL_MAP: Record<string, string> = {
  "1m": "1",
  "3m": "3",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "2h": "120",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol, interval }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [usePerp, setUsePerp] = useState(true);

  const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const tvSymbol = usePerp ? `BINANCE:${cleanSymbol}.P` : `BINANCE:${cleanSymbol}`;
  const tvInterval = TV_INTERVAL_MAP[interval] || "15";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetWrapper = document.createElement("div");
    widgetWrapper.className = "tradingview-widget-container__widget";
    widgetWrapper.style.height = "100%";
    widgetWrapper.style.width = "100%";
    container.appendChild(widgetWrapper);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: tvInterval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(9, 13, 22, 1)",
      gridColor: "rgba(30, 41, 59, 0.45)",
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      withdateranges: true,
      save_image: true,
      details: false,
      hotlist: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = "";
    };
  }, [tvSymbol, tvInterval]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#090d16] overflow-hidden shadow-xl flex flex-col">
      <div className="px-3.5 py-2 border-b border-slate-800 bg-[#0f172a] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="font-mono font-bold text-white">{tvSymbol}</span>
          <span className="text-[11px] text-slate-400">
            Full TradingView drawing tools, Fibs, Long/Short position tool & built-in studies
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setUsePerp(true)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
              usePerp ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Futures (.P)
          </button>
          <button
            type="button"
            onClick={() => setUsePerp(false)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
              !usePerp ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Spot
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="tradingview-widget-container w-full h-[640px] lg:h-[720px]"
      />
    </div>
  );
};
