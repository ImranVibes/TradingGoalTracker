import { NextRequest, NextResponse } from "next/server";
import { getIndicators, saveIndicator, deleteIndicator } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const IndicatorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Indicator name is required").max(128),
  code: z.string().min(1, "Indicator code is required"),
  language: z.enum(["pine", "js"]).default("pine"),
  overlay: z.boolean().default(true),
  is_enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    const indicators = await getIndicators();
    return NextResponse.json({ success: true, indicators });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = IndicatorSchema.parse(body);
    const saved = await saveIndicator(validated);
    return NextResponse.json({ success: true, indicator: saved }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = IndicatorSchema.parse(body);
    const saved = await saveIndicator(validated);
    return NextResponse.json({ success: true, indicator: saved });
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
    if (!id) {
      return NextResponse.json({ success: false, error: "Indicator ID is required" }, { status: 400 });
    }
    await deleteIndicator(id);
    return NextResponse.json({ success: true, message: "Indicator deleted" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
