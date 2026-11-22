export interface ExchangeOiData {
  name: string;
  oiUsd: number;
  oiContracts: number;
  identifier: string | null;
  change24hPct?: number;
}

export interface DeribitOptionsData {
  available: boolean;
  currency: string;
  putCallRatio: number;
  totalCallVolume: number;
  totalPutVolume: number;
  maxPainPrice: number;
  maxPainDistancePct: number;
  sentiment: "BULLISH_CALL_DOMINANT" | "BEARISH_PUT_HEDGING" | "BALANCED";
}

export interface UpbitArbitrageData {
  available: boolean;
  market: string;
  priceKrw: number;
  priceUsd: number;
  usdtKrwRate: number;
  kimchiPremiumPct: number;
  signal: "EXTREME_RETAIL_FOMO" | "MODERATE_PREMIUM" | "NORMAL" | "PANIC_DISCOUNT";
}

export interface CrossExchangeIntelligence {
  binance: ExchangeOiData;
  okx: ExchangeOiData;
  bybit: ExchangeOiData;
  bitget: ExchangeOiData;
  gate: ExchangeOiData;
  totalMonitoredOiUsd: number;
  options: DeribitOptionsData | null;
  upbit: UpbitArbitrageData | null;
}

export interface MarketMakerFlowResult {
  symbol: string;
  baseAsset: string;
  currentPrice: number;
  intelligence: CrossExchangeIntelligence;
  marketMakerState:
    | "WHALE_DUMP_ALERT"
    | "INSTITUTIONAL_ACCUMULATION"
    | "SHORT_SQUEEZE_FUEL"
    | "LONG_LIQUIDATION_TRAP"
    | "OPTIONS_GRAVITY_PULL"
    | "NEUTRAL_CONSOLIDATION";
  stateTitle: string;
  stateDescription: string;
  beginnerVerdict: {
    action: "BUY_LONG" | "SELL_SHORT" | "WAIT_STAY_OUT";
    actionHeadline: string;
    actionBadgeColor: "emerald" | "rose" | "amber" | "purple";
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
    kimchiSignal: string;
    optionsSignal: string;
  };
  aiPromptDigest: string;
}

