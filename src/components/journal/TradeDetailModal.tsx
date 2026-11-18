"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { PairIcon } from "../ui/PairIcon";
import { Trade } from "@/lib/types";
import { BEHAVIOR_TAGS, isHabitTag } from "@/lib/tradingMetrics";
import { useAccounts } from "../providers/AccountProvider";
import { formatCurrency, formatDate, calculateRR } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Radio,
  User,
  Landmark,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";

interface TradeDetailModalProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onDelete: (tradeId: string) => void;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  trade,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [mistakeTags, setMistakeTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const { accounts } = useAccounts();

  useEffect(() => {
    setMistakeTags(Array.isArray(trade?.mistake_tags) ? trade.mistake_tags : []);
  }, [trade]);

  if (!trade) return null;

  const handleToggleBehaviorTag = async (tagId: string) => {
    const next = mistakeTags.includes(tagId)
      ? mistakeTags.filter((t) => t !== tagId)
      : [...mistakeTags, tagId];
    setMistakeTags(next);
    setSavingTags(true);
    try {
      await fetch(`/api/trades/${trade.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mistake_tags: next }),
      });
      trade.mistake_tags = next;
    } catch {}
    finally {
      setSavingTags(false);
    }
  };

  const accountName =
    accounts.find((a) => a.id === (trade.account_id || "acc_default"))?.name || "Main Account";
  const tradingFee = Math.abs(Number(trade.trading_fee || 0));
  const fundingFee = Number(trade.funding_fee || 0);
  const grossPnl =
    trade.gross_pnl !== undefined && trade.gross_pnl !== null ? Number(trade.gross_pnl) : trade.pnl;
  const hasFeeData = tradingFee > 0 || fundingFee !== 0;

  const rrRatio = calculateRR(trade.entry_price || 0, trade.stop_loss, trade.take_profit, trade.direction);
  const isProfit = trade.pnl > 0;
  const isLoss = trade.pnl < 0;

  const getExchangeBadge = (exchange?: string) => {
    const ex = exchange?.toUpperCase();
    if (ex === "BINANCE") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    if (ex === "BYBIT") return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    if (ex === "OKX") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    if (ex === "METATRADER" || ex === "MT4/MT5") return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${trade.symbol} • ${trade.direction || "LONG"}`}
      subtitle={formatDate(trade.trade_date, true)}
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* PnL Banner */}
        <div
          className={`flex items-center justify-between p-4 rounded-xl border ${
            isProfit
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : isLoss
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
              : "bg-slate-800/60 border-slate-700/80 text-slate-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <PairIcon symbol={trade.symbol} size="lg" showQuoteBadge />
            <div
              className={`p-2 rounded-lg ${
                isProfit
                  ? "bg-emerald-500/20 text-emerald-300"
                  : isLoss
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {trade.direction === "LONG" ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Outcome
              </div>
              <div className="text-xl font-black font-mono tracking-tight num-tabular">
                {formatCurrency(trade.pnl, true)}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <Badge
                variant={
                  trade.status === "WON"
                    ? "profit"
                    : trade.status === "LOST"
                    ? "loss"
                    : trade.status === "BREAKEVEN"
                    ? "breakeven"
                    : "open"
                }
                size="sm"
              >
                {trade.status}
              </Badge>

              {trade.exchange && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wider ${getExchangeBadge(
                    trade.exchange
                  )}`}
                >
                  {trade.exchange}
                </span>
              )}
            </div>

            {rrRatio && (
              <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                1:{rrRatio} R:R
              </span>
            )}
          </div>
        </div>

        {/* Pricing, Strategy & Signal Source Details */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Exchange</span>
            <span className="font-semibold text-white truncate block mt-0.5 flex items-center gap-1">
              <Landmark className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="truncate">{trade.exchange || "Manual"}</span>
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Signal Source</span>
            <span className="font-semibold text-white truncate block mt-0.5 flex items-center gap-1">
              {trade.signal_provider && trade.signal_provider.toLowerCase() !== "self" ? (
                <>
                  <Radio className="w-3 h-3 text-violet-400 flex-shrink-0" />
                  <span className="text-violet-300 truncate">{trade.signal_provider}</span>
                </>
              ) : (
                <>
                  <User className="w-3 h-3 text-sky-400 flex-shrink-0" />
                  <span className="text-sky-300 truncate">Self</span>
                </>
              )}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Strategy</span>
            <span className="font-semibold text-white truncate block mt-0.5">
              {trade.strategy || "Manual"}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Entry Price</span>
            <span className="font-mono text-white block mt-0.5">{trade.entry_price || "-"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Exit Price</span>
            <span className="font-mono text-white block mt-0.5">{trade.exit_price || "-"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Lot Size</span>
            <span className="font-mono text-white block mt-0.5">{trade.quantity || 1}</span>
          </div>
        </div>

        {/* Account & Fee Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Account</span>
            <span className="font-semibold text-sky-300 truncate block mt-0.5">{accountName}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Gross P&L</span>
            <span
              className={`font-mono font-bold block mt-0.5 ${
                grossPnl >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatCurrency(grossPnl, true)}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Trading Fee</span>
            <span className="font-mono text-amber-300 block mt-0.5">
              {tradingFee > 0 ? `-${formatCurrency(tradingFee)}` : "$0.00"}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Funding Fee</span>
            <span
              className={`font-mono block mt-0.5 ${
                fundingFee < 0 ? "text-rose-300" : fundingFee > 0 ? "text-emerald-300" : "text-slate-400"
              }`}
            >
              {fundingFee !== 0 ? formatCurrency(fundingFee, true) : "$0.00"}
            </span>
          </div>
        </div>

        {trade.exchange_trade_id && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 font-mono">
            <RefreshCw className="w-3 h-3 text-sky-400 flex-shrink-0" />
            <span>Auto-synced trade ID:</span>
            <span className="text-slate-200 select-all">{trade.exchange_trade_id}</span>
          </div>
        )}

        {/* 1-Click Mistake & Habit Tagging */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">
              Mistake & Habit Tags (1-Click — Feeds Cost of Mistakes Report)
            </span>
            <div className="flex items-center gap-2">
              {trade.discipline_score !== null && trade.discipline_score !== undefined && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  Discipline: {trade.discipline_score}%
                </span>
              )}
              {savingTags && <span className="text-[10px] text-slate-400">Saving...</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BEHAVIOR_TAGS.map((tag) => {
              const active = mistakeTags.includes(tag.id);
              const habit = isHabitTag(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleBehaviorTag(tag.id)}
                  title={tag.description}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    active
                      ? habit
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/50"
                      : "bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                  }`}
                >
                  {active ? "✓ " : "+ "}
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reason: Why I took the trade */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Why I took the trade
          </div>
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {trade.reason_entry || "No entry reasoning recorded."}
          </p>
        </div>

        {/* Reason: Why profit or loss happened */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <HelpCircle className="w-3.5 h-3.5" />
            Why profit / loss was made
          </div>
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {trade.reason_outcome || "No outcome notes recorded."}
          </p>
        </div>

        {/* Attached Chart Image Preview */}
        {trade.chart_image && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                Chart Setup / Autopsy Screenshot
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImageZoomed(!isImageZoomed)}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                >
                  {isImageZoomed ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" /> Normal View
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" /> Expand
                    </>
                  )}
                </button>
                <a
                  href={trade.chart_image}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Full Res
                </a>
              </div>
            </div>

            <div
              className={`overflow-hidden rounded-lg border border-slate-800 bg-black/40 flex items-center justify-center cursor-pointer transition-all ${
                isImageZoomed ? "max-h-[600px]" : "max-h-64"
              }`}
              onClick={() => setIsImageZoomed(!isImageZoomed)}
            >
              <img
                src={trade.chart_image}
                alt="Trade Chart Setup"
                className="w-full h-auto object-contain max-h-inherit"
              />
            </div>
          </div>
        )}

        {trade.chart_url && (
          <div>
            <a
              href={trade.chart_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View External Chart Link
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
          <button
            onClick={() => {
              if (confirm("Delete this trade?")) {
                onDelete(trade.id);
                onClose();
              }
            }}
            className="flex items-center gap-1 text-rose-400 hover:underline"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => {
                onClose();
                onEdit(trade);
              }}
            >
              Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
