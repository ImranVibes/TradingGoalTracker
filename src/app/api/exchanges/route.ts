import { NextRequest, NextResponse } from "next/server";
import { getExchangeConnections, saveExchangeConnection, deleteExchangeConnection } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ConnectionSchema = z.object({
  id: z.string().optional(),
  exchange: z.enum(["binance", "bybit"]),
  name: z.string().min(1, "Connection name is required").max(64),
  api_key: z.string().min(1, "API Key is required"),
  api_secret: z.string().min(1, "API Secret is required"),
  account_type: z.enum(["SPOT", "FUTURES", "ALL"]).default("FUTURES"),
  is_active: z.boolean().default(true),
});

export async function GET() {
  try {
    const connections = await getExchangeConnections();
    // Mask API secrets for security
    const masked = connections.map((c) => ({
      ...c,
      api_key: c.api_key.length > 8 ? `${c.api_key.slice(0, 4)}...${c.api_key.slice(-4)}` : "••••••••",
      api_secret: "••••••••••••••••",
    }));

    return NextResponse.json({ success: true, connections: masked });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = ConnectionSchema.parse(body);

    const saved = await saveExchangeConnection(validated);
    return NextResponse.json({ success: true, connection: saved }, { status: 201 });
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
      return NextResponse.json({ success: false, error: "Connection ID is required" }, { status: 400 });
    }

    await deleteExchangeConnection(id);
    return NextResponse.json({ success: true, message: "Connection removed successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
