import { NextRequest, NextResponse } from "next/server";
import {
  syncExchange,
  syncAllExchanges,
  clearIgnoredExchangeTrades,
  cleanupLegacyPartialFills,
  previewExchangePositions,
  importSelectedExchangePositions,
} from "@/lib/db";
import { BinanceClient, BybitClient } from "@/lib/exchanges";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, exchange, api_key, api_secret, auto, forceFull } = body;
    const connectionId = body.id || body.connection_id;

    // Test raw credentials before saving
    if (action === "test") {
      if (!exchange || !api_key || !api_secret) {
        return NextResponse.json(
          { success: false, error: "Exchange, API Key, and API Secret are required to test" },
          { status: 400 }
        );
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

    // Force-Sync Preview: fetch all consolidated positions from exchange WITHOUT importing yet
    if (action === "preview") {
      const result = await previewExchangePositions(connectionId || undefined);
      return NextResponse.json(result);
    }

    // Selective Import: import ONLY the positions checked by the user in the modal
    if (action === "import_selected") {
      const positions = Array.isArray(body.positions) ? body.positions : [];
      if (positions.length === 0) {
        return NextResponse.json(
          { success: false, error: "Please select at least one position to import." },
          { status: 400 }
        );
      }
      const res = await importSelectedExchangePositions(positions, {
        account_id: body.account_id || undefined,
        signal_provider: body.signal_provider || undefined,
      });
      return NextResponse.json({
        success: true,
        imported_trades: res.imported,
        skipped: res.skipped,
        message: `Imported ${res.imported} selected position(s)!`,
      });
    }

    // Clear ignored deleted positions list
    if (action === "clear_ignored") {
      await clearIgnoredExchangeTrades();
      return NextResponse.json({
        success: true,
        message: "Cleared ignored deleted positions list. Future syncs can import them again.",
      });
    }

    // Remove legacy raw partial-fill imports (binance_fut_*) and re-sync clean consolidated positions
    if (action === "cleanup_legacy_fills") {
      const removed = await cleanupLegacyPartialFills();
      const syncResult = await syncAllExchanges({ forceFull: true });
      return NextResponse.json({
        success: true,
        removed_legacy: removed,
        imported_trades: syncResult.totalImported,
        message: `Cleaned up ${removed} old partial-fill entries and imported ${syncResult.totalImported} consolidated closed position(s)!`,
      });
    }

    // Sync a specific saved connection by ID
    if (connectionId) {
      const result = await syncExchange(connectionId, { forceFull: Boolean(forceFull) });
      return NextResponse.json({
        ...result,
        imported_trades: result.importedTrades,
      });
    }

    // Sync all active exchange connections (supports background auto mode with 60s cooldown)
    const syncResult = await syncAllExchanges({
      auto: Boolean(auto),
      forceFull: Boolean(forceFull),
    });

    return NextResponse.json({
      success: true,
      results: syncResult.results,
      skipped_cooldown: Boolean(syncResult.skippedCooldown),
      imported_trades: syncResult.totalImported,
      totalImported: syncResult.totalImported,
      message: syncResult.skippedCooldown
        ? "Synced recently (up to date)."
        : syncResult.totalImported > 0
        ? `Imported ${syncResult.totalImported} new closed position(s).`
        : "Already up to date. No new closed positions found.",
    });
  } catch (error: any) {
    console.error("[API exchanges/sync POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
