export interface CrossExchangeOi {
  binanceOiUsd: number;
  binanceOiChange24hPct: number;
  okxOiUsd: number;
  okxOiContracts: number;
  okxInstrumentId: string | null;
  bybitOiUsd: number;
  bybitOiContracts: number;
  bybitSymbol: string | null;
  totalMonitoredOiUsd: number;
}

export interface MarketMakerFlowResult {
  symbol: string;
  baseAsset: string;
  currentPrice: number;
  exchanges: CrossExchangeOi;
  marketMakerState:
    | "WHALE_DUMP_ALERT"
    | "INSTITUTIONAL_ACCUMULATION"
    | "SHORT_SQUEEZE_FUEL"
    | "LONG_LIQUIDATION_TRAP"
    | "NEUTRAL_CONSOLIDATION";
  stateTitle: string;
  stateDescription: string;
  beginnerVerdict: {
    action: "BUY_LONG" | "SELL_SHORT" | "WAIT_STAY_OUT";
    actionHeadline: string;
    actionBadgeColor: "emerald" | "rose" | "amber";
    plainEnglishWhy: string;
    goldenRule: string;
    riskTier: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
    suggestedEntryRange: string;
    suggestedStopLoss: string;
  };
  smartMoneyMetrics: {
    whaleVsRetailSignal: string;
    whaleRatio: number;
    retailRatio: number;
    fundingSignal: string;
    orderBookImbalance: string;
  };
  aiPromptDigest: string;
}

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<any> {
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

export async function fetchCrossExchangeMarketMakerFlow(params: {
  symbol: string;
  baseAsset: string;
  currentPrice: number;
  binanceOiUsd: number;
  binanceOiChange24hPct: number;
  fundingRatePct: number;
  whaleLongShortRatio: number;
  retailLongShortRatio: number;
  takerBuySellRatio: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  biggestBidWall?: { price: number; usd: number } | null;
  biggestAskWall?: { price: number; usd: number } | null;
}): Promise<MarketMakerFlowResult> {
  const {
    symbol,
    baseAsset,
    currentPrice,
    binanceOiUsd,
    binanceOiChange24hPct,
    fundingRatePct,
    whaleLongShortRatio,
    retailLongShortRatio,
    takerBuySellRatio,
    bidDepthUsd,
    askDepthUsd,
    biggestBidWall,
    biggestAskWall,
  } = params;

  const base = baseAsset.toUpperCase();

  // 1. Query OKX Open Interest
  let okxOiUsd = 0;
  let okxOiContracts = 0;
  let okxInstrumentId: string | null = null;

  const okxCandidates = [`${base}-USDT-SWAP`, `1000${base}-USDT-SWAP`, `${base}-USD-SWAP`];
  for (const instId of okxCandidates) {
    const okxRes = await fetchWithTimeout(
      `https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${instId}`,
      3000
    );
    if (okxRes?.data?.[0]?.oi) {
      okxInstrumentId = instId;
      okxOiContracts = Number(okxRes.data[0].oi || 0);
      const oiCcy = Number(okxRes.data[0].oiCcy || 0);
      okxOiUsd = oiCcy > 0 ? oiCcy * currentPrice : okxOiContracts * currentPrice;
      break;
    }
  }

  // 2. Query Bybit Open Interest
  let bybitOiUsd = 0;
  let bybitOiContracts = 0;
  let bybitSymbol: string | null = null;

  const bybitCandidates = [`${base}USDT`, `1000${base}USDT`];
  for (const sym of bybitCandidates) {
    const bybitRes = await fetchWithTimeout(
      `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${sym}&intervalTime=5min&limit=1`,
      3000
    );
    if (bybitRes?.result?.list?.[0]?.openInterest) {
      bybitSymbol = sym;
      bybitOiContracts = Number(bybitRes.result.list[0].openInterest || 0);
      bybitOiUsd = bybitOiContracts * currentPrice;
      break;
    }
  }

  const totalMonitoredOiUsd = binanceOiUsd + okxOiUsd + bybitOiUsd;

  // 3. Market Maker Behavior Diagnostics
  let mmState: MarketMakerFlowResult["marketMakerState"] = "NEUTRAL_CONSOLIDATION";
  let stateTitle = "Market Makers in Balanced Inventory";
  let stateDescription =
    "Neither aggressive buying nor dumping is detected. Leverage is evenly distributed across major exchanges.";

  let action: MarketMakerFlowResult["beginnerVerdict"]["action"] = "WAIT_STAY_OUT";
  let actionHeadline = "WAIT — NO IMMEDIATE EDGE";
  let actionBadgeColor: MarketMakerFlowResult["beginnerVerdict"]["actionBadgeColor"] = "amber";
  let plainEnglishWhy =
    "Smart money and market makers are currently sitting on the sidelines without aggressive direction. For beginners, the safest move is to wait for clear institutional commitment.";
  let goldenRule = "Never force a trade when market makers are not pushing volume.";
  let riskTier: MarketMakerFlowResult["beginnerVerdict"]["riskTier"] = "MODERATE";

  const totalDepth = bidDepthUsd + askDepthUsd || 1;
  const bidRatio = bidDepthUsd / totalDepth;
  const askRatio = askDepthUsd / totalDepth;

  // Pattern A: WHALE DUMP ALERT (Insiders selling / MM offloading into retail)
  if (
    (retailLongShortRatio > 1.35 && whaleLongShortRatio < 0.95) ||
    (binanceOiChange24hPct <= -6 && askRatio >= 0.62) ||
    (biggestAskWall && biggestAskWall.usd > 1_500_000 && biggestAskWall.usd > (biggestBidWall?.usd || 0) * 2.5)
  ) {
    mmState = "WHALE_DUMP_ALERT";
    stateTitle = "🚨 Market Maker Dump & Distribution Warning";
    stateDescription =
      "Market makers are offloading inventory into unsuspecting retail traders. Huge sell walls are capping upside while leverage is unwinding.";
    action = "SELL_SHORT";
    actionHeadline = "LOOK FOR SHORT (DO NOT LONG!)";
    actionBadgeColor = "rose";
    plainEnglishWhy =
      "Market makers and institutional whales are actively selling tokens while everyday retail traders are trapped trying to buy the dip. When whales sell into trapped buyers, prices usually drop sharply.";
    goldenRule = "Do NOT buy the dip when smart money is distributing. Look for short entries on minor relief bounces.";
    riskTier = "HIGH";
  }
  // Pattern B: INSTITUTIONAL ACCUMULATION (Smart money quietly loading spot/futures)
  else if (
    (whaleLongShortRatio >= 1.3 && retailLongShortRatio <= 0.85) ||
    (binanceOiChange24hPct >= 4 && takerBuySellRatio >= 1.15 && bidRatio >= 0.58)
  ) {
    mmState = "INSTITUTIONAL_ACCUMULATION";
    stateTitle = "🟢 Smart Money & Market Maker Accumulation";
    stateDescription =
      "Institutional whales are quietly building long positions across Binance and OKX while retail traders are selling or staying cautious.";
    action = "BUY_LONG";
    actionHeadline = "BUY / LONG SETUP (FOLLOW THE WHALES)";
    actionBadgeColor = "emerald";
    plainEnglishWhy =
      "Top trader whale accounts are heavily skewed long, and big buy walls are supporting prices from falling. You are trading on the same side as the biggest market participants.";
    goldenRule = "Buy near the institutional bid walls and ride the momentum upward.";
    riskTier = "LOW";
  }
  // Pattern C: SHORT SQUEEZE FUEL (Trapped shorts paying high fees)
  else if (fundingRatePct <= -0.015 || (takerBuySellRatio >= 1.25 && binanceOiChange24hPct >= 5)) {
    mmState = "SHORT_SQUEEZE_FUEL";
    stateTitle = "⚡ Short-Squeeze Springboard Primed";
    stateDescription =
      "Too many traders are aggressively shorting. Market makers often engineer sudden violent upward spikes to liquidate these shorts.";
    action = "BUY_LONG";
    actionHeadline = "BUY / LONG (SHORT SQUEEZE INCOMING)";
    actionBadgeColor = "emerald";
    plainEnglishWhy =
      "Crowded shorts are paying high funding penalties. A quick burst of buying by market makers can trigger a cascade of buy stops that blasts the price up rapidly.";
    goldenRule = "Enter longs with a tight stop-loss and take profit into the sudden squeeze spike.";
    riskTier = "MODERATE";
  }
  // Pattern D: LONG LIQUIDATION TRAP (Overcrowded longs about to be flushed)
  else if (fundingRatePct >= 0.04 && retailLongShortRatio >= 1.3) {
    mmState = "LONG_LIQUIDATION_TRAP";
    stateTitle = "⚠️ Overleveraged Long Trap (Liquidation Risk)";
    stateDescription =
      "Retail traders are dangerously overleveraged in longs and paying heavy fees. Market makers frequently hunt this liquidity with a fast stop-run downward.";
    action = "WAIT_STAY_OUT";
    actionHeadline = "STAND ASIDE — FLUSH EXPECTED";
    actionBadgeColor = "amber";
    plainEnglishWhy =
      "Everyone is already long and paying huge fees. There are no fresh buyers left at current prices, making the market vulnerable to a sudden 5%–10% flash dump to wipe out stop-losses.";
    goldenRule = "Never FOMO into green candles when funding rates are flashing extreme positive.";
    riskTier = "EXTREME";
  }

  const suggestedEntryRange =
    action === "BUY_LONG"
      ? `$${(currentPrice * 0.992).toFixed(4)} – $${(currentPrice * 1.002).toFixed(4)}`
      : action === "SELL_SHORT"
      ? `$${(currentPrice * 0.998).toFixed(4)} – $${(currentPrice * 1.012).toFixed(4)}`
      : "Wait for fresh consolidation";

  const suggestedStopLoss =
    action === "BUY_LONG"
      ? `$${(currentPrice * 0.978).toFixed(4)} (-2.2%)`
      : action === "SELL_SHORT"
      ? `$${(currentPrice * 1.022).toFixed(4)} (+2.2%)`
      : "N/A";

  const aiPromptDigest = `Analyze live Market Maker & Cross-Exchange flow for ${symbol}:
- Current Price: $${currentPrice}
- Total Monitored Leverage: $${(totalMonitoredOiUsd / 1e6).toFixed(1)}M across Binance ($${(binanceOiUsd / 1e6).toFixed(1)}M), OKX ($${(okxOiUsd / 1e6).toFixed(1)}M), Bybit ($${(bybitOiUsd / 1e6).toFixed(1)}M)
- Market Maker State: ${mmState} (${stateTitle})
- Whale vs Retail: Top Whales are ${whaleLongShortRatio}x Long, Global Retail is ${retailLongShortRatio}x Long
- Funding Rate: ${fundingRatePct.toFixed(4)}% (Taker Buy/Sell: ${takerBuySellRatio})
- Order Book Depth: Bids $${(bidDepthUsd / 1e3).toFixed(0)}k vs Asks $${(askDepthUsd / 1e3).toFixed(0)}k
- What is your strategic recommendation for this token?`;

  return {
    symbol,
    baseAsset,
    currentPrice,
    exchanges: {
      binanceOiUsd: Number(binanceOiUsd.toFixed(0)),
      binanceOiChange24hPct: Number(binanceOiChange24hPct.toFixed(2)),
      okxOiUsd: Number(okxOiUsd.toFixed(0)),
      okxOiContracts: Number(okxOiContracts.toFixed(0)),
      okxInstrumentId,
      bybitOiUsd: Number(bybitOiUsd.toFixed(0)),
      bybitOiContracts: Number(bybitOiContracts.toFixed(0)),
      bybitSymbol,
      totalMonitoredOiUsd: Number(totalMonitoredOiUsd.toFixed(0)),
    },
    marketMakerState: mmState,
    stateTitle,
    stateDescription,
    beginnerVerdict: {
      action,
      actionHeadline,
      actionBadgeColor,
      plainEnglishWhy,
      goldenRule,
      riskTier,
      suggestedEntryRange,
      suggestedStopLoss,
    },
    smartMoneyMetrics: {
      whaleVsRetailSignal:
        whaleLongShortRatio > retailLongShortRatio ? "Whales Long / Retail Short" : "Retail Long / Whales Short",
      whaleRatio: Number(whaleLongShortRatio.toFixed(2)),
      retailRatio: Number(retailLongShortRatio.toFixed(2)),
      fundingSignal:
        fundingRatePct > 0.03
          ? "Overheated Longs"
          : fundingRatePct < -0.01
          ? "Squeeze Primed"
          : "Normal / Healthy",
      orderBookImbalance:
        bidRatio >= 0.58
          ? "Strong Bid Support"
          : askRatio >= 0.58
          ? "Heavy Overhead Resistance"
          : "Balanced Liquidity",
    },
    aiPromptDigest,
  };
}
