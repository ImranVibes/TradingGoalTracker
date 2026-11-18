import { NextRequest, NextResponse } from "next/server";
import {
  getTrades,
  getDailyDosDontsLogs,
  getChecklistLogs,
  createNote,
} from "@/lib/db";
import {
  computeLongShortStats,
  computeSessionStats,
  computeDayOfWeekStats,
  computeMistakeStats,
} from "@/lib/tradingMetrics";
import { callConfiguredLlm } from "@/lib/agentConfig";
import { TradingNote } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const WeeklyReviewSchema = z.object({
  account_id: z.string().optional().default("acc_default"),
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
  saveToNotes: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { account_id, days, saveToNotes } = WeeklyReviewSchema.parse(body);
    const filterAcc = account_id && account_id !== "ALL" ? account_id : undefined;

    const [allTrades, allDdLogs, allChkLogs] = await Promise.all([
      getTrades(filterAcc ? { account_id: filterAcc } : undefined),
      getDailyDosDontsLogs(filterAcc),
      getChecklistLogs(filterAcc, 60),
    ]);

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 86400_000);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    let scopeLabel = `Last ${days} Days (${cutoffStr} → ${now.toISOString().split("T")[0]})`;
    let scopedTrades = allTrades.filter((t) => (t.trade_date || "").slice(0, 10) >= cutoffStr);

    // If user had 0 trades in the last 7 days, automatically fall back to last 30 days so the review is still genuinely useful
    if (scopedTrades.length === 0 && allTrades.length > 0 && days <= 7) {
      const cutoff30 = new Date(now.getTime() - 30 * 86400_000).toISOString().split("T")[0];
      const last30 = allTrades.filter((t) => (t.trade_date || "").slice(0, 10) >= cutoff30);
      if (last30.length > 0) {
        scopedTrades = last30;
        scopeLabel = `Last 30 Days (0 trades in last 7d • ${cutoff30} → ${now.toISOString().split("T")[0]})`;
      } else {
        scopedTrades = allTrades;
        scopeLabel = `All Recorded Positions (${allTrades.length} trades)`;
      }
    }

    const scopedDd = allDdLogs.filter((l) => l.date >= cutoffStr);
    const scopedChk = allChkLogs.filter((l) => (l.created_at || "").slice(0, 10) >= cutoffStr);

    // Compute real quantitative review stats
    const netPnl = Number(scopedTrades.reduce((s, t) => s + Number(t.pnl || 0), 0).toFixed(2));
    const totalFees = Number(
      scopedTrades
        .reduce((s, t) => s + Math.abs(Number(t.trading_fee || 0)) - Number(t.funding_fee || 0), 0)
        .toFixed(2)
    );
    const wins = scopedTrades.filter((t) => t.status === "WON" || t.pnl > 0).length;
    const losses = scopedTrades.filter((t) => t.status === "LOST" || t.pnl < 0).length;
    const winRate = wins + losses > 0 ? Number(((wins / (wins + losses)) * 100).toFixed(1)) : 0;

    const longShort = computeLongShortStats(scopedTrades);
    const sessions = computeSessionStats(scopedTrades).filter((s) => s.trades > 0);
    const bestSession = [...sessions].sort((a, b) => b.netPnl - a.netPnl)[0] || null;
    const worstSession =
      [...sessions].filter((s) => s.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl)[0] || null;

    const weekdays = computeDayOfWeekStats(scopedTrades).filter((d) => d.trades > 0);
    const bestDay = [...weekdays].sort((a, b) => b.netPnl - a.netPnl)[0] || null;
    const worstDay =
      [...weekdays].filter((d) => d.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl)[0] || null;

    // Pair PnL rollup
    const pairMap: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const t of scopedTrades) {
      const sym = t.symbol.toUpperCase();
      if (!pairMap[sym]) pairMap[sym] = { pnl: 0, count: 0, wins: 0 };
      pairMap[sym].pnl += Number(t.pnl || 0);
      pairMap[sym].count++;
      if (t.pnl > 0) pairMap[sym].wins++;
    }
    const pairsSorted = Object.entries(pairMap)
      .map(([symbol, d]) => ({
        symbol,
        pnl: Number(d.pnl.toFixed(2)),
        count: d.count,
        wr: Math.round((d.wins / d.count) * 100),
      }))
      .sort((a, b) => b.pnl - a.pnl);
    const bestPair = pairsSorted[0] || null;
    const worstPair = pairsSorted.length > 0 && pairsSorted[pairsSorted.length - 1].pnl < 0
      ? pairsSorted[pairsSorted.length - 1]
      : null;

    // Mistakes & Do's/Don'ts
    const mistakeRows = computeMistakeStats(scopedTrades);
    const tradeMistakes = mistakeRows.filter((m) => m.kind === "mistake");
    const tradeHabits = mistakeRows.filter((m) => m.kind === "habit");

    const dontFreq: Record<string, number> = {};
    const doFreq: Record<string, number> = {};
    let cleanDays = 0;
    const reflections: string[] = [];
    for (const log of scopedDd) {
      const hasDont = log.items.some((i) => i.kind === "DONT" && i.count > 0);
      if (!hasDont && log.items.length > 0) cleanDays++;
      for (const item of log.items) {
        if (item.kind === "DONT") dontFreq[item.label] = (dontFreq[item.label] || 0) + item.count;
        else doFreq[item.label] = (doFreq[item.label] || 0) + item.count;
      }
      if (log.reflection?.trim()) reflections.push(`[${log.date}] ${log.reflection.trim()}`);
    }
    const topDonts = Object.entries(dontFreq).sort((a, b) => b[1] - a[1]);
    const topDos = Object.entries(doFreq).sort((a, b) => b[1] - a[1]);

    const avgChk =
      scopedChk.length > 0
        ? Math.round(scopedChk.reduce((s, l) => s + Number(l.score || 0), 0) / scopedChk.length)
        : null;

    // Build deterministic fallback review (clean, specific, actionable)
    const fallbackLines: string[] = [
      `WEEKLY PERFORMANCE & PSYCHOLOGY REVIEW`,
      `Period: ${scopeLabel}`,
      ``,
      `1. PERFORMANCE SNAPSHOT`,
      `• Closed Positions: ${scopedTrades.length} (${wins}W / ${losses}L — ${winRate}% Win Rate)`,
      `• Realized Net P&L: ${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(2)} (Total Fees & Funding Impact: $${totalFees.toFixed(2)})`,
      `• Long vs Short: Longs ${longShort.long.trades} tr (${longShort.long.winRate}% WR, ${longShort.long.netPnl >= 0 ? "+" : ""}$${longShort.long.netPnl}) | Shorts ${longShort.short.trades} tr (${longShort.short.winRate}% WR, ${longShort.short.netPnl >= 0 ? "+" : ""}$${longShort.short.netPnl})`,
      bestPair ? `• Strongest Coin: ${bestPair.symbol} (+$${bestPair.pnl} across ${bestPair.count} trades, ${bestPair.wr}% WR)` : `• Strongest Coin: N/A`,
      worstPair ? `• Biggest Drag Coin: ${worstPair.symbol} ($${worstPair.pnl} across ${worstPair.count} trades, ${worstPair.wr}% WR)` : `• No losing coin drags in this window.`,
      ``,
      `2. SESSION & TIMING EDGE`,
      bestSession ? `• Best Session: ${bestSession.label} (${bestSession.utcWindow}) → ${bestSession.netPnl >= 0 ? "+" : ""}$${bestSession.netPnl} (${bestSession.winRate}% WR)` : `• Best Session: Log more trades to establish session edge.`,
      worstSession ? `• Weakest Session: ${worstSession.label} (${worstSession.utcWindow}) → $${worstSession.netPnl} (${worstSession.winRate}% WR) — Cut size or stop trading during this window.` : `• Weakest Session: None (all active sessions profitable).`,
      bestDay ? `• Best Day: ${bestDay.day} ($${bestDay.netPnl})${worstDay ? ` | Worst Day: ${worstDay.day} ($${worstDay.netPnl})` : ""}` : "",
      ``,
      `3. PSYCHOLOGY, MISTAKES & DO'S / DON'TS`,
      `• Daily Accountability Days Logged: ${scopedDd.length} (${cleanDays} Clean Days with 0 Don'ts)`,
      `• Pre-Trade Checklist Discipline Avg: ${avgChk !== null ? `${avgChk}% (${scopedChk.length} checks)` : "No checks logged yet"}`,
      topDonts.length > 0
        ? `• Top Repeated Daily Don'ts: ${topDonts.slice(0, 4).map(([k, v]) => `${k} (${v}x)`).join(", ")}`
        : `• Daily Don'ts: None logged in this window.`,
      topDos.length > 0
        ? `• Top Repeated Daily Do's: ${topDos.slice(0, 4).map(([k, v]) => `${k} (${v}x)`).join(", ")}`
        : `• Daily Do's: None logged yet.`,
      tradeMistakes.length > 0
        ? `• Costliest Tagged Trade Mistakes: ${tradeMistakes.slice(0, 4).map((m) => `${m.tag} (${m.count}x, $${m.netPnl})`).join(", ")}`
        : `• Tagged Trade Mistakes: Tag your closed trades in Journal to track exact dollar cost.`,
      tradeHabits.length > 0
        ? `• Winning Trade Habits: ${tradeHabits.slice(0, 3).map((h) => `${h.tag} (${h.count}x, +$${h.netPnl})`).join(", ")}`
        : "",
      ``,
      `4. CONCRETE ACTION PLAN FOR NEXT WEEK`,
      `☐ Focus 80% of risk on your strongest direction (${longShort.long.netPnl >= longShort.short.netPnl ? "LONGS" : "SHORTS"})${bestSession ? ` during ${bestSession.label}` : ""}${bestPair ? ` and top setups like ${bestPair.symbol}` : ""}.`,
      worstPair
        ? `☐ Put ${worstPair.symbol} on a cooldown or cut risk by 50% until your setup proves profitable again.`
        : `☐ Keep position sizing consistent across your whitelisted pairs.`,
      topDonts.length > 0
        ? `☐ Primary Rule to Break: Eliminate "${topDonts[0][0]}" (repeated ${topDonts[0][1]}x).`
        : tradeMistakes.length > 0
        ? `☐ Primary Leak to Fix: Eliminate "${tradeMistakes[0].tag}" (cost $${Math.abs(tradeMistakes[0].netPnl).toFixed(2)}).`
        : `☐ Complete the Pre-Trade Checklist before every single entry and keep Discipline ≥ 80%.`,
      `☐ Never trade against your Market Sentiment Detector direction and stop immediately if Daily Loss Limit hits.`,
    ].filter((l) => l !== undefined);

    const fallbackContent = fallbackLines.join("\n");

    // Upgrade via external LLM if user configured Gemini / OpenAI / Anthropic / OpenRouter
    const llmPrompt = `Generate a sharp, concise, practical Weekly Trading Review & Next-Week Improvement Plan based STRICTLY on these real performance & psychology metrics. Keep it under 450 words, use plain clean headings and checkboxes (☐), no fluff:\n\n${fallbackContent}\n${
      reflections.length > 0 ? `\nDaily Reflections:\n${reflections.slice(0, 5).join("\n")}` : ""
    }`;

    const llmRes = await callConfiguredLlm(
      "You are an institutional trading performance coach writing a crisp weekly review note saved straight into the trader's journal.",
      llmPrompt
    );

    const finalContent = llmRes ? llmRes.text : fallbackContent;
    const engineUsed = llmRes ? llmRes.providerLabel : "Built-in Quant Review Engine";
    const noteTitle = `Weekly AI Review — ${now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} (${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(2)})`;

    let savedNote: TradingNote | null = null;
    if (saveToNotes) {
      const nowIso = now.toISOString();
      savedNote = await createNote({
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        account_id: account_id && account_id !== "ALL" ? account_id : "acc_default",
        title: noteTitle,
        content: finalContent,
        category: "DAILY_REVIEW",
        symbol: bestPair?.symbol || "",
        tags: ["weekly-review", "ai-coach"],
        is_pinned: true,
        note_date: nowIso,
        image_url: "",
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    return NextResponse.json({
      success: true,
      engine: engineUsed,
      title: noteTitle,
      content: finalContent,
      note: savedNote,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error("[API agent/weekly-review POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
