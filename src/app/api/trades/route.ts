import { NextRequest, NextResponse } from "next/server";
import { getTrades, createTrade, deleteTradesBulk, updateTradesBulk } from "@/lib/db";
import { Trade } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TradeSchema = z.object({
  account_id: z.string().optional().default("acc_default"),
  symbol: z.string().min(1, "Symbol/Currency is required").max(32),
  market: z.enum(["FOREX", "CRYPTO", "COMMODITY", "INDEX", "STOCKS"]).default("FOREX"),
  direction: z.enum(["LONG", "SHORT"]).default("LONG"),
  entry_price: z.coerce.number().optional().nullable(),
  exit_price: z.coerce.number().optional().nullable(),
  stop_loss: z.coerce.number().optional().nullable(),
  take_profit: z.coerce.number().optional().nullable(),
  quantity: z.coerce.number().optional().default(1),
  pnl: z.coerce.number().default(0),
  gross_pnl: z.coerce.number().optional().nullable(),
  trading_fee: z.coerce.number().optional().default(0),
  funding_fee: z.coerce.number().optional().default(0),
  pnl_percentage: z.coerce.number().optional().nullable(),
  status: z.enum(["WON", "LOST", "BREAKEVEN", "OPEN"]).default("OPEN"),
  trade_date: z.string().default(() => new Date().toISOString()),
  closed_date: z.string().optional().nullable(),
  timeframe: z.string().optional().default("1h"),
  session: z.string().optional().default(""),
  strategy: z.string().optional().default(""),
  signal_provider: z.string().optional().default("Self"),
  exchange: z.string().optional().default("MANUAL"),
  exchange_trade_id: z.string().optional().nullable(),
  reason_entry: z.string().optional().default(""),
  reason_outcome: z.string().optional().default(""),
  lessons_learned: z.string().optional().default(""),
  emotions_notes: z.string().optional().default(""),
  chart_url: z.string().optional().default(""),
  chart_image: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  mistake_tags: z.array(z.string()).optional().default([]),
  discipline_score: z.coerce.number().min(0).max(100).optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") || undefined;
    const status = searchParams.get("status") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const signal_provider = searchParams.get("signal_provider") || undefined;
    const exchange = searchParams.get("exchange") || undefined;
    const account_id = searchParams.get("account_id") || undefined;

    const trades = await getTrades({
      symbol,
      status,
      startDate,
      endDate,
      signal_provider,
      exchange,
      account_id,
    });
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

    if (validated.entry_price && validated.exit_price && (!pnl || pnl === 0)) {
      const diff =
        validated.direction === "LONG"
          ? validated.exit_price - validated.entry_price
          : validated.entry_price - validated.exit_price;

      pnl = Number((diff * (validated.quantity || 1)).toFixed(2));
      if (pnl > 0) status = "WON";
      else if (pnl < 0) status = "LOST";
      else status = "BREAKEVEN";
    }

    const tradingFee = Math.abs(Number(validated.trading_fee || 0));
    const fundingFee = Number(validated.funding_fee || 0);
    const grossPnl =
      validated.gross_pnl !== undefined && validated.gross_pnl !== null
        ? Number(validated.gross_pnl)
        : Number((pnl + tradingFee - fundingFee).toFixed(4));

    const newTrade: Trade = {
      ...validated,
      id: tradeId,
      account_id: validated.account_id || "acc_default",
      pnl,
      gross_pnl: grossPnl,
      trading_fee: tradingFee,
      funding_fee: fundingFee,
      status,
      exchange_trade_id: validated.exchange_trade_id || undefined,
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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "No trade IDs provided" }, { status: 400 });
    }
    const updates: { signal_provider?: string; account_id?: string } = {};
    if (body.signal_provider !== undefined) updates.signal_provider = String(body.signal_provider);
    if (body.account_id !== undefined) updates.account_id = String(body.account_id);

    const updated = await updateTradesBulk(ids, updates);
    return NextResponse.json({
      success: true,
      updated,
      message: `Updated ${updated} position(s).`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "No trade IDs provided" }, { status: 400 });
    }
    const deleted = await deleteTradesBulk(ids);
    return NextResponse.json({
      success: true,
      deleted,
      message: `Deleted ${deleted} position(s). They will not be re-imported on future syncs.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
