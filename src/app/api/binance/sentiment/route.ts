import { NextRequest, NextResponse } from "next/server";
import { evaluateMarketSentiment, SentimentInput } from "@/lib/tradingMetrics";

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSym = (searchParams.get("symbol") || "BTCUSDT").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!rawSym || rawSym.length < 3 || rawSym.length > 20) {
      return NextResponse.json({ success: false, error: "Invalid trading symbol" }, { status: 400 });
    }

    const base = "https://fapi.binance.com";
    const [ticker, premium, oiHist, whalePos, whaleAcc, globalLs, takerLs, klines4h, fng] =
      await Promise.all([
        fetchJson(`${base}/fapi/v1/ticker/24hr?symbol=${rawSym}`),
        fetchJson(`${base}/fapi/v1/premiumIndex?symbol=${rawSym}`),
        fetchJson(`${base}/futures/data/openInterestHist?symbol=${rawSym}&period=1h&limit=24`),
        fetchJson(`${base}/futures/data/topLongShortPositionRatio?symbol=${rawSym}&period=1h&limit=3`),
        fetchJson(`${base}/futures/data/topLongShortAccountRatio?symbol=${rawSym}&period=1h&limit=3`),
        fetchJson(`${base}/futures/data/globalLongShortAccountRatio?symbol=${rawSym}&period=1h&limit=3`),
        fetchJson(`${base}/futures/data/takerlongshortRatio?symbol=${rawSym}&period=1h&limit=3`),
        fetchJson(`${base}/fapi/v1/klines?symbol=${rawSym}&interval=4h&limit=210`),
        fetchJson("https://api.alternative.me/fng/?limit=1"),
      ]);

    if (!ticker || ticker.code) {
      return NextResponse.json(
        {
          success: false,
          error: `Symbol "${rawSym}" was not found on Binance USD-M Futures. You can still enter values manually below.`,
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
    const fundingRatePct = Number(premium?.lastFundingRate || 0) * 100; // Convert decimal 0.0001 -> 0.01%
    const nextFundingTime = premium?.nextFundingTime ? new Date(Number(premium.nextFundingTime)).toISOString() : null;

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

    const latestWhalePos = Array.isArray(whalePos) && whalePos.length > 0 ? whalePos[whalePos.length - 1] : null;
    const latestWhaleAcc = Array.isArray(whaleAcc) && whaleAcc.length > 0 ? whaleAcc[whaleAcc.length - 1] : null;
    const latestGlobalLs = Array.isArray(globalLs) && globalLs.length > 0 ? globalLs[globalLs.length - 1] : null;
    const latestTaker = Array.isArray(takerLs) && takerLs.length > 0 ? takerLs[takerLs.length - 1] : null;

    const whaleLongShortRatio = Number(latestWhalePos?.longShortRatio || latestWhaleAcc?.longShortRatio || 1);
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
      input,
      report,
    });
  } catch (error: any) {
    console.error("[API binance/sentiment GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
