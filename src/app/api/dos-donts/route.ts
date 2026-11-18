import { NextRequest, NextResponse } from "next/server";
import {
  getDosDontsTemplates,
  createDosDontsTemplate,
  deleteDosDontsTemplate,
  getDailyDosDontsLogs,
  upsertDailyDosDontsLog,
  deleteDailyDosDontsLog,
} from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BehaviorItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  kind: z.enum(["DO", "DONT"]),
  count: z.coerce.number().int().min(1).max(99).default(1),
  category: z.string().trim().max(48).optional().default("General"),
});

const SaveDaySchema = z.object({
  mode: z.literal("save_day"),
  account_id: z.string().optional().default("acc_default"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  items: z.array(BehaviorItemSchema).max(100).default([]),
  reflection: z.string().max(4000).optional().default(""),
});

const CreateTemplateSchema = z.object({
  mode: z.literal("create_template"),
  kind: z.enum(["DO", "DONT"]),
  label: z.string().trim().min(1, "Point text is required").max(200),
  category: z.string().trim().max(48).optional().default("Custom"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account_id = searchParams.get("account_id") || undefined;

    const [templates, logs] = await Promise.all([
      getDosDontsTemplates(),
      getDailyDosDontsLogs(account_id),
    ]);

    return NextResponse.json({
      success: true,
      templates,
      logs,
    });
  } catch (error: any) {
    console.error("[API dos-donts GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.mode === "create_template") {
      const validated = CreateTemplateSchema.parse(body);
      const id = `tpl_${validated.kind.toLowerCase()}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 6)}`;
      const template = await createDosDontsTemplate({
        id,
        kind: validated.kind,
        label: validated.label,
        category: validated.category,
        is_custom: true,
      });
      return NextResponse.json({ success: true, template }, { status: 201 });
    }

    const validated = SaveDaySchema.parse(body);
    const log = await upsertDailyDosDontsLog({
      account_id: validated.account_id,
      date: validated.date,
      items: validated.items,
      reflection: validated.reflection,
    });
    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error("[API dos-donts POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("template_id");
    const logId = searchParams.get("log_id");

    if (templateId) {
      const ok = await deleteDosDontsTemplate(templateId);
      if (!ok) {
        return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, deleted: templateId });
    }

    if (logId) {
      const ok = await deleteDailyDosDontsLog(logId);
      if (!ok) {
        return NextResponse.json({ success: false, error: "Daily log not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, deleted: logId });
    }

    return NextResponse.json(
      { success: false, error: "template_id or log_id is required" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
