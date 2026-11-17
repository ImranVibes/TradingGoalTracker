"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Wallet,
  Target,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Trading Journal",
    href: "/journal",
    icon: BookOpen,
    badge: "Detailed",
  },
  {
    name: "Daily & Calendar",
    href: "/calendar",
    icon: CalendarDays,
    badge: null,
  },
  {
    name: "Cashflow & Spending",
    href: "/cashflow",
    icon: Wallet,
    badge: null,
  },
  {
    name: "Goals & Milestones",
    href: "/goals",
    icon: Target,
    badge: "Targets",
  },
  {
    name: "Analytics & Edge",
    href: "/analytics",
    icon: BarChart3,
    badge: null,
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 hidden lg:block border-r border-slate-800 bg-[#0b101d] min-h-[calc(100vh-4rem)] p-4">
      {/* Trading Mindset Quote Banner */}
      <div className="mb-6 rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-950/30 to-indigo-950/20 p-3.5">
        <div className="flex items-center gap-2 text-sky-400 mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Trading Discipline</span>
        </div>
        <p className="text-xs text-slate-300 italic leading-relaxed">
          &ldquo;Focus on the process, risk management, and flawless execution. The profits will follow.&rdquo;
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group",
                isActive
                  ? "bg-gradient-to-r from-sky-500/15 to-indigo-500/10 text-sky-400 border border-sky-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/60"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"
                  )}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider",
                    isActive
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      : "bg-slate-800 text-slate-400"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Account Safety Rules Footer */}
      <div className="mt-8 pt-6 border-t border-slate-800/80">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
          Personal Rules Checklist
        </h4>
        <ul className="space-y-1.5 text-xs text-slate-400 px-1">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Max 1-2% risk per position</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Stop after 2 consecutive losses</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Always log trade autopsy</span>
          </li>
        </ul>
      </div>
    </aside>
  );
};
