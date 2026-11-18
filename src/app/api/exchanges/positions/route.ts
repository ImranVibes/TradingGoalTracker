import { NextRequest, NextResponse } from "next/server";
import { getExchangeConnections, getTrades } from "@/lib/db";
import { BinanceClient, LiveOpenPosition } from "@/lib/exchanges";
import { getAgentOsConfig } from "@/lib/agentConfig";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id") || undefined;

    const [connections, agentConfig, trades] = await Promise.all([
      getExchangeConnections(),
      getAgentOsConfig(),
      getTrades(accountId && accountId !== "ALL" ? { account_id: accountId } : undefined),
    ]);

    // Filter active Binance connections matching account scope
    const binanceConns = connections.filter((c) => {
      if (!c.is_active || c.exchange !== "binance") return false;
      if (accountId && accountId !== "ALL") {
        return (c.account_id || "acc_default") === accountId;
      }
      return true;
    });

    const allPositions: LiveOpenPosition[] = [];
    let totalUnrealizedPnl = 0;
    let totalNotionalUsd = 0;
    let totalAccountEquity = 0;
    let totalAvailableBalance = 0;
    const errors: string[] = [];

    // Also inspect isolated Agentic Sub-Account if configured & viewing ALL or default
    const seenKeys = new Set<string>();
    const clientsToQuery: {
      id: string;
      label: string;
      accountId: string;
      apiKey: string;
      apiSecret: string;
    }[] = [];

    for (const c of binanceConns) {
      if (c.api_key && c.api_secret && !seenKeys.has(c.api_key)) {
        seenKeys.add(c.api_key);
        clientsToQuery.push({
          id: c.id,
          label: c.label || c.name || "Binance Futures",
          accountId: c.account_id || "acc_default",
          apiKey: c.api_key,
          apiSecret: c.api_secret,
        });
      }
    }

    if (
      agentConfig.agenticApiKey &&
      agentConfig.agenticApiSecret &&
      !seenKeys.has(agentConfig.agenticApiKey)
    ) {
      seenKeys.add(agentConfig.agenticApiKey);
      clientsToQuery.push({
        id: "binance_agentic_sub",
        label: "Binance Agentic Sub-Account",
        accountId: "acc_default",
        apiKey: agentConfig.agenticApiKey,
        apiSecret: agentConfig.agenticApiSecret,
      });
    }

    await Promise.all(
      clientsToQuery.map(async (item) => {
        try {
          const client = new BinanceClient(item.apiKey, item.apiSecret);
          const snap = await client.getFuturesOpenPositions();
          totalAccountEquity += snap.accountEquity;
          totalAvailableBalance += snap.availableBalance;
          totalUnrealizedPnl += snap.totalUnrealizedPnl;

          for (const p of snap.positions) {
            totalNotionalUsd += p.notionalUsd;
            allPositions.push({
              ...p,
              connectionId: item.id,
              connectionLabel: item.label,
              accountId: item.accountId,
            });
          }
        } catch (err: any) {
          errors.push(`${item.label}: ${err.message}`);
        }
      })
    );

    // Compute Today's Realized P&L + Live Unrealized P&L vs Daily Loss Limit
    const todayPrefix = new Date().toISOString().split("T")[0];
    const todayRealizedPnl = trades
      .filter((t) => (t.trade_date || "").startsWith(todayPrefix))
      .reduce((sum, t) => sum + Number(t.pnl || 0), 0);

    const totalDailyPnl = Number((todayRealizedPnl + totalUnrealizedPnl).toFixed(2));
    const dailyLossLimitUsd = Number(agentConfig.dailyLossLimitUsd || 100);
    const currentDailyLoss = totalDailyPnl < 0 ? Math.abs(totalDailyPnl) : 0;
    const dailyLossPctUsed =
      dailyLossLimitUsd > 0
        ? Math.min(100, Number(((currentDailyLoss / dailyLossLimitUsd) * 100).toFixed(1)))
        : 0;
    const dailyLossBreached = dailyLossLimitUsd > 0 && currentDailyLoss >= dailyLossLimitUsd;

    return NextResponse.json({
      success: true,
      connectedSources: clientsToQuery.length,
      positions: allPositions,
      totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),
      totalNotionalUsd: Number(totalNotionalUsd.toFixed(2)),
      totalAccountEquity: Number(totalAccountEquity.toFixed(2)),
      totalAvailableBalance: Number(totalAvailableBalance.toFixed(2)),
      todayRealizedPnl: Number(todayRealizedPnl.toFixed(2)),
      totalDailyPnl,
      dailyLossLimitUsd,
      dailyLossPctUsed,
      dailyLossBreached,
      errors,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API exchanges/positions GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
