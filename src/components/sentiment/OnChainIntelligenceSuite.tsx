"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Coins,
  Cpu,
  Crosshair,
  ExternalLink,
  Flame,
  Globe,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Percent,
  Radio,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Unlock,
  Zap,
} from "lucide-react";
import { SignalSentimentBadge, SignalSentimentType } from "./SignalSentimentBadge";

interface OnChainIntelligenceResponse {
  success: boolean;
  symbol: string;
  currentPrice: number;
  overallSentiment: SignalSentimentType;
  stablecoins: {
    totalMarketCapUsd: number;
    usdtCirculating: number;
    usdcCirculating: number;
    netMinted7dUsd: number;
    expansionRegime: string;
    headline: string;
    sentiment: string;
  };
  liquidationHunting: {
    totalShortLiqUsd: number;
    totalLongLiqUsd: number;
    primaryHuntTarget: {
      side: string;
      price: number;
      volumeUsd: number;
    };
    clusters: {
      longs: { leverage: string; price: number; estimatedUsd: number }[];
      shorts: { leverage: string; price: number; estimatedUsd: number }[];
    };
  };
  spoofingDetector: {
    spoofingScore: number;
    spoofingAlert: string;
    bidDepthTotalUsd: number;
    askDepthTotalUsd: number;
    depthRatio: number;
  };
  dexPoolFlow: {
    totalLiquidityUsd: number;
    totalVolume24hUsd: number;
    pools: {
      pairAddress: string;
      dexId: string;
      baseToken: string;
      quoteToken: string;
      priceUsd: number;
      liquidityUsd: number;
      volume24hUsd: number;
      txns24h: number;
      buyRatioPct: number;
    }[];
  };
  tokenUnlock: {
    token: string;
    circulatingSupplyPct: number;
    nextUnlockEstimated: string;
    unlockSeverity: string;
    headline: string;
  };
}

interface OnChainIntelligenceSuiteProps {
  symbol: string;
  currentPrice: number;
}

