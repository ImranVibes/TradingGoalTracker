export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number; // 20 SMA
  lower: number;
  bandwidthPct: number;
  percentB: number; // 0 = at lower band, 1 = at upper band
  isSqueeze: boolean;
}

export interface VolumeProfileResult {
  poc: number; // Point of Control (Highest volume price)
  vah: number; // Value Area High (70% boundary)
  val: number; // Value Area Low (70% boundary)
  totalVolume: number;
  profileBins: { price: number; volume: number; isPOC: boolean; inValueArea: boolean }[];
}

export interface SupportResistanceLevel {
  price: number;
  type: "SUPPORT" | "RESISTANCE";
  strength: "ULTRA_STRONG" | "STRONG" | "MODERATE";
  sources: string[]; // e.g., ["Bollinger Lower", "Volume Profile POC", "3x Swing Low"]
  touchCount: number;
  distancePct: number; // % from current price
}

export interface SuperTrendResult {
  value: number;
  direction: "BULLISH" | "BEARISH";
  signalChange: boolean;
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
  cross: "BULLISH_CROSS" | "BEARISH_CROSS" | "ABOVE_ZERO" | "BELOW_ZERO";
}

export interface TradeGptDebate {
  netEdge: "BULLISH" | "BEARISH" | "NEUTRAL";
  bullScore: number; // 0..100
  bearScore: number; // 0..100
  bullishArguments: { title: string; detail: string; indicator: string; weight: "HIGH" | "MEDIUM" }[];
  bearishArguments: { title: string; detail: string; indicator: string; weight: "HIGH" | "MEDIUM" }[];
  researchManagerVerdict: {
    bias: "STRONG_LONG" | "LEAN_LONG" | "NEUTRAL_WAIT" | "LEAN_SHORT" | "STRONG_SHORT";
    headline: string;
    actionPlan: string;
    optimalLongZone: string;
    optimalShortZone: string;
    keyPivotLevel: number;
    invalidationLevel: number;
  };
}

// Technical calculation utilities
export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  if (data.length < period) return result;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) result.push(NaN);
  result.push(ema);
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

export function calculateRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
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
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

export function calculateBollingerBands(
  closes: number[],
  period = 20,
  stdDevMult = 2
): BollingerBandsResult | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = mean + stdDevMult * stdDev;
  const lower = mean - stdDevMult * stdDev;
  const bandwidthPct = ((upper - lower) / mean) * 100;
  const currentPrice = closes[closes.length - 1];
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  return {
    upper: Number(upper.toFixed(4)),
    middle: Number(mean.toFixed(4)),
    lower: Number(lower.toFixed(4)),
    bandwidthPct: Number(bandwidthPct.toFixed(2)),
    percentB: Number(percentB.toFixed(3)),
    isSqueeze: bandwidthPct < 3.5, // tight band squeeze
  };
}

export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MacdResult | null {
  if (closes.length < slowPeriod + signalPeriod) return null;
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }

  const validMacd = macdLine.filter((v) => !isNaN(v));
  if (validMacd.length < signalPeriod) return null;
  const signalEMA = calculateEMA(validMacd, signalPeriod);

  const curMacd = validMacd[validMacd.length - 1];
  const prevMacd = validMacd[validMacd.length - 2];
  const curSignal = signalEMA[signalEMA.length - 1];
  const prevSignal = signalEMA[signalEMA.length - 2];
  const histogram = curMacd - curSignal;

  let cross: MacdResult["cross"] = curMacd >= 0 ? "ABOVE_ZERO" : "BELOW_ZERO";
  if (prevMacd < prevSignal && curMacd >= curSignal) cross = "BULLISH_CROSS";
  else if (prevMacd > prevSignal && curMacd <= curSignal) cross = "BEARISH_CROSS";

  return {
    macd: Number(curMacd.toFixed(4)),
    signal: Number(curSignal.toFixed(4)),
    histogram: Number(histogram.toFixed(4)),
    cross,
  };
}

