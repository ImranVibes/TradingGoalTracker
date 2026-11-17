import { NextRequest, NextResponse } from "next/server";
import { getTrades, getCashflows, getGoals, getUserSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";

    const [trades, cashflows, goals, settings] = await Promise.all([
      getTrades(),
      getCashflows(),
      getGoals(),
      getUserSettings(),
    ]);

    if (format === "json") {
      const backupData = {
        exported_at: new Date().toISOString(),
        settings,
        trades,
        cashflows,
        goals,
      };

      return new NextResponse(JSON.stringify(backupData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="trading_journal_backup_${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // Generate CSV
    const headers = [
      "ID",
      "Date",
      "Exchange",
      "Symbol",
      "Market",
      "Direction",
      "Status",
      "Profit_Loss_USD",
      "Entry_Price",
      "Exit_Price",
      "Quantity_Lot",
      "Strategy",
      "Signal_Provider",
      "Reason_Entry",
      "Reason_Outcome",
      "Exchange_Trade_ID",
    ];

    const rows = trades.map((t) => [
      t.id,
      t.trade_date ? t.trade_date.split("T")[0] : "",
      t.exchange || "MANUAL",
      t.symbol,
      t.market || "FOREX",
      t.direction || "LONG",
      t.status,
      t.pnl,
      t.entry_price ?? "",
      t.exit_price ?? "",
      t.quantity ?? 1,
      `"${(t.strategy || "").replace(/"/g, '""')}"`,
      `"${(t.signal_provider || "Self").replace(/"/g, '""')}"`,
      `"${(t.reason_entry || "").replace(/"/g, '""')}"`,
      `"${(t.reason_outcome || "").replace(/"/g, '""')}"`,
      t.exchange_trade_id || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="trades_export_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
