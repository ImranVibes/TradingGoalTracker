import { NextRequest, NextResponse } from "next/server";
import { getExchangeConnections, saveExchangeConnection, deleteExchangeConnection } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ConnectionSchema = z.object({
  id: z.string().optional(),
  exchange: z.enum(["binance", "bybit"]),
  name: z.string().optional(),
  label: z.string().optional(),
  api_key: z.string().min(1, "API Key is required"),
  api_secret: z.string().min(1, "API Secret is required"),
  account_type: z.string().optional(),
  category: z.string().optional(),
  is_active: z.boolean().default(true),
});

export async function GET() {
  try {
    const connections = await getExchangeConnections();
    // Return masked credentials for security and standard fields
    const masked = connections.map((c) => ({
      ...c,
      label: c.name,
      category: (c.account_type || "FUTURES").toLowerCase(),
      api_key_masked:
        c.api_key.length > 8
          ? `${c.api_key.slice(0, 4)}...${c.api_key.slice(-4)}`
          : "••••••••",
      api_key:
        c.api_key.length > 8
          ? `${c.api_key.slice(0, 4)}...${c.api_key.slice(-4)}`
          : "••••••••",
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

    const resolvedName =
      validated.name?.trim() ||
      validated.label?.trim() ||
      `${validated.exchange.toUpperCase()} Main`;

    const rawType = (validated.account_type || validated.category || "FUTURES").toUpperCase();
    const resolvedType: "SPOT" | "FUTURES" | "ALL" = rawType.includes("SPOT")
      ? "SPOT"
      : rawType.includes("ALL") || rawType.includes("UNIFIED")
      ? "ALL"
      : "FUTURES";

    const saved = await saveExchangeConnection({
      id: validated.id,
      exchange: validated.exchange,
      name: resolvedName,
      api_key: validated.api_key.trim(),
      api_secret: validated.api_secret.trim(),
      account_type: resolvedType,
      is_active: validated.is_active,
    });

    return NextResponse.json({ success: true, connection: saved }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.errors[0];
      const field = firstIssue.path.join(".") || "field";
      return NextResponse.json(
        { success: false, error: `${field}: ${firstIssue.message}` },
        { status: 400 }
      );
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