export function calculateSuperTrend(
  candles: Candle[],
  period = 10,
  multiplier = 3
): SuperTrendResult | null {
  if (candles.length < period + 2) return null;

  // True Range
  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  // ATR
  const atr = calculateSMA(tr, period);

  let direction: "BULLISH" | "BEARISH" = "BULLISH";
  let superTrendValue = candles[0].close;

  for (let i = period; i < candles.length; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const curAtr = atr[i];
    const upperBasic = hl2 + multiplier * curAtr;
    const lowerBasic = hl2 - multiplier * curAtr;

    if (candles[i].close > superTrendValue) {
      direction = "BULLISH";
      superTrendValue = lowerBasic;
    } else {
      direction = "BEARISH";
      superTrendValue = upperBasic;
    }
  }

  return {
    value: Number(superTrendValue.toFixed(4)),
    direction,
    signalChange: false,
  };
}

// Volume Profile (Fixed Range over given candles)
export function calculateVolumeProfile(
  candles: Candle[],
  binsCount = 50,
  valueAreaPct = 0.7
): VolumeProfileResult {
  if (candles.length === 0) {
    return { poc: 0, vah: 0, val: 0, totalVolume: 0, profileBins: [] };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    totalVolume += c.volume;
  }

  const binStep = (maxPrice - minPrice) / binsCount;
  const bins = new Array(binsCount).fill(0).map((_, i) => ({
    price: minPrice + (i + 0.5) * binStep,
    volume: 0,
    isPOC: false,
    inValueArea: false,
  }));

  // Distribute candle volume across bins
  for (const c of candles) {
    const candleSpan = Math.max(0.00001, c.high - c.low);
    for (let i = 0; i < binsCount; i++) {
      const binBottom = minPrice + i * binStep;
      const binTop = binBottom + binStep;
      const overlap = Math.max(0, Math.min(c.high, binTop) - Math.max(c.low, binBottom));
      if (overlap > 0) {
        bins[i].volume += (overlap / candleSpan) * c.volume;
      }
    }
  }

  // Find POC
  let maxBinVol = 0;
  let pocIndex = 0;
  bins.forEach((b, i) => {
    if (b.volume > maxBinVol) {
      maxBinVol = b.volume;
      pocIndex = i;
    }
  });

  bins[pocIndex].isPOC = true;
  const poc = bins[pocIndex].price;

  // Value Area calculation (70% volume surrounding POC)
  const targetAreaVol = totalVolume * valueAreaPct;
  let currentAreaVol = maxBinVol;
  bins[pocIndex].inValueArea = true;

  let upperIdx = pocIndex;
  let lowerIdx = pocIndex;

  while (currentAreaVol < targetAreaVol && (upperIdx < binsCount - 1 || lowerIdx > 0)) {
    const upVol = upperIdx < binsCount - 1 ? bins[upperIdx + 1].volume : 0;
    const downVol = lowerIdx > 0 ? bins[lowerIdx - 1].volume : 0;

    if (upVol >= downVol && upperIdx < binsCount - 1) {
      upperIdx++;
      currentAreaVol += bins[upperIdx].volume;
      bins[upperIdx].inValueArea = true;
    } else if (lowerIdx > 0) {
      lowerIdx--;
      currentAreaVol += bins[lowerIdx].volume;
      bins[lowerIdx].inValueArea = true;
    } else if (upperIdx < binsCount - 1) {
      upperIdx++;
      currentAreaVol += bins[upperIdx].volume;
      bins[upperIdx].inValueArea = true;
    } else {
      break;
    }
  }

  const vah = bins[upperIdx].price;
  const val = bins[lowerIdx].price;

  return {
    poc: Number(poc.toFixed(4)),
    vah: Number(vah.toFixed(4)),
    val: Number(val.toFixed(4)),
    totalVolume: Number(totalVolume.toFixed(2)),
    profileBins: bins.map((b) => ({
      price: Number(b.price.toFixed(4)),
      volume: Number(b.volume.toFixed(2)),
      isPOC: b.isPOC,
      inValueArea: b.inValueArea,
    })),
  };
}

