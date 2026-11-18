import { NextRequest, NextResponse } from "next/server";
import { getAgentOsConfig } from "@/lib/agentConfig";
import { getTrades } from "@/lib/db";
import { BinanceClient } from "@/lib/exchanges";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ExecuteOrderSchema = z.object({
  mode: z.enum(["preview", "execute"]).default("preview"),
  account_id: z.string().optional().default("acc_default"),
  symbol: z.string().trim().min(3).max(20),
  direction: z.enum(["LONG", "SHORT"]),
  orderType: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
  riskUsd: z.coerce.number().positive("Risk amount must be greater than $0"),
  entryPrice: z.coerce.number().positive("Entry price must be greater than 0"),
  stopLoss: z.coerce.number().positive("Stop loss price is mandatory"),
  takeProfit: z.coerce.number().positive().optional().nullable(),
  leverage: z.coerce.number().int().min(1).max(50).default(5),
  checklistScore: z.coerce.number().min(0).max(100).default(0),
  criticalPassed: z.boolean().default(false),
  sentimentAllowedDirection: z
    .enum(["LONG_ONLY", "SHORT_ONLY", "WAIT_NO_TRADE", "UNCHECKED"])
    .optional()
    .default("UNCHECKED"),
  confirmText: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const v = ExecuteOrderSchema.parse(body);
    const symbol = v.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

    const [cfg, trades] = await Promise.all([
      getAgentOsConfig(),
      getTrades(v.account_id && v.account_id !== "ALL" ? { account_id: v.account_id } : undefined),
    ]);

    // Validate Stop-Loss direction logic
    if (v.direction === "LONG" && v.stopLoss >= v.entryPrice) {
      return NextResponse.json(
        { success: false, error: "For a LONG trade, Stop-Loss must be BELOW entry price." },
        { status: 400 }
      );
    }
    if (v.direction === "SHORT" && v.stopLoss <= v.entryPrice) {
      return NextResponse.json(
        { success: false, error: "For a SHORT trade, Stop-Loss must be ABOVE entry price." },
        { status: 400 }
      );
    }
    if (v.takeProfit) {
      if (v.direction === "LONG" && v.takeProfit <= v.entryPrice) {
        return NextResponse.json(
          { success: false, error: "For a LONG trade, Take-Profit must be ABOVE entry price." },
          { status: 400 }
        );
      }
      if (v.direction === "SHORT" && v.takeProfit >= v.entryPrice) {
        return NextResponse.json(
          { success: false, error: "For a SHORT trade, Take-Profit must be BELOW entry price." },
          { status: 400 }
        );
      }
    }

    // Position sizing math from Risk Calculator logic
    const slDistance = Math.abs(v.entryPrice - v.stopLoss);
    const slPct = Number(((slDistance / v.entryPrice) * 100).toFixed(2));
    const quantity = Number((v.riskUsd / slDistance).toFixed(6));
    const notionalUsd = Number((quantity * v.entryPrice).toFixed(2));
    const effectiveLeverage = Math.min(v.leverage, cfg.maxLeverage);
    const requiredMarginUsd = Number((notionalUsd / effectiveLeverage).toFixed(2));

    let rrRatio: number | null = null;
    let potentialProfitUsd: number | null = null;
    if (v.takeProfit) {
      const tpDistance = Math.abs(v.takeProfit - v.entryPrice);
      rrRatio = Number((tpDistance / slDistance).toFixed(2));
      potentialProfitUsd = Number((v.riskUsd * rrRatio).toFixed(2));
    }

    // Check Daily Loss Limit Guard
    const todayPrefix = new Date().toISOString().split("T")[0];
    const todayRealizedPnl = trades
      .filter((t) => (t.trade_date || "").startsWith(todayPrefix))
      .reduce((s, t) => s + Number(t.pnl || 0), 0);
    const dailyLossBreached =
      cfg.dailyLossLimitUsd > 0 && todayRealizedPnl <= -Math.abs(cfg.dailyLossLimitUsd);

    // Safety Gates Audit
    const gates: { name: string; passed: boolean; detail: string }[] = [
      {
        name: "Pre-Trade Checklist Score",
        passed: v.checklistScore >= cfg.requireChecklistScore && v.criticalPassed,
        detail:
          v.checklistScore >= cfg.requireChecklistScore && v.criticalPassed
            ? `Passed (${v.checklistScore}% ≥ ${cfg.requireChecklistScore}% & all required rules verified)`
            : `Blocked: Score is ${v.checklistScore}% (need ≥ ${cfg.requireChecklistScore}% and all REQUIRED rules checked)`,
      },
      {
        name: "Sentiment Direction Alignment",
        passed:
          v.sentimentAllowedDirection === "UNCHECKED" ||
          (v.sentimentAllowedDirection === "LONG_ONLY" && v.direction === "LONG") ||
          (v.sentimentAllowedDirection === "SHORT_ONLY" && v.direction === "SHORT"),
        detail:
          v.sentimentAllowedDirection === "UNCHECKED"
            ? "No opposing sentiment lock provided"
            : v.sentimentAllowedDirection === "WAIT_NO_TRADE"
            ? "Blocked: Market Sentiment Detector says NEUTRAL / WAIT (No directional edge)"
            : (v.sentimentAllowedDirection === "LONG_ONLY" && v.direction === "LONG") ||
              (v.sentimentAllowedDirection === "SHORT_ONLY" && v.direction === "SHORT")
            ? `Aligned with Sentiment (${v.sentimentAllowedDirection})`
            : `Blocked: Counter-sentiment! Sentiment allows ${v.sentimentAllowedDirection} only.`,
      },
      {
        name: "Daily Loss Limit Guard",
        passed: !dailyLossBreached,
        detail: dailyLossBreached
          ? `Blocked: Today's realized P&L ($${todayRealizedPnl.toFixed(2)}) hit your -$${cfg.dailyLossLimitUsd} daily stop.`
          : `OK (Today realized: ${todayRealizedPnl >= 0 ? "+" : ""}$${todayRealizedPnl.toFixed(2)} / Limit -$${cfg.dailyLossLimitUsd})`,
      },
      {
        name: "Max Notional & Leverage Cap",
        passed: notionalUsd <= cfg.maxOrderNotionalUsd && v.leverage <= cfg.maxLeverage,
        detail:
          notionalUsd <= cfg.maxOrderNotionalUsd && v.leverage <= cfg.maxLeverage
            ? `Within caps ($${notionalUsd} ≤ $${cfg.maxOrderNotionalUsd} max, ${v.leverage}x ≤ ${cfg.maxLeverage}x)`
            : `Exceeds guardrail: Notional $${notionalUsd} (max $${cfg.maxOrderNotionalUsd}) or Leverage ${v.leverage}x (max ${cfg.maxLeverage}x). Adjust in Settings or lower Risk $.`,
      },
      {
        name: "Isolated Agentic Sub-Account",
        passed: Boolean(cfg.executionEnabled && cfg.agenticApiKey && cfg.agenticApiSecret),
        detail:
          cfg.executionEnabled && cfg.agenticApiKey && cfg.agenticApiSecret
            ? "Connected & Execution Enabled (Zero withdrawal scope)"
            : "Connect your isolated Binance Agentic Sub-Account & toggle Execution ON in Settings → Agent OS to submit live orders.",
      },
    ];

    const allGatesPassed = gates.every((g) => g.passed);

    const preview = {
      symbol,
      direction: v.direction,
      orderType: v.orderType,
      entryPrice: v.entryPrice,
      stopLoss: v.stopLoss,
      takeProfit: v.takeProfit || null,
      slPct,
      riskUsd: v.riskUsd,
      quantity,
      notionalUsd,
      leverage: effectiveLeverage,
      requiredMarginUsd,
      rrRatio,
      potentialProfitUsd,
      gates,
      allGatesPassed,
    };

    if (v.mode === "preview") {
      return NextResponse.json({ success: true, preview });
    }

    // LIVE EXECUTION MODE — Enforce EVERY safety gate strictly
    if (!allGatesPassed) {
      const firstFail = gates.find((g) => !g.passed);
      return NextResponse.json(
        {
          success: false,
          error: firstFail?.detail || "One or more safety gates blocked execution.",
          preview,
        },
        { status: 403 }
      );
    }

    if (v.confirmText.trim().toUpperCase() !== "CONFIRM") {
      return NextResponse.json(
        {
          success: false,
          error: 'Human-in-the-loop safeguard: Type "CONFIRM" exactly to execute this live order.',
          preview,
        },
        { status: 400 }
      );
    }

    const client = new BinanceClient(cfg.agenticApiKey, cfg.agenticApiSecret);
    const result = await client.placeProtectedFuturesOrder({
      symbol,
      direction: v.direction,
      quantity,
      leverage: effectiveLeverage,
      stopLoss: v.stopLoss,
      takeProfit: v.takeProfit || null,
      orderType: v.orderType,
      limitPrice: v.orderType === "LIMIT" ? v.entryPrice : null,
    });

    return NextResponse.json({
      success: true,
      executed: true,
      preview,
      order: result,
      message: `Live ${v.direction} ${symbol} order placed (${result.roundedQty} qty) with hard Stop-Loss at ${result.roundedSl}${
        result.roundedTp ? ` & TP at ${result.roundedTp}` : ""
      }.`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error("[API agent/execute POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
