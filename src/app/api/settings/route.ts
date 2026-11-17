import { NextRequest, NextResponse } from "next/server";
import { getUserSettings, updateUserSettings } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SettingsSchema = z.object({
  initial_balance: z.coerce.number().min(0, "Balance must be positive").default(10000),
  currency: z.string().default("USD"),
  risk_percentage: z.coerce.number().min(0.1).max(100).default(1.0),
  default_leverage: z.coerce.number().min(1).max(2000).default(100),
  max_drawdown_limit: z.coerce.number().min(1).max(100).default(10),
});

export async function GET() {
  try {
    const settings = await getUserSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = SettingsSchema.parse(body);
    const updated = await updateUserSettings(validated);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
