import { NextRequest, NextResponse } from "next/server";
import { evaluateMarketSentiment, SentimentInput } from "@/lib/tradingMetrics";

export const dynamic = "force-dynamic";

function extractBaseAsset(rawSym: string): string {
  const quotes = ["USDT", "USDC", "FDUSD", "BUSD", "USD", "BTC", "ETH", "BNB"];
  for (const q of quotes) {
    if (rawSym.endsWith(q) && rawSym.length > q.length) {
      const base = rawSym.slice(0, rawSym.length - q.length);
      return base.replace(/^(1000000|100000|10000|1000|1M)/, "") || base;
    }
  }
  return rawSym;
}

async function fetchJson(url: string, timeoutMs = 6000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradingGoalTracker/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function calcEMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

// Cache trending tickers & token registries briefly to keep sentiment scans blazing fast
let trendingCache: { fetchedAt: number; movers: any[] } | null = null;
let alphaRegistryCache: { fetchedAt: number; bySymbol: Record<string, any> } | null = null;
let spotSymbolsCache: { fetchedAt: number; set: Set<string> } | null = null;

async function getTrendingFuturesMovers() {
  if (trendingCache && Date.now() - trendingCache.fetchedAt < 90_000) {
    return trendingCache.movers;
  }
  const all = await fetchJson("https://fapi.binance.com/fapi/v1/ticker/24hr", 6000);
  if (!Array.isArray(all)) return trendingCache?.movers || [];

  const movers = all
    .filter((t: any) => {
      const sym = String(t.symbol || "");
      const vol = Number(t.quoteVolume || 0);
      return (
        (sym.endsWith("USDT") || sym.endsWith("USDC")) &&
        !sym.startsWith("USDC") &&
        !sym.startsWith("FDUSD") &&
        vol >= 40_000_000
      );
    })
    .map((t: any) => {
      const vol = Number(t.quoteVolume || 0);
      const pct = Number(t.priceChangePercent || 0);
      // Score combines volume strength + strong directional momentum
      const heatScore = Math.log10(Math.max(1, vol)) * Math.abs(pct);
      return {
        symbol: String(t.symbol).toUpperCase(),
        lastPrice: Number(t.lastPrice || 0),
        priceChangePct: Number(pct.toFixed(2)),
        quoteVolumeUsd: Number(vol.toFixed(0)),
        heatScore,
      };
    })
    .sort((a: any, b: any) => b.heatScore - a.heatScore)
    .slice(0, 8);

  trendingCache = { fetchedAt: Date.now(), movers };
  return movers;
}

async function getTokenRegistryContext(baseSymbol: string) {
  const now = Date.now();
  const tasks: Promise<void>[] = [];

  if (!alphaRegistryCache || now - alphaRegistryCache.fetchedAt > 6 * 3600_000) {
    tasks.push(
      fetchJson(
        "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list",
        5000
      ).then((res) => {
        if (res && Array.isArray(res.data)) {
          const map: Record<string, any> = {};
          for (const item of res.data) {
            const sym = String(item.symbol || "").toUpperCase();
            if (sym && !map[sym]) map[sym] = item;
          }
          alphaRegistryCache = { fetchedAt: Date.now(), bySymbol: map };
        }
      })
    );
  }

  if (!spotSymbolsCache || now - spotSymbolsCache.fetchedAt > 6 * 3600_000) {
    tasks.push(
      fetchJson("https://www.binance.com/bapi/asset/v2/public/asset/asset/get-all-asset", 5000).then(
        (res) => {
          if (res && Array.isArray(res.data)) {
            const set = new Set<string>();
            for (const a of res.data) {
              if (a?.assetCode) set.add(String(a.assetCode).toUpperCase());
            }
            spotSymbolsCache = { fetchedAt: Date.now(), set };
          }
        }
      )
    );
  }

  if (tasks.length > 0) await Promise.all(tasks);

  const lookup = baseSymbol.toUpperCase();
  const isMainSpotListed = Boolean(spotSymbolsCache?.set.has(lookup));
  const alphaEntry = alphaRegistryCache?.bySymbol[lookup] || null;
  return { isMainSpotListed, alphaEntry };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSym = (searchParams.get("symbol") || "BTCUSDT")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!rawSym || rawSym.length < 3 || rawSym.length > 20) {
      return NextResponse.json({ success: false, error: "Invalid trading symbol" }, { status: 400 });
    }

    const baseAsset = extractBaseAsset(rawSym);
    const base = "https://fapi.binance.com";

    const [
      ticker,
      premium,
      oiHist,
      whalePos,
      whaleAcc,
      globalLs,
      takerLs,
      klines4h,
      fng,
      depth,
      trendingMovers,
      tokenReg,
    ] = await Promise.all([
      fetchJson(`${base}/fapi/v1/ticker/24hr?symbol=${rawSym}`),
      fetchJson(`${base}/fapi/v1/premiumIndex?symbol=${rawSym}`),
      fetchJson(`${base}/futures/data/openInterestHist?symbol=${rawSym}&period=1h&limit=24`),
      fetchJson(`${base}/futures/data/topLongShortPositionRatio?symbol=${rawSym}&period=1h&limit=3`),
      fetchJson(`${base}/futures/data/topLongShortAccountRatio?symbol=${rawSym}&period=1h&limit=3`),
      fetchJson(`${base}/futures/data/globalLongShortAccountRatio?symbol=${rawSym}&period=1h&limit=3`),
      fetchJson(`${base}/futures/data/takerlongshortRatio?symbol=${rawSym}&period=1h&limit=3`),
      fetchJson(`${base}/fapi/v1/klines?symbol=${rawSym}&interval=4h&limit=210`),
      fetchJson("https://api.alternative.me/fng/?limit=1"),
      fetchJson(`${base}/fapi/v1/depth?symbol=${rawSym}&limit=50`),
      getTrendingFuturesMovers(),
      getTokenRegistryContext(baseAsset),
    ]);

    if (!ticker || ticker.code) {
      return NextResponse.json(
        {
          success: false,
          error: `Symbol "${rawSym}" was not found on Binance USD-M Futures. You can still enter values manually below.`,
          trendingMovers,
        },
        { status: 404 }
      );
    }

    const lastPrice = Number(ticker.lastPrice || 0);
    const priceChange24hPct = Number(ticker.priceChangePercent || 0);
    const high24h = Number(ticker.highPrice || 0);
    const low24h = Number(ticker.lowPrice || 0);
    const quoteVolume24h = Number(ticker.quoteVolume || 0);

    const markPrice = Number(premium?.markPrice || lastPrice);
    const fundingRatePct = Number(premium?.lastFundingRate || 0) * 100;
    const nextFundingTime = premium?.nextFundingTime
      ? new Date(Number(premium.nextFundingTime)).toISOString()
      : null;

    // Open Interest & 4H / 24H % change
    let openInterestUsd = 0;
    let oiChange4hPct = 0;
    let oiChange24hPct = 0;
    if (Array.isArray(oiHist) && oiHist.length > 0) {
      const latest = Number(oiHist[oiHist.length - 1]?.sumOpenInterestValue || 0);
      openInterestUsd = latest;
      const prev4h = Number(oiHist[Math.max(0, oiHist.length - 5)]?.sumOpenInterestValue || latest);
      const prev24h = Number(oiHist[0]?.sumOpenInterestValue || latest);
      if (prev4h > 0) oiChange4hPct = Number((((latest - prev4h) / prev4h) * 100).toFixed(2));
      if (prev24h > 0) oiChange24hPct = Number((((latest - prev24h) / prev24h) * 100).toFixed(2));
    }

    const latestWhalePos =
      Array.isArray(whalePos) && whalePos.length > 0 ? whalePos[whalePos.length - 1] : null;
    const latestWhaleAcc =
      Array.isArray(whaleAcc) && whaleAcc.length > 0 ? whaleAcc[whaleAcc.length - 1] : null;
    const latestGlobalLs =
      Array.isArray(globalLs) && globalLs.length > 0 ? globalLs[globalLs.length - 1] : null;
    const latestTaker =
      Array.isArray(takerLs) && takerLs.length > 0 ? takerLs[takerLs.length - 1] : null;

    const whaleLongShortRatio = Number(
      latestWhalePos?.longShortRatio || latestWhaleAcc?.longShortRatio || 1
    );
    const whaleLongPct = Number(latestWhalePos?.longAccount || 0.5) * 100;
    const retailLongShortRatio = Number(latestGlobalLs?.longShortRatio || 1);
    const retailLongPct = Number(latestGlobalLs?.longAccount || 0.5) * 100;
    const takerBuySellRatio = Number(latestTaker?.buySellRatio || 1);

    // 4H EMA 50 & EMA 200 trend structure
    let ema50: number | null = null;
    let ema200: number | null = null;
    let htfTrend: "BULLISH" | "NEUTRAL" | "BEARISH" = "NEUTRAL";
    if (Array.isArray(klines4h) && klines4h.length >= 50) {
      const closes = klines4h.map((k: any) => Number(k[4]));
      ema50 = calcEMA(closes, 50);
      ema200 = calcEMA(closes, 200);
      if (ema50 !== null && ema200 !== null) {
        if (lastPrice > ema50 && ema50 > ema200) htfTrend = "BULLISH";
        else if (lastPrice < ema50 && ema50 < ema200) htfTrend = "BEARISH";
        else if (lastPrice > ema50 * 1.008) htfTrend = "BULLISH";
        else if (lastPrice < ema50 * 0.992) htfTrend = "BEARISH";
      } else if (ema50 !== null) {
        if (lastPrice > ema50 * 1.005) htfTrend = "BULLISH";
        else if (lastPrice < ema50 * 0.995) htfTrend = "BEARISH";
      }
    }

    // Order-Book Depth & Whale Wall Imbalance (Top 50 Bid/Ask Levels)
    let bidDepthUsd = 0;
    let askDepthUsd = 0;
    let biggestBidWall: { price: number; usd: number } | null = null;
    let biggestAskWall: { price: number; usd: number } | null = null;

    if (depth && Array.isArray(depth.bids) && Array.isArray(depth.asks)) {
      for (const [pStr, qStr] of depth.bids) {
        const p = Number(pStr);
        const q = Number(qStr);
        const usd = p * q;
        bidDepthUsd += usd;
        if (!biggestBidWall || usd > biggestBidWall.usd) {
          biggestBidWall = { price: p, usd: Number(usd.toFixed(0)) };
        }
      }
      for (const [pStr, qStr] of depth.asks) {
        const p = Number(pStr);
        const q = Number(qStr);
        const usd = p * q;
        askDepthUsd += usd;
        if (!biggestAskWall || usd > biggestAskWall.usd) {
          biggestAskWall = { price: p, usd: Number(usd.toFixed(0)) };
        }
      }
    }
    const totalDepthUsd = bidDepthUsd + askDepthUsd;
    const bidPressurePct =
      totalDepthUsd > 0 ? Number(((bidDepthUsd / totalDepthUsd) * 100).toFixed(1)) : 50;
    const askPressurePct = Number((100 - bidPressurePct).toFixed(1));
    const orderBookSignal =
      bidPressurePct >= 58
        ? "BUY_WALL_DOMINANT"
        : askPressurePct >= 58
        ? "SELL_WALL_DOMINANT"
        : "BALANCED";

    // Token Security, Liquidity & Listing Risk Audit (Binance Skills Hub style)
    const range24hPct =
      low24h > 0 ? Number((((high24h - low24h) / low24h) * 100).toFixed(2)) : 0;
    const oiToVolRatio =
      quoteVolume24h > 0 ? Number((openInterestUsd / quoteVolume24h).toFixed(2)) : 0;

    const riskFlags: { severity: "LOW" | "MEDIUM" | "HIGH"; title: string; detail: string }[] = [];

    if (!tokenReg.isMainSpotListed && tokenReg.alphaEntry) {
      riskFlags.push({
        severity: "MEDIUM",
        title: "Binance Alpha / Futures-Only Listing",
        detail: `${baseAsset} trades via Binance Alpha / Futures without main Spot depth — expect sharper wicks and use lower leverage.`,
      });
    } else if (!tokenReg.isMainSpotListed) {
      riskFlags.push({
        severity: "MEDIUM",
        title: "Non-Main-Spot Futures Contract",
        detail: `${baseAsset} is not in Binance's core Spot list (e.g., synthetic metal/index or new perp). Verify liquidity before sizing up.`,
      });
    } else {
      riskFlags.push({
        severity: "LOW",
        title: "Tier-1 Binance Spot + Futures Listed",
        detail: `${baseAsset} is listed on both Binance Spot and USD-M Futures with deep institutional routing.`,
      });
    }

    if (quoteVolume24h < 25_000_000) {
      riskFlags.push({
        severity: "HIGH",
        title: "Thin Liquidity Warning (<$25M 24h Vol)",
        detail: "Low 24h futures volume increases slippage and stop-hunt risk. Avoid market orders with large size.",
      });
    } else if (quoteVolume24h < 100_000_000) {
      riskFlags.push({
        severity: "MEDIUM",
        title: "Mid-Cap Liquidity ($25M–$100M)",
        detail: "Moderate volume — prefer limit entries near whale walls instead of chasing spikes.",
      });
    }

    if (range24hPct >= 14) {
      riskFlags.push({
        severity: "HIGH",
        title: `Extreme 24h Volatility (${range24hPct}% Range)`,
        detail: "Wide intraday swings can liquidate high leverage quickly. Cap leverage ≤ 3x–5x.",
      });
    } else if (range24hPct >= 8) {
      riskFlags.push({
        severity: "MEDIUM",
        title: `Elevated Volatility (${range24hPct}% Range)`,
        detail: "Widen stop-loss distance and scale down position size to keep risk within 1–2%.",
      });
    }

    if (Math.abs(fundingRatePct) >= 0.05) {
      riskFlags.push({
        severity: "HIGH",
        title: `Extreme Funding Alert (${fundingRatePct >= 0 ? "+" : ""}${fundingRatePct.toFixed(4)}%)`,
        detail: "Heavy leverage crowding detected — elevated liquidation cascade / squeeze probability.",
      });
    }

    if (oiToVolRatio >= 0.65) {
      riskFlags.push({
        severity: "MEDIUM",
        title: `High OI/Volume Ratio (${oiToVolRatio}x)`,
        detail: "Large leveraged open interest relative to daily turnover — coiled for a sharp volatility breakout.",
      });
    }

    const highCount = riskFlags.filter((f) => f.severity === "HIGH").length;
    const medCount = riskFlags.filter((f) => f.severity === "MEDIUM").length;
    const overallRiskTier: "LOW" | "MODERATE" | "HIGH" =
      highCount > 0 ? "HIGH" : medCount >= 2 ? "MODERATE" : "LOW";

    const fearGreedIndex = Number(fng?.data?.[0]?.value || 50);
    const fearGreedLabel = String(fng?.data?.[0]?.value_classification || "Neutral");

    const input: SentimentInput = {
      symbol: rawSym,
      priceChange24hPct: Number(priceChange24hPct.toFixed(2)),
      oiChangePct: oiChange24hPct !== 0 ? oiChange24hPct : oiChange4hPct,
      fundingRatePct: Number(fundingRatePct.toFixed(4)),
      whaleLongShortRatio: Number(whaleLongShortRatio.toFixed(2)),
      retailLongShortRatio: Number(retailLongShortRatio.toFixed(2)),
      takerBuySellRatio: Number(takerBuySellRatio.toFixed(2)),
      htfTrend,
      fearGreedIndex,
      newsRisk: "CLEAR",
    };

    const report = evaluateMarketSentiment(input);

    return NextResponse.json({
      success: true,
      symbol: rawSym,
      fetchedAt: new Date().toISOString(),
      market: {
        lastPrice,
        markPrice,
        high24h,
        low24h,
        range24hPct,
        quoteVolume24h,
        openInterestUsd,
        oiChange4hPct,
        oiChange24hPct,
        nextFundingTime,
        whaleLongPct: Number(whaleLongPct.toFixed(1)),
        retailLongPct: Number(retailLongPct.toFixed(1)),
        ema50: ema50 ? Number(ema50.toFixed(4)) : null,
        ema200: ema200 ? Number(ema200.toFixed(4)) : null,
        fearGreedLabel,
      },
      orderBook: {
        bidDepthUsd: Number(bidDepthUsd.toFixed(0)),
        askDepthUsd: Number(askDepthUsd.toFixed(0)),
        bidPressurePct,
        askPressurePct,
        signal: orderBookSignal,
        biggestBidWall,
        biggestAskWall,
      },
      tokenAudit: {
        baseAsset,
        isMainSpotListed: tokenReg.isMainSpotListed,
        isAlphaToken: Boolean(tokenReg.alphaEntry),
        chainName: tokenReg.alphaEntry?.chainName || null,
        contractAddress: tokenReg.alphaEntry?.contractAddress || null,
        oiToVolRatio,
        overallRiskTier,
        flags: riskFlags,
      },
      trendingMovers,
      input,
      report,
    });
  } catch (error: any) {
    console.error("[API binance/sentiment GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
