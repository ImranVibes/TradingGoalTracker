import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account_id = searchParams.get("account_id") || undefined;
    const stats = await getDashboardStats(account_id);
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
