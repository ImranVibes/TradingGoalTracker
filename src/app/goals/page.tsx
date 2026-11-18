"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { useAccounts } from "@/components/providers/AccountProvider";
import { Goal } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import confetti from "canvas-confetti";
import { Target, Trophy, PlusCircle, CheckCircle2, Award, Layers } from "lucide-react";

export default function GoalsPage() {
  const { activeAccountId, activeAccount, refreshAccounts } = useAccounts();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      const accParam =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const res = await fetch(`/api/goals${accParam}`);
      const data = await res.json();
      if (data.success) {
        setGoals(data.goals);
        const newlyAchieved = data.goals.some(
          (g: Goal) => g.status === "ACHIEVED" || g.current_amount >= g.target_amount
        );
        if (newlyAchieved) {
          try {
            confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleDeleteGoal = async (id: string) => {
    try {
      await fetch(`/api/goals/${id}`, { method: "DELETE" });
      await fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const achievedGoals = goals.filter((g) => g.status === "ACHIEVED");

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => {
          setEditGoal(null);
          setIsGoalModalOpen(true);
        }}
        onRefresh={fetchGoals}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Trading Goals & Targets
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  <Layers className="w-3 h-3" />
                  {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Set profit targets, account balance milestones, and payout targets for this account workspace.
              </p>
            </div>

            <button
              onClick={() => {
                setEditGoal(null);
                setIsGoalModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Set Goal
            </button>
          </div>

          {/* Quick Rollup */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Active Goals
                </span>
                <div className="text-xl font-bold font-mono text-white mt-0.5">
                  {activeGoals.length}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Completed Milestones
                </span>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {achievedGoals.length}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Total Target Capital
                </span>
                <div className="text-xl font-bold font-mono text-white mt-0.5">
                  {formatCurrency(goals.reduce((sum, g) => sum + g.target_amount, 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Goals Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white tracking-tight">Active Targets</h3>

            {activeGoals.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
                <Target className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-slate-300">No active goals yet</h4>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  Set a monthly profit target or withdrawal milestone to track progress.
                </p>
                <button
                  onClick={() => {
                    setEditGoal(null);
                    setIsGoalModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  + Add Goal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={(g) => {
                      setEditGoal(g);
                      setIsGoalModalOpen(true);
                    }}
                    onDelete={handleDeleteGoal}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Achieved Goals Section */}
          {achievedGoals.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-bold text-emerald-400 tracking-tight flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Completed Goals ({achievedGoals.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={(g) => {
                      setEditGoal(g);
                      setIsGoalModalOpen(true);
                    }}
                    onDelete={handleDeleteGoal}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => fetchGoals()}
        editGoal={editGoal}
      />

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => fetchGoals()}
      />

      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={() => fetchGoals()}
      />
    </div>
  );
}
