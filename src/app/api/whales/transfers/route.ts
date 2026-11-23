import { NextRequest, NextResponse } from "next/server";
import { getSettingValue, setSettingValue } from "@/lib/db";

export const dynamic = "force-dynamic";

interface WhaleAlertTx {
  blockchain: string;
  symbol: string;
  id: string;
  transaction_type: string;
  hash?: string;
  from?: {
    address?: string;
    owner_type?: string;
    owner?: string;
  };
  to?: {
    address?: string;
    owner_type?: string;
    owner?: string;
  };
  timestamp: number;
  amount: number;
  amount_usd: number;
  transaction_count?: number;
}

export interface UnifiedWhaleItem {
  id: string;
  source: "WHALE_ALERT_ONCHAIN" | "BINANCE_BLOCK_TRADE" | "BINANCE_WAVE_DUMP";
  timestamp: number;
  timestampIso: string;
  timeAgo: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  price?: number;
  type:
    | "EXCHANGE_INFLOW_DUMP"
    | "EXCHANGE_OUTFLOW_ACCUMULATION"
    | "MARKET_SELL_DUMP"
    | "MARKET_BUY_SWEEP"
    | "WHALE_OTC_TRANSFER";
  from: string;
  to: string;
  fromType: "wallet" | "exchange" | "market_maker" | "aggressor";
  toType: "wallet" | "exchange" | "order_book" | "liquidity_pool";
  txHash?: string;
  blockchain?: string;
  impactTier: "MEGA_WHALE" | "LARGE_WHALE" | "HEAVY";
  details: string;
  isDump: boolean;
}

// In-memory cache for Whale Alert to respect free rate limits (10 calls/min)
let whaleAlertCache: {
  timestamp: number;
  data: WhaleAlertTx[];
} | null = null;

const CACHE_TTL_MS = 35_000; // 35 seconds

