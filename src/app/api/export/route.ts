import { NextRequest, NextResponse } from "next/server";
import { getTrades, getCashflows, getGoals, getUserSettings, getAccounts } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const account_id = searchParams.get("account_id") || undefined;

    const [trades, cashflows, goals, settings, accounts] = await Promise.all([
      getTrades(account_id && account_id !== "ALL" ? { account_id } : undefined),
      getCashflows(),
      getGoals(),
      getUserSettings(),
      getAccounts(),
    ]);

    const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

    if (format === "json") {
      const backupData = {
        exported_at: new Date().toISOString(),
        settings,
        accounts,
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

    const headers = [
      "ID",
      "Account",
      "Date",
      "Exchange",
      "Symbol",
      "Market",
      "Direction",
      "Status",
      "Gross_PnL_USD",
      "Trading_Fee_USD",
      "Funding_Fee_USD",
      "Net_PnL_USD",
      "Entry_Price",
      "Exit_Price",
      "Quantity_Lot",
      "Strategy",
      "Signal_Provider",
      "Reason_Entry",
      "Reason_Outcome",
      "Exchange_Position_ID",
    ];

    const rows = trades.map((t) => [
      t.id,
      `"${(accountMap.get(t.account_id || "acc_default") || "Main Account").replace(/"/g, '""')}"`,
      t.trade_date ? t.trade_date.split("T")[0] : "",
      t.exchange || "MANUAL",
      t.symbol,
      t.market || "CRYPTO",
      t.direction || "LONG",
      t.status,
      t.gross_pnl ?? t.pnl,
      t.trading_fee ?? 0,
      t.funding_fee ?? 0,
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
        "Content-Disposition": `attachment; filename="positions_export_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
