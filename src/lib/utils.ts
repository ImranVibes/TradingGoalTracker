import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, showSign: boolean = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "$0.00";
  const absFormatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (amount > 0) {
    return showSign ? `+$${absFormatted}` : `$${absFormatted}`;
  } else if (amount < 0) {
    return `-$${absFormatted}`;
  }
  return `$${absFormatted}`;
}

export function formatPercent(percent: number, showSign: boolean = true): string {
  if (isNaN(percent) || percent === null || percent === undefined) return "0.00%";
  const formatted = Math.abs(percent).toFixed(2);
  if (percent > 0) {
    return showSign ? `+${formatted}%` : `${formatted}%`;
  } else if (percent < 0) {
    return `-${formatted}%`;
  }
  return `${formatted}%`;
}

export function formatDate(dateString: string | Date, includeTime: boolean = false): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return String(dateString);

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  };

  return d.toLocaleDateString("en-US", options);
}

export function toDateInputValue(date: string | Date = new Date()): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
}

export function calculateRR(
  entry: number,
  stopLoss?: number | null,
  takeProfit?: number | null,
  direction: "LONG" | "SHORT" = "LONG"
): number | null {
  if (!entry || !stopLoss || !takeProfit) return null;
  const risk = direction === "LONG" ? entry - stopLoss : stopLoss - entry;
  const reward = direction === "LONG" ? takeProfit - entry : entry - takeProfit;
  if (risk <= 0 || reward <= 0) return null;
  return Number((reward / risk).toFixed(2));
}

export function calculateWinRate(wins: number, total: number): number {
  if (!total || total === 0) return 0;
  return Number(((wins / total) * 100).toFixed(1));
}

export function calculateProfitFactor(grossProfit: number, grossLoss: number): number {
  if (grossLoss === 0) return grossProfit > 0 ? 99.9 : 0;
  return Number((Math.abs(grossProfit) / Math.abs(grossLoss)).toFixed(2));
}
