"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  variant?: "profit" | "loss" | "brand" | "amber" | "neutral";
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  variant = "neutral",
}) => {
  const variantStyles = {
    profit: "border-emerald-500/30 bg-emerald-950/10 text-emerald-400 hover:border-emerald-500/50",
    loss: "border-rose-500/30 bg-rose-950/10 text-rose-400 hover:border-rose-500/50",
    brand: "border-sky-500/30 bg-sky-950/10 text-sky-400 hover:border-sky-500/50",
    amber: "border-amber-500/30 bg-amber-950/10 text-amber-400 hover:border-amber-500/50",
    neutral: "border-slate-800 bg-[#0f172a] text-slate-200 hover:border-slate-700",
  };

  const iconBgStyles = {
    profit: "bg-emerald-500/10 text-emerald-400",
    loss: "bg-rose-500/10 text-rose-400",
    brand: "bg-sky-500/10 text-sky-400",
    amber: "bg-amber-500/10 text-amber-400",
    neutral: "bg-slate-800 text-slate-300",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5 shadow-lg transition-all flex flex-col justify-between",
        variantStyles[variant]
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div className={cn("p-2 rounded-xl border border-white/5", iconBgStyles[variant])}>
          {icon}
        </div>
      </div>

      <div>
        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight num-tabular text-white">
          {value}
        </div>
        {subValue && <div className="text-xs text-slate-400 mt-1 font-mono">{subValue}</div>}
      </div>
    </div>
  );
};
