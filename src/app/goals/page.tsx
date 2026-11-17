"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { Goal } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import confetti from "canvas-confetti";
import {
  Target,
  Trophy,
  PlusCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Award,
} from "lucide-react";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals");
      const data = await res.json();
      if (data.success) {
        setGoals(data.goals);
        // Check if any goal was just achieved
        const newlyAchieved = data.goals.some(
          (g: Goal) => g.status === "ACHIEVED" || g.current_amount >= g.target_amount
        );
        if (newlyAchieved) {
          // Trigger subtle milestone confetti celebration
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 },
            });
          } catch (e) {
            // Ignore if confetti not supported
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Goals & Financial Milestones Setup
                </h1>
                <p className="text-xs text-slate-400">
                  Target net profit benchmarks, prop firm challenges, withdrawal milestones, and scaling roadmap
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setEditGoal(null);
                setIsGoalModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              Set New Goal
            </button>
          </div>

          {/* Goal Statistics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-950/10 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Active Milestones
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-0.5">
                  {activeGoals.length} Goals In Flight
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Milestones Achieved
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                  {achievedGoals.length} Completed
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-950/10 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Total Target Capital
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-0.5">
                  {formatCurrency(goals.reduce((sum, g) => sum + g.target_amount, 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Goals Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                Active Goals & In-Progress Targets ({activeGoals.length})
              </h3>
            </div>

            {activeGoals.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
                <Target className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-300">No active goals set yet</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Set a profit target (e.g. $5,000) or withdrawal goal to start tracking progress automatically.
                </p>
                <button
                  onClick={() => {
                    setEditGoal(null);
                    setIsGoalModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  + Create Your First Goal
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
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-base font-bold text-emerald-400 tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Trophy Case: Achieved Milestones ({achievedGoals.length})
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

          {/* Discipline Rules Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl">
            <div className="flex items-center gap-2 text-sky-400 mb-3">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Trading Plan & Discipline Commitments
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-sky-400 block mb-1">Rule 1: Risk Limit</span>
                <span className="text-slate-300">
                  Never risk more than 1-2% of total account balance on any single idea.
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">Rule 2: Daily Stop</span>
                <span className="text-slate-300">
                  Walk away for the day immediately after 2 consecutive losing trades. No revenge trading.
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">Rule 3: Quality Over Quantity</span>
                <span className="text-slate-300">
                  Only take A+ high-confluence setups (liquidity sweep + FVG + multi-timeframe order block).
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-indigo-400 block mb-1">Rule 4: Mandatory Autopsy</span>
                <span className="text-slate-300">
                  Log entry reasoning before execution and autopsy why profit/loss occurred after closing.
                </span>
              </div>
            </div>
          </div>
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
