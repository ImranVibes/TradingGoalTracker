import { NextRequest, NextResponse } from "next/server";
import { getSettingValue, setSettingValue } from "@/lib/db";
import { DEFAULT_SIDEBAR_ORDER } from "@/lib/sidebarConfig";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SidebarConfigSchema = z.object({
  order: z.array(z.string()).default(DEFAULT_SIDEBAR_ORDER),
  hidden: z.array(z.string()).default([]),
});

export async function GET() {
  try {
    const saved = await getSettingValue<{ order: string[]; hidden: string[] }>("sidebar_order");
    if (saved && Array.isArray(saved.order)) {
      return NextResponse.json({
        success: true,
        order: saved.order,
        hidden: Array.isArray(saved.hidden) ? saved.hidden : [],
      });
    }
    return NextResponse.json({
      success: true,
      order: DEFAULT_SIDEBAR_ORDER,
      hidden: [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = SidebarConfigSchema.parse(body);

    // Safeguard: dashboard must never be hidden
    const cleanHidden = validated.hidden.filter((id) => id !== "dashboard");
    const payload = {
      order: validated.order,
      hidden: cleanHidden,
    };

    await setSettingValue("sidebar_order", payload);

    return NextResponse.json({
      success: true,
      ...payload,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
