import { NextRequest, NextResponse } from "next/server";
import { getTradeById, updateTrade, deleteTrade } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TradeUpdateSchema = z.object({
  account_id: z.string().optional(),
  symbol: z.string().max(32).optional(),
  market: z.enum(["FOREX", "CRYPTO", "COMMODITY", "INDEX", "STOCKS"]).optional(),
  direction: z.enum(["LONG", "SHORT"]).optional(),
  entry_price: z.coerce.number().optional().nullable(),
  exit_price: z.coerce.number().optional().nullable(),
  stop_loss: z.coerce.number().optional().nullable(),
  take_profit: z.coerce.number().optional().nullable(),
  quantity: z.coerce.number().optional(),
  pnl: z.coerce.number().optional(),
  gross_pnl: z.coerce.number().optional().nullable(),
  trading_fee: z.coerce.number().optional().nullable(),
  funding_fee: z.coerce.number().optional().nullable(),
  pnl_percentage: z.coerce.number().optional().nullable(),
  status: z.enum(["WON", "LOST", "BREAKEVEN", "OPEN"]).optional(),
  trade_date: z.string().optional(),
  closed_date: z.string().optional().nullable(),
  timeframe: z.string().optional(),
  session: z.string().optional(),
  strategy: z.string().optional(),
  signal_provider: z.string().optional(),
  exchange: z.string().optional(),
  chart_image: z.string().optional(),
  reason_entry: z.string().optional(),
  reason_outcome: z.string().optional(),
  lessons_learned: z.string().optional(),
  emotions_notes: z.string().optional(),
  chart_url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mistake_tags: z.array(z.string()).optional(),
  discipline_score: z.coerce.number().min(0).max(100).optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const trade = await getTradeById(params.id);
    if (!trade) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, trade });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function handleUpdate(req: NextRequest, id: string) {
  try {
    const body = await req.json();
    const validated = TradeUpdateSchema.parse(body);

    const updated = await updateTrade(id, validated);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, trade: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handleUpdate(req, params.id);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handleUpdate(req, params.id);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteTrade(params.id, true);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      message: "Position deleted and permanently excluded from future exchange syncs.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
