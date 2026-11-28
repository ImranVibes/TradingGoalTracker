"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { WeeklyReviewButton } from "@/components/analytics/WeeklyReviewButton";
import { useAccounts } from "@/components/providers/AccountProvider";
import { DosDontsTemplate, DailyDosDontsLog, DailyBehaviorItem, Trade } from "@/lib/types";
import { toDateInputValue } from "@/lib/utils";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Layers,
  Award,
  Flame,
  Filter,
  Trash2,
  Save,
  Sparkles,
  BarChart2,
  X,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

type RollupScope = "DAY" | "WEEK" | "MONTH" | "ALL";
type CalendarFilterMode = "ALL" | "CLEAN" | "MISTAKES";

function computeDayGrade(dosTotal: number, dontsTotal: number): {
  grade: string;
  color: string;
  bg: string;
  pct: number;
} | null {
  const sum = dosTotal + dontsTotal;
  if (sum === 0) return null;
  const pct = Math.round((dosTotal / sum) * 100);
  if (dontsTotal === 0 && dosTotal >= 3) {
    return { grade: "A+", color: "text-emerald-300", bg: "bg-emerald-500/20 border-emerald-500/40", pct };
  }
  if (pct >= 85) {
    return { grade: "A", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", pct };
  }
  if (pct >= 70) {
    return { grade: "B", color: "text-sky-300", bg: "bg-sky-500/15 border-sky-500/30", pct };
  }
  if (pct >= 50) {
    return { grade: "C", color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30", pct };
  }
  if (pct >= 30) {
    return { grade: "D", color: "text-orange-300", bg: "bg-orange-500/15 border-orange-500/30", pct };
  }
  return { grade: "F", color: "text-rose-400", bg: "bg-rose-500/20 border-rose-500/40", pct };
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().split("T")[0];
}

function getWeekRangeForDate(dateKey: string): { start: string; end: string } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun .. 6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(Date.UTC(y, m - 1, d + diffToMon));
  const sun = new Date(Date.UTC(y, m - 1, d + diffToMon + 6));
  return {
    start: mon.toISOString().split("T")[0],
    end: sun.toISOString().split("T")[0],
  };
}

function formatReadableDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function DosDontsPage() {
  const { activeAccountId, activeAccount } = useAccounts();

  const todayKey = useMemo(() => toDateInputValue(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const [y, m] = todayKey.split("-").map(Number);
    return { year: y, month: m - 1 }; // 0-indexed month
  });

  const [templates, setTemplates] = useState<DosDontsTemplate[]>([]);
  const [logs, setLogs] = useState<DailyDosDontsLog[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  // Trade Linking State
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [tradeMatrixScope, setTradeMatrixScope] = useState<"SELECTED_DAY" | "WEEK" | "MONTH">("SELECTED_DAY");
  const [tradeMatrixFilter, setTradeMatrixFilter] = useState<"ALL" | "CLEAN" | "MISTAKES">("ALL");
  const [quickTagTradeId, setQuickTagTradeId] = useState<string | null>(null);

  // Selected Day Draft State
  const [dayItems, setDayItems] = useState<DailyBehaviorItem[]>([]);
  const [reflection, setReflection] = useState("");
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Custom Point Inputs
  const [customDoText, setCustomDoText] = useState("");
  const [customDontText, setCustomDontText] = useState("");
  const [addingCustom, setAddingCustom] = useState<"DO" | "DONT" | null>(null);

  // Calendar & Frequency Filters
  const [rollupScope, setRollupScope] = useState<RollupScope>("MONTH");
  const [calendarFilterMode, setCalendarFilterMode] = useState<CalendarFilterMode>("ALL");
  const [highlightBehavior, setHighlightBehavior] = useState<string>(""); // label filter

  // Global Navbar Modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const targetAccountId =
    activeAccountId && activeAccountId !== "ALL" ? activeAccountId : "acc_default";

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const accParam =
        activeAccountId && activeAccountId !== "ALL"
          ? `?account_id=${encodeURIComponent(activeAccountId)}`
          : "";
      const res = await fetch(`/api/dos-donts${accParam}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
        setLogs(data.logs || []);
        if (Array.isArray(data.trades)) {
          setTrades(data.trades);
        }
      }
    } catch (err) {
      console.error("[DosDonts] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Combine logs by date (when viewing ALL accounts, merge counts for calendar/rollups)
  const logsByDate = useMemo(() => {
    const map: Record<string, { items: DailyBehaviorItem[]; reflection: string; logIds: string[] }> =
      {};
    for (const log of logs) {
      const d = log.date;
      if (!map[d]) {
        map[d] = { items: [], reflection: log.reflection || "", logIds: [log.id] };
      } else {
        map[d].logIds.push(log.id);
        if (log.reflection && !map[d].reflection) map[d].reflection = log.reflection;
      }
      for (const item of log.items || []) {
        const existing = map[d].items.find(
          (x) =>
            x.kind === item.kind &&
            x.label.toLowerCase() === item.label.toLowerCase() &&
            (item.trade_id ? x.trade_id === item.trade_id : !x.trade_id)
        );
        if (existing) {
          existing.count += Number(item.count || 1);
        } else {
          map[d].items.push({ ...item, count: Number(item.count || 1) });
        }
      }
    }
    return map;
  }, [logs]);

  // Sync draft editor whenever selectedDate or loaded logs change
  useEffect(() => {
    const exactLog =
      activeAccountId === "ALL"
        ? logsByDate[selectedDate]
        : logs.find((l) => l.date === selectedDate);
    if (exactLog) {
      setDayItems((exactLog.items || []).map((i) => ({ ...i })));
      setReflection(exactLog.reflection || "");
    } else {
      setDayItems([]);
      setReflection("");
    }
    setSavingStatus("idle");
  }, [selectedDate, logs, logsByDate, activeAccountId]);

  // Keep calendar month synced when user jumps to a date in another month
  const selectDateAndSyncMonth = (dateKey: string) => {
    setSelectedDate(dateKey);
    const [y, m] = dateKey.split("-").map(Number);
    if (y && m) {
      setCalendarMonth({ year: y, month: m - 1 });
    }
  };

  // Persist selected day to PostgreSQL
  const persistDay = useCallback(
    async (nextItems: DailyBehaviorItem[], nextReflection: string, dateToSave: string) => {
      setSavingStatus("saving");
      try {
        const res = await fetch("/api/dos-donts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "save_day",
            account_id: targetAccountId,
            date: dateToSave,
            items: nextItems,
            reflection: nextReflection,
          }),
        });
        const data = await res.json();
        if (data.success && data.log) {
          setLogs((prev) => {
            const idx = prev.findIndex(
              (l) => l.account_id === data.log.account_id && l.date === data.log.date
            );
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = data.log;
              return copy;
            }
            return [data.log, ...prev];
          });
          setSavingStatus("saved");
          setTimeout(() => setSavingStatus("idle"), 1600);
        }
      } catch (err) {
        console.error(err);
        setSavingStatus("idle");
      }
    },
    [targetAccountId]
  );

  // Trade linkages
  const selectedDayTrades = useMemo(() => {
    return trades.filter((t) => {
      const d = (t.trade_date || "").slice(0, 10);
      return d === selectedDate;
    });
  }, [trades, selectedDate]);

  const activeTrade = useMemo(() => {
    if (!selectedTradeId) return null;
    return trades.find((t) => t.id === selectedTradeId) || null;
  }, [trades, selectedTradeId]);

  // Add/increment/decrement a behavior point on the selected day
  const updateItemCount = (
    kind: "DO" | "DONT",
    label: string,
    delta: number,
    category = "General",
    overrideTradeId?: string | null
  ) => {
    const next = [...dayItems];
    const targetTradeId = overrideTradeId !== undefined ? overrideTradeId : selectedTradeId;
    const linkedTrade = targetTradeId ? trades.find((t) => t.id === targetTradeId) : null;

    const idx = next.findIndex(
      (i) =>
        i.kind === kind &&
        i.label.toLowerCase() === label.toLowerCase() &&
        (targetTradeId ? i.trade_id === targetTradeId : !i.trade_id)
    );
    if (idx >= 0) {
      const updatedCount = next[idx].count + delta;
      if (updatedCount <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], count: Math.min(99, updatedCount) };
      }
    } else if (delta > 0) {
      next.push({
        label: label.trim(),
        kind,
        count: delta,
        category,
        trade_id: linkedTrade ? linkedTrade.id : undefined,
        trade_symbol: linkedTrade ? linkedTrade.symbol : undefined,
        trade_direction: linkedTrade ? linkedTrade.direction || "LONG" : undefined,
        trade_pnl: linkedTrade ? linkedTrade.pnl : undefined,
      });
    }
    setDayItems(next);
    persistDay(next, reflection, selectedDate);
  };

  const handleAddCustomPoint = async (kind: "DO" | "DONT", e: React.FormEvent) => {
    e.preventDefault();
    const raw = (kind === "DO" ? customDoText : customDontText).trim();
    if (!raw) return;

    setAddingCustom(kind);
    try {
      // 1. Save as reusable pre-selector template so user can 1-click select it in the future
      const res = await fetch("/api/dos-donts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create_template",
          kind,
          label: raw,
          category: "Custom",
        }),
      });
      const data = await res.json();
      if (data.success && data.template) {
        setTemplates((prev) => {
          if (prev.some((t) => t.id === data.template.id)) return prev;
          return [...prev, data.template];
        });
      }

      // 2. Also add 1x to the currently selected day right away
      updateItemCount(kind, raw, 1, "Custom");
      if (kind === "DO") setCustomDoText("");
      else setCustomDontText("");
    } catch (err) {
      console.error(err);
    } finally {
      setAddingCustom(null);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/dos-donts?template_id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const doTemplates = useMemo(() => templates.filter((t) => t.kind === "DO"), [templates]);
  const dontTemplates = useMemo(() => templates.filter((t) => t.kind === "DONT"), [templates]);

  const getSelectedCount = (
    kind: "DO" | "DONT",
    label: string,
    targetTradeId?: string | null
  ): number => {
    const checkId = targetTradeId !== undefined ? targetTradeId : selectedTradeId;
    if (checkId) {
      const found = dayItems.find(
        (i) =>
          i.kind === kind &&
          i.label.toLowerCase() === label.toLowerCase() &&
          i.trade_id === checkId
      );
      return found ? found.count : 0;
    }
    const found = dayItems.find(
      (i) =>
        i.kind === kind &&
        i.label.toLowerCase() === label.toLowerCase() &&
        !i.trade_id
    );
    return found ? found.count : 0;
  };

  const selectedDayDos = dayItems.filter((i) => i.kind === "DO");
  const selectedDayDonts = dayItems.filter((i) => i.kind === "DONT");
  const selectedDosTotal = selectedDayDos.reduce((s, i) => s + i.count, 0);
  const selectedDontsTotal = selectedDayDonts.reduce((s, i) => s + i.count, 0);
  const selectedDayGrade = computeDayGrade(selectedDosTotal, selectedDontsTotal);

  // Month String (YYYY-MM)
  const monthPrefix = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, "0")}`;
  const monthLabel = new Date(
    Date.UTC(calendarMonth.year, calendarMonth.month, 1)
  ).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  // Week range around selectedDate
  const activeWeek = useMemo(() => getWeekRangeForDate(selectedDate), [selectedDate]);

  // Trades based on the Trade Matrix Scope (Day, Week, Month)
  const scopedMatrixTrades = useMemo(() => {
    return trades.filter((t) => {
      const d = (t.trade_date || "").slice(0, 10);
      if (tradeMatrixScope === "SELECTED_DAY") return d === selectedDate;
      if (tradeMatrixScope === "WEEK") return d >= activeWeek.start && d <= activeWeek.end;
      if (tradeMatrixScope === "MONTH") return d.startsWith(monthPrefix);
      return true;
    });
  }, [trades, tradeMatrixScope, selectedDate, activeWeek, monthPrefix]);

  // Trade-by-trade analytics helper for scopedMatrixTrades
  const tradeBehaviorStats = useMemo(() => {
    let cleanWins = 0;
    let cleanTotal = 0;
    let cleanPnl = 0;

    let mistakeWins = 0;
    let mistakeTotal = 0;
    let mistakePnl = 0;

    // Collect all items across logs to match trades
    const allItems: DailyBehaviorItem[] = [];
    for (const log of logs) {
      for (const item of log.items || []) {
        allItems.push(item);
      }
    }

    const tradeBreakdown = scopedMatrixTrades.map((t) => {
      const tItems = [
        ...dayItems.filter((i) => i.trade_id === t.id),
        ...allItems.filter(
          (i) =>
            i.trade_id === t.id &&
            !dayItems.some((di) => di.trade_id === t.id && di.label.toLowerCase() === i.label.toLowerCase())
        ),
      ];
      const dos = tItems.filter((i) => i.kind === "DO");
      const donts = tItems.filter((i) => i.kind === "DONT");
      const dosCount = dos.reduce((s, i) => s + i.count, 0);
      const dontsCount = donts.reduce((s, i) => s + i.count, 0);
      const grade = computeDayGrade(dosCount, dontsCount);
      const isWon = t.status === "WON" || t.pnl > 0;
      const isMistakeTainted = dontsCount > 0;

      if (isMistakeTainted) {
        mistakeTotal++;
        if (isWon) mistakeWins++;
        mistakePnl += Number(t.pnl || 0);
      } else {
        cleanTotal++;
        if (isWon) cleanWins++;
        cleanPnl += Number(t.pnl || 0);
      }

      return {
        trade: t,
        dos,
        donts,
        dosCount,
        dontsCount,
        grade,
        isMistakeTainted,
      };
    });

    const cleanWinRate = cleanTotal > 0 ? Math.round((cleanWins / cleanTotal) * 100) : 0;
    const mistakeWinRate = mistakeTotal > 0 ? Math.round((mistakeWins / mistakeTotal) * 100) : 0;

    return {
      tradeBreakdown,
      cleanTotal,
      cleanWinRate,
      cleanPnl,
      mistakeTotal,
      mistakeWinRate,
      mistakePnl,
    };
  }, [scopedMatrixTrades, dayItems, logs]);

  // Rollup Stats (Day / Week / Month / All Time)
  const rollup = useMemo(() => {
    const filteredDates = Object.entries(logsByDate).filter(([dateKey]) => {
      if (rollupScope === "DAY") return dateKey === selectedDate;
      if (rollupScope === "WEEK") return dateKey >= activeWeek.start && dateKey <= activeWeek.end;
      if (rollupScope === "MONTH") return dateKey.startsWith(monthPrefix);
      return true;
    });

    const doMap: Record<string, { label: string; count: number; days: number }> = {};
    const dontMap: Record<string, { label: string; count: number; days: number }> = {};
    let totalDos = 0;
    let totalDonts = 0;
    let cleanDays = 0;
    let loggedDays = 0;

    for (const [, entry] of filteredDates) {
      const items = entry.items || [];
      if (items.length === 0) continue;
      loggedDays++;
      const dayHasDont = items.some((i) => i.kind === "DONT" && i.count > 0);
      if (!dayHasDont) cleanDays++;

      for (const item of items) {
        const key = item.label.toLowerCase();
        if (item.kind === "DO") {
          totalDos += item.count;
          if (!doMap[key]) doMap[key] = { label: item.label, count: 0, days: 0 };
          doMap[key].count += item.count;
          doMap[key].days += 1;
        } else {
          totalDonts += item.count;
          if (!dontMap[key]) dontMap[key] = { label: item.label, count: 0, days: 0 };
          dontMap[key].count += item.count;
          dontMap[key].days += 1;
        }
      }
    }

    const topDos = Object.values(doMap).sort((a, b) => b.count - a.count);
    const topDonts = Object.values(dontMap).sort((a, b) => b.count - a.count);
    const ratioPct =
      totalDos + totalDonts > 0 ? Math.round((totalDos / (totalDos + totalDonts)) * 100) : 0;

    return { totalDos, totalDonts, cleanDays, loggedDays, topDos, topDonts, ratioPct };
  }, [logsByDate, rollupScope, selectedDate, activeWeek, monthPrefix]);

  // All unique logged behavior labels for the Calendar pre-filter dropdown
  const allLoggedLabels = useMemo(() => {
    const set = new Map<string, "DO" | "DONT">();
    for (const t of templates) set.set(t.label, t.kind);
    for (const entry of Object.values(logsByDate)) {
      for (const item of entry.items) {
        if (!set.has(item.label)) set.set(item.label, item.kind);
      }
    }
    return Array.from(set.entries()).map(([label, kind]) => ({ label, kind }));
  }, [templates, logsByDate]);

  // Monthly Calendar Cells
  const calendarDays = useMemo(() => {
    const firstDayUtc = new Date(Date.UTC(calendarMonth.year, calendarMonth.month, 1));
    const daysInMonth = new Date(
      Date.UTC(calendarMonth.year, calendarMonth.month + 1, 0)
    ).getUTCDate();
    // Monday-first offset (Mon=0 .. Sun=6)
    const rawDow = firstDayUtc.getUTCDay();
    const startOffset = rawDow === 0 ? 6 : rawDow - 1;

    const cells: (null | {
      dayNum: number;
      dateKey: string;
      dosCount: number;
      dontsCount: number;
      grade: ReturnType<typeof computeDayGrade>;
      highlightCount: number;
      matchesFilter: boolean;
    })[] = [];

    for (let i = 0; i < startOffset; i++) cells.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(
        2,
        "0"
      )}-${String(d).padStart(2, "0")}`;
      const entry = logsByDate[dateKey];
      const items = entry?.items || [];
      const dosCount = items
        .filter((i) => i.kind === "DO")
        .reduce((s, i) => s + Number(i.count || 0), 0);
      const dontsCount = items
        .filter((i) => i.kind === "DONT")
        .reduce((s, i) => s + Number(i.count || 0), 0);
      const grade = computeDayGrade(dosCount, dontsCount);

      const highlightCount = highlightBehavior
        ? items
            .filter((i) => i.label.toLowerCase() === highlightBehavior.toLowerCase())
            .reduce((s, i) => s + Number(i.count || 0), 0)
        : 0;

      let matchesFilter = true;
      if (highlightBehavior) {
        matchesFilter = highlightCount > 0;
      } else if (calendarFilterMode === "CLEAN") {
        matchesFilter = dosCount > 0 && dontsCount === 0;
      } else if (calendarFilterMode === "MISTAKES") {
        matchesFilter = dontsCount > 0;
      }

      cells.push({
        dayNum: d,
        dateKey,
        dosCount,
        dontsCount,
        grade,
        highlightCount,
        matchesFilter,
      });
    }
    return cells;
  }, [calendarMonth, logsByDate, calendarFilterMode, highlightBehavior]);

  const changeMonth = (delta: number) => {
    const dt = new Date(Date.UTC(calendarMonth.year, calendarMonth.month + delta, 1));
    setCalendarMonth({ year: dt.getUTCFullYear(), month: dt.getUTCMonth() });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={fetchData}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Daily Do&apos;s &amp; Don&apos;ts Journal
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <Layers className="w-3 h-3" />
                    {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  After-trading daily accountability log — track what you did right (Do&apos;s), what mistakes you made (Don&apos;s) with 1x/2x counts, and inspect patterns across your monthly calendar.
                </p>
              </div>
            </div>

            {/* Date Navigator + Automated Weekly AI Review */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <WeeklyReviewButton accountId={activeAccountId} />
              <div className="flex items-center gap-1.5 bg-[#0f172a] border border-slate-800 p-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => selectDateAndSyncMonth(shiftDateKey(selectedDate, -1))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) selectDateAndSyncMonth(e.target.value);
                }}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => selectDateAndSyncMonth(shiftDateKey(selectedDate, 1))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {selectedDate !== todayKey && (
                <button
                  type="button"
                  onClick={() => selectDateAndSyncMonth(todayKey)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25"
                >
                  Today
                </button>
              )}
              </div>
            </div>
          </div>

          {/* Top KPI Summary Strip (Synced to Selected Rollup Scope) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Do&apos;s ({rollupScope === "DAY" ? "Selected Day" : rollupScope === "WEEK" ? "This Week" : rollupScope === "MONTH" ? monthLabel.split(" ")[0] : "All Time"})
                </span>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
                  {rollup.totalDos}x
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Don&apos;ts ({rollupScope === "DAY" ? "Selected Day" : rollupScope === "WEEK" ? "This Week" : rollupScope === "MONTH" ? monthLabel.split(" ")[0] : "All Time"})
                </span>
                <div className="text-2xl font-black font-mono text-rose-400 mt-0.5">
                  {rollup.totalDonts}x
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Discipline Ratio
                </span>
                <div className="text-2xl font-black font-mono text-white mt-0.5">
                  {rollup.ratioPct}%
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0f172a] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Clean Days (0 Don&apos;ts)
                </span>
                <div className="text-2xl font-black font-mono text-amber-300 mt-0.5">
                  {rollup.cleanDays}
                  <span className="text-xs text-slate-500 font-normal">/{rollup.loggedDays}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main 2-Column Workspace */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* LEFT COLUMN: Daily After-Trading Logger */}
            <div className="xl:col-span-6 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-5 shadow-xl">
                {/* Active Date & Grade Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-sky-400 font-bold">
                      Post-Trading Review For
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {formatReadableDate(selectedDate)}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {savingStatus === "saving" && (
                      <span className="text-[11px] text-sky-400 font-mono">Saving...</span>
                    )}
                    {savingStatus === "saved" && (
                      <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                    {selectedDayGrade ? (
                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-black font-mono border ${selectedDayGrade.bg} ${selectedDayGrade.color}`}
                      >
                        Grade {selectedDayGrade.grade} ({selectedDayGrade.pct}%)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-mono bg-slate-900 text-slate-500 border border-slate-800">
                        Not logged yet
                      </span>
                    )}
                  </div>
                </div>

                {/* Target Trade Scope Selector (Day-Wide vs. Specific Trade) */}
                <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-mono">
                      <Target className="w-3.5 h-3.5 text-sky-400" />
                      Assign Behavior To:
                    </span>
                    {selectedTradeId && (
                      <button
                        type="button"
                        onClick={() => setSelectedTradeId(null)}
                        className="text-[10px] text-sky-400 hover:text-sky-300 font-mono font-bold flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Reset to Day-Wide
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedTradeId(null)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedTradeId === null
                          ? "bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Day-Wide (General)</span>
                    </button>

                    {selectedDayTrades.map((t) => {
                      const isWon = t.status === "WON" || t.pnl > 0;
                      const isLost = t.status === "LOST" || t.pnl < 0;
                      const isSelected = selectedTradeId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTradeId(isSelected ? null : t.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-md ring-1 ring-amber-500/40"
                              : isWon
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60"
                              : isLost
                              ? "bg-rose-500/10 text-rose-300 border-rose-500/30 hover:border-rose-500/60"
                              : "bg-slate-900 text-slate-300 border-slate-800 hover:text-white"
                          }`}
                        >
                          <span>{t.symbol}</span>
                          <span className="text-[10px] opacity-75">({t.direction || "TRADE"})</span>
                          <span className={`font-black ${isWon ? "text-emerald-400" : isLost ? "text-rose-400" : "text-slate-400"}`}>
                            {t.pnl >= 0 ? `+$${Number(t.pnl).toFixed(0)}` : `-$${Math.abs(Number(t.pnl)).toFixed(0)}`}
                          </span>
                        </button>
                      );
                    })}

                    {selectedDayTrades.length === 0 && (
                      <span className="text-xs text-slate-500 italic py-1">
                        (No trades logged on {selectedDate} — points will apply day-wide)
                      </span>
                    )}
                  </div>

                  {activeTrade ? (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-200">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>
                          Tagging points to: <strong>{activeTrade.symbol}</strong> ({activeTrade.direction} • {activeTrade.pnl >= 0 ? `+$${Number(activeTrade.pnl).toFixed(0)}` : `-$${Math.abs(Number(activeTrade.pnl)).toFixed(0)}`}).
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 uppercase font-bold bg-amber-500/20 px-2 py-0.5 rounded">
                        Trade Active
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pl-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      Points clicked below will log to overall daily discipline.
                    </div>
                  )}
                </div>

                {/* Today's Active Logged Points (with 1x / 2x / 3x counters) */}
                {(selectedDayDos.length > 0 || selectedDayDonts.length > 0) && (
                  <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3.5 space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Logged on {selectedDate} (Use +/- for 2x, 3x...)</span>
                      <span className="font-mono">
                        <span className="text-emerald-400">✓ {selectedDosTotal}x</span> •{" "}
                        <span className="text-rose-400">✕ {selectedDontsTotal}x</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedDayDos.map((item) => (
                        <div
                          key={`active_do_${item.label}_${item.trade_id || "day"}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="font-semibold">{item.label}</span>
                          {item.trade_symbol ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                                (item.trade_pnl ?? 0) >= 0
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              }`}
                            >
                              {item.trade_symbol} {item.trade_pnl !== undefined ? ((item.trade_pnl >= 0 ? "+" : "") + `$${Number(item.trade_pnl).toFixed(0)}`) : ""}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                              Day-Wide
                            </span>
                          )}
                          <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-emerald-500/30 font-mono">
                            <button
                              type="button"
                              onClick={() => updateItemCount("DO", item.label, -1, item.category, item.trade_id)}
                              className="p-0.5 rounded hover:bg-emerald-500/30 text-emerald-300"
                              title="Decrease count (removes at 0)"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-black text-emerald-300 min-w-[20px] text-center">
                              {item.count}x
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItemCount("DO", item.label, 1, item.category, item.trade_id)}
                              className="p-0.5 rounded hover:bg-emerald-500/30 text-emerald-300"
                              title="Increment count (2x, 3x...)"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {selectedDayDonts.map((item) => (
                        <div
                          key={`active_dont_${item.label}_${item.trade_id || "day"}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                          <span className="font-semibold">{item.label}</span>
                          {item.trade_symbol ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                                (item.trade_pnl ?? 0) >= 0
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              }`}
                            >
                              {item.trade_symbol} {item.trade_pnl !== undefined ? ((item.trade_pnl >= 0 ? "+" : "") + `$${Number(item.trade_pnl).toFixed(0)}`) : ""}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                              Day-Wide
                            </span>
                          )}
                          <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-rose-500/30 font-mono">
                            <button
                              type="button"
                              onClick={() => updateItemCount("DONT", item.label, -1, item.category, item.trade_id)}
                              className="p-0.5 rounded hover:bg-rose-500/30 text-rose-300"
                              title="Decrease count (removes at 0)"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-black text-rose-300 min-w-[20px] text-center">
                              {item.count}x
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItemCount("DONT", item.label, 1, item.category, item.trade_id)}
                              className="p-0.5 rounded hover:bg-rose-500/30 text-rose-300"
                              title="Increment mistake count (2x, 3x...)"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DO's Quick Pre-Selectors */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      DO&apos;s — What I Did Right (Click to add +1x)
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {doTemplates.map((tpl) => {
                      const cnt = getSelectedCount("DO", tpl.label);
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => updateItemCount("DO", tpl.label, 1, tpl.category)}
                          className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-all select-none ${
                            cnt > 0
                              ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/50 shadow-sm"
                              : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-emerald-500/40 hover:text-white"
                          }`}
                        >
                          <span>{tpl.label}</span>
                          {cnt > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-500 text-slate-950 font-mono font-black text-[10px]">
                              {cnt}x
                            </span>
                          )}
                          {tpl.is_custom && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                              className="opacity-50 hover:opacity-100 hover:text-rose-400 ml-0.5"
                              title="Delete custom pre-selector"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick Add Custom DO */}
                  <form
                    onSubmit={(e) => handleAddCustomPoint("DO", e)}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={customDoText}
                      onChange={(e) => setCustomDoText(e.target.value)}
                      placeholder="+ Write custom DO (auto-saved as quick pre-selector)..."
                      className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={addingCustom === "DO" || !customDoText.trim()}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 disabled:opacity-40 transition-colors"
                    >
                      + Add Do
                    </button>
                  </form>
                </div>

                {/* DON'Ts Quick Pre-Selectors */}
                <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      DON&apos;Ts — Mistakes Made Today (Click to add +1x)
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {dontTemplates.map((tpl) => {
                      const cnt = getSelectedCount("DONT", tpl.label);
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => updateItemCount("DONT", tpl.label, 1, tpl.category)}
                          className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-all select-none ${
                            cnt > 0
                              ? "bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-sm"
                              : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-rose-500/40 hover:text-white"
                          }`}
                        >
                          <span>{tpl.label}</span>
                          {cnt > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-rose-500 text-white font-mono font-black text-[10px]">
                              {cnt}x
                            </span>
                          )}
                          {tpl.is_custom && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                              className="opacity-50 hover:opacity-100 hover:text-rose-300 ml-0.5"
                              title="Delete custom pre-selector"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick Add Custom DON'T */}
                  <form
                    onSubmit={(e) => handleAddCustomPoint("DONT", e)}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={customDontText}
                      onChange={(e) => setCustomDontText(e.target.value)}
                      placeholder="+ Write custom DON'T mistake (auto-saved as pre-selector)..."
                      className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={addingCustom === "DONT" || !customDontText.trim()}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 disabled:opacity-40 transition-colors"
                    >
                      + Add Don&apos;t
                    </button>
                  </form>
                </div>

                {/* Daily After-Trading Reflection */}
                <div className="space-y-2 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      End-of-Day Reflection & Tomorrow&apos;s Rule
                    </label>
                    <button
                      type="button"
                      onClick={() => persistDay(dayItems, reflection, selectedDate)}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 transition-colors"
                    >
                      <Save className="w-3 h-3" />
                      Save Day
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    onBlur={() => persistDay(dayItems, reflection, selectedDate)}
                    placeholder="What went well today? What exact rule will prevent today's mistakes tomorrow?"
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Monthly Pro Journal Calendar + Day/Week/Month Frequency Tracker */}
            <div className="xl:col-span-6 space-y-5">
              {/* Interactive Monthly Calendar */}
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-sky-400" />
                    <h3 className="text-sm font-bold text-white">{monthLabel} Accountability Calendar</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changeMonth(-1)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const [y, m] = todayKey.split("-").map(Number);
                        setCalendarMonth({ year: y, month: m - 1 });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white"
                    >
                      Current
                    </button>
                    <button
                      type="button"
                      onClick={() => changeMonth(1)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Calendar Pre-Filters */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Filter className="w-3.5 h-3.5 text-slate-500 mr-0.5" />
                  {(
                    [
                      { id: "ALL", label: "All Days" },
                      { id: "CLEAN", label: "Clean Days (0 Don'ts)" },
                      { id: "MISTAKES", label: "Mistake Days" },
                    ] as { id: CalendarFilterMode; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setCalendarFilterMode(f.id);
                        setHighlightBehavior("");
                      }}
                      className={`px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
                        !highlightBehavior && calendarFilterMode === f.id
                          ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}

                  <select
                    value={highlightBehavior}
                    onChange={(e) => setHighlightBehavior(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500 max-w-[190px] truncate"
                    title="Highlight every day a specific mistake or habit occurred"
                  >
                    <option value="">Filter specific Do / Don&apos;t...</option>
                    <optgroup label="DON'Ts (Mistakes)">
                      {allLoggedLabels
                        .filter((l) => l.kind === "DONT")
                        .map((l) => (
                          <option key={`f_dont_${l.label}`} value={l.label}>
                            ✕ {l.label}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="DO's (Habits)">
                      {allLoggedLabels
                        .filter((l) => l.kind === "DO")
                        .map((l) => (
                          <option key={`f_do_${l.label}`} value={l.label}>
                            ✓ {l.label}
                          </option>
                        ))}
                    </optgroup>
                  </select>

                  {highlightBehavior && (
                    <button
                      type="button"
                      onClick={() => setHighlightBehavior("")}
                      className="text-amber-300 hover:underline flex items-center gap-0.5"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Weekday Headers (Mon-Sun) */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
                    <div key={w} className="py-1">
                      {w}
                    </div>
                  ))}
                </div>

                {/* Month Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty_${idx}`} className="h-16 rounded-xl bg-slate-950/30" />;
                    }
                    const isSelected = cell.dateKey === selectedDate;
                    const isToday = cell.dateKey === todayKey;
                    const hasData = cell.dosCount > 0 || cell.dontsCount > 0;
                    const dimmed =
                      (calendarFilterMode !== "ALL" || Boolean(highlightBehavior)) &&
                      !cell.matchesFilter;

                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => setSelectedDate(cell.dateKey)}
                        className={`h-16 p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                          isSelected
                            ? "border-sky-400 bg-sky-500/15 ring-1 ring-sky-400/50"
                            : highlightBehavior && cell.highlightCount > 0
                            ? "border-amber-400/70 bg-amber-500/15"
                            : hasData
                            ? cell.dontsCount === 0
                              ? "border-emerald-500/30 bg-emerald-500/[0.06] hover:border-emerald-400/60"
                              : cell.dosCount >= cell.dontsCount
                              ? "border-slate-700 bg-slate-900/90 hover:border-slate-600"
                              : "border-rose-500/35 bg-rose-500/[0.07] hover:border-rose-400/60"
                            : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700"
                        } ${dimmed ? "opacity-25" : ""}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-[11px] font-mono font-bold ${
                              isToday
                                ? "text-sky-400 underline"
                                : isSelected
                                ? "text-white"
                                : "text-slate-300"
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          {cell.grade && !highlightBehavior && (
                            <span
                              className={`text-[9px] font-mono font-black px-1 rounded ${cell.grade.color}`}
                            >
                              {cell.grade.grade}
                            </span>
                          )}
                        </div>

                        {highlightBehavior && cell.highlightCount > 0 ? (
                          <div className="text-[11px] font-mono font-black text-amber-300 text-center">
                            {cell.highlightCount}x
                          </div>
                        ) : hasData ? (
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                            <span className="text-emerald-400">
                              {cell.dosCount > 0 ? `✓${cell.dosCount}` : ""}
                            </span>
                            <span className="text-rose-400">
                              {cell.dontsCount > 0 ? `✕${cell.dontsCount}` : ""}
                            </span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-700 text-center">—</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Frequency Leaderboard (Day / This Week / This Month / All Time) */}
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-amber-400" />
                      Repeat Frequency Tracker (1x, 2x, 3x...)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Click any mistake or habit to highlight the exact days it happened on the calendar
                    </p>
                  </div>

                  {/* Scope Tabs */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {(
                      [
                        { id: "DAY", label: "Day" },
                        { id: "WEEK", label: "Week" },
                        { id: "MONTH", label: "Month" },
                        { id: "ALL", label: "All" },
                      ] as { id: RollupScope; label: string }[]
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setRollupScope(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          rollupScope === s.id
                            ? "bg-sky-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="h-32 rounded-xl bg-slate-900/60 animate-pulse" />
                ) : rollup.topDonts.length === 0 && rollup.topDos.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    No Do&apos;s or Don&apos;ts logged in this timeframe yet. Click pre-selectors on the left to log your day!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top Repeated DON'Ts */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between">
                        <span>Repeated Don&apos;ts (Mistakes)</span>
                        <span className="font-mono">{rollup.totalDonts}x total</span>
                      </div>
                      {rollup.topDonts.length === 0 ? (
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-emerald-300">
                          Zero mistakes logged in this period!
                        </div>
                      ) : (
                        rollup.topDonts.map((row) => {
                          const maxCnt = rollup.topDonts[0]?.count || 1;
                          const pct = Math.max(12, Math.round((row.count / maxCnt) * 100));
                          const active = highlightBehavior === row.label;
                          return (
                            <button
                              key={row.label}
                              type="button"
                              onClick={() =>
                                setHighlightBehavior(active ? "" : row.label)
                              }
                              className={`w-full text-left p-2.5 rounded-xl border transition-all space-y-1 ${
                                active
                                  ? "bg-amber-500/15 border-amber-400/60"
                                  : "bg-rose-500/[0.06] border-rose-500/20 hover:border-rose-500/50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-white truncate">
                                  {row.label}
                                </span>
                                <span className="font-mono font-black text-rose-400 flex-shrink-0">
                                  {row.count}x
                                  {rollupScope !== "DAY" && (
                                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                                      ({row.days}d)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-rose-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Top Repeated DO's */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                        <span>Repeated Do&apos;s (Good Habits)</span>
                        <span className="font-mono">{rollup.totalDos}x total</span>
                      </div>
                      {rollup.topDos.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-500">
                          No Do&apos;s logged in this period yet.
                        </div>
                      ) : (
                        rollup.topDos.map((row) => {
                          const maxCnt = rollup.topDos[0]?.count || 1;
                          const pct = Math.max(12, Math.round((row.count / maxCnt) * 100));
                          const active = highlightBehavior === row.label;
                          return (
                            <button
                              key={row.label}
                              type="button"
                              onClick={() =>
                                setHighlightBehavior(active ? "" : row.label)
                              }
                              className={`w-full text-left p-2.5 rounded-xl border transition-all space-y-1 ${
                                active
                                  ? "bg-amber-500/15 border-amber-400/60"
                                  : "bg-emerald-500/[0.06] border-emerald-500/20 hover:border-emerald-500/50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-white truncate">
                                  {row.label}
                                </span>
                                <span className="font-mono font-black text-emerald-400 flex-shrink-0">
                                  {row.count}x
                                  {rollupScope !== "DAY" && (
                                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                                      ({row.days}d)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* TRADE-BY-TRADE ACCOUNTABILITY & ROOT-CAUSE MATRIX          */}
          {/* ========================================================= */}
          <div className="rounded-3xl border border-slate-800 bg-[#0c1322] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Ambient Lighting */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header & Scope Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/90 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Target className="w-3.5 h-3.5" />
                    Trade-Level Root Cause Analysis
                  </span>
                  <span className="text-slate-500 text-xs">•</span>
                  <span className="text-xs text-slate-400 font-mono">
                    In which trade you did what correct &amp; what wrong
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Trade-by-Trade Performance &amp; Accountability
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
                  Analyze every execution individually: tag specific DO&apos;s followed and DON&apos;Ts committed per trade. See how strictly following your rules directly influenced winning percentage and net PnL.
                </p>
              </div>

              {/* Scope & Filter Controls */}
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                {/* Scope Switcher: Selected Day / Active Week / Month */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  {(
                    [
                      { id: "SELECTED_DAY", label: `Day (${selectedDayTrades.length})` },
                      { id: "WEEK", label: "Week" },
                      { id: "MONTH", label: "Month" },
                    ] as { id: typeof tradeMatrixScope; label: string }[]
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setTradeMatrixScope(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        tradeMatrixScope === s.id
                          ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Filter Mode: All / Clean / Mistakes */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  {(
                    [
                      { id: "ALL", label: "All" },
                      { id: "CLEAN", label: "Clean" },
                      { id: "MISTAKES", label: "Mistakes" },
                    ] as { id: typeof tradeMatrixFilter; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTradeMatrixFilter(f.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        tradeMatrixFilter === f.id
                          ? "bg-slate-800 text-white border border-slate-700"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Execution Discipline & Win-Rate Correlation Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Clean Trades (0 Mistakes)
                  </span>
                  <span className="font-mono">{tradeBehaviorStats.cleanTotal} Trades</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-black font-mono text-emerald-300">
                    {tradeBehaviorStats.cleanWinRate}% Win Rate
                  </span>
                  <span className={`text-base font-black font-mono ${tradeBehaviorStats.cleanPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {tradeBehaviorStats.cleanPnl >= 0 ? "+" : ""}${tradeBehaviorStats.cleanPnl.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-300/80">
                  Trades executed with zero rule violations.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-rose-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Mistake Tainted (1+ Don&apos;ts)
                  </span>
                  <span className="font-mono">{tradeBehaviorStats.mistakeTotal} Trades</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-black font-mono text-rose-300">
                    {tradeBehaviorStats.mistakeWinRate}% Win Rate
                  </span>
                  <span className={`text-base font-black font-mono ${tradeBehaviorStats.mistakePnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {tradeBehaviorStats.mistakePnl >= 0 ? "+" : ""}${tradeBehaviorStats.mistakePnl.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-rose-300/80">
                  Trades dragged down by emotional impulses or broken rules.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/30 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sky-400">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Discipline Edge
                  </span>
                  <span className="font-mono">PnL Advantage</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-black font-mono text-white">
                    +{Math.max(0, tradeBehaviorStats.cleanWinRate - tradeBehaviorStats.mistakeWinRate)}%
                  </span>
                  <span className="text-base font-black font-mono text-sky-300">
                    {tradeBehaviorStats.cleanPnl - tradeBehaviorStats.mistakePnl >= 0 ? "+" : ""}${(tradeBehaviorStats.cleanPnl - tradeBehaviorStats.mistakePnl).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Net edge generated strictly by adhering to your plan.
                </p>
              </div>
            </div>

            {/* List of Trades with Behavior Details */}
            {tradeBehaviorStats.tradeBreakdown.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">No Trades In This Scope</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    No trades were recorded for {tradeMatrixScope === "SELECTED_DAY" ? selectedDate : tradeMatrixScope === "WEEK" ? "this active week" : monthLabel}. Select a day with trades or click below to log a new trade in your journal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTradeModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
                >
                  + Log a Trade
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tradeBehaviorStats.tradeBreakdown
                  .filter((item) => {
                    if (tradeMatrixFilter === "CLEAN") return !item.isMistakeTainted;
                    if (tradeMatrixFilter === "MISTAKES") return item.isMistakeTainted;
                    return true;
                  })
                  .map(({ trade, dos, donts, dosCount, dontsCount, grade }) => {
                    const isWon = trade.status === "WON" || trade.pnl > 0;
                    const isLost = trade.status === "LOST" || trade.pnl < 0;
                    const isQuickTagging = quickTagTradeId === trade.id;
                    const tradeDateStr = (trade.trade_date || "").slice(0, 10);

                    return (
                      <div
                        key={trade.id}
                        className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-3.5 ${
                          isQuickTagging
                            ? "bg-slate-900/90 border-sky-500/50 shadow-xl"
                            : isWon
                            ? "bg-slate-900/50 border-slate-800/90 hover:border-slate-700"
                            : isLost
                            ? "bg-slate-900/50 border-slate-800/90 hover:border-slate-700"
                            : "bg-slate-900/40 border-slate-800/80"
                        }`}
                      >
                        {/* Trade Row Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2.5 rounded-xl border flex items-center justify-center font-bold text-xs ${
                                (trade.direction || "LONG") === "LONG"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              }`}
                            >
                              {(trade.direction || "LONG") === "LONG" ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-black text-white font-mono">
                                  {trade.symbol}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black font-mono uppercase border ${
                                    (trade.direction || "LONG") === "LONG"
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  }`}
                                >
                                  {trade.direction || "LONG"}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {tradeDateStr}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                                {trade.entry_price && (
                                  <span>Entry: ${Number(trade.entry_price).toLocaleString()}</span>
                                )}
                                {trade.exit_price && (
                                  <span>Exit: ${Number(trade.exit_price).toLocaleString()}</span>
                                )}
                                {trade.timeframe && <span>TF: {trade.timeframe}</span>}
                              </div>
                            </div>
                          </div>

                          {/* PnL & Trade Grade */}
                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            {grade && (
                              <span
                                className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono border ${grade.bg} ${grade.color}`}
                                title={`Discipline Grade based on ${dosCount} Do's vs ${dontsCount} Don'ts`}
                              >
                                Grade {grade.grade}
                              </span>
                            )}

                            <div className="text-right">
                              <span
                                className={`text-lg sm:text-xl font-black font-mono block ${
                                  isWon
                                    ? "text-emerald-400"
                                    : isLost
                                    ? "text-rose-400"
                                    : "text-slate-300"
                                }`}
                              >
                                {trade.pnl >= 0 ? `+$${Number(trade.pnl).toLocaleString()}` : `-$${Math.abs(Number(trade.pnl)).toLocaleString()}`}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 uppercase">
                                {trade.status || "CLOSED"}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setQuickTagTradeId(isQuickTagging ? null : trade.id)
                              }
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isQuickTagging
                                  ? "bg-sky-600 text-white border-sky-500"
                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600"
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isQuickTagging ? "Close" : "Tag Do / Don't"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Behavior Badges on this Trade */}
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">
                            Behavior Audit:
                          </span>

                          {dos.length === 0 && donts.length === 0 && (
                            <span className="text-xs text-slate-500 italic">
                              No behaviors tagged yet — click &ldquo;Tag Do / Don&apos;t&rdquo; to analyze this trade.
                            </span>
                          )}

                          {dos.map((item) => (
                            <div
                              key={`t_do_${trade.id}_${item.label}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span className="font-semibold">{item.label}</span>
                              <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-emerald-500/30 font-mono">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItemCount("DO", item.label, -1, item.category, trade.id)
                                  }
                                  className="p-0.5 rounded hover:bg-emerald-500/30 text-emerald-300"
                                  title="Decrease count"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-black text-emerald-300">{item.count}x</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItemCount("DO", item.label, 1, item.category, trade.id)
                                  }
                                  className="p-0.5 rounded hover:bg-emerald-500/30 text-emerald-300"
                                  title="Increment count"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {donts.map((item) => (
                            <div
                              key={`t_dont_${trade.id}_${item.label}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200"
                            >
                              <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                              <span className="font-semibold">{item.label}</span>
                              <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-rose-500/30 font-mono">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItemCount("DONT", item.label, -1, item.category, trade.id)
                                  }
                                  className="p-0.5 rounded hover:bg-rose-500/30 text-rose-300"
                                  title="Decrease count"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-black text-rose-300">{item.count}x</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItemCount("DONT", item.label, 1, item.category, trade.id)
                                  }
                                  className="p-0.5 rounded hover:bg-rose-500/30 text-rose-300"
                                  title="Increment mistake count"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Quick Tagging Accordion Drawer for this trade */}
                        {isQuickTagging && (
                          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 mt-2 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                              <span className="flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-sky-400" />
                                1-Click Attach to {trade.symbol} ({trade.direction})
                              </span>
                              <button
                                type="button"
                                onClick={() => setQuickTagTradeId(null)}
                                className="text-slate-400 hover:text-white"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* DOs chips */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                What did you do right on this trade?
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {doTemplates.map((tpl) => {
                                  const cnt = getSelectedCount("DO", tpl.label, trade.id);
                                  return (
                                    <button
                                      key={`tq_do_${tpl.id}`}
                                      type="button"
                                      onClick={() =>
                                        updateItemCount("DO", tpl.label, 1, tpl.category, trade.id)
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                        cnt > 0
                                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-emerald-500/40"
                                      }`}
                                    >
                                      ✓ {tpl.label} {cnt > 0 && `(${cnt}x)`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* DONTs chips */}
                            <div className="space-y-1.5 pt-2 border-t border-slate-800">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                                What mistake did you make on this trade?
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {dontTemplates.map((tpl) => {
                                  const cnt = getSelectedCount("DONT", tpl.label, trade.id);
                                  return (
                                    <button
                                      key={`tq_dont_${tpl.id}`}
                                      type="button"
                                      onClick={() =>
                                        updateItemCount("DONT", tpl.label, 1, tpl.category, trade.id)
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                        cnt > 0
                                          ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-rose-500/40"
                                      }`}
                                    >
                                      ✕ {tpl.label} {cnt > 0 && `(${cnt}x)`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => {}}
      />
      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={() => {}}
      />
      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
