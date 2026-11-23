"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Flame,
  Info,
  Key,
  Layers,
  Lock,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

interface UnifiedWhaleItem {
  id: string;
  source: "WHALE_ALERT_ONCHAIN" | "BINANCE_BLOCK_TRADE" | "BINANCE_WAVE_DUMP";
  timestamp: number;
  timestampIso: string;
  timeAgo: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  price?: number;
  type:
    | "EXCHANGE_INFLOW_DUMP"
    | "EXCHANGE_OUTFLOW_ACCUMULATION"
    | "MARKET_SELL_DUMP"
    | "MARKET_BUY_SWEEP"
    | "WHALE_OTC_TRANSFER";
  from: string;
  to: string;
  fromType: "wallet" | "exchange" | "market_maker" | "aggressor";
  toType: "wallet" | "exchange" | "order_book" | "liquidity_pool";
  txHash?: string;
  blockchain?: string;
  impactTier: "MEGA_WHALE" | "LARGE_WHALE" | "HEAVY";
  details: string;
  isDump: boolean;
}

interface WhaleRadarResponse {
  success: boolean;
  symbol: string;
  binanceSymbol: string;
  engine: string;
  whaleAlertConfigured: boolean;
  whaleAlertError?: string | null;
  summary: {
    totalEvents: number;
    totalDumpUsd: number;
    totalAccumulationUsd: number;
    netFlowUsd: number;
    dumpRiskScore: number;
    dominantState: "HIGH_DUMP_RISK" | "ACCUMULATION_SQUEEZE" | "BALANCED_CHURN";
    summaryHeadline: string;
    actionRecommendation: string;
    maxTxUsd: number;
  };
  transfers: UnifiedWhaleItem[];
}

interface WhaleTransferRadarProps {
  symbol: string;
  currentPrice: number;
}

