import { NextRequest, NextResponse } from "next/server";
import { getCashflows, createCashflow } from "@/lib/db";
import { Cashflow } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CashflowSchema = z.object({
  type: z.enum(["WITHDRAWAL", "EXPENSE", "DEPOSIT"]),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  category: z.string().min(1, "Category is required").max(64),
  description: z.string().default(""),
  date: z.string().default(() => new Date().toISOString()),
  source: z.string().optional().default("Trading Account"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const items = await getCashflows({ type, startDate, endDate });
    return NextResponse.json({ success: true, count: items.length, cashflows: items });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CashflowSchema.parse(body);

    const now = new Date().toISOString();
    const id = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newCashflow: Cashflow = {
      ...validated,
      id,
      created_at: now,
      updated_at: now,
    };

    const saved = await createCashflow(newCashflow);
    return NextResponse.json({ success: true, cashflow: saved }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
