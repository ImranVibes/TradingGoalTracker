import { NextRequest, NextResponse } from "next/server";
import { updateGoal, deleteGoal } from "@/lib/db";
import { z } from "zod";

const GoalUpdateSchema = z.object({
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
