import { NextRequest, NextResponse } from "next/server";
import { getGoals, updateGoal, deleteGoal } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const GoalUpdateSchema = z.object({
  account_id: z.string().optional(),
  tracking_mode: z.enum(["AUTO_DATE", "MANUAL_TRADES"]).optional(),
  linked_trade_ids: z.array(z.string()).optional(),
  title: z.string().max(128).optional(),
  category: z.enum(["PROFIT_TARGET", "WITHDRAWAL_GOAL", "ACCOUNT_BALANCE", "DISCIPLINE_HABIT"]).optional(),
  target_amount: z.coerce.number().positive().optional(),
  current_amount: z.coerce.number().optional(),
  start_date: z.string().optional(),
  target_date: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "ACHIEVED", "PAUSED"]).optional(),
  notes: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const validated = GoalUpdateSchema.parse(body);

    const updated = await updateGoal(params.id, validated);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, goal: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const goals = await getGoals();
    const existing = goals.find((g) => g.id === params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Goal not found" }, { status: 404 });
    }

    // Quick-toggle a specific trade's P&L into/out of this goal
    if (body.toggle_trade_id || body.add_trade_id || body.remove_trade_id) {
      const currentLinked = new Set(existing.linked_trade_ids || []);
      if (body.toggle_trade_id) {
        if (currentLinked.has(body.toggle_trade_id)) {
          currentLinked.delete(body.toggle_trade_id);
        } else {
          currentLinked.add(body.toggle_trade_id);
        }
      }
      if (body.add_trade_id) currentLinked.add(body.add_trade_id);
      if (body.remove_trade_id) currentLinked.delete(body.remove_trade_id);

      const updated = await updateGoal(params.id, {
        linked_trade_ids: Array.from(currentLinked),
      });
      return NextResponse.json({ success: true, goal: updated });
    }

    const validated = GoalUpdateSchema.parse(body);
    const updated = await updateGoal(params.id, validated);
    return NextResponse.json({ success: true, goal: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteGoal(params.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Goal deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
