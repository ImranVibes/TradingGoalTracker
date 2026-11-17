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
  HelpCircle,
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

  const rrRatio = calculateRR(trade.entry_price || 0, trade.stop_loss, trade.take_profit, trade.direction);
  const isProfit = trade.pnl > 0;
  const isLoss = trade.pnl < 0;

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

          <div className="flex flex-col items-end gap-1">
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
            {rrRatio && (
              <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                1:{rrRatio} R:R
              </span>
            )}
          </div>
        </div>

        {/* Pricing & Strategy Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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

        {trade.chart_url && (
          <div>
            <a
              href={trade.chart_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Chart Link
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
