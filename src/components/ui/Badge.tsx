import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "profit" | "loss" | "breakeven" | "open" | "neutral" | "brand" | "warning";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  className,
}) => {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs font-medium",
    md: "px-2.5 py-1 text-xs font-semibold",
  };

  const variantStyles = {
    profit: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    loss: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
    breakeven: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    open: "bg-sky-500/10 text-sky-400 border border-sky-500/30 animate-pulse",
    neutral: "bg-slate-800 text-slate-300 border border-slate-700/60",
    brand: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30",
    warning: "bg-yellow-500/10 text-yellow-300 border border-yellow-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border transition-colors select-none",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