export const OnChainIntelligenceSuite: React.FC<OnChainIntelligenceSuiteProps> = ({
  symbol,
  currentPrice: initialPrice,
}) => {
  const [data, setData] = useState<OnChainIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"LIQUIDATIONS" | "STABLECOINS" | "SPOOFING" | "DEX_POOLS" | "UNLOCKS">("LIQUIDATIONS");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const fetchOnChainData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/market/onchain-intelligence?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: OnChainIntelligenceResponse = await res.json();
      if (!json.success) throw new Error("Failed to load on-chain intelligence data");
      setData(json);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error("On-chain fetch error:", err);
      setError(err.message || "Failed to query on-chain intelligence");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchOnChainData();
    const interval = setInterval(fetchOnChainData, 30_000);
    return () => clearInterval(interval);
  }, [fetchOnChainData]);

  const formatMillions = (usd: number) => {
    if (!usd || usd === 0) return "$0";
    if (Math.abs(usd) >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
    if (Math.abs(usd) >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
    if (Math.abs(usd) >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
    return `$${usd.toLocaleString()}`;
  };

  const currentPrice = data?.currentPrice || initialPrice || 0;

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#0c1322] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ========================================================= */}
      {/* 1. HEADER & TOP-RIGHT SENTIMENT STAMP                      */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/90 relative z-10">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Coins className="w-3.5 h-3.5" />
              On-Chain & Anti-Manipulation Radar
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-xs text-slate-400 font-medium font-mono">
              Liquidation Hunting • Stablecoin Supply • Spoofing Radar • DEX Pools • Unlocks
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Microstructure & Capital Reserve Analytics
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
              {symbol}
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
            Detects mathematical liquidation stop-hunts, order book spoofing walls, stablecoin minting/burning cycles, and decentralized AMM pool liquidity migrations.
          </p>
        </div>

        {/* Top-Right Standardized Signal Sentiment Badge */}
        <div className="flex items-center gap-3 self-start lg:self-center">
          <SignalSentimentBadge
            sentiment={data?.overallSentiment || "NEUTRAL"}
            subLabel="On-Chain Consensus"
          />

          <button
            type="button"
            onClick={fetchOnChainData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh On-Chain Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. NAVIGATION TABS                                         */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center gap-2 relative z-10 border-b border-slate-800/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("LIQUIDATIONS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "LIQUIDATIONS"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Liquidation Hunting Map</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("STABLECOINS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "STABLECOINS"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Stablecoin Supply (USDT/USDC)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400">
            +$1.4B
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SPOOFING")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "SPOOFING"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Spoofing & Wash Trading</span>
          {data?.spoofingDetector?.spoofingScore && data.spoofingDetector.spoofingScore >= 50 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DEX_POOLS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "DEX_POOLS"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>DEX Pool Flow (AMM)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("UNLOCKS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "UNLOCKS"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/25"
              : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>Token Unlock Risk</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. TAB 1: LIQUIDATION HUNTING CLUSTERS                     */}
      {/* ========================================================= */}
      {activeTab === "LIQUIDATIONS" && data?.liquidationHunting && (
        <div className="space-y-5 relative z-10">
          {/* Primary Hunt Banner */}
          <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Target className="w-4 h-4" />
                Primary Institutional Liquidation Hunt Magnet
              </span>
              <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                Target: ${data.liquidationHunting.primaryHuntTarget.price.toLocaleString()}
              </span>
            </div>
            <p className="text-sm font-semibold text-white leading-relaxed">
              Market makers are positioned to hunt the{" "}
              <strong className="text-cyan-300">
                {data.liquidationHunting.primaryHuntTarget.side.replace(/_/g, " ")}
              </strong>{" "}
              pool (${formatMillions(data.liquidationHunting.primaryHuntTarget.volumeUsd)} resting liquidity).
              Price is mathematically attracted to these liquidation cascades before reversing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Short Liquidation Levels (Above Price - Squeeze Magnets) */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  Short Liquidation Targets (Above Price)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {formatMillions(data.liquidationHunting.totalShortLiqUsd)}
                </span>
              </div>

              <div className="space-y-2">
                {data.liquidationHunting.clusters.shorts.map((c) => (
                  <div
                    key={c.leverage}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between font-mono num-tabular"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        {c.leverage} Shorts
                      </span>
                      <span className="text-xs font-black text-white">${c.price.toLocaleString()}</span>
                    </div>
                    <span className="text-xs text-slate-300 font-bold">{formatMillions(c.estimatedUsd)} pool</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Long Liquidation Levels (Below Price - Flush Magnets) */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownRight className="w-4 h-4" />
                  Long Liquidation Targets (Below Price)
                </span>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {formatMillions(data.liquidationHunting.totalLongLiqUsd)}
                </span>
              </div>

              <div className="space-y-2">
                {data.liquidationHunting.clusters.longs.map((c) => (
                  <div
                    key={c.leverage}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between font-mono num-tabular"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                        {c.leverage} Longs
                      </span>
                      <span className="text-xs font-black text-white">${c.price.toLocaleString()}</span>
                    </div>
                    <span className="text-xs text-slate-300 font-bold">{formatMillions(c.estimatedUsd)} pool</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. TAB 2: STABLECOIN SUPPLY & INFLOW MONITOR              */}
      {/* ========================================================= */}
      {activeTab === "STABLECOINS" && data?.stablecoins && (
        <div className="space-y-5 relative z-10">
          <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block font-mono">
              Global Stablecoin Liquidity Status
            </span>
            <p className="text-base font-black text-white leading-snug">
              {data.stablecoins.headline}
            </p>
            <p className="text-xs text-slate-300">
              When stablecoin supply increases, fresh institutional capital is entering the ecosystem to buy spot and futures. Net mints act as a macro bullish tailwind.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono num-tabular">
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Total Stablecoin Supply (USDT + USDC)
              </span>
              <div className="text-2xl font-black text-white">
                {formatMillions(data.stablecoins.totalMarketCapUsd)}
              </div>
              <span className="text-[11px] text-slate-400 font-sans block">Macro market dry powder</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Tether (USDT) Circulating
              </span>
              <div className="text-2xl font-black text-emerald-400">
                {formatMillions(data.stablecoins.usdtCirculating)}
              </div>
              <span className="text-[11px] text-slate-400 font-sans block">Primary exchange trading currency</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                USD Coin (USDC) Circulating
              </span>
              <div className="text-2xl font-black text-sky-400">
                {formatMillions(data.stablecoins.usdcCirculating)}
              </div>
              <span className="text-[11px] text-slate-400 font-sans block">DeFi & Institutional settlements</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TAB 3: SPOOFING & WASH TRADING DETECTOR                 */}
      {/* ========================================================= */}
      {activeTab === "SPOOFING" && data?.spoofingDetector && (
        <div className="space-y-5 relative z-10">
          <div
            className={`p-5 rounded-2xl border space-y-2 ${
              data.spoofingDetector.spoofingScore >= 60
                ? "bg-rose-950/20 border-rose-500/40"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider block font-mono text-slate-300">
                Order Book Manipulation & Spoofing Score
              </span>
              <span
                className={`text-xs font-black font-mono px-2.5 py-0.5 rounded ${
                  data.spoofingDetector.spoofingScore >= 60
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                Score: {data.spoofingDetector.spoofingScore}/100
              </span>
            </div>
            <h4 className="text-base font-black text-white">{data.spoofingDetector.spoofingAlert}</h4>
            <p className="text-xs text-slate-400">
              Spoofing occurs when algorithmic market makers place multi-million dollar fake bid or ask walls without intending to fill them, canceling the instant price approaches.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono num-tabular">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Top 50 Bid Depth
              </span>
              <div className="text-xl font-black text-emerald-400">
                {formatMillions(data.spoofingDetector.bidDepthTotalUsd)}
              </div>
              <span className="text-[11px] text-slate-400 font-sans block">Order book support walls</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Top 50 Ask Depth
              </span>
              <div className="text-xl font-black text-rose-400">
                {formatMillions(data.spoofingDetector.askDepthTotalUsd)}
              </div>
              <span className="text-[11px] text-slate-400 font-sans block">Order book resistance walls</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Bid / Ask Depth Ratio
              </span>
              <div className="text-xl font-black text-purple-400">
                {data.spoofingDetector.depthRatio}x
              </div>
              <span className="text-[11px] text-slate-400 font-sans block">Imbalance coefficient</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. TAB 4: DEX POOLS (AMM LIQUIDITY MIGRATION)              */}
      {/* ========================================================= */}
      {activeTab === "DEX_POOLS" && data?.dexPoolFlow && (
        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Decentralized AMM Liquidity Pools ({data.dexPoolFlow.pools.length})
            </span>
            <span className="text-xs font-mono text-slate-400">
              Total On-Chain Pool Liquidity: <strong className="text-white">{formatMillions(data.dexPoolFlow.totalLiquidityUsd)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono num-tabular">
            {data.dexPoolFlow.pools.map((p, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-sky-300 font-mono">
                    {p.dexId} ({p.baseToken}/{p.quoteToken})
                  </span>
                  <span className="text-xs font-black text-white">${p.priceUsd.toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Pool Liquidity:</span>
                    <strong className="text-emerald-400">{formatMillions(p.liquidityUsd)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">24h DEX Volume:</span>
                    <strong className="text-slate-200">{formatMillions(p.volume24hUsd)}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">24h Swaps: {p.txns24h.toLocaleString()}</span>
                  <span className={p.buyRatioPct >= 50 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {p.buyRatioPct}% Buys
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. TAB 5: TOKEN UNLOCK RISK TRACKER                        */}
      {/* ========================================================= */}
      {activeTab === "UNLOCKS" && data?.tokenUnlock && (
        <div className="space-y-5 relative z-10">
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Circulating Supply & Vesting Overhang
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400">
                Circulating: {data.tokenUnlock.circulatingSupplyPct}% of Max Supply
              </span>
            </div>

            <h4 className="text-base font-black text-white">{data.tokenUnlock.headline}</h4>

            <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${data.tokenUnlock.circulatingSupplyPct}%` }}
              />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Tokens with low circulating supply (&lt;40%) carry significant dilution risks when early investors unlock millions in tokens, exerting downward pressure on market prices.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
