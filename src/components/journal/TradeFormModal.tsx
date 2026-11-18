"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Trade, TradeDirection, TradeStatus } from "@/lib/types";
import { useAccounts } from "../providers/AccountProvider";
import { toDateInputValue, calculateRR } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  User,
  Radio,
  Plus,
  Zap,
  SlidersHorizontal,
  Building2,
  Image,
  UploadCloud,
  Trash2,
} from "lucide-react";

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (trade: Trade) => void;
  editTrade?: Trade | null;
}

const COMMON_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSDT", "ETHUSDT", "SOLUSDT", "NAS100", "US30"];
const STRATEGY_SUGGESTIONS = ["Breakout", "Order Block", "FVG", "Trend Continuation", "Scalp", "News", "Reversal"];
const COMMON_EXCHANGES = [
  { id: "BINANCE", name: "Binance" },
  { id: "BYBIT", name: "Bybit" },
  { id: "METATRADER", name: "MetaTrader" },
  { id: "OKX", name: "OKX" },
  { id: "BITGET", name: "Bitget" },
  { id: "WALLET", name: "DEX / Wallet" },
  { id: "MANUAL", name: "Manual / Other" },
];

export const TradeFormModal: React.FC<TradeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editTrade,
}) => {
  const { accounts, activeAccountId, refreshAccounts } = useAccounts();
  const defaultAccountId = activeAccountId && activeAccountId !== "ALL" ? activeAccountId : "acc_default";

  const [activeMode, setActiveMode] = useState<"quick" | "full">("quick");
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [direction, setDirection] = useState<TradeDirection>("LONG");
  const [pnl, setPnl] = useState("");
  const [tradingFee, setTradingFee] = useState("0");
  const [fundingFee, setFundingFee] = useState("0");
  const [status, setStatus] = useState<TradeStatus>("WON");
  const [tradeDate, setTradeDate] = useState(toDateInputValue());
  const [strategy, setStrategy] = useState("");
  const [exchange, setExchange] = useState("BINANCE");
  const [reasonEntry, setReasonEntry] = useState("");
  const [reasonOutcome, setReasonOutcome] = useState("");
  const [signalProvider, setSignalProvider] = useState("Self");
  const [providers, setProviders] = useState<{ id: string; name: string; color?: string }[]>([]);
  const [isAddingCustomProvider, setIsAddingCustomProvider] = useState(false);

  // Full execution details
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [quantity, setQuantity] = useState("1.0");
  const [timeframe, setTimeframe] = useState("1h");
  const [chartUrl, setChartUrl] = useState("");
  const [chartImage, setChartImage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/providers")
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.providers)) {
            setProviders(data.providers.filter((p: any) => p.name.toLowerCase() !== "self"));
          }
        })
        .catch(() => {});
    }

    if (editTrade) {
      setAccountId(editTrade.account_id || "acc_default");
      setSymbol(editTrade.symbol);
      setDirection(editTrade.direction || "LONG");
      setPnl(String(editTrade.pnl));
      setTradingFee(String(editTrade.trading_fee ?? 0));
      setFundingFee(String(editTrade.funding_fee ?? 0));
      setStatus(editTrade.status);
      setTradeDate(toDateInputValue(editTrade.trade_date));
      setStrategy(editTrade.strategy || "");
      setExchange(editTrade.exchange || "BINANCE");
      setSignalProvider(editTrade.signal_provider || "Self");
      setReasonEntry(editTrade.reason_entry || "");
      setReasonOutcome(editTrade.reason_outcome || "");
      setEntryPrice(editTrade.entry_price ? String(editTrade.entry_price) : "");
      setExitPrice(editTrade.exit_price ? String(editTrade.exit_price) : "");
      setStopLoss(editTrade.stop_loss ? String(editTrade.stop_loss) : "");
      setTakeProfit(editTrade.take_profit ? String(editTrade.take_profit) : "");
      setQuantity(editTrade.quantity ? String(editTrade.quantity) : "1.0");
      setTimeframe(editTrade.timeframe || "1h");
      setChartUrl(editTrade.chart_url || "");
      setChartImage(editTrade.chart_image || "");
      if (editTrade.entry_price || editTrade.exit_price || editTrade.stop_loss) {
        setActiveMode("full");
      }
    } else {
      resetForm();
    }
  }, [editTrade, isOpen, defaultAccountId]);

  const resetForm = () => {
    setAccountId(defaultAccountId);
    setSymbol("BTCUSDT");
    setDirection("LONG");
    setPnl("");
    setTradingFee("0");
    setFundingFee("0");
    setStatus("WON");
    setTradeDate(toDateInputValue());
    setStrategy("");
    setExchange("BINANCE");
    setSignalProvider("Self");
    setIsAddingCustomProvider(false);
    setReasonEntry("");
    setReasonOutcome("");
    setEntryPrice("");
    setExitPrice("");
    setStopLoss("");
    setTakeProfit("");
    setQuantity("1.0");
    setTimeframe("1h");
    setChartUrl("");
    setChartImage("");
    setActiveMode("quick");
    setError(null);
  };

  const handleAutoCalcPnl = () => {
    const entry = parseFloat(entryPrice);
    const exit = parseFloat(exitPrice);
    const qty = parseFloat(quantity) || 1;
    if (!isNaN(entry) && !isNaN(exit)) {
      const diff = direction === "LONG" ? exit - entry : entry - exit;
      const calculatedPnl = Number((diff * qty).toFixed(2));
      setPnl(String(calculatedPnl));
      if (calculatedPnl > 0) setStatus("WON");
      else if (calculatedPnl < 0) setStatus("LOST");
      else setStatus("BREAKEVEN");
    }
  };

  const handlePasteImage = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;

        setUploadingImage(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          try {
            const res = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image: base64 }),
            });
            const data = await res.json();
            if (data.success && data.url) {
              setChartImage(data.url);
            } else {
              setChartImage(base64);
            }
          } catch {
            setChartImage(base64);
          } finally {
            setUploadingImage(false);
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          setChartImage(data.url);
        } else {
          setChartImage(base64);
        }
      } catch {
        setChartImage(base64);
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!symbol.trim()) {
      setError("Please specify the currency pair / asset.");
      return;
    }

    setLoading(true);
    try {
      const netPnlNum = parseFloat(pnl) || 0;
      const tFeeNum = Math.abs(parseFloat(tradingFee) || 0);
      const fFeeNum = parseFloat(fundingFee) || 0;
      const payload = {
        account_id: accountId || "acc_default",
        symbol: symbol.toUpperCase().trim(),
        direction,
        pnl: netPnlNum,
        trading_fee: tFeeNum,
        funding_fee: fFeeNum,
        gross_pnl: Number((netPnlNum + tFeeNum - fFeeNum).toFixed(4)),
        status,
        trade_date: new Date(tradeDate).toISOString(),
        strategy: strategy.trim(),
        exchange,
        signal_provider: signalProvider.trim() || "Self",
        reason_entry: reasonEntry.trim(),
        reason_outcome: reasonOutcome.trim(),
        entry_price: entryPrice ? parseFloat(entryPrice) : null,
        exit_price: exitPrice ? parseFloat(exitPrice) : null,
        stop_loss: stopLoss ? parseFloat(stopLoss) : null,
        take_profit: takeProfit ? parseFloat(takeProfit) : null,
        quantity: parseFloat(quantity) || 1,
        timeframe: timeframe || "1h",
        chart_url: chartUrl.trim(),
        chart_image: chartImage.trim(),
      };

      const url = editTrade ? `/api/trades/${editTrade.id}` : "/api/trades";
      const method = editTrade ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save trade");
      }

      await refreshAccounts();
      onSuccess(data.trade);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const rrRatio = calculateRR(
    parseFloat(entryPrice),
    parseFloat(stopLoss),
    parseFloat(takeProfit),
    direction
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editTrade ? `Edit Trade: ${editTrade.symbol}` : "Log Trade"}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} onPaste={handlePasteImage} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Visual Mode Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveMode("quick")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              activeMode === "quick"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Quick P&L Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("full")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              activeMode === "full"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            Full Execution (Entry, Exit, SL, TP)
          </button>
        </div>

        {/* Account Assignment & Fees */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-slate-800 bg-[#0b101d] p-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Trading Account / Target
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none font-medium"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
              {accounts.length === 0 && <option value="acc_default">Main Account</option>}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Trading Fee ($)
            </label>
            <input
              type="number"
              step="any"
              value={tradingFee}
              onChange={(e) => setTradingFee(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs font-mono text-amber-300 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Funding Fee ($ signed)
            </label>
            <input
              type="number"
              step="any"
              value={fundingFee}
              onChange={(e) => setFundingFee(e.target.value)}
              placeholder="0.00 (- paid / + earned)"
              className="w-full rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Trade Source / Signal Provider */}
        <div className="rounded-xl border border-slate-800 bg-[#0b101d] p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              Trade Source / Signal Provider
            </label>
            <span className="text-[10px] text-slate-400 font-mono">
              {signalProvider.toLowerCase() === "self" ? "Personal Trade" : `Copied from ${signalProvider}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSignalProvider("Self");
                setIsAddingCustomProvider(false);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                signalProvider.toLowerCase() === "self" && !isAddingCustomProvider
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-sm"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <User className="w-3.5 h-3.5 text-sky-400" />
              Self (My Own Trade)
            </button>

            {providers.map((p) => {
              const isSelected =
                signalProvider.toLowerCase() === p.name.toLowerCase() && !isAddingCustomProvider;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSignalProvider(p.name);
                    setIsAddingCustomProvider(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    isSelected
                      ? "bg-violet-500/20 text-violet-300 border-violet-500/60 shadow-sm"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Radio className="w-3 h-3 text-violet-400" />
                  {p.name}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setIsAddingCustomProvider(!isAddingCustomProvider);
                if (!isAddingCustomProvider && signalProvider.toLowerCase() === "self") {
                  setSignalProvider("");
                }
              }}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                isAddingCustomProvider
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              <Plus className="w-3 h-3" />
              {isAddingCustomProvider ? "Cancel" : "+ Other Trader"}
            </button>
          </div>

          {isAddingCustomProvider && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={signalProvider === "Self" ? "" : signalProvider}
                onChange={(e) => setSignalProvider(e.target.value)}
                placeholder="Enter Trader or Channel Name"
                className="flex-1 rounded-lg bg-slate-950 border border-indigo-500/50 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                autoFocus
              />
              <span className="text-[10px] text-slate-400 whitespace-nowrap">Auto-saves to followed traders</span>
            </div>
          )}
        </div>

        {/* Exchange Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            Exchange / Platform
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_EXCHANGES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setExchange(ex.id)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                  exchange === ex.id
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>

        {/* Currency & Direction */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Currency / Pair *</label>
            <input
              type="text"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="BTCUSDT, EURUSD, XAUUSD..."
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono uppercase focus:border-sky-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {COMMON_SYMBOLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSymbol(s)}
                  className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
                    symbol === s
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("LONG")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  direction === "LONG"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/60"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> BUY / LONG
              </button>
              <button
                type="button"
                onClick={() => setDirection("SHORT")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  direction === "SHORT"
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/60"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" /> SELL / SHORT
              </button>
            </div>
          </div>
        </div>

        {/* PnL & Status & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Profit / Loss ($) *
            </label>
            <input
              type="number"
              step="any"
              required
              value={pnl}
              onChange={(e) => {
                setPnl(e.target.value);
                const val = parseFloat(e.target.value);
                if (val > 0) setStatus("WON");
                else if (val < 0) setStatus("LOST");
                else if (val === 0) setStatus("BREAKEVEN");
              }}
              placeholder="+250 or -100"
              className={`w-full rounded-xl bg-slate-900 border px-3 py-2 text-sm font-mono font-bold focus:outline-none ${
                parseFloat(pnl) > 0
                  ? "border-emerald-500/60 text-emerald-400"
                  : parseFloat(pnl) < 0
                  ? "border-rose-500/60 text-rose-400"
                  : "border-slate-700/80 text-white"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TradeStatus)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="WON">WON (Profit)</option>
              <option value="LOST">LOST (Loss)</option>
              <option value="BREAKEVEN">BREAKEVEN</option>
              <option value="OPEN">OPEN / Running</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
            <input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Full Execution Details (when Full mode is active) */}
        {activeMode === "full" && (
          <div className="p-3.5 space-y-3 bg-[#0c1322] border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-xs text-sky-400 font-semibold">
              <span>Execution Prices, Lot Size & R:R</span>
              {rrRatio && (
                <span className="font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  Risk/Reward: 1:{rrRatio}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Entry Price</label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="65000"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Exit Price</label>
                <input
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  onBlur={handleAutoCalcPnl}
                  placeholder="67500"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="64000"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Take Profit</label>
                <input
                  type="number"
                  step="any"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="70000"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Lot Size / Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1.0"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Timeframe</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-white text-xs"
                >
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                  <option value="1d">Daily</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Name */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Strategy / Setup Name (Optional)
          </label>
          <input
            type="text"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            placeholder="Type any custom strategy, e.g. Asian Breakout, Retest, FVG, Scalp..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {STRATEGY_SUGGESTIONS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStrategy(st)}
                className={`text-[10px] px-2 py-0.5 rounded border ${
                  strategy === st
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Why I took the trade */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Why I took the trade (Setup / Reasoning)
          </label>
          <textarea
            rows={2}
            value={reasonEntry}
            onChange={(e) => setReasonEntry(e.target.value)}
            placeholder="What triggered this entry? Confluence, breakout, news reaction..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Why profit or loss happened */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Why profit / loss was made (Reflection)
          </label>
          <textarea
            rows={2}
            value={reasonOutcome}
            onChange={(e) => setReasonOutcome(e.target.value)}
            placeholder="What happened after entry? Good execution, closed early, slippage..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Direct Image / Chart Upload & Clipboard Paste (Ctrl+V) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-sky-400" />
              Chart Screenshot (Direct Clipboard Paste or Upload)
            </label>
            {chartImage && (
              <button
                type="button"
                onClick={() => setChartImage("")}
                className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Remove image
              </button>
            )}
          </div>

          {chartImage ? (
            <div className="relative rounded-xl border border-slate-700 bg-slate-950 p-2 overflow-hidden max-h-48 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={chartImage}
                alt="Trade chart screenshot"
                className="rounded-lg object-contain max-h-44 w-auto mx-auto shadow-md"
              />
            </div>
          ) : (
            <div
              tabIndex={0}
              className="rounded-xl border border-dashed border-slate-700 hover:border-sky-500/60 bg-slate-900/40 hover:bg-slate-900/60 p-4 text-center cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <div className="flex flex-col items-center gap-1.5">
                <UploadCloud className="w-5 h-5 text-slate-400" />
                <p className="text-xs text-slate-300 font-medium">
                  Click here & press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">Ctrl + V</kbd> to paste TradingView screenshot
                </p>
                <p className="text-[10px] text-slate-500">or click below to choose a file</p>
                <label className="cursor-pointer text-xs text-sky-400 hover:underline font-semibold mt-1">
                  {uploadingImage ? "Uploading..." : "Browse image file"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="profit" size="sm" disabled={loading}>
            {loading ? "Saving..." : editTrade ? "Update Trade" : "Save Trade"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
