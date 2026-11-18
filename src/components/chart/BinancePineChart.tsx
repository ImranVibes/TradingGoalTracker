"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  LineStyle,
  Time,
  SeriesMarker,
} from "lightweight-charts";
import {
  Candle,
  IndicatorRunResult,
  PINE_TEMPLATES,
  runIndicatorScript,
} from "@/lib/pineEngine";
import { CustomIndicator, Trade } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Play,
  Save,
  Trash2,
  Code2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  Edit2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";

interface BinancePineChartProps {
  symbol: string;
  interval: string;
}

export const BinancePineChart: React.FC<BinancePineChartProps> = ({ symbol, interval }) => {
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const oscContainerRef = useRef<HTMLDivElement | null>(null);

  const mainChartRef = useRef<IChartApi | null>(null);
  const oscChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const mainOverlaySeriesRef = useRef<ISeriesApi<any>[]>([]);
  const mainPriceLinesRef = useRef<any[]>([]);
  const oscSeriesRef = useRef<ISeriesApi<any>[]>([]);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [marketType, setMarketType] = useState<"futures" | "spot">("futures");
  const [wsConnected, setWsConnected] = useState(false);
  const [loadingCandles, setLoadingCandles] = useState(true);
  const [candleError, setCandleError] = useState<string | null>(null);

  // User trades overlay
  const [showMyTrades, setShowMyTrades] = useState(true);
  const [symbolTrades, setSymbolTrades] = useState<Trade[]>([]);

  // Saved Custom Indicators (PostgreSQL)
  const [savedIndicators, setSavedIndicators] = useState<CustomIndicator[]>([]);

  // Active Pine Script Editor state
  const [editorOpen, setEditorOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scriptName, setScriptName] = useState("EMA 9 / 21 Crossover Signals");
  const [scriptLang, setScriptLang] = useState<"pine" | "js">("pine");
  const [scriptOverlay, setScriptOverlay] = useState<boolean>(true);
  const [scriptCode, setScriptCode] = useState(PINE_TEMPLATES[0].code);
  const [previewActive, setPreviewActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorFeedback, setEditorFeedback] = useState<{
    type: "success" | "error" | "warn";
    text: string;
  } | null>(null);

  const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Fetch saved indicators from DB
  const fetchIndicators = useCallback(async () => {
    try {
      const res = await fetch("/api/indicators");
      const data = await res.json();
      if (data.success && Array.isArray(data.indicators)) {
        setSavedIndicators(data.indicators);
      }
    } catch (err) {
      console.error("[Chart] Failed to fetch indicators:", err);
    }
  }, []);

  useEffect(() => {
    fetchIndicators();
  }, [fetchIndicators]);

  // Fetch user's logged trades for this symbol so we can mark entries/exits on the candles
  useEffect(() => {
    fetch(`/api/trades?symbol=${encodeURIComponent(cleanSymbol)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.trades)) {
          setSymbolTrades(data.trades);
        } else {
          setSymbolTrades([]);
        }
      })
      .catch(() => setSymbolTrades([]));
  }, [cleanSymbol]);

  // Fetch historical klines from our Binance proxy + open live WebSocket
  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;

    setLoadingCandles(true);
    setCandleError(null);
    setWsConnected(false);

    fetch(`/api/binance/klines?symbol=${encodeURIComponent(cleanSymbol)}&interval=${interval}&limit=500`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (!data.success || !Array.isArray(data.candles)) {
          setCandleError(data.error || `Could not load Binance candles for ${cleanSymbol}`);
          setCandles([]);
          setLoadingCandles(false);
          return;
        }
        setCandles(data.candles);
        setMarketType(data.market === "spot" ? "spot" : "futures");
        setLoadingCandles(false);

        // Open Live WebSocket for real-time candle updates
        try {
          const wsBase =
            data.market === "spot"
              ? "wss://stream.binance.com:9443/ws"
              : "wss://fstream.binance.com/ws";
          ws = new WebSocket(`${wsBase}/${cleanSymbol.toLowerCase()}@kline_${interval}`);
          ws.onopen = () => {
            if (active) setWsConnected(true);
          };
          ws.onclose = () => {
            if (active) setWsConnected(false);
          };
          ws.onerror = () => {
            if (active) setWsConnected(false);
          };
          ws.onmessage = (evt) => {
            if (!active) return;
            try {
              const msg = JSON.parse(evt.data);
              const k = msg.k;
              if (!k) return;
              const liveCandle: Candle = {
                time: Math.floor(Number(k.t) / 1000),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
              };
              setCandles((prev) => {
                if (prev.length === 0) return [liveCandle];
                const last = prev[prev.length - 1];
                if (last.time === liveCandle.time) {
                  const next = prev.slice();
                  next[next.length - 1] = liveCandle;
                  return next;
                }
                if (liveCandle.time > last.time) {
                  return [...prev.slice(-499), liveCandle];
                }
                return prev;
              });
            } catch {
              // ignore malformed ws message
            }
          };
        } catch {
          // WS optional fallback
        }
      })
      .catch((err) => {
        if (!active) return;
        setCandleError(err.message || "Network error loading Binance candles");
        setLoadingCandles(false);
      });

    return () => {
      active = false;
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [cleanSymbol, interval]);

  // Execute all enabled saved indicators + active editor preview
  const runResults = useMemo(() => {
    if (candles.length === 0) return [] as { id: string; result: IndicatorRunResult }[];
    const list: { id: string; result: IndicatorRunResult }[] = [];

    for (const ind of savedIndicators) {
      if (!ind.is_enabled) continue;
      // Avoid duplicate if currently previewing the exact same saved ID
      if (previewActive && editingId === ind.id) continue;
      const res = runIndicatorScript(ind.code, candles, ind.language, ind.overlay);
      list.push({ id: ind.id, result: res });
    }

    if (previewActive && scriptCode.trim()) {
      const res = runIndicatorScript(scriptCode, candles, scriptLang, scriptOverlay);
      list.push({ id: "__preview__", result: res });
    }

    return list;
  }, [candles, savedIndicators, previewActive, editingId, scriptCode, scriptLang, scriptOverlay]);

  const hasOscillatorPane = useMemo(
    () =>
      runResults.some(
        (r) => r.result.success && !r.result.overlay && (r.result.lines.length > 0 || r.result.hlines.length > 0)
      ),
    [runResults]
  );

  // Initialize Main Lightweight Chart once
  useEffect(() => {
    const el = mainContainerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: "#090d16" },
        textColor: "#94a3b8",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.45)" },
        horzLines: { color: "rgba(30, 41, 59, 0.45)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    mainChartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volSeriesRef.current = volSeries;

    const handleResize = () => {
      if (el && mainChartRef.current) {
        mainChartRef.current.applyOptions({ width: el.clientWidth });
      }
      if (oscContainerRef.current && oscChartRef.current) {
        oscChartRef.current.applyOptions({ width: oscContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      mainChartRef.current = null;
      candleSeriesRef.current = null;
      volSeriesRef.current = null;
      mainOverlaySeriesRef.current = [];
      mainPriceLinesRef.current = [];
    };
  }, []);

  // Initialize / Tear down Lower Oscillator Pane dynamically
  useEffect(() => {
    if (!hasOscillatorPane) {
      if (oscChartRef.current) {
        oscChartRef.current.remove();
        oscChartRef.current = null;
        oscSeriesRef.current = [];
      }
      return;
    }

    const el = oscContainerRef.current;
    if (!el || oscChartRef.current) return;

    const oscChart = createChart(el, {
      width: el.clientWidth,
      height: 175,
      layout: {
        background: { type: ColorType.Solid, color: "#090d16" },
        textColor: "#94a3b8",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.35)" },
        horzLines: { color: "rgba(30, 41, 59, 0.35)" },
      },
      rightPriceScale: {
        borderColor: "#1e293b",
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    oscChartRef.current = oscChart;

    // Sync visible range from Main Chart -> Oscillator Chart
    const main = mainChartRef.current;
    if (main) {
      const range = main.timeScale().getVisibleLogicalRange();
      if (range) oscChart.timeScale().setVisibleLogicalRange(range);

      const syncHandler = (r: any) => {
        if (r && oscChartRef.current) {
          oscChartRef.current.timeScale().setVisibleLogicalRange(r);
        }
      };
      main.timeScale().subscribeVisibleLogicalRangeChange(syncHandler);

      return () => {
        main.timeScale().unsubscribeVisibleLogicalRangeChange(syncHandler);
        oscChart.remove();
        oscChartRef.current = null;
        oscSeriesRef.current = [];
      };
    }

    return () => {
      oscChart.remove();
      oscChartRef.current = null;
      oscSeriesRef.current = [];
    };
  }, [hasOscillatorPane]);

  // Update Candles + Volume Series
  useEffect(() => {
    if (!candleSeriesRef.current || !volSeriesRef.current || candles.length === 0) return;

    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(34, 197, 94, 0.22)" : "rgba(239, 68, 68, 0.22)",
      }))
    );
  }, [candles]);

  // Fit content when switching symbol or interval
  useEffect(() => {
    if (candles.length > 0 && mainChartRef.current) {
      mainChartRef.current.timeScale().fitContent();
    }
  }, [cleanSymbol, interval, candles.length === 0]);

  // Render Pine Script / JS Indicator Series, HLines, and Signal + Trade Markers
  useEffect(() => {
    const mainChart = mainChartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!mainChart || !candleSeries) return;

    // Clear old overlay series
    for (const s of mainOverlaySeriesRef.current) {
      try {
        mainChart.removeSeries(s);
      } catch {}
    }
    mainOverlaySeriesRef.current = [];

    for (const pl of mainPriceLinesRef.current) {
      try {
        candleSeries.removePriceLine(pl);
      } catch {}
    }
    mainPriceLinesRef.current = [];

    // Clear old oscillator series
    const oscChart = oscChartRef.current;
    if (oscChart) {
      for (const s of oscSeriesRef.current) {
        try {
          oscChart.removeSeries(s);
        } catch {}
      }
      oscSeriesRef.current = [];
    }

    const allMarkers: SeriesMarker<Time>[] = [];

    for (const { result } of runResults) {
      if (!result.success) continue;

      for (const line of result.lines) {
        if (line.data.length === 0) continue;
        const targetChart = line.overlay ? mainChart : oscChart;
        if (!targetChart) continue;

        let series: ISeriesApi<any>;
        if (line.style === "histogram") {
          series = targetChart.addHistogramSeries({
            title: line.title,
            color: line.color,
            priceLineVisible: false,
          });
          series.setData(
            line.data.map((pt) => ({
              time: pt.time as Time,
              value: pt.value,
              color: pt.color || line.color,
            }))
          );
        } else {
          series = targetChart.addLineSeries({
            title: line.title,
            color: line.color,
            lineWidth: line.lineWidth as 1 | 2 | 3 | 4,
            lineType: line.style === "stepline" ? 1 : 0,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          series.setData(
            line.data.map((pt) => ({
              time: pt.time as Time,
              value: pt.value,
              color: pt.color || line.color,
            }))
          );
        }

        if (line.overlay) {
          mainOverlaySeriesRef.current.push(series);
        } else {
          oscSeriesRef.current.push(series);
        }
      }

      // Render HLines
      for (const hl of result.hlines) {
        if (hl.overlay) {
          const pl = candleSeries.createPriceLine({
            price: hl.price,
            color: hl.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: hl.title,
          });
          mainPriceLinesRef.current.push(pl);
        } else if (oscChart && oscSeriesRef.current.length > 0) {
          oscSeriesRef.current[0].createPriceLine({
            price: hl.price,
            color: hl.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: hl.title,
          });
        }
      }

      // Collect Pine Script plotshape / strategy markers
      for (const m of result.markers) {
        allMarkers.push({
          time: m.time as Time,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
        });
      }
    }

    // Overlay User's Actual Journal / Synced Trades for this symbol!
    if (showMyTrades && candles.length > 0 && symbolTrades.length > 0) {
      const firstCandleTime = candles[0].time;
      const lastCandleTime = candles[candles.length - 1].time;

      for (const tr of symbolTrades) {
        const tSec = Math.floor(new Date(tr.trade_date).getTime() / 1000);
        if (tSec < firstCandleTime || tSec > lastCandleTime + 86400) continue;

        // Snap trade timestamp to nearest candle bar
        let nearest = candles[0].time;
        let minDiff = Infinity;
        for (const c of candles) {
          const d = Math.abs(c.time - tSec);
          if (d < minDiff) {
            minDiff = d;
            nearest = c.time;
          }
        }

        const isLong = tr.direction === "LONG";
        const pnlStr = formatCurrency(tr.pnl, true);
        allMarkers.push({
          time: nearest as Time,
          position: isLong ? "belowBar" : "aboveBar",
          color: tr.pnl >= 0 ? "#10b981" : "#f43f5e",
          shape: isLong ? "arrowUp" : "arrowDown",
          text: `${tr.direction} ${pnlStr}`,
        });
      }
    }

    // lightweight-charts requires markers sorted strictly ascending by time
    allMarkers.sort((a, b) => Number(a.time) - Number(b.time));
    candleSeries.setMarkers(allMarkers);
  }, [runResults, showMyTrades, symbolTrades, candles, hasOscillatorPane]);

  // Run current script in editor as live preview
  const handleRunPreview = () => {
    if (!scriptCode.trim()) {
      setEditorFeedback({ type: "error", text: "Paste or write Pine Script code first." });
      return;
    }

    // Auto-detect title & overlay from Pine `indicator(...)` header
    let detectedOverlay = scriptOverlay;
    if (scriptLang === "pine") {
      const mOverlay = scriptCode.match(/overlay\s*=\s*(true|false)/i);
      if (mOverlay) {
        detectedOverlay = mOverlay[1].toLowerCase() === "true";
        setScriptOverlay(detectedOverlay);
      }
      const mTitle = scriptCode.match(/\b(?:indicator|study|strategy)\s*\(\s*["']([^"']+)["']/);
      if (mTitle && (!scriptName.trim() || scriptName === "Custom Indicator")) {
        setScriptName(mTitle[1]);
      }
    }

    const testRun = runIndicatorScript(scriptCode, candles, scriptLang, detectedOverlay);
    if (!testRun.success) {
      setEditorFeedback({ type: "error", text: testRun.error || "Script execution failed." });
      return;
    }

    setPreviewActive(true);
    const totalPlots = testRun.lines.length + testRun.hlines.length;
    const totalSignals = testRun.markers.length;
    if (totalPlots === 0 && totalSignals === 0) {
      setEditorFeedback({
        type: "warn",
        text: "Script compiled, but produced 0 plot() or plotshape() calls. Make sure your script has plot() or plotshape().",
      });
    } else {
      const warnSuffix = testRun.warnings.length > 0 ? ` (${testRun.warnings.join("; ")})` : "";
      setEditorFeedback({
        type: "success",
        text: `Live on chart: ${testRun.lines.length} line(s), ${totalSignals} signal(s), ${testRun.hlines.length} level(s).${warnSuffix}`,
      });
    }
  };

  // Save current editor script to PostgreSQL
  const handleSaveIndicator = async () => {
    if (!scriptCode.trim()) {
      setEditorFeedback({ type: "error", text: "Indicator code cannot be empty." });
      return;
    }

    let finalName = scriptName.trim();
    let finalOverlay = scriptOverlay;
    if (scriptLang === "pine") {
      const mOverlay = scriptCode.match(/overlay\s*=\s*(true|false)/i);
      if (mOverlay) finalOverlay = mOverlay[1].toLowerCase() === "true";
      const mTitle = scriptCode.match(/\b(?:indicator|study|strategy)\s*\(\s*["']([^"']+)["']/);
      if (!finalName && mTitle) finalName = mTitle[1];
    }
    if (!finalName) finalName = "Custom Pine Indicator";

    setSaving(true);
    setEditorFeedback(null);
    try {
      const res = await fetch("/api/indicators", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          name: finalName,
          code: scriptCode,
          language: scriptLang,
          overlay: finalOverlay,
          is_enabled: true,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setEditorFeedback({ type: "error", text: data.error || "Failed to save indicator." });
      } else {
        setEditingId(data.indicator.id);
        setScriptName(data.indicator.name);
        setScriptOverlay(data.indicator.overlay);
        setPreviewActive(false);
        await fetchIndicators();
        setEditorFeedback({
          type: "success",
          text: `Saved "${data.indicator.name}" permanently and activated on chart!`,
        });
      }
    } catch (err: any) {
      setEditorFeedback({ type: "error", text: err.message || "Error saving indicator." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSaved = async (ind: CustomIndicator) => {
    const nextEnabled = !ind.is_enabled;
    setSavedIndicators((prev) =>
      prev.map((i) => (i.id === ind.id ? { ...i, is_enabled: nextEnabled } : i))
    );
    try {
      await fetch("/api/indicators", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ind, is_enabled: nextEnabled }),
      });
    } catch {
      await fetchIndicators();
    }
  };

  const handleDeleteSaved = async (ind: CustomIndicator) => {
    if (!confirm(`Delete indicator "${ind.name}"?`)) return;
    try {
      await fetch(`/api/indicators?id=${ind.id}`, { method: "DELETE" });
      if (editingId === ind.id) {
        setEditingId(null);
        setPreviewActive(false);
      }
      await fetchIndicators();
    } catch (err) {
      console.error(err);
    }
  };

  const loadTemplate = (tpl: (typeof PINE_TEMPLATES)[number]) => {
    setEditingId(null);
    setScriptName(tpl.name);
    setScriptLang("pine");
    setScriptOverlay(tpl.overlay);
    setScriptCode(tpl.code);
    setPreviewActive(true);
    setEditorOpen(true);
    setEditorFeedback({
      type: "success",
      text: `Loaded "${tpl.name}" on chart! Click "Save Indicator" if you want to keep it permanently.`,
    });
  };

  const loadSavedIntoEditor = (ind: CustomIndicator) => {
    setEditingId(ind.id);
    setScriptName(ind.name);
    setScriptLang(ind.language);
    setScriptOverlay(ind.overlay);
    setScriptCode(ind.code);
    setPreviewActive(false);
    setEditorOpen(true);
    setEditorFeedback(null);
  };

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const priceChangePct =
    lastCandle && prevCandle && prevCandle.close > 0
      ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100
      : 0;

  return (
    <div className="space-y-4">
      {/* Live Binance Chart Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#090d16] overflow-hidden shadow-xl">
        {/* Top Ticker & Active Indicators Strip */}
        <div className="px-4 py-2.5 border-b border-slate-800 bg-[#0f172a] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-white">{cleanSymbol}</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                Binance {marketType === "futures" ? "Futures" : "Spot"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {interval}
              </span>
            </div>

            {lastCandle && (
              <div className="flex items-center gap-2 font-mono">
                <span
                  className={`text-sm font-black ${
                    priceChangePct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  ${lastCandle.close.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </span>
                <span
                  className={`text-[11px] ${
                    priceChangePct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  ({priceChangePct >= 0 ? "+" : ""}
                  {priceChangePct.toFixed(2)}%)
                </span>
              </div>
            )}

            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                wsConnected
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              {wsConnected ? "LIVE WS" : "SNAPSHOT"}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowMyTrades(!showMyTrades)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1.5 ${
                showMyTrades
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
              title="Overlay your logged/synced positions for this symbol on the candles"
            >
              <Target className="w-3 h-3" />
              My Trades ({symbolTrades.length})
            </button>

            <button
              type="button"
              onClick={() => setEditorOpen(!editorOpen)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30 transition-colors flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5" />
              Pine Script Studio
              {editorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Saved Indicators Toggle Bar */}
        {savedIndicators.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-800/80 bg-[#0b101d] flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Saved Indicators:
            </span>
            {savedIndicators.map((ind) => (
              <div
                key={ind.id}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] transition-colors ${
                  ind.is_enabled
                    ? "bg-sky-500/15 border-sky-500/40 text-sky-200"
                    : "bg-slate-900 border-slate-800 text-slate-500"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleSaved(ind)}
                  className="flex items-center gap-1 font-semibold hover:text-white"
                  title={ind.is_enabled ? "Hide indicator" : "Show indicator"}
                >
                  {ind.is_enabled ? <Eye className="w-3 h-3 text-sky-400" /> : <EyeOff className="w-3 h-3" />}
                  {ind.name}
                </button>
                <button
                  type="button"
                  onClick={() => loadSavedIntoEditor(ind)}
                  className="p-0.5 text-slate-400 hover:text-white"
                  title="Edit Pine Script code"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSaved(ind)}
                  className="p-0.5 text-slate-500 hover:text-rose-400"
                  title="Delete saved indicator"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chart Canvas Area */}
        <div className="relative">
          {loadingCandles && (
            <div className="absolute inset-0 z-10 bg-[#090d16]/80 flex items-center justify-center gap-2 text-xs text-slate-300">
              <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
              Loading live Binance {cleanSymbol} ({interval}) candles...
            </div>
          )}

          {candleError && (
            <div className="p-6 text-center text-xs text-rose-300 bg-rose-500/5">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-rose-400" />
              {candleError}
            </div>
          )}

          <div ref={mainContainerRef} className="w-full h-[500px]" />

          {/* Dynamic Lower Oscillator Pane (RSI, MACD, Stochastic, etc.) */}
          {hasOscillatorPane && (
            <div className="border-t border-slate-800">
              <div className="px-3 py-1 bg-[#0b101d] text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Lower Oscillator Pane (overlay=false)
              </div>
              <div ref={oscContainerRef} className="w-full h-[175px]" />
            </div>
          )}
        </div>
      </div>

      {/* Pine Script & Custom Indicator Editor Studio */}
      {editorOpen && (
        <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-sky-400" />
                Pine Script & Custom Indicator Studio
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Paste Pine Script v4/v5/v6 indicators (`ta.ema`, `ta.sma`, `ta.rsi`, `ta.supertrend`, `ta.macd`, `ta.bb`, `ta.vwap`, `plot`, `plotshape`, `hline`, `strategy.entry`) and run them directly on live Binance candles.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setScriptName("My Custom Indicator");
                setScriptLang("pine");
                setScriptOverlay(true);
                setScriptCode(`//@version=5\nindicator("My Custom Indicator", overlay=true)\n`);
                setPreviewActive(false);
                setEditorFeedback(null);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" /> New Blank Script
            </button>
          </div>

          {/* Quick 1-Click Pine Templates */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quick Pine Scripts:
            </span>
            {PINE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => loadTemplate(tpl)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-sky-500/40 transition-colors text-[11px] font-medium"
              >
                {tpl.name}
              </button>
            ))}
          </div>

          {/* Script Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Indicator Name
              </label>
              <input
                type="text"
                value={scriptName}
                onChange={(e) => setScriptName(e.target.value)}
                placeholder="e.g. My Trend Strategy"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Script Language
              </label>
              <select
                value={scriptLang}
                onChange={(e) => setScriptLang(e.target.value as "pine" | "js")}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="pine">TradingView Pine Script (v4 / v5 / v6)</option>
                <option value="js">Custom JavaScript</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Chart Placement
              </label>
              <select
                value={scriptOverlay ? "overlay" : "oscillator"}
                onChange={(e) => setScriptOverlay(e.target.value === "overlay")}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="overlay">Overlay on Price Candles (overlay=true)</option>
                <option value="oscillator">Lower Oscillator Pane (overlay=false)</option>
              </select>
            </div>
          </div>

          {/* Code Textarea */}
          <div>
            <textarea
              rows={11}
              value={scriptCode}
              onChange={(e) => setScriptCode(e.target.value)}
              spellCheck={false}
              placeholder="Paste your TradingView Pine Script indicator here..."
              className="w-full rounded-xl bg-[#090d16] border border-slate-800 p-3.5 text-xs font-mono text-sky-100 leading-relaxed focus:outline-none focus:border-sky-500 resize-y"
            />
          </div>

          {/* Feedback / Compiler Console */}
          {editorFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                editorFeedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : editorFeedback.type === "warn"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {editorFeedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{editorFeedback.text}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {previewActive ? (
              <button
                type="button"
                onClick={() => {
                  setPreviewActive(false);
                  setEditorFeedback(null);
                }}
                className="text-xs text-slate-400 hover:text-rose-400 underline"
              >
                Clear Live Preview
              </button>
            ) : (
              <span className="text-[11px] text-slate-500">
                Tip: Saved indicators automatically stay active across all pairs & timeframes.
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunPreview}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                Run on Chart
              </button>

              <button
                type="button"
                onClick={handleSaveIndicator}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : editingId ? "Update Saved" : "Save Indicator"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