// Swing Highs & Lows Cluster Detection
export function calculateSwingClusters(
  candles: Candle[],
  currentPrice: number,
  tolerancePct = 0.007
): { supports: SupportResistanceLevel[]; resistances: SupportResistanceLevel[] } {
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    if (
      c.high > candles[i - 1].high &&
      c.high > candles[i - 2].high &&
      c.high > candles[i + 1].high &&
      c.high > candles[i + 2].high
    ) {
      swingHighs.push(c.high);
    }
    if (
      c.low < candles[i - 1].low &&
      c.low < candles[i - 2].low &&
      c.low < candles[i + 1].low &&
      c.low < candles[i + 2].low
    ) {
      swingLows.push(c.low);
    }
  }

  // Group into clusters
  const clusterLevels = (levels: number[], type: "SUPPORT" | "RESISTANCE"): SupportResistanceLevel[] => {
    const clusters: { priceSum: number; count: number; prices: number[] }[] = [];

    for (const lvl of levels) {
      let matched = false;
      for (const cl of clusters) {
        const avg = cl.priceSum / cl.count;
        if (Math.abs(lvl - avg) / avg <= tolerancePct) {
          cl.priceSum += lvl;
          cl.count += 1;
          cl.prices.push(lvl);
          matched = true;
          break;
        }
      }
      if (!matched) {
        clusters.push({ priceSum: lvl, count: 1, prices: [lvl] });
      }
    }

    return clusters
      .map((cl) => {
        const avgPrice = cl.priceSum / cl.count;
        const distPct = ((avgPrice - currentPrice) / currentPrice) * 100;
        const strength: SupportResistanceLevel["strength"] =
          cl.count >= 3 ? "ULTRA_STRONG" : cl.count === 2 ? "STRONG" : "MODERATE";

        return {
          price: Number(avgPrice.toFixed(4)),
          type,
          strength,
          sources: [`${cl.count}x Swing ${type === "SUPPORT" ? "Low" : "High"} Re-test`],
          touchCount: cl.count,
          distancePct: Number(distPct.toFixed(2)),
        };
      })
      .filter((l) => (type === "SUPPORT" ? l.price < currentPrice : l.price > currentPrice));
  };

  const supports = clusterLevels(swingLows, "SUPPORT").sort((a, b) => b.price - a.price); // nearest support first
  const resistances = clusterLevels(swingHighs, "RESISTANCE").sort((a, b) => a.price - b.price); // nearest resistance first

  return { supports, resistances };
}

