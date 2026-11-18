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
  Calculator,
  Radio,
  Settings,
  Layers,
  CandlestickChart,
  StickyNote,
  CheckSquare,
  Compass,
  ClipboardCheck,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "AI Copilot",
    href: "/copilot",
    icon: Bot,
  },
  {
    name: "Chart",
    href: "/chart",
    icon: CandlestickChart,
  },
  {
    name: "Sentiment Detector",
    href: "/sentiment",
    icon: Compass,
  },
  {
    name: "Pre-Trade Checklist",
    href: "/checklist",
    icon: CheckSquare,
  },
  {
    name: "Do's & Don'ts",
    href: "/dos-donts",
    icon: ClipboardCheck,
  },
  {
    name: "Trading Accounts",
    href: "/accounts",
    icon: Layers,
  },
  {
    name: "Positions Journal",
    href: "/journal",
    icon: BookOpen,
  },
  {
    name: "Notes",
    href: "/notes",
    icon: StickyNote,
  },
  {
    name: "Signal Providers",
    href: "/signals",
    icon: Radio,
  },
  {
    name: "Daily & Calendar",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    name: "Cashflow & Spending",
    href: "/cashflow",
    icon: Wallet,
  },
  {
    name: "Goals & Targets",
    href: "/goals",
    icon: Target,
  },
  {
    name: "Risk & Lot Calculator",
    href: "/calculator",
    icon: Calculator,
  },
  {
    name: "Performance Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    name: "Exchange & Settings",
    href: "/settings",
    icon: Settings,
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 hidden lg:block border-r border-slate-800 bg-[#090d16] min-h-[calc(100vh-3.5rem)] p-3">
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
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
    </aside>
  );
};
