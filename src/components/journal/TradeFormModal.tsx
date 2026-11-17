"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Trade, TradeDirection, TradeStatus, MarketType } from "@/lib/types";
import { toDateInputValue, calculateRR } from "@/lib/utils";
import { TrendingUp, TrendingDown, HelpCircle, Sparkles } from "lucide-react";

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (trade: Trade) => void;
  editTrade?: Trade | null;
}

const COMMON_SYMBOLS = [
  { symbol: "EURUSD", market: "FOREX" },
  { symbol: "GBPUSD", market: "FOREX" },
  { symbol: "USDJPY", market: "FOREX" },
  { symbol: "XAUUSD", market: "COMMODITY" },
  { symbol: "BTCUSDT", market: "CRYPTO" },
  { symbol: "ETHUSDT", market: "CRYPTO" },
  { symbol: "NAS100", market: "INDEX" },
  { symbol: "US30", market: "INDEX" },
];

export const TradeFormModal: React.FC<TradeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editTrade,
}) => {
  const [symbol, setSymbol] = useState("EURUSD");
  const [market, setMarket] = useState<MarketType>("FOREX");
  const [direction, setDirection] = useState<TradeDirection>("LONG");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [quantity, setQuantity] = useState("1.0");
  const [pnl, setPnl] = useState("");
  const [status, setStatus] = useState<TradeStatus>("WON");
  const [tradeDate, setTradeDate] = useState(toDateInputValue());
  const [timeframe, setTimeframe] = useState("1h");
  const [session, setSession] = useState("New York");
  const [strategy, setStrategy] = useState("SMC Fortress");
  const [reasonEntry, setReasonEntry] = useState("");
  const [reasonOutcome, setReasonOutcome] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [emotionsNotes, setEmotionsNotes] = useState("");
  const [chartUrl, setChartUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editTrade) {
      setSymbol(editTrade.symbol);
      setMarket(editTrade.market);
      setDirection(editTrade.direction);
      setEntryPrice(String(editTrade.entry_price));
      setExitPrice(editTrade.exit_price ? String(editTrade.exit_price) : "");
      setStopLoss(editTrade.stop_loss ? String(editTrade.stop_loss) : "");
      setTakeProfit(editTrade.take_profit ? String(editTrade.take_profit) : "");
      setQuantity(String(editTrade.quantity));
      setPnl(String(editTrade.pnl));
      setStatus(editTrade.status);
      setTradeDate(toDateInputValue(editTrade.trade_date));
      setTimeframe(editTrade.timeframe || "1h");
      setSession(editTrade.session || "New York");
      setStrategy(editTrade.strategy || "SMC Fortress");
      setReasonEntry(editTrade.reason_entry || "");
      setReasonOutcome(editTrade.reason_outcome || "");
      setLessonsLearned(editTrade.lessons_learned || "");
      setEmotionsNotes(editTrade.emotions_notes || "");
      setChartUrl(editTrade.chart_url || "");
      setTags(editTrade.tags || []);
    } else {
      resetForm();
    }
  }, [editTrade, isOpen]);

  const resetForm = () => {
    setSymbol("EURUSD");
    setMarket("FOREX");
    setDirection("LONG");
    setEntryPrice("");
    setExitPrice("");
    setStopLoss("");
    setTakeProfit("");
    setQuantity("1.0");
    setPnl("");
    setStatus("WON");
    setTradeDate(toDateInputValue());
    setTimeframe("1h");
    setSession("New York");
    setStrategy("SMC Fortress");
    setReasonEntry("");
    setReasonOutcome("");
    setLessonsLearned("");
    setEmotionsNotes("");
    setChartUrl("");
    setTags([]);
    setError(null);
  };

  // Auto-calculate PnL when entry and exit prices are modified
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

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numEntry = parseFloat(entryPrice);
    if (isNaN(numEntry) || numEntry <= 0) {
      setError("Please provide a valid entry price.");
      return;
    }

    if (!reasonEntry.trim()) {
      setError("Please write why you took this trade (confluence / reason).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        symbol: symbol.toUpperCase(),
        market,
        direction,
        entry_price: numEntry,
        exit_price: exitPrice ? parseFloat(exitPrice) : null,
        stop_loss: stopLoss ? parseFloat(stopLoss) : null,
        take_profit: takeProfit ? parseFloat(takeProfit) : null,
        quantity: parseFloat(quantity) || 1,
        pnl: parseFloat(pnl) || 0,
        status,
        trade_date: new Date(tradeDate).toISOString(),
        timeframe,
        session,
        strategy,
        reason_entry: reasonEntry,
        reason_outcome: reasonOutcome,
        lessons_learned: lessonsLearned,
        emotions_notes: emotionsNotes,
        chart_url: chartUrl,
        tags,
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

      onSuccess(data.trade);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
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
      title={editTrade ? `Edit Trade: ${editTrade.symbol}` : "Log Trade & Journal"}
      subtitle="Track your currency, execution, profit/loss reasons, and lessons learned"
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Quick Symbol Chips */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Quick Pair Select
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_SYMBOLS.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => {
                  setSymbol(item.symbol);
                  setMarket(item.market as MarketType);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all ${
                  symbol === item.symbol
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold"
                    : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200"
                }`}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Currency & Direction */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Currency / Symbol *</label>
            <input
              type="text"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="EURUSD, BTCUSDT, XAUUSD..."
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono uppercase focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Asset Market</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as MarketType)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="FOREX">Forex Currency</option>
              <option value="CRYPTO">Crypto</option>
              <option value="COMMODITY">Commodity / Gold</option>
              <option value="INDEX">Index (US30 / NAS100)</option>
              <option value="STOCKS">Stocks</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Direction *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("LONG")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  direction === "LONG"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-sm shadow-emerald-500/20"
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
                    ? "bg-rose-500/20 text-rose-400 border-rose-500 shadow-sm shadow-rose-500/20"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" /> SELL / SHORT
              </button>
            </div>
          </div>
        </div>

        {/* Pricing & Execution Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Entry Price *</label>
            <input
              type="number"
              step="any"
              required
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="e.g. 1.0850"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Exit Price</label>
              {exitPrice && (
                <button
                  type="button"
                  onClick={handleAutoCalcPnl}
                  className="text-[10px] text-sky-400 hover:underline"
                >
                  Calc PnL
                </button>
              )}
            </div>
            <input
              type="number"
              step="any"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              onBlur={handleAutoCalcPnl}
              placeholder="e.g. 1.0920"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Stop Loss (SL)</label>
            <input
              type="number"
              step="any"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="e.g. 1.0820"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Take Profit (TP)</label>
            <input
              type="number"
              step="any"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="e.g. 1.0950"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* PnL & Outcome Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Profit / Loss Amount ($) *
            </label>
            <div className="relative">
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
                placeholder="+250 or -120"
                className={`w-full rounded-xl bg-slate-900 border px-3 py-2 text-sm font-mono font-bold focus:outline-none ${
                  parseFloat(pnl) > 0
                    ? "border-emerald-500/60 text-emerald-400"
                    : parseFloat(pnl) < 0
                    ? "border-rose-500/60 text-rose-400"
                    : "border-slate-700/80 text-white"
                }`}
              />
              {rrRatio && (
                <span className="absolute right-3 top-2.5 text-[11px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                  {rrRatio}R
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Outcome Status</label>
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
            <label className="block text-xs font-medium text-slate-300 mb-1">Trade Date *</label>
            <input
              type="date"
              required
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Strategy & Session Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Setup / Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="SMC Fortress">SMC Fortress (Order Block / Liquidity)</option>
              <option value="Fair Value Gap">Fair Value Gap (FVG)</option>
              <option value="Break & Retest">Break & Retest</option>
              <option value="Trend Continuation">Trend Continuation</option>
              <option value="Scalp Momentum">Scalp Momentum</option>
              <option value="Session Open Reversal">Session Open Reversal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Trading Session</label>
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="New York">New York Session</option>
              <option value="London">London Session</option>
              <option value="London/NY Overlap">London / NY Overlap</option>
              <option value="Asian">Asian Session</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">Daily (1d)</option>
            </select>
          </div>
        </div>

        {/* Reflective Autopsy - Core Requirement: WHY I TOOK THE TRADE */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-sky-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Why I took the trade (Confluence & Entry Trigger) *
            </label>
            <span className="text-[11px] text-slate-500">Analysis & Setup</span>
          </div>
          <textarea
            required
            rows={2}
            value={reasonEntry}
            onChange={(e) => setReasonEntry(e.target.value)}
            placeholder="e.g. 4H bullish order block retest + 15m liquidity sweep + bullish divergence on RSI. Entered on 1m engulfing candle with clean 1:3 R:R."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Core Requirement: WHY PROFIT OR LOSS WAS MADE */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              Why profit / loss was made (Post-Trade Autopsy)
            </label>
            <span className="text-[11px] text-slate-500">Execution Review</span>
          </div>
          <textarea
            rows={2}
            value={reasonOutcome}
            onChange={(e) => setReasonOutcome(e.target.value)}
            placeholder="e.g. Price respected the 15m FVG perfectly and expanded into the London highs. Trailed stop loss to breakeven after TP1, hit full TP2."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Lessons Learned & Psychology */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Lessons Learned</label>
            <input
              type="text"
              value={lessonsLearned}
              onChange={(e) => setLessonsLearned(e.target.value)}
              placeholder="e.g. Stay patient, don't move stop loss early"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Chart Screenshot URL</label>
            <input
              type="url"
              value={chartUrl}
              onChange={(e) => setChartUrl(e.target.value)}
              placeholder="https://www.tradingview.com/x/..."
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="profit" disabled={loading}>
            {loading ? "Saving..." : editTrade ? "Update Trade" : "Save Trade to Journal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
