import { NextResponse } from "next/server";
import { checkConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbStatus = await checkConnection();
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
}