export const WhaleTransferRadar: React.FC<WhaleTransferRadarProps> = ({
  symbol,
  currentPrice,
}) => {
  const [data, setData] = useState<WhaleRadarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "DUMPS" | "BUYS" | "WAVES">("ALL");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Whale Alert Key Modal State
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [inputApiKey, setInputApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchWhaleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/whales/transfers?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json: WhaleRadarResponse = await res.json();
      if (!json.success) throw new Error("Failed to load whale radar data");
      setData(json);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error("Whale radar fetch error:", err);
      setError(err.message || "Failed to query live whale transfers");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchWhaleData();
    // Auto-refresh every 20 seconds for live order flow tracking
    const interval = setInterval(fetchWhaleData, 20_000);
    return () => clearInterval(interval);
  }, [fetchWhaleData]);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputApiKey.trim()) return;
    try {
      setSavingKey(true);
      setKeySaveMessage(null);
      const res = await fetch("/api/whales/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: inputApiKey.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        setKeySaveMessage({ type: "success", text: result.message || "Connected successfully!" });
        setInputApiKey("");
        setTimeout(() => {
          setIsKeyModalOpen(false);
          setKeySaveMessage(null);
          fetchWhaleData();
        }, 1500);
      } else {
        setKeySaveMessage({ type: "error", text: result.error || "Verification failed." });
      }
    } catch (err: any) {
      setKeySaveMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSavingKey(false);
    }
  };

  const handleDisconnectKey = async () => {
    try {
      setSavingKey(true);
      await fetch("/api/whales/transfers", { method: "DELETE" });
      setIsKeyModalOpen(false);
      fetchWhaleData();
    } catch (err) {
      console.error("Error disconnecting key:", err);
    } finally {
      setSavingKey(false);
    }
  };

  const formatUsd = (val: number) => {
    if (!val || val === 0) return "$0";
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toLocaleString()}`;
  };

  const filteredTransfers = useMemo(() => {
    if (!data?.transfers) return [];
    if (activeFilter === "ALL") return data.transfers;
    if (activeFilter === "DUMPS") return data.transfers.filter((t) => t.isDump);
    if (activeFilter === "BUYS") return data.transfers.filter((t) => !t.isDump);
    if (activeFilter === "WAVES") return data.transfers.filter((t) => t.source === "BINANCE_WAVE_DUMP");
    return data.transfers;
  }, [data?.transfers, activeFilter]);

  const summary = data?.summary;
  const isHighDumpRisk = summary?.dominantState === "HIGH_DUMP_RISK";
  const isAccumulation = summary?.dominantState === "ACCUMULATION_SQUEEZE";

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#0c1322] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient radar glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* ========================================================= */}
      {/* 1. HEADER & LIVE RADAR STATUS                              */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/90 relative z-10">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Live Whale Radar
            </span>

            <span className="text-slate-500 text-xs">•</span>

            <span className="text-xs text-slate-400 font-medium">
              {data?.whaleAlertConfigured ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Dual Engine Active (On-Chain + Order Flow)
                </span>
              ) : (
                <span className="text-sky-400 font-medium flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  Binance Institutional Order Flow Engine (Free Tier)
                </span>
              )}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Market Maker & Whale Transfer Radar
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
              {symbol}
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
            Real-time detection of high-value block orders, market maker multi-part dump waves, and large wallet-to-exchange deposits.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              data?.whaleAlertConfigured
                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40"
                : "bg-slate-900/80 border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{data?.whaleAlertConfigured ? "Whale Alert Connected" : "Connect Whale Alert API"}</span>
          </button>

          <button
            type="button"
            onClick={fetchWhaleData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Radar Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. DUMP RISK SPECTRUM & EXECUTIVE PRESSURE METER           */}
      {/* ========================================================= */}
      {summary && (
        <div className="space-y-4 relative z-10">
          <div
            className={`p-5 sm:p-6 rounded-2xl border transition-all ${
              isHighDumpRisk
                ? "bg-rose-950/25 border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.12)]"
                : isAccumulation
                ? "bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.12)]"
                : "bg-slate-950/60 border-slate-800"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 border ${
                      isHighDumpRisk
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                        : isAccumulation
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {isHighDumpRisk ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        🚨 DUMP RISK: HIGH
                      </>
                    ) : isAccumulation ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        🟢 ACCUMULATION: DOMINANT
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4 text-amber-400" />
                        ⚖️ BALANCED ORDER FLOW
                      </>
                    )}
                  </span>

                  <span className="text-xs font-mono text-slate-400">
                    Dump Pressure Score:{" "}
                    <strong
                      className={`num-tabular font-bold ${
                        isHighDumpRisk
                          ? "text-rose-400"
                          : isAccumulation
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {summary.dumpRiskScore}%
                    </strong>
                  </span>
                </div>

                <h4 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
                  {summary.summaryHeadline}
                </h4>

                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  <strong className="text-white">Strategy Tip:</strong> {summary.actionRecommendation}
                </p>
              </div>

              {/* Dynamic Inflow/Outflow Balance Meter */}
              <div className="min-w-[240px] p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 self-stretch md:self-auto flex flex-col justify-center">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                  <span className="text-emerald-400">Sweeps / Outflows</span>
                  <span className="text-rose-400">Dumps / Inflows</span>
                </div>

                <div className="relative h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-full transition-all duration-500"
                    style={{ width: "100%" }}
                  />
                  {/* Gauge marker */}
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_white] transition-all duration-300"
                    style={{ left: `calc(${summary.dumpRiskScore}% - 4px)` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs font-mono num-tabular">
                  <span className="text-emerald-400 font-bold">{formatUsd(summary.totalAccumulationUsd)}</span>
                  <span className="text-rose-400 font-bold">{formatUsd(summary.totalDumpUsd)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Quick KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Net Whale Inflow / Outflow
              </span>
              <div
                className={`text-xl sm:text-2xl font-black font-mono num-tabular tracking-tight ${
                  summary.netFlowUsd > 0
                    ? "text-emerald-400"
                    : summary.netFlowUsd < 0
                    ? "text-rose-400"
                    : "text-slate-300"
                }`}
              >
                {summary.netFlowUsd > 0 ? `+${formatUsd(summary.netFlowUsd)}` : formatUsd(summary.netFlowUsd)}
              </div>
              <span className="text-[11px] text-slate-400 block">
                {summary.netFlowUsd > 0 ? "Net buying absorption" : "Net market maker sell pressure"}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Total Aggressive Dumps
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono num-tabular tracking-tight text-rose-400">
                {formatUsd(summary.totalDumpUsd)}
              </div>
              <span className="text-[11px] text-slate-400 block">Market sells & exchange deposits</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Total Aggressive Sweeps
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono num-tabular tracking-tight text-emerald-400">
                {formatUsd(summary.totalAccumulationUsd)}
              </div>
              <span className="text-[11px] text-slate-400 block">Market buys & exchange withdrawals</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Largest Single Transfer
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono num-tabular tracking-tight text-amber-400">
                {formatUsd(summary.maxTxUsd)}
              </div>
              <span className="text-[11px] text-slate-400 block">Peak institutional block size</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. FILTER TABS & TRANSACTION FEED                          */}
      {/* ========================================================= */}
      <div className="space-y-3.5 relative z-10 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeFilter === "ALL"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              All Moves ({data?.transfers?.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("DUMPS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "DUMPS"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
              Dumps & Inflows (
              {data?.transfers ? data.transfers.filter((t) => t.isDump).length : 0}
              )
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("BUYS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "BUYS"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              Sweeps & Outflows (
              {data?.transfers ? data.transfers.filter((t) => !t.isDump).length : 0}
              )
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("WAVES")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "WAVES"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              MM Waves (
              {data?.transfers ? data.transfers.filter((t) => t.source === "BINANCE_WAVE_DUMP").length : 0}
              )
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <span>Auto-refresh: 20s</span>
            <span>•</span>
            <span>{lastRefreshedAt.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Transfer Item List */}
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {filteredTransfers.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-2">
              <Info className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-slate-300">No transactions match current filter</p>
              <p className="text-xs text-slate-400">
                Large block orders or deposits will appear here as soon as they execute.
              </p>
            </div>
          ) : (
            filteredTransfers.map((item) => {
              const isDump = item.isDump;
              const isWave = item.source === "BINANCE_WAVE_DUMP";
              const isOnChain = item.source === "WHALE_ALERT_ONCHAIN";

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isDump
                      ? "bg-rose-950/15 border-rose-500/20 hover:border-rose-500/40"
                      : "bg-emerald-950/15 border-emerald-500/20 hover:border-emerald-500/40"
                  }`}
                >
                  {/* Left Column: Icons, Source & Direction */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${
                        isDump ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {isDump ? (
                        <TrendingDown className="w-5 h-5" />
                      ) : (
                        <TrendingUp className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Impact Tier Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider font-mono ${
                            item.impactTier === "MEGA_WHALE"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : item.impactTier === "LARGE_WHALE"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {item.impactTier.replace("_", " ")}
                        </span>

                        {/* Source Tag */}
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                          {isWave
                            ? "🔥 Market Maker Wave"
                            : isOnChain
                            ? `🌐 On-Chain (${item.blockchain || "EVM"})`
                            : "⚡ Futures Aggressive Fill"}
                        </span>

                        <span className="text-slate-500 text-xs">•</span>
                        <span className="text-xs font-mono text-slate-400">{item.timeAgo}</span>
                      </div>

                      {/* Sender -> Recipient Flow */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-200 font-medium">
                        <span className="text-slate-300 font-semibold">{item.from}</span>
                        <span className="text-slate-500 font-bold">➔</span>
                        <span className={isDump ? "text-rose-300 font-bold" : "text-emerald-300 font-bold"}>
                          {item.to}
                        </span>
                      </div>

                      {/* Narrative Detail */}
                      <p className="text-[11px] text-slate-400 leading-snug">{item.details}</p>
                    </div>
                  </div>

                  {/* Right Column: Amount & USD Value */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-slate-800/80 pt-2 md:pt-0 gap-1 flex-shrink-0">
                    <span
                      className={`text-lg sm:text-xl font-black font-mono num-tabular tracking-tight ${
                        isDump ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {formatUsd(item.amountUsd)}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {item.amount >= 1e6
                        ? `${(item.amount / 1e6).toFixed(2)}M`
                        : item.amount >= 1e3
                        ? `${(item.amount / 1e3).toFixed(1)}K`
                        : item.amount.toFixed(2)}{" "}
                      {item.symbol}
                      {item.price ? ` @ $${item.price.toLocaleString()}` : ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. WHALE ALERT API CONNECT MODAL                           */}
      {/* ========================================================= */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0f172a] p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsKeyModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Key className="w-4 h-4" />
                Whale Alert Integration
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Connect Whale Alert API Key
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unlock multi-chain on-chain wallet tracking (Ethereum, Bitcoin, Solana, Binance, Coinbase).
                Free tier accounts at Whale Alert get 10 calls/minute.
              </p>
            </div>

            {keySaveMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                  keySaveMessage.type === "success"
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                }`}
              >
                {keySaveMessage.type === "success" ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span>{keySaveMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Whale Alert API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    placeholder="e.g. 2s9f82kd019..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-white text-sm font-mono tracking-wider focus:outline-none transition-colors"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 text-xs text-slate-400">
                <span className="font-bold text-white block">How to get a Free Key:</span>
                <p>1. Go to <a href="https://developer.whale-alert.io" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-0.5">developer.whale-alert.io <ExternalLink className="w-3 h-3" /></a></p>
                <p>2. Create a free developer account and copy your personal API key.</p>
                <p>3. Paste it here to combine on-chain deposits with live exchange book flow.</p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                {data?.whaleAlertConfigured && (
                  <button
                    type="button"
                    onClick={handleDisconnectKey}
                    disabled={savingKey}
                    className="px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-xs font-bold text-rose-300 transition-colors cursor-pointer"
                  >
                    Disconnect Key
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingKey || !inputApiKey.trim()}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    {savingKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{savingKey ? "Verifying Key..." : "Save & Activate"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