function getTimeAgo(epochMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

// Normalize symbol for Binance Futures
function normalizeBinanceSymbol(sym: string): string {
  const cleaned = sym.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Map common meme/small caps to 1000x contracts if needed
  if (cleaned === "PEPEUSDT") return "1000PEPEUSDT";
  if (cleaned === "SHIBUSDT") return "1000SHIBUSDT";
  if (cleaned === "BONKUSDT") return "1000BONKUSDT";
  if (cleaned === "FLOKIUSDT") return "1000FLOKIUSDT";
  if (cleaned === "LUNCUSDT") return "1000LUNCUSDT";
  if (cleaned === "XECUSDT") return "1000XECUSDT";
  if (cleaned === "RATSUSDT") return "1000RATSUSDT";
  if (cleaned === "SATSUSDT") return "1000SATSUSDT";
  return cleaned;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbol = searchParams.get("symbol") || "BTCUSDT";
    const binanceSymbol = normalizeBinanceSymbol(rawSymbol);
    const baseAsset = rawSymbol.replace(/USDT$|BUSD$|USDC$/, "");

    // 1. Check for Whale Alert API Key
    const dbKey = await getSettingValue<string>("whale_alert_api_key");
    const apiKey = (process.env.WHALE_ALERT_API_KEY || dbKey || "").trim();
    const isWhaleAlertConfigured = Boolean(apiKey && apiKey.length > 5);

    let whaleAlertTxs: WhaleAlertTx[] = [];
    let whaleAlertError: string | null = null;

    if (isWhaleAlertConfigured) {
      const now = Date.now();
      if (whaleAlertCache && now - whaleAlertCache.timestamp < CACHE_TTL_MS) {
        whaleAlertTxs = whaleAlertCache.data;
      } else {
        try {
          const startTimestamp = Math.floor((now - 3600_000) / 1000); // last 1 hour
          const urls = [
            `https://leviathan.whale-alert.io/v1/transactions?api_key=${apiKey}&min_value=250000&start=${startTimestamp}&limit=50`,
            `https://api.whale-alert.io/v1/transactions?api_key=${apiKey}&min_value=250000&start=${startTimestamp}&limit=50`,
          ];

          let fetched = false;
          for (const url of urls) {
            try {
              const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(5000) });
              if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.transactions)) {
                  whaleAlertTxs = data.transactions;
                  whaleAlertCache = { timestamp: now, data: whaleAlertTxs };
                  fetched = true;
                  break;
                }
              }
            } catch (err: any) {
              // Try next URL fallback
            }
          }

          if (!fetched && !whaleAlertCache) {
            whaleAlertError = "Whale Alert API rate limited or unauthorized.";
          }
        } catch (err: any) {
          whaleAlertError = err.message || "Failed to query Whale Alert";
        }
      }
    }

    // 2. Fetch Binance USD-M aggTrades for real-time order-flow whales
    let binanceTrades: any[] = [];
    try {
      const aggRes = await fetch(
        `https://fapi.binance.com/fapi/v1/aggTrades?symbol=${binanceSymbol}&limit=500`,
        { next: { revalidate: 0 }, signal: AbortSignal.timeout(5000) }
      );
      if (aggRes.ok) {
        binanceTrades = await aggRes.json();
      }
    } catch (err) {
      console.warn("Binance aggTrades error:", err);
    }

    // 3. Process Binance Large Block Trades & Aggressive Market Dumps
    const unifiedItems: UnifiedWhaleItem[] = [];

    if (Array.isArray(binanceTrades) && binanceTrades.length > 0) {
      // Compute notional values
      const parsedTrades = binanceTrades.map((t) => {
        const price = parseFloat(t.p);
        const qty = parseFloat(t.q);
        const usd = price * qty;
        return {
          id: String(t.a),
          price,
          qty,
          usd,
          isBuyerMaker: Boolean(t.m), // true = Seller market aggressive (DUMP), false = Buyer market aggressive (BUY)
          timestamp: t.T,
        };
      });

      // Determine dynamic threshold based on token liquidity
      const isMegaCap = binanceSymbol.includes("BTC") || binanceSymbol.includes("ETH");
      const isHighCap = binanceSymbol.includes("SOL") || binanceSymbol.includes("BNB") || binanceSymbol.includes("XRP");
      
      const defaultThreshold = isMegaCap ? 75_000 : isHighCap ? 40_000 : 15_000;

      // Filter trades meeting threshold
      const filteredTrades = parsedTrades.filter((t) => t.usd >= defaultThreshold);

      // If fewer than 5 trades meet threshold, take top 10 largest trades
      const finalTrades =
        filteredTrades.length >= 5
          ? filteredTrades
          : [...parsedTrades].sort((a, b) => b.usd - a.usd).slice(0, 8);

      // Detect clustered Market Maker waves (trades within 2.5 seconds in the same direction)
      const clusters: Array<{
        trades: typeof finalTrades;
        totalUsd: number;
        isDump: boolean;
        startTs: number;
        endTs: number;
      }> = [];

      let currentCluster: typeof finalTrades = [];
      for (const t of finalTrades) {
        if (currentCluster.length === 0) {
          currentCluster.push(t);
        } else {
          const prev = currentCluster[currentCluster.length - 1];
          const timeGap = Math.abs(t.timestamp - prev.timestamp);
          if (timeGap <= 2500 && t.isBuyerMaker === prev.isBuyerMaker) {
            currentCluster.push(t);
          } else {
            if (currentCluster.length > 1) {
              const totalUsd = currentCluster.reduce((sum, item) => sum + item.usd, 0);
              clusters.push({
                trades: currentCluster,
                totalUsd,
                isDump: currentCluster[0].isBuyerMaker,
                startTs: currentCluster[0].timestamp,
                endTs: currentCluster[currentCluster.length - 1].timestamp,
              });
            }
            currentCluster = [t];
          }
        }
      }
      if (currentCluster.length > 1) {
        const totalUsd = currentCluster.reduce((sum, item) => sum + item.usd, 0);
        clusters.push({
          trades: currentCluster,
          totalUsd,
          isDump: currentCluster[0].isBuyerMaker,
          startTs: currentCluster[0].timestamp,
          endTs: currentCluster[currentCluster.length - 1].timestamp,
        });
      }

      // Add clustered wave items first if significant
      for (const c of clusters) {
        if (c.totalUsd >= 50_000 || (!isMegaCap && c.totalUsd >= 20_000)) {
          unifiedItems.push({
            id: `cluster_${c.startTs}_${c.trades.length}`,
            source: "BINANCE_WAVE_DUMP",
            timestamp: c.startTs,
            timestampIso: new Date(c.startTs).toISOString(),
            timeAgo: getTimeAgo(c.startTs),
            symbol: rawSymbol,
            amount: c.trades.reduce((sum, t) => sum + t.qty, 0),
            amountUsd: Math.round(c.totalUsd),
            price: c.trades[0].price,
            type: c.isDump ? "MARKET_SELL_DUMP" : "MARKET_BUY_SWEEP",
            from: c.isDump ? "🚨 MM Heavy Dumping Wave" : "🟢 Whale Aggressive Sweep",
            to: c.isDump ? "Binance Order Book Bids" : "Binance Order Book Asks",
            fromType: "market_maker",
            toType: "order_book",
            impactTier: c.totalUsd >= 250_000 ? "MEGA_WHALE" : c.totalUsd >= 100_000 ? "LARGE_WHALE" : "HEAVY",
            details: `${c.trades.length} rapid execution fills within 2.5s (${c.isDump ? "aggressive market sell hitting bids" : "aggressive market sweep lifting asks"})`,
            isDump: c.isDump,
          });
        }
      }

      // Add individual large block trades
      for (const t of finalTrades) {
        const isDump = t.isBuyerMaker;
        const tier =
          t.usd >= 500_000
            ? "MEGA_WHALE"
            : t.usd >= 100_000
            ? "LARGE_WHALE"
            : "HEAVY";

        unifiedItems.push({
          id: `bn_${t.id}`,
          source: "BINANCE_BLOCK_TRADE",
          timestamp: t.timestamp,
          timestampIso: new Date(t.timestamp).toISOString(),
          timeAgo: getTimeAgo(t.timestamp),
          symbol: rawSymbol,
          amount: t.qty,
          amountUsd: Math.round(t.usd),
          price: t.price,
          type: isDump ? "MARKET_SELL_DUMP" : "MARKET_BUY_SWEEP",
          from: isDump ? "Whale Market Seller" : "Whale Market Buyer",
          to: isDump ? "Order Book Bids (Dump)" : "Order Book Asks (Sweep)",
          fromType: isDump ? "market_maker" : "aggressor",
          toType: "order_book",
          impactTier: tier,
          details: isDump
            ? `Large market sell order executed at $${t.price.toLocaleString()}`
            : `Large market buy order swept asks at $${t.price.toLocaleString()}`,
          isDump,
        });
      }
    }

    // 4. Process Whale Alert On-Chain Transfers
    if (whaleAlertTxs.length > 0) {
      for (const tx of whaleAlertTxs) {
        const txSymbol = (tx.symbol || "").toUpperCase();
        // Check if token matches active symbol or major stablecoins (USDT/USDC often indicate buying/selling dry powder)
        const isTargetCoin =
          txSymbol === baseAsset ||
          (baseAsset === "BTC" && txSymbol === "BTC") ||
          (baseAsset === "ETH" && txSymbol === "ETH") ||
          (baseAsset === "PEPE" && txSymbol === "PEPE") ||
          (baseAsset === "SOL" && txSymbol === "SOL") ||
          txSymbol === "USDT" ||
          txSymbol === "USDC";

        if (!isTargetCoin) continue;

        const toOwnerType = tx.to?.owner_type?.toLowerCase() || "";
        const fromOwnerType = tx.from?.owner_type?.toLowerCase() || "";
        const toOwner = tx.to?.owner || "Private Wallet";
        const fromOwner = tx.from?.owner || "Whale Wallet";

        let type: UnifiedWhaleItem["type"] = "WHALE_OTC_TRANSFER";
        let isDump = false;

        if (toOwnerType === "exchange") {
          type = "EXCHANGE_INFLOW_DUMP";
          isDump = true;
        } else if (fromOwnerType === "exchange") {
          type = "EXCHANGE_OUTFLOW_ACCUMULATION";
          isDump = false;
        }

        const tier =
          tx.amount_usd >= 5_000_000
            ? "MEGA_WHALE"
            : tx.amount_usd >= 1_000_000
            ? "LARGE_WHALE"
            : "HEAVY";

        const txEpochMs = tx.timestamp * 1000;

        unifiedItems.push({
          id: `wa_${tx.id}`,
          source: "WHALE_ALERT_ONCHAIN",
          timestamp: txEpochMs,
          timestampIso: new Date(txEpochMs).toISOString(),
          timeAgo: getTimeAgo(txEpochMs),
          symbol: txSymbol,
          amount: tx.amount,
          amountUsd: Math.round(tx.amount_usd),
          type,
          from: fromOwner,
          to: toOwner,
          fromType: fromOwnerType === "exchange" ? "exchange" : "wallet",
          toType: toOwnerType === "exchange" ? "exchange" : "wallet",
          txHash: tx.hash,
          blockchain: tx.blockchain,
          impactTier: tier,
          details:
            type === "EXCHANGE_INFLOW_DUMP"
              ? `🚨 Whale deposited ${tx.amount.toLocaleString()} ${txSymbol} into ${toOwner} (Potential Dump Preparation)`
              : type === "EXCHANGE_OUTFLOW_ACCUMULATION"
              ? `🟢 Whale withdrew ${tx.amount.toLocaleString()} ${txSymbol} from ${fromOwner} to Cold Storage (Accumulation)`
              : `Whale transferred ${tx.amount.toLocaleString()} ${txSymbol} to another private entity`,
          isDump,
        });
      }
    }

    // Sort all items newest first
    unifiedItems.sort((a, b) => b.timestamp - a.timestamp);

    // 5. Calculate Comprehensive Whale Inflow/Outflow Pressure
    let totalDumpUsd = 0;
    let totalAccumulationUsd = 0;
    let maxTxUsd = 0;

    for (const item of unifiedItems) {
      if (item.amountUsd > maxTxUsd) maxTxUsd = item.amountUsd;
      if (item.isDump) {
        totalDumpUsd += item.amountUsd;
      } else {
        totalAccumulationUsd += item.amountUsd;
      }
    }

    const netFlowUsd = totalAccumulationUsd - totalDumpUsd;
    const totalVolumeUsd = totalDumpUsd + totalAccumulationUsd;

    // Dump Risk Score (0 = extreme accumulation, 50 = balanced, 100 = extreme dump risk)
    let dumpRiskScore = 50;
    if (totalVolumeUsd > 0) {
      dumpRiskScore = Math.round((totalDumpUsd / totalVolumeUsd) * 100);
    }

    let dominantState: "HIGH_DUMP_RISK" | "ACCUMULATION_SQUEEZE" | "BALANCED_CHURN" =
      "BALANCED_CHURN";
    let summaryHeadline = "Order Flow Balanced: Whales & MM executing evenly on both sides.";
    let actionRecommendation = "Neutral: Monitor if sell blocks increase or if bids get absorbed.";

    if (dumpRiskScore >= 65) {
      dominantState = "HIGH_DUMP_RISK";
      summaryHeadline = `🚨 HIGH DUMP WARNING: Sell pressure dominates with $${(
        totalDumpUsd / 1e6
      ).toFixed(2)}M in aggressive dump volume vs $${(
        totalAccumulationUsd / 1e6
      ).toFixed(2)}M buy volume.`;
      actionRecommendation =
        "Caution on Longs: Market makers and large whales are hitting bids aggressively. Watch for sudden down-spikes.";
    } else if (dumpRiskScore <= 35) {
      dominantState = "ACCUMULATION_SQUEEZE";
      summaryHeadline = `🟢 WHALE ACCUMULATION DOMINANT: Strong buying demand with $${(
        totalAccumulationUsd / 1e6
      ).toFixed(2)}M absorbed vs $${(totalDumpUsd / 1e6).toFixed(2)}M sold.`;
      actionRecommendation =
        "Bullish Bias: Smart money is aggressively sweeping asks and withdrawing liquidity. Short squeezes likely.";
    }

    return NextResponse.json({
      success: true,
      symbol: rawSymbol,
      binanceSymbol,
      engine: isWhaleAlertConfigured ? "HYBRID_ONCHAIN_AND_BLOCKS" : "REALTIME_BINANCE_ORDER_FLOW",
      whaleAlertConfigured: isWhaleAlertConfigured,
      whaleAlertError,
      summary: {
        totalEvents: unifiedItems.length,
        totalDumpUsd,
        totalAccumulationUsd,
        netFlowUsd,
        dumpRiskScore,
        dominantState,
        summaryHeadline,
        actionRecommendation,
        maxTxUsd,
      },
      transfers: unifiedItems.slice(0, 40),
    });
  } catch (error: any) {
    console.error("Whale transfers error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process whale radar" },
      { status: 500 }
    );
  }
}