// Full Confluence S/R Resolver
export function resolveConfluenceSR(params: {
  currentPrice: number;
  candles: Candle[];
  bollinger: BollingerBandsResult | null;
  volumeProfile: VolumeProfileResult;
  whaleBidWall?: { price: number; usd: number } | null;
  whaleAskWall?: { price: number; usd: number } | null;
}): {
  supportLadder: SupportResistanceLevel[];
  resistanceLadder: SupportResistanceLevel[];
  nearestSupport: SupportResistanceLevel | null;
  nearestResistance: SupportResistanceLevel | null;
  rangeLocation: string;
} {
  const { currentPrice, candles, bollinger, volumeProfile, whaleBidWall, whaleAskWall } = params;
  const { supports: swingSupports, resistances: swingResistances } = calculateSwingClusters(
    candles,
    currentPrice
  );

  const rawLevels: SupportResistanceLevel[] = [...swingSupports, ...swingResistances];

  // Add Bollinger levels
  if (bollinger) {
    if (bollinger.lower < currentPrice) {
      rawLevels.push({
        price: bollinger.lower,
        type: "SUPPORT",
        strength: "STRONG",
        sources: ["Bollinger Band Lower (20, 2)"],
        touchCount: 1,
        distancePct: Number((((bollinger.lower - currentPrice) / currentPrice) * 100).toFixed(2)),
      });
    }
    if (bollinger.upper > currentPrice) {
      rawLevels.push({
        price: bollinger.upper,
        type: "RESISTANCE",
        strength: "STRONG",
        sources: ["Bollinger Band Upper (20, 2)"],
        touchCount: 1,
        distancePct: Number((((bollinger.upper - currentPrice) / currentPrice) * 100).toFixed(2)),
      });
    }
    // Middle band as support or resistance
    if (bollinger.middle < currentPrice) {
      rawLevels.push({
        price: bollinger.middle,
        type: "SUPPORT",
        strength: "MODERATE",
        sources: ["20 SMA Mean Dynamic Support"],
        touchCount: 1,
        distancePct: Number((((bollinger.middle - currentPrice) / currentPrice) * 100).toFixed(2)),
      });
    } else {
      rawLevels.push({
        price: bollinger.middle,
        type: "RESISTANCE",
        strength: "MODERATE",
        sources: ["20 SMA Mean Dynamic Resistance"],
        touchCount: 1,
        distancePct: Number((((bollinger.middle - currentPrice) / currentPrice) * 100).toFixed(2)),
      });
    }
  }

  // Add Volume Profile levels
  if (volumeProfile.poc > 0) {
    const isPocSupport = volumeProfile.poc < currentPrice;
    rawLevels.push({
      price: volumeProfile.poc,
      type: isPocSupport ? "SUPPORT" : "RESISTANCE",
      strength: "ULTRA_STRONG",
      sources: ["Volume Profile POC (Point of Control)"],
      touchCount: 2,
      distancePct: Number((((volumeProfile.poc - currentPrice) / currentPrice) * 100).toFixed(2)),
    });
  }
  if (volumeProfile.vah > currentPrice) {
    rawLevels.push({
      price: volumeProfile.vah,
      type: "RESISTANCE",
      strength: "STRONG",
      sources: ["Volume Profile VAH (70% Volume Boundary)"],
      touchCount: 1,
      distancePct: Number((((volumeProfile.vah - currentPrice) / currentPrice) * 100).toFixed(2)),
    });
  }
  if (volumeProfile.val < currentPrice) {
    rawLevels.push({
      price: volumeProfile.val,
      type: "SUPPORT",
      strength: "STRONG",
      sources: ["Volume Profile VAL (70% Volume Boundary)"],
      touchCount: 1,
      distancePct: Number((((volumeProfile.val - currentPrice) / currentPrice) * 100).toFixed(2)),
    });
  }

  // Add Whale Walls
  if (whaleBidWall && whaleBidWall.price < currentPrice && whaleBidWall.usd > 100_000) {
    rawLevels.push({
      price: whaleBidWall.price,
      type: "SUPPORT",
      strength: "STRONG",
      sources: [`Live Order Book Whale Bid Wall ($${(whaleBidWall.usd / 1000).toFixed(0)}k)`],
      touchCount: 1,
      distancePct: Number((((whaleBidWall.price - currentPrice) / currentPrice) * 100).toFixed(2)),
    });
  }
  if (whaleAskWall && whaleAskWall.price > currentPrice && whaleAskWall.usd > 100_000) {
    rawLevels.push({
      price: whaleAskWall.price,
      type: "RESISTANCE",
      strength: "STRONG",
      sources: [`Live Order Book Whale Ask Wall ($${(whaleAskWall.usd / 1000).toFixed(0)}k)`],
      touchCount: 1,
      distancePct: Number((((whaleAskWall.price - currentPrice) / currentPrice) * 100).toFixed(2)),
    });
  }

  // Merge nearby levels within 0.6% into Confluence Zones
  const mergeConfluences = (levels: SupportResistanceLevel[], type: "SUPPORT" | "RESISTANCE") => {
    const merged: SupportResistanceLevel[] = [];

    levels
      .filter((l) => l.type === type)
      .sort((a, b) => (type === "SUPPORT" ? b.price - a.price : a.price - b.price))
      .forEach((lvl) => {
        let matched = false;
        for (const m of merged) {
          if (Math.abs(lvl.price - m.price) / m.price <= 0.007) {
            // Merge
            m.sources = Array.from(new Set([...m.sources, ...lvl.sources]));
            m.touchCount += lvl.touchCount;
            if (m.sources.length >= 3 || m.touchCount >= 4) {
              m.strength = "ULTRA_STRONG";
            } else if (m.sources.length >= 2 || m.touchCount >= 2) {
              m.strength = "STRONG";
            }
            matched = true;
            break;
          }
        }
        if (!matched) {
          merged.push({ ...lvl });
        }
      });

    return merged.slice(0, 4); // Top 4 levels
  };

  const supportLadder = mergeConfluences(rawLevels, "SUPPORT");
  const resistanceLadder = mergeConfluences(rawLevels, "RESISTANCE");

  const nearestSupport = supportLadder[0] || null;
  const nearestResistance = resistanceLadder[0] || null;

  let rangeLocation = "Consolidating Mid-Range";
  if (nearestSupport && nearestResistance) {
    const distToS = Math.abs(nearestSupport.distancePct);
    const distToR = Math.abs(nearestResistance.distancePct);
    if (distToS <= 0.8) {
      rangeLocation = `At Major Confluence Support (${nearestSupport.sources[0]})`;
    } else if (distToR <= 0.8) {
      rangeLocation = `At Major Confluence Resistance (${nearestResistance.sources[0]})`;
    } else if (distToS < distToR) {
      rangeLocation = "Lower Half of Range (Accumulation Zone)";
    } else {
      rangeLocation = "Upper Half of Range (Distribution Zone)";
    }
  }

  return {
    supportLadder,
    resistanceLadder,
    nearestSupport,
    nearestResistance,
    rangeLocation,
  };
}

