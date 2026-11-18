import { NextRequest, NextResponse } from "next/server";
import {
  getChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  resetDefaultChecklistItems,
  getChecklistLogs,
  createChecklistLog,
  deleteChecklistLog,
} from "@/lib/db";
import { ChecklistItem, ChecklistLog } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateItemSchema = z.object({
  mode: z.literal("item").optional(),
  title: z.string().trim().min(1, "Rule title is required").max(240),
  category: z.string().trim().max(64).optional().default("General"),
  description: z.string().trim().max(500).optional().default(""),
  is_critical: z.boolean().optional().default(false),
  sort_order: z.coerce.number().optional().default(100),
});

const CreateLogSchema = z.object({
  mode: z.literal("log"),
  account_id: z.string().optional().default("acc_default"),
  symbol: z.string().trim().max(32).optional().default(""),
  direction: z.enum(["LONG", "SHORT"]).optional().default("LONG"),
  checked_ids: z.array(z.string()).default([]),
  total_items: z.coerce.number().min(0).default(0),
  critical_passed: z.boolean().default(true),
  score: z.coerce.number().min(0).max(100).default(0),
  sentiment_verdict: z.string().max(64).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});

const UpdateItemSchema = z.object({
  id: z.string().min(1, "Item ID is required"),
  title: z.string().trim().min(1).max(240).optional(),
  category: z.string().trim().max(64).optional(),
  description: z.string().trim().max(500).optional(),
  is_critical: z.boolean().optional(),
  sort_order: z.coerce.number().optional(),
  enabled: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account_id = searchParams.get("account_id") || undefined;

    const [items, logs] = await Promise.all([
      getChecklistItems(),
      getChecklistLogs(account_id, 60),
    ]);

    const averageScore =
      logs.length > 0
        ? Number((logs.reduce((s, l) => s + Number(l.score || 0), 0) / logs.length).toFixed(1))
        : 0;
    const passCount = logs.filter((l) => l.score >= 80 && l.critical_passed).length;
    const passRate = logs.length > 0 ? Number(((passCount / logs.length) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      items,
      logs,
      stats: {
        totalChecks: logs.length,
        averageScore,
        passRate,
      },
    });
  } catch (error: any) {
    console.error("[API checklist GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.mode === "reset_defaults") {
      const items = await resetDefaultChecklistItems();
      return NextResponse.json({ success: true, items });
    }

    if (body?.mode === "log") {
      const validated = CreateLogSchema.parse(body);
      const id = `chklog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const log: ChecklistLog = {
        id,
        account_id: validated.account_id || "acc_default",
        symbol: validated.symbol.toUpperCase(),
        direction: validated.direction,
        checked_ids: validated.checked_ids,
        total_items: validated.total_items,
        critical_passed: validated.critical_passed,
        score: validated.score,
        sentiment_verdict: validated.sentiment_verdict,
        notes: validated.notes,
        created_at: new Date().toISOString(),
      };
      const saved = await createChecklistLog(log);
      return NextResponse.json({ success: true, log: saved }, { status: 201 });
    }

    const validated = CreateItemSchema.parse(body);
    const id = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const item: ChecklistItem = {
      id,
      title: validated.title,
      category: validated.category,
      description: validated.description,
      is_critical: validated.is_critical,
      sort_order: validated.sort_order,
      enabled: true,
      created_at: new Date().toISOString(),
    };
    const saved = await createChecklistItem(item);
    return NextResponse.json({ success: true, item: saved }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error("[API checklist POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = UpdateItemSchema.parse(body);
    const { id, ...updates } = validated;

    const updated = await updateChecklistItem(id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Checklist item not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const logId = searchParams.get("log_id");

    if (logId) {
      const ok = await deleteChecklistLog(logId);
      if (!ok) return NextResponse.json({ success: false, error: "Log not found" }, { status: 404 });
      return NextResponse.json({ success: true, deleted: logId });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "id or log_id is required" }, { status: 400 });
    }
    const ok = await deleteChecklistItem(id);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Checklist item not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, deleted: id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
