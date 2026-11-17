"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Calculator, ShieldCheck, Scale, Zap, Info } from "lucide-react";

export const RiskCalculator: React.FC = () => {
  // Tab: "position" | "margin"
  const [tab, setTab] = useState<"position" | "margin">("position");

  // Position Size State
  const [balance, setBalance] = useState("10000");
  const [riskPercent, setRiskPercent] = useState("1.0");
  const [assetType, setAssetType] = useState<"FOREX" | "GOLD" | "CRYPTO" | "INDEX">("FOREX");
  const [stopLossPips, setStopLossPips] = useState("20");
  const [takeProfitPips, setTakeProfitPips] = useState("60");

  // Margin & Leverage State
  const [leverage, setLeverage] = useState("100");
  const [marginLots, setMarginLots] = useState("1.0");
  const [assetPrice, setAssetPrice] = useState("1.0850");

  // Calculations: Position Size
  const numBalance = parseFloat(balance) || 0;
  const numRiskPct = parseFloat(riskPercent) || 0;
  const riskAmount = (numBalance * numRiskPct) / 100;
  const slDistance = parseFloat(stopLossPips) || 1;
  const tpDistance = parseFloat(takeProfitPips) || 0;

  let calculatedLotSize = 0;
  let pipValuePerLot = 10; // Forex default $10 per pip on 1 standard lot

  if (assetType === "FOREX") {
    pipValuePerLot = 10;
    calculatedLotSize = slDistance > 0 ? riskAmount / (slDistance * 10) : 0;
  } else if (assetType === "GOLD") {
    // 1 standard lot = 100 oz. $1 price move = $100 per lot
    pipValuePerLot = 100;
    calculatedLotSize = slDistance > 0 ? riskAmount / (slDistance * 100) : 0;
  } else if (assetType === "CRYPTO") {
    // 1 unit of BTC/ETH. $1 price move = $1 per unit
    pipValuePerLot = 1;
    calculatedLotSize = slDistance > 0 ? riskAmount / slDistance : 0;
  } else if (assetType === "INDEX") {
    // US30/NAS: 1 point = $1 or $10 depending on contract
    pipValuePerLot = 1;
    calculatedLotSize = slDistance > 0 ? riskAmount / slDistance : 0;
  }

  const rrRatio = slDistance > 0 && tpDistance > 0 ? (tpDistance / slDistance).toFixed(2) : "0";
  const potentialProfit = riskAmount * parseFloat(rrRatio);

  // Calculations: Margin & Leverage
  const numLeverage = parseFloat(leverage) || 100;
  const numLots = parseFloat(marginLots) || 1;
  const numPrice = parseFloat(assetPrice) || 1;

  let notionalValue = 0;
  if (assetType === "FOREX") {
    notionalValue = numLots * 100000 * numPrice;
  } else if (assetType === "GOLD") {
    notionalValue = numLots * 100 * numPrice;
  } else {
    notionalValue = numLots * numPrice;
  }

  const requiredMargin = numLeverage > 0 ? notionalValue / numLeverage : 0;
  const freeMarginRemaining = Math.max(0, numBalance - requiredMargin);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f172a] shadow-xl overflow-hidden">
      {/* Sub-Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 p-2 gap-2">
        <button
          onClick={() => setTab("position")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            tab === "position"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Scale className="w-4 h-4" />
          Position Size & Risk Calculator
        </button>

        <button
          onClick={() => setTab("margin")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            tab === "margin"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Zap className="w-4 h-4" />
          Leverage & Margin Calculator
        </button>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {tab === "position" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Asset Class</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "FOREX", label: "Forex" },
                    { id: "GOLD", label: "Gold (XAU)" },
                    { id: "CRYPTO", label: "Crypto" },
                    { id: "INDEX", label: "Indices" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAssetType(item.id as any)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                        assetType === item.id
                          ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Account Balance ($)
                  </label>
                  <input
                    type="number"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Risk Percentage (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.25"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      {["0.5", "1", "2"].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setRiskPercent(pct)}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-300"
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Stop Loss Distance {assetType === "FOREX" ? "(Pips)" : "(Points / $)"}
                  </label>
                  <input
                    type="number"
                    value={stopLossPips}
                    onChange={(e) => setStopLossPips(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Target Distance (Optional)
                  </label>
                  <input
                    type="number"
                    value={takeProfitPips}
                    onChange={(e) => setTakeProfitPips(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Live Calculation Output Card */}
            <div className="rounded-2xl border border-sky-500/30 bg-sky-950/10 p-5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  Recommended Position Size
                </span>
                <div className="text-4xl font-black font-mono text-white tracking-tight mt-1 num-tabular">
                  {calculatedLotSize > 0 ? calculatedLotSize.toFixed(2) : "0.00"}{" "}
                  <span className="text-base text-slate-400 font-normal">
                    {assetType === "CRYPTO" ? "Units" : "Lots"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  At this lot size, hitting your stop loss risks exactly {formatCurrency(riskAmount)} ({riskPercent}% of capital).
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800/80 mt-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[11px] block">Max Risk ($)</span>
                  <span className="text-rose-400 font-bold">{formatCurrency(riskAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Target Profit</span>
                  <span className="text-emerald-400 font-bold">
                    {potentialProfit > 0 ? formatCurrency(potentialProfit) : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Risk / Reward</span>
                  <span className="text-sky-300 font-bold">1 : {rrRatio}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Margin & Leverage Calculator Tab */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Account Leverage
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["30", "50", "100", "200", "500"].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setLeverage(lev)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                        leverage === lev
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      1:{lev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Trade Size (Lots)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={marginLots}
                    onChange={(e) => setMarginLots(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Asset Market Price
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={assetPrice}
                    onChange={(e) => setAssetPrice(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Margin Results Card */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Required Margin To Open Trade
                </span>
                <div className="text-4xl font-black font-mono text-white tracking-tight mt-1 num-tabular">
                  {formatCurrency(requiredMargin)}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Margin required by your broker under 1:{leverage} leverage for {marginLots} lot(s).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80 mt-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[11px] block">Notional Contract Value</span>
                  <span className="text-white font-bold">{formatCurrency(notionalValue)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Free Margin Remaining</span>
                  <span className="text-emerald-400 font-bold">
                    {formatCurrency(freeMarginRemaining)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
