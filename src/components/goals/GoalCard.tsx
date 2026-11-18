"use client";

import React from "react";
import { Goal } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { useAccounts } from "../providers/AccountProvider";
import {
  Target,
  Trophy,
  DollarSign,
  Award,
  Clock,
  Calendar,
  ListChecks,
  Edit2,
  Trash2,
} from "lucide-react";

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onEdit, onDelete }) => {
  const { accounts } = useAccounts();
  const current = Number(goal.current_amount || 0);
  const target = Number(goal.target_amount || 1);
  const percentage = Math.min(100, Math.max(0, (current / target) * 100));
  const isAchieved = goal.status === "ACHIEVED" || current >= target;
  const linkedCount = Array.isArray(goal.linked_trade_ids) ? goal.linked_trade_ids.length : 0;
  const isManualOnly = goal.tracking_mode === "MANUAL_TRADES";
  const accountName =
    goal.account_id && goal.account_id !== "ALL"
      ? accounts.find((a) => a.id === goal.account_id)?.name
      : null;

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

  const isExactStart = goal.start_date && !goal.start_date.endsWith("T00:00:00.000Z");

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
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex-shrink-0">
              {categoryIcons[goal.category] || <Target className="w-4 h-4 text-sky-400" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {categoryLabels[goal.category] || goal.category}
                </span>
                {accountName && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                    {accountName}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white tracking-tight leading-snug truncate">
                {goal.title}
              </h3>
            </div>
          </div>

          <Badge variant={isAchieved ? "profit" : "brand"}>
            {isAchieved ? "ACHIEVED" : `${percentage.toFixed(0)}%`}
          </Badge>
        </div>

        {/* Tracking Scope Pill Row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono mb-3">
          {isManualOnly ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <ListChecks className="w-3 h-3" />
              Specific Trades Only ({linkedCount} linked)
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/80 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sky-400" />
              From: {formatDate(goal.start_date, Boolean(isExactStart))}
              {linkedCount > 0 ? ` + ${linkedCount} extra` : ""}
            </span>
          )}
        </div>

        {/* Progress Numbers */}
        <div className="my-3">
          <div className="flex items-baseline justify-between text-xs mb-1.5 font-mono">
            <span className="text-slate-400">
              Current:{" "}
              <strong
                className={`text-sm font-bold ${
                  current < 0 ? "text-rose-400" : isAchieved ? "text-emerald-400" : "text-white"
                }`}
              >
                {formatCurrency(current, current < 0)}
              </strong>
            </span>
            <span className="text-slate-400">
              Target:{" "}
              <strong className="text-sky-400 text-sm font-bold">
                {formatCurrency(target)}
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

          {!isAchieved && (
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {formatCurrency(Math.max(0, target - current))} remaining to reach target
            </div>
          )}
        </div>

        {/* Motivation Notes */}
        {goal.notes && (
          <p className="text-xs text-slate-300 italic mb-3 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
            &ldquo;{goal.notes}&rdquo;
          </p>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {goal.target_date ? `Deadline: ${formatDate(goal.target_date)}` : "No Deadline"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(goal)}
            className="px-2 py-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-1"
            title="Pick specific trades or edit start date"
          >
            <ListChecks className="w-3 h-3" />
            Trades
          </button>
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