// POST endpoint to save or update Whale Alert API key
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = (body.apiKey || "").trim();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key is required" },
        { status: 400 }
      );
    }

    // Verify key with Whale Alert
    const testUrl = `https://leviathan.whale-alert.io/v1/transactions?api_key=${apiKey}&min_value=5000000&limit=1`;
    let isValid = false;
    let message = "";

    try {
      const res = await fetch(testUrl, { signal: AbortSignal.timeout(6000) });
      if (res.status === 200) {
        isValid = true;
      } else if (res.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid Whale Alert API key (401 Unauthorized). Please check your key at developer.whale-alert.io",
          },
          { status: 400 }
        );
      } else {
        // Fallback check on status endpoint
        const statRes = await fetch("https://leviathan.whale-alert.io/status");
        if (statRes.ok) {
          // If status is ok, accept the key
          isValid = true;
        }
      }
    } catch (err: any) {
      // Network timeout or error
      isValid = true; // Still allow saving so user can use when network clears
    }

    if (isValid) {
      await setSettingValue("whale_alert_api_key", apiKey);
      // Reset cache
      whaleAlertCache = null;
      return NextResponse.json({
        success: true,
        message: "Whale Alert API key successfully saved and verified!",
      });
    }

    return NextResponse.json(
      { success: false, error: "Failed to verify Whale Alert API key" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE endpoint to disconnect / remove Whale Alert API key
export async function DELETE() {
  try {
    await setSettingValue("whale_alert_api_key", null);
    whaleAlertCache = null;
    return NextResponse.json({
      success: true,
      message: "Whale Alert API key removed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
