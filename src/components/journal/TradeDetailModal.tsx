"use client";

import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Trade } from "@/lib/types";
import { formatCurrency, formatDate, calculateRR } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Compass,
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
  if (!trade) return null;

  const rrRatio = calculateRR(trade.entry_price, trade.stop_loss, trade.take_profit, trade.direction);
  const isProfit = trade.pnl > 0;
  const isLoss = trade.pnl < 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${trade.symbol} (${trade.direction})`}
      subtitle={`Logged on ${formatDate(trade.trade_date, true)}`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Main PnL Banner */}
        <div
          className={`flex items-center justify-between p-4 rounded-2xl border ${
            isProfit
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : isLoss
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
              : "bg-slate-800/60 border-slate-700/80 text-slate-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isProfit
                  ? "bg-emerald-500/20 text-emerald-300"
                  : isLoss
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {trade.direction === "LONG" ? (
                <TrendingUp className="w-6 h-6" />
              ) : (
                <TrendingDown className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Realized Outcome
              </div>
              <div className="text-2xl font-black font-mono tracking-tight num-tabular">
                {formatCurrency(trade.pnl, true)}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
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
              size="md"
            >
              {trade.status}
            </Badge>
            {rrRatio && (
              <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                Risk/Reward: 1:{rrRatio}
              </span>
            )}
          </div>
        </div>

        {/* Pricing Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Entry Price</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">
              {trade.entry_price}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Exit Price</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">
              {trade.exit_price ?? "Running / None"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Stop Loss</div>
            <div className="text-sm font-mono font-bold text-rose-400 mt-0.5">
              {trade.stop_loss ?? "-"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Take Profit</div>
            <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
              {trade.take_profit ?? "-"}
            </div>
          </div>
        </div>

        {/* Setup & Session Details */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Strategy:</span>
            <span className="font-semibold text-white">{trade.strategy || "SMC"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Session:</span>
            <span className="font-semibold text-white">{trade.session || "NY"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-slate-400">Timeframe:</span>
            <span className="font-mono font-semibold text-white">{trade.timeframe || "1h"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-slate-400">Lot/Qty:</span>
            <span className="font-mono font-semibold text-white">{trade.quantity}</span>
          </div>
        </div>

        {/* CORE REQUIREMENT: WHY I TOOK THE TRADE */}
        <div className="rounded-2xl border border-sky-500/20 bg-sky-950/10 p-4">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Why I took this trade (Setup Confluence & Entry Checklist)
          </div>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {trade.reason_entry || "No entry notes provided."}
          </p>
        </div>

        {/* CORE REQUIREMENT: WHY PROFIT OR LOSS WAS MADE */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <AlertCircle className="w-4 h-4" />
            Why profit / loss was made (Post-Trade Execution Review)
          </div>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {trade.reason_outcome || "No outcome reflection provided."}
          </p>
        </div>

        {/* Lessons Learned */}
        {trade.lessons_learned && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              Key Lesson Learned
            </div>
            <p className="text-xs text-slate-300">{trade.lessons_learned}</p>
          </div>
        )}

        {/* Chart Screenshot Link */}
        {trade.chart_url && (
          <div>
            <a
              href={trade.chart_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Chart / Screenshot
            </a>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="w-4 h-4 text-rose-400" />}
            onClick={() => {
              if (confirm("Are you sure you want to delete this trade?")) {
                onDelete(trade.id);
                onClose();
              }
            }}
            className="text-rose-400 hover:bg-rose-500/10"
          >
            Delete
          </Button>

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
              Edit Trade
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
