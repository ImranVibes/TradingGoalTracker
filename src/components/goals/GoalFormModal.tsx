"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Goal, GoalCategory } from "@/lib/types";
import { toDateInputValue } from "@/lib/utils";
import { Target, Trophy, DollarSign, Award } from "lucide-react";

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
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("PROFIT_TARGET");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [startDate, setStartDate] = useState(toDateInputValue());
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editGoal) {
      setTitle(editGoal.title);
      setCategory(editGoal.category);
      setTargetAmount(String(editGoal.target_amount));
      setCurrentAmount(String(editGoal.current_amount));
      setStartDate(toDateInputValue(editGoal.start_date));
      setTargetDate(editGoal.target_date ? toDateInputValue(editGoal.target_date) : "");
      setNotes(editGoal.notes || "");
    } else {
      setTitle("");
      setCategory("PROFIT_TARGET");
      setTargetAmount("");
      setCurrentAmount("0");
      setStartDate(toDateInputValue());
      setTargetDate("");
      setNotes("");
      setError(null);
    }
  }, [editGoal, isOpen]);

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
      const payload = {
        title,
        category,
        target_amount: numTarget,
        current_amount: parseFloat(currentAmount) || 0,
        start_date: new Date(startDate).toISOString(),
        target_date: targetDate ? new Date(targetDate).toISOString() : null,
        notes,
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
      subtitle="Establish concrete profit targets, funded account milestones, or payout goals"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Goal Category Preset */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Goal Type *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCategory("PROFIT_TARGET")}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                category === "PROFIT_TARGET"
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <Trophy className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <div>
                <div>Net Profit Target</div>
                <div className="text-[10px] text-slate-500 font-normal">Auto-tracks trading profits</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCategory("WITHDRAWAL_GOAL")}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                category === "WITHDRAWAL_GOAL"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <DollarSign className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <div>Withdrawal Milestone</div>
                <div className="text-[10px] text-slate-500 font-normal">Real extracted payouts</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCategory("ACCOUNT_BALANCE")}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                category === "ACCOUNT_BALANCE"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <Award className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <div>Account Balance / Scale</div>
                <div className="text-[10px] text-slate-500 font-normal">Prop or live account size</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCategory("DISCIPLINE_HABIT")}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                category === "DISCIPLINE_HABIT"
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <Target className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <div>Discipline & Win Target</div>
                <div className="text-[10px] text-slate-500 font-normal">Milestones & trade count</div>
              </div>
            </button>
          </div>
        </div>

        {/* Goal Title */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Goal Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Make $5,000 Net Profit this Month or Funded Phase 1 Target"
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
          />
        </div>

        {/* Target Amount & Target Date */}
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
              placeholder="e.g. 5000"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono font-bold focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Deadline</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Notes & Motivation */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Notes / Why this goal matters</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Reward myself with a new trading workstation once completed. Maintain risk of 1% strictly."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-3 text-sm text-slate-200 focus:border-sky-500 focus:outline-none leading-relaxed"
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
