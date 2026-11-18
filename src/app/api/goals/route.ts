import { NextRequest, NextResponse } from "next/server";
import { getGoals, createGoal, syncGoals } from "@/lib/db";
import { Goal } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const GoalSchema = z.object({
  account_id: z.string().optional().default("acc_default"),
  tracking_mode: z.enum(["AUTO_DATE", "MANUAL_TRADES"]).optional().default("AUTO_DATE"),
  linked_trade_ids: z.array(z.string()).optional().default([]),
  title: z.string().min(1, "Goal title is required").max(128),
  category: z
    .enum(["PROFIT_TARGET", "WITHDRAWAL_GOAL", "ACCOUNT_BALANCE", "DISCIPLINE_HABIT"])
    .default("PROFIT_TARGET"),
  target_amount: z.coerce.number().positive("Target amount must be greater than zero"),
  current_amount: z.coerce.number().default(0),
  start_date: z.string().default(() => new Date().toISOString()),
  target_date: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "ACHIEVED", "PAUSED"]).default("ACTIVE"),
  notes: z.string().optional().default(""),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account_id = searchParams.get("account_id") || undefined;
    await syncGoals();
    const goals = await getGoals(account_id);
    return NextResponse.json({ success: true, count: goals.length, goals });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = GoalSchema.parse(body);

    const now = new Date().toISOString();
    const id = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newGoal: Goal = {
      ...validated,
      id,
      created_at: now,
      updated_at: now,
    };

    const saved = await createGoal(newGoal);
    return NextResponse.json({ success: true, goal: saved }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
