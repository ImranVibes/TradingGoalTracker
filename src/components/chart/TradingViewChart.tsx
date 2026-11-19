"use client";

import React, { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval: string;
  usePerp?: boolean;
  onTogglePerp?: (val: boolean) => void;
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

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  interval,
  usePerp = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // For Gold/Silver commodities and crypto on Binance:
  // Binance Futures uses BINANCE:XAUUSDT.P or BINANCE:BTCUSDT.P
  // Binance Spot uses BINANCE:BTCUSDT
  const tvSymbol = usePerp ? `BINANCE:${cleanSymbol}.P` : `BINANCE:${cleanSymbol}`;
  const tvInterval = TV_INTERVAL_MAP[interval] || "15";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetWrapper = document.createElement("div");
    widgetWrapper.className = "tradingview-widget-container__widget";
    widgetWrapper.style.height = "100%";
    widgetWrapper.style.minHeight = "720px";
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
    <div className="w-full h-full flex-1 flex flex-col bg-[#090d16] shrink-0">
      {/* TradingView Advanced Chart Canvas */}
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full shrink-0 flex-1"
        style={{ height: "calc(100vh - 200px)", minHeight: "720px", width: "100%" }}
      />
    </div>
  );
};
