"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { PairIcon } from "../ui/PairIcon";
import { useAccounts } from "../providers/AccountProvider";
import { Goal, GoalCategory, GoalTrackingMode, Trade } from "@/lib/types";
import { toDateInputValue, formatCurrency, formatDate } from "@/lib/utils";
import {
  Target,
  Trophy,
  DollarSign,
  Award,
  Calendar,
  ListChecks,
  Search,
  CheckSquare,
  Square,
  Clock,
} from "lucide-react";

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (goal: Goal) => void;
  editGoal?: Goal | null;
}

export const GoalFormModal: React.FC<GoalFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editGoal,
}) => {
  const { accounts, activeAccountId } = useAccounts();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("PROFIT_TARGET");
  const [trackingMode, setTrackingMode] = useState<GoalTrackingMode>("AUTO_DATE");
  const [accountId, setAccountId] = useState("acc_default");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [startDate, setStartDate] = useState(toDateInputValue());
  const [startFromExactNow, setStartFromExactNow] = useState(false);
  const [exactStartIso, setExactStartIso] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  // Specific trade linking
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [linkedTradeIds, setLinkedTradeIds] = useState<string[]>([]);
  const [tradeSearch, setTradeSearch] = useState("");
  const [showTradePicker, setShowTradePicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const targetAcc = editGoal
        ? editGoal.account_id || "acc_default"
        : activeAccountId && activeAccountId !== "ALL"
        ? activeAccountId
        : "acc_default";
      const accQuery = targetAcc && targetAcc !== "ALL" ? `?account_id=${encodeURIComponent(targetAcc)}` : "";
      fetch(`/api/trades${accQuery}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.trades)) {
            setAllTrades(data.trades);
          }
        })
        .catch(() => {});
    }

    if (editGoal) {
      setTitle(editGoal.title);
      setCategory(editGoal.category);
      setTrackingMode(editGoal.tracking_mode === "MANUAL_TRADES" ? "MANUAL_TRADES" : "AUTO_DATE");
      setAccountId(editGoal.account_id || "acc_default");
      setTargetAmount(String(editGoal.target_amount));
      setCurrentAmount(String(editGoal.current_amount));
      const isExact = editGoal.start_date && !editGoal.start_date.endsWith("T00:00:00.000Z");
      setStartFromExactNow(Boolean(isExact));
      setExactStartIso(isExact ? editGoal.start_date : null);
      setStartDate(toDateInputValue(editGoal.start_date));
      setTargetDate(editGoal.target_date ? toDateInputValue(editGoal.target_date) : "");
      setNotes(editGoal.notes || "");
      const linked = Array.isArray(editGoal.linked_trade_ids) ? editGoal.linked_trade_ids : [];
      setLinkedTradeIds(linked);
      setShowTradePicker(editGoal.tracking_mode === "MANUAL_TRADES" || linked.length > 0);
      setError(null);
    } else {
      setTitle("");
      setCategory("PROFIT_TARGET");
      setTrackingMode("AUTO_DATE");
      setAccountId(activeAccountId && activeAccountId !== "ALL" ? activeAccountId : "acc_default");
      setTargetAmount("");
      setCurrentAmount("0");
      setStartDate(toDateInputValue());
      setStartFromExactNow(false);
      setExactStartIso(null);
      setTargetDate("");
      setNotes("");
      setLinkedTradeIds([]);
      setTradeSearch("");
      setShowTradePicker(false);
      setError(null);
    }
  }, [editGoal, isOpen, activeAccountId]);

  const applyDatePreset = (preset: "TODAY" | "NOW" | "WEEK" | "MONTH" | "ALL") => {
    const now = new Date();
    if (preset === "NOW") {
      setStartFromExactNow(true);
      setExactStartIso(now.toISOString());
      setStartDate(toDateInputValue(now));
    } else if (preset === "TODAY") {
      setStartFromExactNow(false);
      setExactStartIso(null);
      setStartDate(toDateInputValue(now));
    } else if (preset === "WEEK") {
      setStartFromExactNow(false);
      setExactStartIso(null);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diff);
      setStartDate(toDateInputValue(monday));
    } else if (preset === "MONTH") {
      setStartFromExactNow(false);
      setExactStartIso(null);
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toDateInputValue(first));
    } else if (preset === "ALL") {
      setStartFromExactNow(false);
      setExactStartIso(null);
      setStartDate("2020-01-01");
    }
  };

  const toggleLinkedTrade = (tradeId: string) => {
    setLinkedTradeIds((prev) =>
      prev.includes(tradeId) ? prev.filter((id) => id !== tradeId) : [...prev, tradeId]
    );
  };

  const filteredTradesForPicker = allTrades.filter((t) => {
    if (!tradeSearch.trim()) return true;
    const q = tradeSearch.toLowerCase();
    return (
      t.symbol.toLowerCase().includes(q) ||
      t.trade_date.toLowerCase().includes(q) ||
      (t.exchange || "").toLowerCase().includes(q)
    );
  });

  const selectedTradesPnl = allTrades
    .filter((t) => linkedTradeIds.includes(t.id))
    .reduce((sum, t) => sum + Number(t.pnl || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numTarget = parseFloat(targetAmount);
    if (isNaN(numTarget) || numTarget <= 0) {
      setError("Please specify a target amount greater than zero.");
      return;
    }

    if (!title.trim()) {
      setError("Please give your goal a title.");
      return;
    }

    setLoading(true);
    try {
      // If user chose "Right Now", preserve the exact ISO timestamp; otherwise use YYYY-MM-DDT00:00:00.000Z
      const resolvedStartDate =
        startFromExactNow && exactStartIso
          ? exactStartIso
          : `${startDate}T00:00:00.000Z`;

      const payload = {
        title: title.trim(),
        category,
        tracking_mode: trackingMode,
        account_id: accountId || "ALL",
        linked_trade_ids: linkedTradeIds,
        target_amount: numTarget,
        current_amount: parseFloat(currentAmount) || 0,
        start_date: resolvedStartDate,
        target_date: targetDate ? `${targetDate}T23:59:59.000Z` : null,
        notes: notes.trim(),
      };

      const url = editGoal ? `/api/goals/${editGoal.id}` : "/api/goals";
      const method = editGoal ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save goal");
      }

      onSuccess(data.goal);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editGoal ? "Edit Goal / Milestone" : "Set New Trading Goal"}
      subtitle="Track profit from a specific start date or attach specific trades' profit & loss"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Tracking Mode Switcher */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            How Should Progress Be Calculated?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTrackingMode("AUTO_DATE")}
              className={`flex items-start gap-2.5 p-3 rounded-xl text-xs border transition-all text-left ${
                trackingMode === "AUTO_DATE"
                  ? "bg-sky-500/15 text-white border-sky-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <Calendar className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Start From Specific Date</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Only counts trades on/after your chosen start day (ignores older profit)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTrackingMode("MANUAL_TRADES");
                setShowTradePicker(true);
              }}
              className={`flex items-start gap-2.5 p-3 rounded-xl text-xs border transition-all text-left ${
                trackingMode === "MANUAL_TRADES"
                  ? "bg-emerald-500/15 text-white border-emerald-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ListChecks className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Specific Trades Only</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Starts at $0 — only includes the exact trades you pick & assign
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Goal Title + Category */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Goal Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Make $200 Profit Starting Today"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Goal Type</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GoalCategory)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="PROFIT_TARGET">Net Profit Target</option>
              <option value="WITHDRAWAL_GOAL">Withdrawal Goal</option>
              <option value="ACCOUNT_BALANCE">Account Balance</option>
              <option value="DISCIPLINE_HABIT">Milestone / Custom</option>
            </select>
          </div>
        </div>

        {/* Target Amount + Account Scope */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Target Amount ($) *
            </label>
            <input
              type="number"
              step="any"
              required
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="e.g. 200"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono font-bold focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Track Account Scope
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Accounts (Combined)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Start Date & Deadline */}
        <div className="rounded-xl border border-slate-800 bg-[#0b101d] p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Start Counting Profit From
            </label>

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => applyDatePreset("TODAY")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                  !startFromExactNow && startDate === toDateInputValue()
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("NOW")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors flex items-center gap-1 ${
                  startFromExactNow
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
                title="Excludes even trades taken earlier today — starts strictly from $0 right now"
              >
                <Clock className="w-2.5 h-2.5" />
                Right Now ($0 Fresh)
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("WEEK")}
                className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("MONTH")}
                className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("ALL")}
                className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              >
                All Time
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Start Date {startFromExactNow ? "(Exact timestamp active)" : "(Trades before this day are excluded)"}
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setStartFromExactNow(false);
                  setExactStartIso(null);
                }}
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Target Deadline (Optional)</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Specific Trades Picker (Always open in MANUAL_TRADES, optional expandable in AUTO_DATE) */}
        <div className="rounded-xl border border-slate-800 bg-[#0b101d] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowTradePicker(!showTradePicker)}
              className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 hover:underline"
            >
              <ListChecks className="w-3.5 h-3.5" />
              {trackingMode === "MANUAL_TRADES"
                ? `Pick Specific Trades to Count (${linkedTradeIds.length} selected)`
                : showTradePicker
                ? `Hide Specific Trade Picker (${linkedTradeIds.length} linked)`
                : `+ Also Link Specific Trades' Profit / Loss (${linkedTradeIds.length} linked)`}
            </button>

            {linkedTradeIds.length > 0 && (
              <span
                className={`text-xs font-mono font-bold ${
                  selectedTradesPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                Selected P&L: {formatCurrency(selectedTradesPnl, true)}
              </span>
            )}
          </div>

          {showTradePicker && (
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={tradeSearch}
                  onChange={(e) => setTradeSearch(e.target.value)}
                  placeholder="Search positions by symbol or date..."
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {filteredTradesForPicker.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500">
                    No trades found to link.
                  </div>
                ) : (
                  filteredTradesForPicker.slice(0, 60).map((t) => {
                    const checked = linkedTradeIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleLinkedTrade(t.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border transition-colors text-left ${
                          checked
                            ? "bg-emerald-500/15 border-emerald-500/40 text-white"
                            : "bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {checked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          )}
                          <PairIcon symbol={t.symbol} size="xs" />
                          <span className="font-mono font-bold">{t.symbol}</span>
                          <span className="text-[10px] text-slate-400">{t.direction}</span>
                          <span className="text-[10px] text-slate-500 font-mono truncate">
                            {formatDate(t.trade_date)}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-bold flex-shrink-0 ${
                            t.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatCurrency(t.pnl, true)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Notes (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Stick to 1% risk per trade."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Saving..." : editGoal ? "Update Goal" : "Create Goal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
