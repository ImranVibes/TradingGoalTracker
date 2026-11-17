import { NextRequest, NextResponse } from "next/server";
import { syncExchange, syncAllExchanges } from "@/lib/db";
import { BinanceClient, BybitClient } from "@/lib/exchanges";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, exchange, api_key, api_secret } = body;

    // Test a raw key before saving
    if (action === "test") {
      if (!exchange || !api_key || !api_secret) {
        return NextResponse.json({ success: false, error: "Exchange, API Key, and API Secret are required" }, { status: 400 });
      }

      if (exchange === "binance") {
        const client = new BinanceClient(api_key, api_secret);
        const result = await client.testConnection();
        return NextResponse.json(result);
      } else if (exchange === "bybit") {
        const client = new BybitClient(api_key, api_secret);
        const result = await client.testConnection();
        return NextResponse.json(result);
      } else {
        return NextResponse.json({ success: false, error: "Unsupported exchange for auto-sync" }, { status: 400 });
      }
    }

    // Sync a specific saved connection by ID
    if (id) {
      const result = await syncExchange(id);
      return NextResponse.json(result);
    }

    // Sync all active exchange connections
    const syncResult = await syncAllExchanges();
    return NextResponse.json({
      success: true,
      results: syncResult.results,
      totalImported: syncResult.totalImported,
      message: `Completed sync across all active exchange connections. Imported ${syncResult.totalImported} new trade(s).`,
    });
  } catch (error: any) {
    console.error("[API exchanges/sync POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
