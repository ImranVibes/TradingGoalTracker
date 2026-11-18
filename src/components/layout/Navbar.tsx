"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  ArrowDownLeft,
  Target,
  Calculator,
  RefreshCw,
  BarChart2,
  Settings,
  Layers,
  CandlestickChart,
} from "lucide-react";
import { Button } from "../ui/Button";
import { useAccounts } from "../providers/AccountProvider";
import { formatCurrency } from "@/lib/utils";

interface NavbarProps {
  onOpenTradeModal: () => void;
  onOpenCashflowModal: () => void;
  onOpenGoalModal: () => void;
  onRefresh?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenTradeModal,
  onOpenCashflowModal,
  onOpenGoalModal,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { accounts, activeAccountId, setActiveAccountId, autoSyncStatus } = useAccounts();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) await onRefresh();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-3 sm:px-6 lg:px-8 gap-2">
        {/* Brand + Global Account Switcher */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700/80 text-sky-400">
              <BarChart2 className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold tracking-tight text-white">Trading Journal</span>
            </div>
          </Link>

          {/* Global Account Switcher */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              <Layers className="w-3.5 h-3.5 text-sky-400 mr-1.5 flex-shrink-0" />
              <select
                value={activeAccountId}
                onChange={(e) => setActiveAccountId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1 max-w-[140px] sm:max-w-[210px] truncate"
                title="Switch active trading account or view all accounts combined"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  All Accounts (Combined)
                </option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                    {acc.name} ({formatCurrency(acc.net_pnl || 0, true)})
                  </option>
                ))}
              </select>
            </div>

            <Link
              href="/accounts"
              className="hidden md:inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-sky-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
              title="Create or manage separate target & loss recovery accounts"
            >
              + Accounts
            </Link>
          </div>

          {autoSyncStatus === "syncing" && (
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-300 font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Auto-syncing positions...
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          <Link
            href="/chart"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-colors"
          >
            <CandlestickChart className="w-3.5 h-3.5 text-amber-400" />
            Chart
          </Link>

          <Link
            href="/calculator"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-sky-400" />
            Calculator
          </Link>

          <Link
            href="/settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Settings & Exchange Keys"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
          </Link>

          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-sky-400" : ""}`} />
            </button>
          )}

          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />}
            onClick={onOpenCashflowModal}
            className="hidden sm:inline-flex"
          >
            Cashflow
          </Button>

          <Button
            size="sm"
            variant="outline"
            icon={<Target className="w-3.5 h-3.5 text-indigo-400" />}
            onClick={onOpenGoalModal}
            className="hidden sm:inline-flex"
          >
            Goal
          </Button>

          <Button
            size="sm"
            variant="profit"
            icon={<PlusCircle className="w-3.5 h-3.5" />}
            onClick={onOpenTradeModal}
          >
            Log Trade
          </Button>
        </div>
      </div>
    </header>
  );
};
