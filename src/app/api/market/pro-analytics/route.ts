import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface KlineData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  takerBuyQuoteVolume: number;
  takerSellQuoteVolume: number;
  deltaUsd: number;
}

// Standard Wilder's RSI calculation
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

// Normalize symbol for Binance & OKX
function normalizeSymbols(sym: string) {
  const clean = sym.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "BTCUSDT";
  let binance = clean;
  if (clean === "PEPEUSDT") binance = "1000PEPEUSDT";
  if (clean === "SHIBUSDT") binance = "1000SHIBUSDT";
  if (clean === "BONKUSDT") binance = "1000BONKUSDT";
  if (clean === "FLOKIUSDT") binance = "1000FLOKIUSDT";

  const base = clean.replace(/USDT$|BUSD$|USDC$/, "");
  const okxInstId = `${base}-USDT-SWAP`;

  return { clean, binance, base, okxInstId };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbol = searchParams.get("symbol") || "BTCUSDT";
    const { clean, binance, base, okxInstId } = normalizeSymbols(rawSymbol);

    // Parallel fetch: Binance 15m klines, 1h klines, 4h klines, Binance funding, OKX funding & ticker
    const [k15Res, k1hRes, k4hRes, bnFundingRes, okxFundingRes, okxTickerRes] =
      await Promise.allSettled([
        fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${binance}&interval=15m&limit=40`, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${binance}&interval=1h&limit=50`, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${binance}&interval=4h&limit=30`, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${binance}`, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${okxInstId}`, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxInstId}`, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(5000),
        }),
      ]);

    // Parse Binance 15m Klines
    const rawK15: any[] =
      k15Res.status === "fulfilled" && k15Res.value.ok ? await k15Res.value.json() : [];
    // Parse Binance 1h Klines
    const rawK1h: any[] =
      k1hRes.status === "fulfilled" && k1hRes.value.ok ? await k1hRes.value.json() : [];
    // Parse Binance 4h Klines
    const rawK4h: any[] =
      k4hRes.status === "fulfilled" && k4hRes.value.ok ? await k4hRes.value.json() : [];

    const currentPrice =
      rawK15.length > 0 ? parseFloat(rawK15[rawK15.length - 1][4]) : 0;

    // -------------------------------------------------------------
    // 1. CVD (Cumulative Volume Delta) & Absorption Divergence
    // -------------------------------------------------------------
    let runningCvd = 0;
    const cvdSeries: {
      time: string;
      timestamp: number;
      close: number;
      deltaUsd: number;
      cvdUsd: number;
      isBuyerDominant: boolean;
    }[] = [];

    let totalTakerBuyUsd = 0;
    let totalTakerSellUsd = 0;

    for (const k of rawK15) {
      const openTime = k[0];
      const close = parseFloat(k[4]);
      const quoteVol = parseFloat(k[7]);
      const takerBuyQuote = parseFloat(k[10]);
      const takerSellQuote = Math.max(0, quoteVol - takerBuyQuote);
      const delta = takerBuyQuote - takerSellQuote;

      totalTakerBuyUsd += takerBuyQuote;
      totalTakerSellUsd += takerSellQuote;
      runningCvd += delta;

      cvdSeries.push({
        time: new Date(openTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        timestamp: openTime,
        close,
        deltaUsd: Math.round(delta),
        cvdUsd: Math.round(runningCvd),
        isBuyerDominant: delta >= 0,
      });
    }

    // Delta Divergence Detection (Comparing last 10 candles vs previous 10)
    let cvdDivergence: "BEARISH_ABSORPTION" | "BULLISH_ABSORPTION" | "NEUTRAL_ALIGNED" =
      "NEUTRAL_ALIGNED";
    let cvdSignalHeadline = "CVD Aligned with Price: Order flow confirming trend.";

    if (cvdSeries.length >= 20) {
      const firstHalf = cvdSeries.slice(-20, -10);
      const secondHalf = cvdSeries.slice(-10);

      const priceFirstMax = Math.max(...firstHalf.map((c) => c.close));
      const priceSecondMax = Math.max(...secondHalf.map((c) => c.close));
      const cvdFirstMax = Math.max(...firstHalf.map((c) => c.cvdUsd));
      const cvdSecondMax = Math.max(...secondHalf.map((c) => c.cvdUsd));

      const priceFirstMin = Math.min(...firstHalf.map((c) => c.close));
      const priceSecondMin = Math.min(...secondHalf.map((c) => c.close));
      const cvdFirstMin = Math.min(...firstHalf.map((c) => c.cvdUsd));
      const cvdSecondMin = Math.min(...secondHalf.map((c) => c.cvdUsd));

      if (priceSecondMax > priceFirstMax && cvdSecondMax < cvdFirstMax) {
        cvdDivergence = "BEARISH_ABSORPTION";
        cvdSignalHeadline =
          "🚨 Bearish Delta Divergence: Price reached higher high but CVD made lower high. Whales actively absorbing with passive limit sell orders.";
      } else if (priceSecondMin < priceFirstMin && cvdSecondMin > cvdFirstMin) {
        cvdDivergence = "BULLISH_ABSORPTION";
        cvdSignalHeadline =
          "🟢 Bullish Delta Divergence: Price reached lower low but CVD made higher low. Aggressive sellers exhausting into institutional limit buy walls.";
      }
    }

    // -------------------------------------------------------------
    // 2. FVG (Fair Value Gaps) Imbalance Engine
    // -------------------------------------------------------------
    interface FVGItem {
      id: string;
      type: "BULLISH_FVG" | "BEARISH_FVG";
      top: number;
      bottom: number;
      midpoint: number;
      sizeUsd: number;
      pct: number;
      mitigated: boolean;
      distancePct: number;
      time: string;
    }

    const fvgList: FVGItem[] = [];

    if (rawK1h.length >= 3) {
      for (let i = 2; i < rawK1h.length; i++) {
        const prev2High = parseFloat(rawK1h[i - 2][2]);
        const prev2Low = parseFloat(rawK1h[i - 2][3]);
        const currHigh = parseFloat(rawK1h[i][2]);
        const currLow = parseFloat(rawK1h[i][3]);
        const candleTime = new Date(rawK1h[i - 1][0]).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
        });

        // Bullish FVG: Low of candle i > High of candle i-2
        if (currLow > prev2High) {
          const top = currLow;
          const bottom = prev2High;
          const sizeUsd = top - bottom;
          let mitigated = false;
          for (let j = i + 1; j < rawK1h.length; j++) {
            if (parseFloat(rawK1h[j][3]) <= bottom) {
              mitigated = true;
              break;
            }
          }
          const midpoint = (top + bottom) / 2;
          const distancePct =
            currentPrice > 0 ? ((midpoint - currentPrice) / currentPrice) * 100 : 0;

          fvgList.push({
            id: `fvg_bull_${rawK1h[i - 1][0]}`,
            type: "BULLISH_FVG",
            top,
            bottom,
            midpoint,
            sizeUsd,
            pct: currentPrice > 0 ? Math.round((sizeUsd / currentPrice) * 10000) / 100 : 0,
            mitigated,
            distancePct: Math.round(distancePct * 10) / 10,
            time: candleTime,
          });
        }

        // Bearish FVG: High of candle i < Low of candle i-2
        if (currHigh < prev2Low) {
          const top = prev2Low;
          const bottom = currHigh;
          const sizeUsd = top - bottom;
          let mitigated = false;
          for (let j = i + 1; j < rawK1h.length; j++) {
            if (parseFloat(rawK1h[j][2]) >= top) {
              mitigated = true;
              break;
            }
          }
          const midpoint = (top + bottom) / 2;
          const distancePct =
            currentPrice > 0 ? ((midpoint - currentPrice) / currentPrice) * 100 : 0;

          fvgList.push({
            id: `fvg_bear_${rawK1h[i - 1][0]}`,
            type: "BEARISH_FVG",
            top,
            bottom,
            midpoint,
            sizeUsd,
            pct: currentPrice > 0 ? Math.round((sizeUsd / currentPrice) * 10000) / 100 : 0,
            mitigated,
            distancePct: Math.round(distancePct * 10) / 10,
            time: candleTime,
          });
        }
      }
    }

    const unmitigatedFvgs = fvgList.filter((f) => !f.mitigated);
    // Closest FVG to current price (magnet zone)
    const nearestMagnetFvg =
      unmitigatedFvgs.length > 0
        ? [...unmitigatedFvgs].sort(
            (a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct)
          )[0]
        : null;

    // -------------------------------------------------------------
    // 3. SMC (Smart Money Concepts) Market Structure
    // -------------------------------------------------------------
    const highs = rawK1h.map((k) => parseFloat(k[2]));
    const lows = rawK1h.map((k) => parseFloat(k[3]));
    const closes1h = rawK1h.map((k) => parseFloat(k[4]));

    const bsl = highs.length > 0 ? Math.max(...highs.slice(-30)) : currentPrice * 1.05; // Buy-Side Liquidity
    const ssl = lows.length > 0 ? Math.min(...lows.slice(-30)) : currentPrice * 0.95; // Sell-Side Liquidity

    // Find Demand Order Block (Last bearish candle before upward impulse)
    let demandOb: { top: number; bottom: number; time: string } | null = null;
    let supplyOb: { top: number; bottom: number; time: string } | null = null;

    for (let i = rawK1h.length - 2; i >= 2; i--) {
      const open = parseFloat(rawK1h[i][1]);
      const close = parseFloat(rawK1h[i][4]);
      const high = parseFloat(rawK1h[i][2]);
      const low = parseFloat(rawK1h[i][3]);
      const nextClose = parseFloat(rawK1h[i + 1][4]);

      // Demand OB: Down candle followed by aggressive expansion up
      if (!demandOb && close < open && nextClose > high * 1.008) {
        demandOb = {
          top: high,
          bottom: low,
          time: new Date(rawK1h[i][0]).toLocaleDateString([], { month: "short", day: "numeric" }),
        };
      }

      // Supply OB: Up candle followed by aggressive expansion down
      if (!supplyOb && close > open && nextClose < low * 0.992) {
        supplyOb = {
          top: high,
          bottom: low,
          time: new Date(rawK1h[i][0]).toLocaleDateString([], { month: "short", day: "numeric" }),
        };
      }
      if (demandOb && supplyOb) break;
    }

    // Default fallbacks if no clear order block formed yet
    if (!demandOb && currentPrice > 0) {
      demandOb = { top: currentPrice * 0.985, bottom: currentPrice * 0.975, time: "Recent Swing Low" };
    }
    if (!supplyOb && currentPrice > 0) {
      supplyOb = { top: currentPrice * 1.025, bottom: currentPrice * 1.015, time: "Recent Swing High" };
    }

    // Determine SMC Market Structure Status
    const isBullishStructure =
      closes1h.length >= 10 &&
      closes1h[closes1h.length - 1] > closes1h[closes1h.length - 10];
    const structureState = isBullishStructure ? "BULLISH_EXPANSION" : "BEARISH_EXPANSION";

    // -------------------------------------------------------------
    // 4. RSI (Multi-Timeframe Momentum Matrix)
    // -------------------------------------------------------------
    const closes15m = rawK15.map((k) => parseFloat(k[4]));
    const closes4h = rawK4h.map((k) => parseFloat(k[4]));

    const rsi15m = calculateRSI(closes15m, 14);
    const rsi1h = calculateRSI(closes1h, 14);
    const rsi4h = calculateRSI(closes4h, 14);

    const getRsiRegime = (val: number) => {
      if (val >= 70) return { label: "OVERBOUGHT", color: "rose" };
      if (val <= 30) return { label: "OVERSOLD", color: "emerald" };
      if (val >= 55) return { label: "BULLISH_CONTROL", color: "emerald" };
      if (val <= 45) return { label: "BEARISH_CONTROL", color: "rose" };
      return { label: "NEUTRAL_PIVOT", color: "amber" };
    };

    // -------------------------------------------------------------
    // 5. OKX vs Binance Cross-Exchange Spread & Basis
    // -------------------------------------------------------------
    let binanceFundingPct = 0.01;
    let okxFundingPct = 0.01;
    let okxPrice = currentPrice;
    let okxConnected = false;

    if (bnFundingRes.status === "fulfilled" && bnFundingRes.value.ok) {
      const bnData = await bnFundingRes.value.json();
      binanceFundingPct = parseFloat(bnData.lastFundingRate || "0.0001") * 100;
    }

    if (okxFundingRes.status === "fulfilled" && okxFundingRes.value.ok) {
      const okxData = await okxFundingRes.value.json();
      if (okxData?.data?.[0]?.fundingRate) {
        okxFundingPct = parseFloat(okxData.data[0].fundingRate) * 100;
        okxConnected = true;
      }
    }

    if (okxTickerRes.status === "fulfilled" && okxTickerRes.value.ok) {
      const tData = await okxTickerRes.value.json();
      if (tData?.data?.[0]?.last) {
        okxPrice = parseFloat(tData.data[0].last);
      }
    }

    const fundingSpreadPct = Math.round((binanceFundingPct - okxFundingPct) * 1000) / 1000;
    const priceBasisSpreadUsd = Math.round((currentPrice - okxPrice) * 100) / 100;

    // -------------------------------------------------------------
    // 6. APY Funding Rate Arbitrage (Cash & Carry Yield)
    // -------------------------------------------------------------
    // 3 funding intervals per day * 365 days = 1095 funding cycles/yr
    const binanceAnnualizedApy = Math.round(binanceFundingPct * 3 * 365 * 10) / 10;
    const okxAnnualizedApy = Math.round(okxFundingPct * 3 * 365 * 10) / 10;
    const spreadAnnualizedApy = Math.round(Math.abs(fundingSpreadPct) * 3 * 365 * 10) / 10;

    // Delta-neutral recommendation
    let arbitrageRecommendation = "";
    if (binanceFundingPct >= 0.03) {
      arbitrageRecommendation = `High Cash-and-Carry APY (${binanceAnnualizedApy}%): Long Spot + Short Binance Perp earns daily funding fees with zero price risk.`;
    } else if (binanceFundingPct <= -0.03) {
      arbitrageRecommendation = `Crowded Short Trap (${binanceAnnualizedApy}%): Shorts are paying extreme fees to longs. Prime setup for explosive short squeeze.`;
    } else if (spreadAnnualizedApy >= 15 && okxConnected) {
      arbitrageRecommendation = `Cross-Exchange Arbitrage Available (${spreadAnnualizedApy}% APY): Long on ${
        binanceFundingPct < okxFundingPct ? "Binance" : "OKX"
      } and Short on ${binanceFundingPct > okxFundingPct ? "Binance" : "OKX"}.`;
    } else {
      arbitrageRecommendation = `Standard Basis: Funding is neutral (${binanceAnnualizedApy}% APY). Directional trades favored over basis arbitrage.`;
    }

    // -------------------------------------------------------------
    // 7. ROI Expectancy & Risk-to-Reward Calculator Matrix
    // -------------------------------------------------------------
    const isLongBias = structureState === "BULLISH_EXPANSION" || rsi1h >= 50;

    const plannedEntry = currentPrice;
    const plannedSl = isLongBias
      ? demandOb?.bottom || currentPrice * 0.985
      : supplyOb?.top || currentPrice * 1.015;
    const plannedTp = isLongBias
      ? bsl || currentPrice * 1.045
      : ssl || currentPrice * 0.955;

    const riskDist = Math.abs(plannedEntry - plannedSl);
    const rewardDist = Math.abs(plannedTp - plannedEntry);
    const riskRewardRatio =
      riskDist > 0 ? Math.round((rewardDist / riskDist) * 10) / 10 : 2.5;

    const baseUnleveragedRoiPct =
      plannedEntry > 0 ? (rewardDist / plannedEntry) * 100 : 3.5;
    const baseRiskPct =
      plannedEntry > 0 ? (riskDist / plannedEntry) * 100 : 1.2;

    const leverageTiers = [
      {
        leverage: 1,
        projectedRoiPct: Math.round(baseUnleveragedRoiPct * 10) / 10,
        projectedRiskPct: Math.round(baseRiskPct * 10) / 10,
      },
      {
        leverage: 5,
        projectedRoiPct: Math.round(baseUnleveragedRoiPct * 5 * 10) / 10,
        projectedRiskPct: Math.round(baseRiskPct * 5 * 10) / 10,
      },
      {
        leverage: 10,
        projectedRoiPct: Math.round(baseUnleveragedRoiPct * 10 * 10) / 10,
        projectedRiskPct: Math.round(baseRiskPct * 10 * 10) / 10,
      },
      {
        leverage: 20,
        projectedRoiPct: Math.round(baseUnleveragedRoiPct * 20 * 10) / 10,
        projectedRiskPct: Math.round(baseRiskPct * 20 * 10) / 10,
      },
    ];

    // Mathematical Trade Expectancy assuming conservative 55% win-rate for confluence setups
    const assumedWinRate = 0.55;
    const mathematicalExpectancy =
      Math.round(
        (assumedWinRate * baseUnleveragedRoiPct - (1 - assumedWinRate) * baseRiskPct) * 100
      ) / 100;

    return NextResponse.json({
      success: true,
      symbol: clean,
      currentPrice,
      cvd: {
        totalTakerBuyUsd,
        totalTakerSellUsd,
        netDeltaUsd: Math.round(totalTakerBuyUsd - totalTakerSellUsd),
        cvdSeries: cvdSeries.slice(-15),
        divergence: cvdDivergence,
        signalHeadline: cvdSignalHeadline,
      },
      fvg: {
        totalFound: fvgList.length,
        unmitigatedCount: unmitigatedFvgs.length,
        nearestMagnetFvg,
        activeFvgs: unmitigatedFvgs.slice(-6),
      },
      smc: {
        structureState,
        bslPrice: bsl,
        sslPrice: ssl,
        demandOrderBlock: demandOb,
        supplyOrderBlock: supplyOb,
        bosBreakLevel: isBullishStructure ? bsl : ssl,
      },
      rsi: {
        rsi15m: { value: rsi15m, regime: getRsiRegime(rsi15m) },
        rsi1h: { value: rsi1h, regime: getRsiRegime(rsi1h) },
        rsi4h: { value: rsi4h, regime: getRsiRegime(rsi4h) },
        confluenceSignal:
          rsi1h >= 55 && rsi4h >= 55
            ? "BULLISH_MOMENTUM_ALIGNMENT"
            : rsi1h <= 45 && rsi4h <= 45
            ? "BEARISH_MOMENTUM_ALIGNMENT"
            : "MIXED_TIMEFRAME_CHOP",
      },
      okx: {
        connected: okxConnected,
        okxInstId,
        binanceFundingPct,
        okxFundingPct,
        fundingSpreadPct,
        priceBasisSpreadUsd,
      },
      apy: {
        binanceAnnualizedApy,
        okxAnnualizedApy,
        spreadAnnualizedApy,
        arbitrageRecommendation,
      },
      roi: {
        bias: isLongBias ? "LONG" : "SHORT",
        plannedEntry,
        plannedSl,
        plannedTp,
        riskRewardRatio,
        baseUnleveragedRoiPct: Math.round(baseUnleveragedRoiPct * 10) / 10,
        baseRiskPct: Math.round(baseRiskPct * 10) / 10,
        mathematicalExpectancy,
        leverageTiers,
      },
    });
  } catch (error: any) {
    console.error("Pro analytics API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calculate pro analytics" },
      { status: 500 }
    );
  }
}