// TradeGPT Bull vs Bear Debate Engine
export function generateTradeGptDebate(params: {
  symbol: string;
  currentPrice: number;
  candles4h: Candle[];
  candles1h: Candle[];
  ema20_4h: number | null;
  ema50_4h: number | null;
  ema200_4h: number | null;
  rsi14: number | null;
  macd: MacdResult | null;
  superTrend: SuperTrendResult | null;
  bollinger: BollingerBandsResult | null;
  volumeProfile: VolumeProfileResult;
  fundingRatePct: number;
  whaleLongShortRatio: number;
  retailLongShortRatio: number;
  takerBuySellRatio: number;
  oiChangePct: number;
  priceChange24hPct: number;
  whaleBidWall?: { price: number; usd: number } | null;
  whaleAskWall?: { price: number; usd: number } | null;
}): TradeGptDebate {
  const {
    symbol,
    currentPrice,
    ema20_4h,
    ema50_4h,
    ema200_4h,
    rsi14,
    macd,
    superTrend,
    bollinger,
    volumeProfile,
    fundingRatePct,
    whaleLongShortRatio,
    retailLongShortRatio,
    takerBuySellRatio,
    oiChangePct,
    priceChange24hPct,
    whaleBidWall,
    whaleAskWall,
  } = params;

  const bullishArgs: TradeGptDebate["bullishArguments"] = [];
  const bearishArgs: TradeGptDebate["bearishArguments"] = [];

  let bullPoints = 0;
  let bearPoints = 0;

  // 1. EMA Ordering & Alignment
  if (ema20_4h && ema50_4h) {
    if (currentPrice > ema20_4h && ema20_4h > ema50_4h) {
      bullPoints += 20;
      bullishArgs.push({
        title: "4H EMA Ordering Upward (Golden Alignment)",
        detail: `Price ($${currentPrice.toLocaleString()}) > 20 EMA ($${ema20_4h.toLocaleString()}) > 50 EMA ($${ema50_4h.toLocaleString()}) confirms short-term bullish trend structure.`,
        indicator: "EMA 20/50/200",
        weight: "HIGH",
      });
    } else if (currentPrice < ema20_4h && ema20_4h < ema50_4h) {
      bearPoints += 20;
      bearishArgs.push({
        title: "4H EMA Ordering Downward (Death Alignment)",
        detail: `Price ($${currentPrice.toLocaleString()}) < 20 EMA ($${ema20_4h.toLocaleString()}) < 50 EMA ($${ema50_4h.toLocaleString()}) confirms institutional downward trend pressure.`,
        indicator: "EMA 20/50/200",
        weight: "HIGH",
      });
    }
  }

  if (ema200_4h) {
    if (currentPrice > ema200_4h) {
      bullPoints += 15;
      bullishArgs.push({
        title: "Trading Above 4H 200 EMA Macro Baseline",
        detail: `Market is in macro bull territory above 200 EMA ($${ema200_4h.toLocaleString()}). Dips to 200 EMA are treated as institutional discount buying zones.`,
        indicator: "Macro 200 EMA",
        weight: "HIGH",
      });
    } else {
      bearPoints += 15;
      bearishArgs.push({
        title: "Trading Below 4H 200 EMA Macro Baseline",
        detail: `Price is rejected under the 200 EMA ($${ema200_4h.toLocaleString()}). Macro market trend is structurally defensive and rallies face heavy supply.`,
        indicator: "Macro 200 EMA",
        weight: "HIGH",
      });
    }
  }

  // 2. SuperTrend & MACD
  if (superTrend) {
    if (superTrend.direction === "BULLISH") {
      bullPoints += 15;
      bullishArgs.push({
        title: "SuperTrend 4H Is Green / Bullish",
        detail: `Dynamic trend stop at $${superTrend.value.toLocaleString()} provides trailing floor protection for long positions.`,
        indicator: "SuperTrend (10, 3)",
        weight: "HIGH",
      });
    } else {
      bearPoints += 15;
      bearishArgs.push({
        title: "SuperTrend 4H Is Red / Bearish",
        detail: `Dynamic trend ceiling at $${superTrend.value.toLocaleString()} overhead actively suppresses bullish breakout attempts.`,
        indicator: "SuperTrend (10, 3)",
        weight: "HIGH",
      });
    }
  }

  if (macd) {
    if (macd.cross === "BULLISH_CROSS" || (macd.macd > 0 && macd.histogram > 0)) {
      bullPoints += 12;
      bullishArgs.push({
        title: "MACD Momentum Expanding Bullish",
        detail: `MACD line (${macd.macd}) expanding above signal line (${macd.signal}) with positive histogram (${macd.histogram}).`,
        indicator: "MACD (12, 26, 9)",
        weight: "MEDIUM",
      });
    } else if (macd.cross === "BEARISH_CROSS" || (macd.macd < 0 && macd.histogram < 0)) {
      bearPoints += 12;
      bearishArgs.push({
        title: "MACD Below Zero / Bearish Expansion",
        detail: `MACD line (${macd.macd}) trailing below zero and signal line (${macd.signal}), favoring seller momentum.`,
        indicator: "MACD (12, 26, 9)",
        weight: "MEDIUM",
      });
    }
  }

  // 3. Bollinger Bands & Volatility Squeeze
  if (bollinger) {
    if (bollinger.percentB <= 0.2) {
      bullPoints += 12;
      bullishArgs.push({
        title: "Bollinger Band Lower Touch (%B ≤ 0.20)",
        detail: `Price is stretched at the lower band ($${bollinger.lower.toLocaleString()}). Historically high mean-reversion bounce probability toward 20 SMA ($${bollinger.middle.toLocaleString()}).`,
        indicator: "Bollinger Bands",
        weight: "MEDIUM",
      });
    } else if (bollinger.percentB >= 0.8) {
      bearPoints += 12;
      bearishArgs.push({
        title: "Bollinger Band Upper Rejection (%B ≥ 0.80)",
        detail: `Price is overbought against upper band ($${bollinger.upper.toLocaleString()}). Chasing longs here carries poor risk-to-reward.`,
        indicator: "Bollinger Bands",
        weight: "MEDIUM",
      });
    }

    if (bollinger.isSqueeze) {
      bearishArgs.push({
        title: "Bollinger Volatility Squeeze Coiled",
        detail: `Bandwidth is compressed at ${bollinger.bandwidthPct}%. A sharp 5%–10% expansion wick is imminent — protect positions with hard stops.`,
        indicator: "Volatility Squeeze",
        weight: "MEDIUM",
      });
    }
  }

  // 4. Volume Profile (POC & Value Area)
  if (volumeProfile.poc > 0) {
    if (currentPrice > volumeProfile.poc) {
      bullPoints += 15;
      bullishArgs.push({
        title: "Price Accepted Above Volume POC Support",
        detail: `Trading above Point of Control ($${volumeProfile.poc.toLocaleString()}). Institutional high-volume shelf serves as primary demand springboard.`,
        indicator: "Volume Profile POC",
        weight: "HIGH",
      });
    } else {
      bearPoints += 15;
      bearishArgs.push({
        title: "Price Trapped Under Volume POC Resistance",
        detail: `Heavy trading volume at Point of Control ($${volumeProfile.poc.toLocaleString()}) acts as major overhead supply resistance.`,
        indicator: "Volume Profile POC",
        weight: "HIGH",
      });
    }
  }

  // 5. Order Book Whale Walls & Institutional Ratios
  if (whaleLongShortRatio >= 1.25) {
    bullPoints += 15;
    bullishArgs.push({
      title: `Top Trader Whale Positioning Long (${whaleLongShortRatio}x)`,
      detail: `Institutional top accounts on Binance have heavily skewed long positions over shorts.`,
      indicator: "Whale L/S Ratio",
      weight: "HIGH",
    });
  } else if (whaleLongShortRatio <= 0.85) {
    bearPoints += 15;
    bearishArgs.push({
      title: `Top Trader Whale Positioning Short (${whaleLongShortRatio}x)`,
      detail: `Institutional accounts on Binance holding dominant short exposure compared to longs.`,
      indicator: "Whale L/S Ratio",
      weight: "HIGH",
    });
  }

  // Funding Rate Squeeze / Crowding
  if (fundingRatePct <= -0.01) {
    bullPoints += 14;
    bullishArgs.push({
      title: `Negative Funding Rate (${fundingRatePct.toFixed(4)}%)`,
      detail: `Shorts are paying longs to keep positions open. High short-squeeze fuel if price breaks immediate resistance.`,
      indicator: "Futures Funding Rate",
      weight: "HIGH",
    });
  } else if (fundingRatePct >= 0.03) {
    bearPoints += 14;
    bearishArgs.push({
      title: `Elevated Positive Funding (${fundingRatePct.toFixed(4)}%)`,
      detail: `Long leverage is crowded and paying high fees. Prime conditions for sudden long-liquidation cascade washouts.`,
      indicator: "Futures Funding Rate",
      weight: "HIGH",
    });
  }

  // Retail vs Smart Money Divergence
  if (retailLongShortRatio > 1.3 && whaleLongShortRatio < 1.0) {
    bearPoints += 15;
    bearishArgs.push({
      title: "Smart Money vs Retail Long Divergence (Bearish Trap)",
      detail: `Retail accounts are ${retailLongShortRatio}x long while Top Whales are net short. Retail long liquidation risk is elevated.`,
      indicator: "Flow Divergence",
      weight: "HIGH",
    });
  } else if (retailLongShortRatio < 0.8 && whaleLongShortRatio > 1.2) {
    bullPoints += 15;
    bullishArgs.push({
      title: "Smart Money vs Retail Short Divergence (Bullish Trap)",
      detail: `Whales are accumulating longs (${whaleLongShortRatio}x) while retail traders are selling shorts (${retailLongShortRatio}x).`,
      indicator: "Flow Divergence",
      weight: "HIGH",
    });
  }

  // Whale Wall confirmation
  if (whaleBidWall && whaleBidWall.usd >= 500_000) {
    bullPoints += 10;
    bullishArgs.push({
      title: `Order Book Whale Bid Wall at $${whaleBidWall.price.toLocaleString()}`,
      detail: `$${(whaleBidWall.usd / 1000).toFixed(0)}k bid support wall defending against downward price cascades.`,
      indicator: "Live Order Book Depth",
      weight: "MEDIUM",
    });
  }
  if (whaleAskWall && whaleAskWall.usd >= 500_000) {
    bearPoints += 10;
    bearishArgs.push({
      title: `Order Book Whale Ask Wall at $${whaleAskWall.price.toLocaleString()}`,
      detail: `$${(whaleAskWall.usd / 1000).toFixed(0)}k ask resistance wall blocking upward breakout spikes.`,
      indicator: "Live Order Book Depth",
      weight: "MEDIUM",
    });
  }

  // Normalize scores
  const totalRaw = bullPoints + bearPoints || 1;
  const bullScore = Math.min(100, Math.round((bullPoints / totalRaw) * 100));
  const bearScore = 100 - bullScore;

  let netEdge: TradeGptDebate["netEdge"] = "NEUTRAL";
  let bias: TradeGptDebate["researchManagerVerdict"]["bias"] = "NEUTRAL_WAIT";
  let headline = "";
  let actionPlan = "";

  const keyPivotLevel = bollinger?.middle || ema50_4h || currentPrice;
  const optimalLongZone = bollinger
    ? `$${bollinger.lower.toLocaleString()} – $${(volumeProfile.val || bollinger.lower * 1.01).toLocaleString()}`
    : `$${(currentPrice * 0.98).toFixed(2)}`;
  const optimalShortZone = bollinger
    ? `$${(volumeProfile.vah || bollinger.upper * 0.99).toLocaleString()} – $${bollinger.upper.toLocaleString()}`
    : `$${(currentPrice * 1.02).toFixed(2)}`;
  const invalidationLevel =
    bullScore > bearScore
      ? Number((currentPrice * 0.975).toFixed(2))
      : Number((currentPrice * 1.025).toFixed(2));

  if (bullScore >= 68) {
    netEdge = "BULLISH";
    bias = "STRONG_LONG";
    headline = "DOMINANT INSTITUTIONAL BULLISH EDGE (68%+ Conviction)";
    actionPlan = `Take LONG setups only. Look for entries around ${optimalLongZone} with invalidation stop placed strictly below $${invalidationLevel.toLocaleString()}. Shorts are strictly prohibited.`;
  } else if (bullScore >= 56) {
    netEdge = "BULLISH";
    bias = "LEAN_LONG";
    headline = "MODERATE BULLISH BIAS — BUY DIPS AT CONFLUENCE SUPPORT";
    actionPlan = `Edge leans Bullish. Avoid breakout chasing; wait for pullbacks into the 20 EMA or Value Area Low before opening longs. Invalidation: $${invalidationLevel.toLocaleString()}.`;
  } else if (bearScore >= 68) {
    netEdge = "BEARISH";
    bias = "STRONG_SHORT";
    headline = "DOMINANT INSTITUTIONAL BEARISH EDGE (68%+ Conviction)";
    actionPlan = `Take SHORT setups only. Sell into relief rallies near ${optimalShortZone} with stop-loss above $${invalidationLevel.toLocaleString()}. Do not catch falling knives with longs.`;
  } else if (bearScore >= 56) {
    netEdge = "BEARISH";
    bias = "LEAN_SHORT";
    headline = "MODERATE BEARISH BIAS — SELL RESISTANCE RE-TESTS";
    actionPlan = `Edge leans Bearish. Price action is suppressed by overhead EMA and Volume POC resistance. Wait for rejection at ${optimalShortZone} before entering shorts.`;
  } else {
    netEdge = "NEUTRAL";
    bias = "NEUTRAL_WAIT";
    headline = "NEUTRAL CHOP — BULL & BEAR CONFLUENCES ARE BALANCED";
    actionPlan = `No decisive directional edge currently. Bull and Bear arguments are evenly matched within the range. Wait for price to test either extreme (${optimalLongZone} or ${optimalShortZone}) before taking action.`;
  }

  return {
    netEdge,
    bullScore,
    bearScore,
    bullishArguments: bullishArgs,
    bearishArguments: bearishArgs,
    researchManagerVerdict: {
      bias,
      headline,
      actionPlan,
      optimalLongZone,
      optimalShortZone,
      keyPivotLevel: Number(keyPivotLevel.toFixed(4)),
      invalidationLevel,
    },
  };
}
