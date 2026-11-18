"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { CashflowTable } from "@/components/cashflow/CashflowTable";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { StatCard } from "@/components/dashboard/StatCard";
import { useAccounts } from "@/components/providers/AccountProvider";
import { Cashflow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet,
  ArrowDownLeft,
  ShoppingBag,
  ArrowUpRight,
  PlusCircle,
  PiggyBank,
  Layers,
} from "lucide-react";

export default function CashflowPage() {
  const { activeAccountId, activeAccount, refreshAccounts } = useAccounts();
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const fetchCashflow = useCallback(async () => {
    try {
      const accParam =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const res = await fetch(`/api/cashflow${accParam}`);
      const data = await res.json();
      if (data.success) setCashflows(data.cashflows);
    } catch (err) {
      console.error(err);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchCashflow();
  }, [fetchCashflow]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/cashflow/${id}`, { method: "DELETE" });
      await fetchCashflow();
      refreshAccounts();
    } catch (err) {
      console.error(err);
    }
  };

  // Rollups
  let totalWithdrawn = 0;
  let totalSpent = 0;
  let totalDeposited = 0;

  const categoryTotals: Record<string, number> = {};

  for (const c of cashflows) {
    if (c.type === "WITHDRAWAL") totalWithdrawn += c.amount;
    else if (c.type === "EXPENSE") totalSpent += c.amount;
    else if (c.type === "DEPOSIT") totalDeposited += c.amount;

    categoryTotals[c.category] = (categoryTotals[c.category] || 0) + c.amount;
  }

  const netExtracted = totalWithdrawn - totalDeposited;

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={fetchCashflow}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Cashflow & Life Spending
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <Layers className="w-3 h-3" />
                    {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Track how much you withdraw from trading, how much you spend, and what it was spent on
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCashflowModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              Record Cashflow
            </button>
          </div>

          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Withdrawn (Bank / Crypto)"
              value={formatCurrency(totalWithdrawn)}
              subValue="Money taken out of trading"
              icon={<ArrowDownLeft className="w-5 h-5" />}
              variant="amber"
            />

            <StatCard
              label="Total Spent & Expenses"
              value={formatCurrency(totalSpent)}
              subValue="Living, gear, subscriptions & bills"
              icon={<ShoppingBag className="w-5 h-5" />}
              variant="loss"
            />

            <StatCard
              label="Net Capital Extracted"
              value={formatCurrency(netExtracted, true)}
              subValue="Withdrawn minus Capital Deposits"
              icon={<PiggyBank className="w-5 h-5" />}
              variant="profit"
            />

            <StatCard
              label="Capital Injected (Deposits)"
              value={formatCurrency(totalDeposited)}
              subValue="Account deposits & refills"
              icon={<ArrowUpRight className="w-5 h-5" />}
              variant="neutral"
            />
          </div>

          {/* Category Spending Breakdown */}
          {Object.keys(categoryTotals).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
                Spending & Outflow by Category
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(categoryTotals).map(([cat, amt]) => (
                  <div
                    key={cat}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
                  >
                    <span className="text-xs text-slate-400 font-medium truncate">{cat}</span>
                    <span className="text-base font-bold font-mono text-white mt-1 num-tabular">
                      {formatCurrency(amt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Cashflow Table */}
          <CashflowTable
            cashflows={cashflows}
            onDelete={handleDelete}
            onOpenModal={() => setIsCashflowModalOpen(true)}
          />
        </main>
      </div>

      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={() => {
          fetchCashflow();
          refreshAccounts();
        }}
      />

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => fetchCashflow()}
      />

      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => fetchCashflow()}
      />
    </div>
  );
}
