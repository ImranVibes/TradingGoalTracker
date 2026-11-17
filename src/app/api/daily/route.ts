import { NextRequest, NextResponse } from "next/server";
import { getDailySummaries } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || undefined;

    const summaries = await getDailySummaries(month);
    return NextResponse.json({ success: true, summaries });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