async function fetchWithTimeout(url: string, timeoutMs = 4500): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradingGoalTracker/2.0)" },
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

  // Run all parallel queries across OKX, Bybit, Bitget, Gate.io, Upbit, and Deribit
  const [okxData, bybitData, bitgetData, gateData, upbitData, deribitData] = await Promise.all([
    // 1. OKX Open Interest
    (async () => {
      const candidates = [`${base}-USDT-SWAP`, `1000${base}-USDT-SWAP`, `${base}-USD-SWAP`];
      for (const instId of candidates) {
        const res = await fetchWithTimeout(
          `https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${instId}`,
          3500
        );
        if (res?.data?.[0]?.oi) {
          const contracts = Number(res.data[0].oi || 0);
          const ccy = Number(res.data[0].oiCcy || 0);
          const usd = ccy > 0 ? ccy * currentPrice : contracts * currentPrice;
          return { name: "OKX Swap", oiUsd: usd, oiContracts: contracts, identifier: instId };
        }
      }
      return { name: "OKX Swap", oiUsd: 0, oiContracts: 0, identifier: null };
    })(),

    // 2. Bybit Open Interest
    (async () => {
      const candidates = [`${base}USDT`, `1000${base}USDT`];
      for (const sym of candidates) {
        const res = await fetchWithTimeout(
          `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${sym}&intervalTime=5min&limit=1`,
          3500
        );
        if (res?.result?.list?.[0]?.openInterest) {
          const contracts = Number(res.result.list[0].openInterest || 0);
          const usd = contracts * currentPrice;
          return { name: "Bybit Linear", oiUsd: usd, oiContracts: contracts, identifier: sym };
        }
      }
      return { name: "Bybit Linear", oiUsd: 0, oiContracts: 0, identifier: null };
    })(),

    // 3. Bitget Open Interest
    (async () => {
      const candidates = [`${base}USDT`, `1000${base}USDT`];
      for (const sym of candidates) {
        const res = await fetchWithTimeout(
          `https://api.bitget.com/api/v2/mix/market/open-interest?productType=USDT-FUTURES&symbol=${sym}`,
          3500
        );
        if (res?.data?.openInterestList?.[0]?.size) {
          const contracts = Number(res.data.openInterestList[0].size || 0);
          const usd = contracts * currentPrice;
          return { name: "Bitget Futures", oiUsd: usd, oiContracts: contracts, identifier: sym };
        }
      }
      return { name: "Bitget Futures", oiUsd: 0, oiContracts: 0, identifier: null };
    })(),

    // 4. Gate.io Open Interest
    (async () => {
      const candidates = [`${base}_USDT`, `1000_${base}_USDT`];
      for (const c of candidates) {
        const res = await fetchWithTimeout(
          `https://api.gateio.ws/api/v4/futures/usdt/contracts/${c}`,
          3500
        );
        if (res?.position_size) {
          const contracts = Number(res.position_size || 0);
          const usd = contracts * currentPrice;
          return { name: "Gate.io Futures", oiUsd: usd, oiContracts: contracts, identifier: c };
        }
      }
      return { name: "Gate.io Futures", oiUsd: 0, oiContracts: 0, identifier: null };
    })(),

    // 5. Upbit Arbitrage (Kimchi Premium)
    (async () => {
      try {
        const [usdtRes, coinRes] = await Promise.all([
          fetchWithTimeout("https://api.upbit.com/v1/ticker?markets=KRW-USDT", 3000),
          fetchWithTimeout(`https://api.upbit.com/v1/ticker?markets=KRW-${base}`, 3000),
        ]);
        if (usdtRes?.[0]?.trade_price && coinRes?.[0]?.trade_price) {
          const usdtRate = Number(usdtRes[0].trade_price);
          const coinKrw = Number(coinRes[0].trade_price);
          const upbitUsd = coinKrw / usdtRate;
          const premiumPct = ((upbitUsd - currentPrice) / currentPrice) * 100;
          let signal: UpbitArbitrageData["signal"] = "NORMAL";
          if (premiumPct >= 3.5) signal = "EXTREME_RETAIL_FOMO";
          else if (premiumPct >= 1.2) signal = "MODERATE_PREMIUM";
          else if (premiumPct <= -2.0) signal = "PANIC_DISCOUNT";

          return {
            available: true,
            market: `KRW-${base}`,
            priceKrw: coinKrw,
            priceUsd: Number(upbitUsd.toFixed(4)),
            usdtKrwRate: usdtRate,
            kimchiPremiumPct: Number(premiumPct.toFixed(2)),
            signal,
          };
        }
      } catch {}
      return null;
    })(),

    // 6. Deribit Institutional Options (BTC, ETH, SOL)
    (async () => {
      if (!["BTC", "ETH", "SOL"].includes(base)) return null;
      try {
        const res = await fetchWithTimeout(
          `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${base}&kind=option`,
          4000
        );
        const options = res?.result;
        if (Array.isArray(options) && options.length > 0) {
          let callVol = 0;
          let putVol = 0;
          const strikes = new Map<number, { callsOi: number; putsOi: number }>();

          for (const o of options) {
            const parts = String(o.instrument_name || "").split("-");
            if (parts.length >= 4) {
              const strike = Number(parts[2]);
              const isCall = parts[3] === "C";
              const oi = Number(o.open_interest || 0);
              const vol = Number(o.volume || 0);

              if (isCall) callVol += vol;
              else putVol += vol;

              if (!isNaN(strike)) {
                if (!strikes.has(strike)) strikes.set(strike, { callsOi: 0, putsOi: 0 });
                const cur = strikes.get(strike)!;
                if (isCall) cur.callsOi += oi;
                else cur.putsOi += oi;
              }
            }
          }

          // Max Pain Strike Calculation
          const strikeKeys = Array.from(strikes.keys()).sort((a, b) => a - b);
          let minLoss = Infinity;
          let maxPainPrice = currentPrice;

          for (const s of strikeKeys) {
            let totalLoss = 0;
            for (const [otherStrike, data] of strikes.entries()) {
              if (s > otherStrike) totalLoss += (s - otherStrike) * data.callsOi;
              else if (s < otherStrike) totalLoss += (otherStrike - s) * data.putsOi;
            }
            if (totalLoss < minLoss) {
              minLoss = totalLoss;
              maxPainPrice = s;
            }
          }

          const putCallRatio = callVol > 0 ? Number((putVol / callVol).toFixed(2)) : 1.0;
          const maxPainDistPct = Number((((maxPainPrice - currentPrice) / currentPrice) * 100).toFixed(2));
          let sentiment: DeribitOptionsData["sentiment"] = "BALANCED";
          if (putCallRatio >= 1.15) sentiment = "BEARISH_PUT_HEDGING";
          else if (putCallRatio <= 0.75) sentiment = "BULLISH_CALL_DOMINANT";

          return {
            available: true,
            currency: base,
            putCallRatio,
            totalCallVolume: Number(callVol.toFixed(1)),
            totalPutVolume: Number(putVol.toFixed(1)),
            maxPainPrice,
            maxPainDistancePct: maxPainDistPct,
            sentiment,
          };
        }
      } catch {}
      return null;
    })(),
  ]);

  const binanceData: ExchangeOiData = {
    name: "Binance Futures",
    oiUsd: binanceOiUsd,
    oiContracts: currentPrice > 0 ? binanceOiUsd / currentPrice : 0,
    identifier: symbol,
    change24hPct: binanceOiChange24hPct,
  };

  const totalMonitoredOiUsd =
    binanceData.oiUsd +
    okxData.oiUsd +
    bybitData.oiUsd +
    bitgetData.oiUsd +
    gateData.oiUsd;

  // 7. Advanced Market Maker State Synthesis
  let mmState: MarketMakerFlowResult["marketMakerState"] = "NEUTRAL_CONSOLIDATION";
  let stateTitle = "Market Makers in Balanced Inventory";
  let stateDescription =
    "Neither aggressive dumping nor runaway accumulation is detected across major exchanges.";

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

  // Pattern 1: DUMP / DISTRIBUTION WARNING
  if (
    (retailLongShortRatio > 1.35 && whaleLongShortRatio < 0.95) ||
    (binanceOiChange24hPct <= -6 && askRatio >= 0.62) ||
    (upbitData?.signal === "EXTREME_RETAIL_FOMO" && whaleLongShortRatio < 1.0) ||
    (biggestAskWall && biggestAskWall.usd > 1_500_000 && biggestAskWall.usd > (biggestBidWall?.usd || 0) * 2.5)
  ) {
    mmState = "WHALE_DUMP_ALERT";
    stateTitle = "🚨 Market Maker Dump & Distribution Warning";
    stateDescription =
      "Market makers are offloading inventory into unsuspecting retail traders. Huge sell walls are capping upside while leverage is unwinding.";
    action = "SELL_SHORT";
    actionHeadline = "LOOK FOR SHORT (DO NOT BUY!)";
    actionBadgeColor = "rose";
    plainEnglishWhy =
      "Market makers and institutional whales are actively selling tokens while everyday retail traders are trapped trying to buy the dip. When whales sell into trapped buyers, prices usually drop sharply.";
    goldenRule = "Do NOT buy the dip when smart money is distributing. Look for short entries on minor relief bounces.";
    riskTier = "HIGH";
  }
  // Pattern 2: INSTITUTIONAL ACCUMULATION
  else if (
    (whaleLongShortRatio >= 1.3 && retailLongShortRatio <= 0.85) ||
    (binanceOiChange24hPct >= 4 && takerBuySellRatio >= 1.15 && bidRatio >= 0.58)
  ) {
    mmState = "INSTITUTIONAL_ACCUMULATION";
    stateTitle = "🟢 Smart Money & Market Maker Accumulation";
    stateDescription =
      "Institutional whales are quietly building long positions across Binance, OKX, and Bybit while retail traders are selling or staying cautious.";
    action = "BUY_LONG";
    actionHeadline = "BUY / LONG SETUP (FOLLOW THE WHALES)";
    actionBadgeColor = "emerald";
    plainEnglishWhy =
      "Top trader whale accounts are heavily skewed long, and big buy walls are supporting prices from falling. You are trading on the same side as the biggest market participants.";
    goldenRule = "Buy near the institutional bid walls and ride the momentum upward.";
    riskTier = "LOW";
  }
  // Pattern 3: SHORT SQUEEZE FUEL
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
  // Pattern 4: DERIBIT OPTIONS GRAVITY (If price is strongly deflected from Max Pain)
  else if (deribitData && Math.abs(deribitData.maxPainDistancePct) >= 5.0) {
    mmState = "OPTIONS_GRAVITY_PULL";
    stateTitle = `🎯 Institutional Options Max Pain Pull ($${deribitData.maxPainPrice.toLocaleString()})`;
    stateDescription = `Deribit option sellers have maximum incentive to pull market price toward $${deribitData.maxPainPrice.toLocaleString()} (${deribitData.maxPainDistancePct >= 0 ? "+" : ""}${deribitData.maxPainDistancePct}% away).`;
    action = deribitData.maxPainPrice > currentPrice ? "BUY_LONG" : "SELL_SHORT";
    actionHeadline = deribitData.maxPainPrice > currentPrice ? "LEAN LONG (MAX PAIN PULL)" : "LEAN SHORT (MAX PAIN PULL)";
    actionBadgeColor = "purple";
    plainEnglishWhy = `Institutional option market makers on Deribit make the highest profit if the price finishes close to the Max Pain Strike ($${deribitData.maxPainPrice.toLocaleString()}). Expect gravitational pull toward this strike.`;
    goldenRule = `Trade toward the Max Pain magnet level ($${deribitData.maxPainPrice.toLocaleString()}).`;
    riskTier = "LOW";
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

  const aiPromptDigest = `Comprehensive Institutional Market Maker Intelligence for ${symbol}:
- Current Price: $${currentPrice}
- Global Monitored Leverage: $${(totalMonitoredOiUsd / 1e6).toFixed(1)}M across 5 Tier-1 Exchanges:
  * Binance: $${(binanceData.oiUsd / 1e6).toFixed(1)}M (${binanceData.change24hPct >= 0 ? "+" : ""}${binanceData.change24hPct}%)
  * OKX: $${(okxData.oiUsd / 1e6).toFixed(1)}M
  * Bybit: $${(bybitData.oiUsd / 1e6).toFixed(1)}M
  * Bitget: $${(bitgetData.oiUsd / 1e6).toFixed(1)}M
  * Gate.io: $${(gateData.oiUsd / 1e6).toFixed(1)}M
${deribitData ? `- Deribit Options: Put/Call Ratio ${deribitData.putCallRatio}, Max Pain Strike $${deribitData.maxPainPrice} (${deribitData.maxPainDistancePct >= 0 ? "+" : ""}${deribitData.maxPainDistancePct}% from current)` : ""}
${upbitData ? `- Upbit Kimchi Premium: ${upbitData.kimchiPremiumPct}% ($${upbitData.priceUsd} vs Binance $${currentPrice})` : ""}
- Market Maker State: ${mmState} (${stateTitle})
- Whale vs Retail: Top Whales are ${whaleLongShortRatio}x Long, Global Retail is ${retailLongShortRatio}x Long
- Order Book Walls: Bids $${(bidDepthUsd / 1e3).toFixed(0)}k vs Asks $${(askDepthUsd / 1e3).toFixed(0)}k
- What is your strategic recommendation for this token?`;

  return {
    symbol,
    baseAsset,
    currentPrice,
    intelligence: {
      binance: binanceData,
      okx: okxData,
      bybit: bybitData,
      bitget: bitgetData,
      gate: gateData,
      totalMonitoredOiUsd: Number(totalMonitoredOiUsd.toFixed(0)),
      options: deribitData,
      upbit: upbitData,
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
      kimchiSignal: upbitData ? `${upbitData.kimchiPremiumPct}% (${upbitData.signal.replace(/_/g, " ")})` : "N/A",
      optionsSignal: deribitData ? `Max Pain $${deribitData.maxPainPrice} (P/C ${deribitData.putCallRatio})` : "N/A",
    },
    aiPromptDigest,
  };
}
