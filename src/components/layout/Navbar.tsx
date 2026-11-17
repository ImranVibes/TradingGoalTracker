"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PlusCircle, ArrowDownLeft, Target, Calculator, RefreshCw, BarChart2 } from "lucide-react";
import { Button } from "../ui/Button";

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) await onRefresh();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700/80 text-sky-400">
              <BarChart2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white">Trading Journal</span>
            </div>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Link
            href="/calculator"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-sky-400" />
            Calculator
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
