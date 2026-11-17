"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, ArrowUpRight, ArrowDownLeft, Target, Database, Activity, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
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
  const [dbStatus, setDbStatus] = useState<{ isPostgres: boolean; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setDbStatus(data.database))
      .catch(() => setDbStatus({ isPostgres: false, message: "Storage Active" }));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090d16]/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & System Status */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#090d16]">
                <Activity className="h-5 w-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">APEX</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                  Tracker & Goals
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Institutional Journal & Personal Finance</p>
            </div>
          </Link>

          {/* Database Health Pill */}
          <div className="hidden md:flex items-center gap-2 text-xs px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono text-[11px]">
              {dbStatus?.isPostgres ? "Postgres (signal_terminal)" : "Storage Active"}
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
        </div>

        {/* Global Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-sky-400" : ""}`} />
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
            New Goal
          </Button>

          <Button
            size="sm"
            variant="profit"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={onOpenTradeModal}
          >
            <span className="hidden xs:inline">Log</span> Trade
          </Button>
        </div>
      </div>
    </header>
  );
};
