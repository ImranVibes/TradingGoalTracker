"use client";

import React from "react";
import { Goal } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Target, Trophy, DollarSign, Award, Clock, CheckCircle, Edit2, Trash2 } from "lucide-react";

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onEdit, onDelete }) => {
  const percentage = Math.min(100, Math.max(0, (goal.current_amount / goal.target_amount) * 100));
  const isAchieved = goal.status === "ACHIEVED" || percentage >= 100;

  const categoryIcons = {
    PROFIT_TARGET: <Trophy className="w-4 h-4 text-sky-400" />,
    WITHDRAWAL_GOAL: <DollarSign className="w-4 h-4 text-amber-400" />,
    ACCOUNT_BALANCE: <Award className="w-4 h-4 text-emerald-400" />,
    DISCIPLINE_HABIT: <Target className="w-4 h-4 text-indigo-400" />,
  };

  const categoryLabels = {
    PROFIT_TARGET: "Profit Target",
    WITHDRAWAL_GOAL: "Withdrawal Milestone",
    ACCOUNT_BALANCE: "Account Scaling",
    DISCIPLINE_HABIT: "Discipline Target",
  };

  return (
    <div
      className={`rounded-2xl border p-5 transition-all relative overflow-hidden flex flex-col justify-between ${
        isAchieved
          ? "bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-900 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
          : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
      }`}
    >
      {/* Top Banner */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              {categoryIcons[goal.category] || <Target className="w-4 h-4 text-sky-400" />}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {categoryLabels[goal.category] || goal.category}
              </span>
              <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                {goal.title}
              </h3>
            </div>
          </div>

          <Badge variant={isAchieved ? "profit" : "brand"}>
            {isAchieved ? "ACHIEVED" : `${percentage.toFixed(0)}% Done`}
          </Badge>
        </div>

        {/* Progress Numbers */}
        <div className="my-4">
          <div className="flex items-baseline justify-between text-xs mb-1.5 font-mono">
            <span className="text-slate-400">
              Current:{" "}
              <strong className="text-white text-sm font-bold">
                {formatCurrency(goal.current_amount)}
              </strong>
            </span>
            <span className="text-slate-400">
              Target:{" "}
              <strong className="text-sky-400 text-sm font-bold">
                {formatCurrency(goal.target_amount)}
              </strong>
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isAchieved
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/30"
                  : "bg-gradient-to-r from-sky-500 to-indigo-500 shadow-md shadow-sky-500/30"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Motivation Notes */}
        {goal.notes && (
          <p className="text-xs text-slate-300 italic mb-4 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
            &ldquo;{goal.notes}&rdquo;
          </p>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {goal.target_date ? `Deadline: ${formatDate(goal.target_date)}` : "Ongoing Target"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(goal)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Edit Goal"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this goal?")) onDelete(goal.id);
            }}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Delete Goal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
