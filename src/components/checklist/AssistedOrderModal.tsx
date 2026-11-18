"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { PairIcon } from "../ui/PairIcon";
import { TradeDirection } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Zap,
  RefreshCw,
  AlertTriangle,
  Settings,
} from "lucide-react";

interface AssistedOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  symbol: string;
  direction: TradeDirection;
  checklistScore: number;
  criticalPassed: boolean;
  sentimentVerdict?: string;
}

export const AssistedOrderModal: React.FC<AssistedOrderModalProps> = ({
  isOpen,
  onClose,
  accountId,
  symbol,
  direction,
  checklistScore,
  criticalPassed,
  sentimentVerdict = "",
}) => {
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [riskUsd, setRiskUsd] = useState("10");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [leverage, setLeverage] = useState("5");
  const [confirmText, setConfirmText] = useState("");

  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [sentimentAllowed, setSentimentAllowed] = useState<
    "LONG_ONLY" | "SHORT_ONLY" | "WAIT_NO_TRADE" | "UNCHECKED"
  >("UNCHECKED");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadLivePrice = useCallback(async () => {
    if (!symbol) return;
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/binance/sentiment?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (data.success && data.market?.lastPrice) {
        const px = Number(data.market.lastPrice);
        setEntryPrice(String(px));
        // Suggest sensible default 1.5% SL and 3% TP (1:2 R:R)
        const sl = direction === "LONG" ? px * 0.985 : px * 1.015;
        const tp = direction === "LONG" ? px * 1.03 : px * 0.97;
        const dec = px >= 100 ? 2 : px >= 1 ? 4 : 6;
        setStopLoss(sl.toFixed(dec));
        setTakeProfit(tp.toFixed(dec));
        if (data.report?.allowedDirection) {
          setSentimentAllowed(data.report.allowedDirection);
        }
      }
    } catch {}
    finally {
      setFetchingPrice(false);
    }
  }, [symbol, direction]);

  useEffect(() => {
    if (isOpen) {
      setPreview(null);
      setError(null);
      setSuccessMsg(null);
      setConfirmText("");
      loadLivePrice();
    }
  }, [isOpen, loadLivePrice]);

  const runPreview = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          account_id: accountId,
          symbol,
          direction,
          orderType,
          riskUsd: parseFloat(riskUsd) || 0,
          entryPrice: parseFloat(entryPrice) || 0,
          stopLoss: parseFloat(stopLoss) || 0,
          takeProfit: takeProfit ? parseFloat(takeProfit) : null,
          leverage: parseInt(leverage, 10) || 5,
          checklistScore,
          criticalPassed,
          sentimentAllowedDirection: sentimentAllowed,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Preview validation failed");
        if (data.preview) setPreview(data.preview);
        return;
      }
      setPreview(data.preview);
    } catch (err: any) {
      setError(err.message || "Could not preview order");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteLive = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          account_id: accountId,
          symbol,
          direction,
          orderType,
          riskUsd: parseFloat(riskUsd) || 0,
          entryPrice: parseFloat(entryPrice) || 0,
          stopLoss: parseFloat(stopLoss) || 0,
          takeProfit: takeProfit ? parseFloat(takeProfit) : null,
          leverage: parseInt(leverage, 10) || 5,
          checklistScore,
          criticalPassed,
          sentimentAllowedDirection: sentimentAllowed,
          confirmText,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Order blocked by safety gate");
        if (data.preview) setPreview(data.preview);
        return;
      }
      setSuccessMsg(data.message || "Protected order executed on Binance Agentic Sub-Account!");
      setConfirmText("");
    } catch (err: any) {
      setError(err.message || "Execution failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Checklist-Gated Assisted Order (Binance Agent OS)"
      subtitle="Auto-calculates exact position size from your risk, enforces hard Stop-Loss, and requires CONFIRM"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Pair + Live Gate Summary */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <PairIcon symbol={symbol} size="md" showQuoteBadge />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-white">{symbol}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    direction === "LONG"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {direction}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300">
                  Checklist: {checklistScore}%
                </span>
              </div>
              {sentimentVerdict && (
                <div className="text-[10px] text-amber-300 font-mono mt-0.5">
                  Sentiment: {sentimentVerdict}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={loadLivePrice}
            disabled={fetchingPrice}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${fetchingPrice ? "animate-spin text-sky-400" : ""}`} />
            Sync Price
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Order Parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as "MARKET" | "LIMIT")}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="MARKET">MARKET (Instant)</option>
              <option value="LIMIT">LIMIT (At Entry Price)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Max Risk Amount ($) *
            </label>
            <input
              type="number"
              step="any"
              value={riskUsd}
              onChange={(e) => setRiskUsd(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Leverage (x)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono font-bold text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Entry Price *
            </label>
            <input
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-rose-300 mb-1">
              Hard Stop-Loss *
            </label>
            <input
              type="number"
              step="any"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-rose-500/40 px-3 py-2 text-xs font-mono text-rose-200 focus:border-rose-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-emerald-300 mb-1">
              Take-Profit (Optional)
            </label>
            <input
              type="number"
              step="any"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-emerald-500/40 px-3 py-2 text-xs font-mono text-emerald-200 focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={runPreview}
          disabled={loading}
          className="w-full py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center justify-center gap-1.5"
        >
          <ShieldCheck className="w-4 h-4" />
          {loading ? "Checking Guardrails..." : "Calculate Size & Run 5 Safety Gates"}
        </button>

        {/* Preview & 5 Safety Gates */}
        {preview && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Auto Position Qty</span>
                <strong className="text-white">{preview.quantity}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Notional Value</span>
                <strong className="text-sky-300">{formatCurrency(preview.notionalUsd)}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Est. Margin ({preview.leverage}x)</span>
                <strong className="text-amber-300">{formatCurrency(preview.requiredMarginUsd)}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Reward / Risk</span>
                <strong className="text-emerald-400">
                  {preview.rrRatio ? `1 : ${preview.rrRatio}` : "—"}
                </strong>
              </div>
            </div>

            {/* 5 Server Safety Gates */}
            <div className="space-y-1.5">
              {preview.gates.map((g: any) => (
                <div
                  key={g.name}
                  className={`px-3 py-2 rounded-xl border text-xs flex items-start gap-2 ${
                    g.passed
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-200"
                  }`}
                >
                  {g.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold">{g.name}:</span>{" "}
                    <span className="opacity-90">{g.detail}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mandatory CONFIRM Box */}
            {preview.allGatesPassed ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2.5">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  Human-in-the-Loop Safety Gate: Type CONFIRM to Submit Live Order
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder='Type "CONFIRM" here...'
                    className="flex-1 rounded-xl bg-slate-950 border border-amber-500/50 px-3 py-2 text-xs font-mono font-bold text-white uppercase focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="profit"
                    disabled={loading || confirmText.trim().toUpperCase() !== "CONFIRM"}
                    onClick={handleExecuteLive}
                  >
                    {loading ? "Placing Order..." : `Execute ${direction} + Hard SL`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Resolve the red gate(s) above to unlock live order submission.
                </span>
                <Link
                  href="/settings"
                  className="text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Settings className="w-3.5 h-3.5" /> Configure Agent OS
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
