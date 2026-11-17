import { NextRequest, NextResponse } from "next/server";
import { getTrades, createTrade } from "@/lib/db";
import { Trade } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TradeSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(32),
  market: z.enum(["FOREX", "CRYPTO", "COMMODITY", "INDEX", "STOCKS"]).default("FOREX"),
  direction: z.enum(["LONG", "SHORT"]),
  entry_price: z.coerce.number().positive("Entry price must be positive"),
  exit_price: z.coerce.number().optional().nullable(),
  stop_loss: z.coerce.number().optional().nullable(),
  take_profit: z.coerce.number().optional().nullable(),
  quantity: z.coerce.number().default(1),
  pnl: z.coerce.number().default(0),
  pnl_percentage: z.coerce.number().optional().nullable(),
  status: z.enum(["WON", "LOST", "BREAKEVEN", "OPEN"]).default("OPEN"),
  trade_date: z.string().default(() => new Date().toISOString()),
  closed_date: z.string().optional().nullable(),
  timeframe: z.string().optional().default("1h"),
  session: z.string().optional().default("New York"),
  strategy: z.string().optional().default("SMC Fortress"),
  reason_entry: z.string().min(1, "Reason for taking trade is required"),
  reason_outcome: z.string().default(""),
  lessons_learned: z.string().optional().default(""),
  emotions_notes: z.string().optional().default(""),
  chart_url: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") || undefined;
    const status = searchParams.get("status") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const trades = await getTrades({ symbol, status, startDate, endDate });
    return NextResponse.json({ success: true, count: trades.length, trades });
  } catch (error: any) {
    console.error("[API trades GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = TradeSchema.parse(body);

    const now = new Date().toISOString();
    const tradeId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let pnl = validated.pnl;
    let status = validated.status;

    if (validated.exit_price && (!pnl || pnl === 0)) {
      const diff =
        validated.direction === "LONG"
          ? validated.exit_price - validated.entry_price
          : validated.entry_price - validated.exit_price;

      pnl = Number((diff * validated.quantity).toFixed(2));
      if (pnl > 0) status = "WON";
      else if (pnl < 0) status = "LOST";
      else status = "BREAKEVEN";
    }

    const newTrade: Trade = {
      ...validated,
      id: tradeId,
      pnl,
      status,
      created_at: now,
      updated_at: now,
    };

    const saved = await createTrade(newTrade);
    return NextResponse.json({ success: true, trade: saved }, { status: 201 });
  } catch (error: any) {
    console.error("[API trades POST] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
