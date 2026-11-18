"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Lock,
  Menu,
  X,
  StickyNote,
} from "lucide-react";
import { Button } from "../ui/Button";
import { useAccounts } from "../providers/AccountProvider";
import { NAV_ITEMS } from "./Sidebar";
import { cn, formatCurrency } from "@/lib/utils";

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
  const pathname = usePathname();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { accounts, activeAccountId, setActiveAccountId, autoSyncStatus } = useAccounts();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) await onRefresh();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleLock = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/login";
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-3 sm:px-6 lg:px-8 gap-2">
          {/* Brand + Mobile Hamburger + Global Account Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors flex-shrink-0"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

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
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1 max-w-[130px] sm:max-w-[210px] truncate"
                  title="Switch active trading account workspace"
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
                title="Create or manage separate trading accounts"
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
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Link
              href="/notes"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-colors"
            >
              <StickyNote className="w-3.5 h-3.5 text-emerald-400" />
              Notes
            </Link>

            <Link
              href="/chart"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-colors"
            >
              <CandlestickChart className="w-3.5 h-3.5 text-amber-400" />
              Chart
            </Link>

            <Link
              href="/calculator"
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
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

            <button
              onClick={handleLock}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Lock Vault (Sign Out)"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>

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

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[82vw] bg-[#090d16] border-r border-slate-800 h-full flex flex-col p-4 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-sky-400">
                  <BarChart2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-bold text-white">Trading Journal</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="space-y-1 flex-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors",
                      isActive
                        ? "bg-slate-800 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isActive ? "text-sky-400" : "text-slate-500"
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-3 mt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenCashflowModal();
                }}
                className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-amber-300 flex items-center justify-center gap-1"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" /> Cashflow
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenGoalModal();
                }}
                className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-indigo-300 flex items-center justify-center gap-1"
              >
                <Target className="w-3.5 h-3.5" /> Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
