"use client";

import React, { useMemo } from "react";

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
  const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // For Gold/Silver commodities and crypto on Binance:
  // Binance Futures uses BINANCE:XAUUSDT.P or BINANCE:BTCUSDT.P
  // Binance Spot uses BINANCE:BTCUSDT
  const tvSymbol = usePerp ? `BINANCE:${cleanSymbol}.P` : `BINANCE:${cleanSymbol}`;
  const tvInterval = TV_INTERVAL_MAP[interval] || "15";

  // Build direct TradingView widget embed URL.
  // This bypasses external script injection race conditions and enforces strict 100% / 760px container height.
  const iframeSrc = useMemo(() => {
    const params = {
      symbol: tvSymbol,
      frameElementId: "tradingview_advanced_chart",
      interval: tvInterval,
      hide_side_toolbar: "0",
      hide_top_toolbar: "0",
      allow_symbol_change: "1",
      save_image: "1",
      theme: "dark",
      style: "1",
      timezone: "Etc/UTC",
      withdateranges: "1",
      studies: [],
      utm_source: "trading.vibetools.digital",
      utm_medium: "widget",
      utm_campaign: "chart",
      page_uri: "trading.vibetools.digital/chart",
    };

    return `https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(
      JSON.stringify(params)
    )}`;
  }, [tvSymbol, tvInterval]);

  return (
    <div className="w-full flex-1 flex flex-col bg-[#090d16] shrink-0 min-h-[750px]">
      <iframe
        id="tradingview_advanced_chart_iframe"
        key={`${tvSymbol}_${tvInterval}`}
        src={iframeSrc}
        title={`TradingView Chart - ${tvSymbol}`}
        className="w-full shrink-0 border-0 bg-[#090d16]"
        style={{
          height: "760px",
          minHeight: "750px",
          width: "100%",
          display: "block",
        }}
        allow="clipboard-write; fullscreen"
        allowFullScreen
      />
    </div>
  );
};
