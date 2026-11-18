import { Trade } from "./types";

// -----------------------------------------------------------------------------
// MISTAKE & HABIT TAGS
// -----------------------------------------------------------------------------
export interface BehaviorTagDef {
  id: string;
  label: string;
  kind: "mistake" | "habit";
  description: string;
}

export const BEHAVIOR_TAGS: BehaviorTagDef[] = [
  // Mistakes
  { id: "FOMO", label: "FOMO", kind: "mistake", description: "Entered late out of fear of missing out" },
  { id: "Revenge Trade", label: "Revenge Trade", kind: "mistake", description: "Traded immediately after a loss to win it back" },
  { id: "Moved SL", label: "Moved SL", kind: "mistake", description: "Widened or removed stop loss against plan" },
  { id: "Overleveraged", label: "Overleveraged", kind: "mistake", description: "Position size exceeded max risk rule" },
  { id: "Early Exit", label: "Early Exit", kind: "mistake", description: "Closed winner too early before target" },
  { id: "Counter-Trend", label: "Counter-Trend", kind: "mistake", description: "Traded against higher-timeframe / sentiment bias" },
  { id: "No Stop Loss", label: "No Stop Loss", kind: "mistake", description: "Entered without a defined invalidation level" },
  { id: "Overtrading", label: "Overtrading", kind: "mistake", description: "Forced low-quality setups outside plan" },
  // Good Habits
  { id: "A+ Setup", label: "A+ Setup", kind: "habit", description: "High-conviction confluence aligned with bias" },
  { id: "Followed Plan", label: "Followed Plan", kind: "habit", description: "Executed entry, SL, and TP strictly as planned" },
  { id: "Patience Entry", label: "Patience Entry", kind: "habit", description: "Waited for confirmation / pullback level" },
  { id: "Proper Risk", label: "Proper Risk", kind: "habit", description: "Respected strict risk-per-trade sizing" },
];

export const MISTAKE_TAG_SET = new Set(
  BEHAVIOR_TAGS.filter((t) => t.kind === "mistake").map((t) => t.id.toLowerCase())
);
export const HABIT_TAG_SET = new Set(
  BEHAVIOR_TAGS.filter((t) => t.kind === "habit").map((t) => t.id.toLowerCase())
);

export function isHabitTag(tag: string): boolean {
  return HABIT_TAG_SET.has(tag.trim().toLowerCase());
}

// -----------------------------------------------------------------------------
// DEFAULT PRE-TRADE CHECKLIST ITEMS
// -----------------------------------------------------------------------------
export const DEFAULT_CHECKLIST_SEED = [
  {
    id: "chk_htf_pa",
    title: "Higher-Timeframe Price Action & Key S/R Checked (4H / 1D)",
    category: "Price Action",
    description: "Verify market structure, trend direction, and nearby supply/demand or liquidity zones.",
    is_critical: true,
    sort_order: 1,
    enabled: true,
  },
  {
    id: "chk_sentiment",
    title: "Market Sentiment & Direction Detector Aligned",
    category: "Sentiment",
    description: "Only trade in the direction allowed by your Sentiment Detector — skip opposite-direction setups.",
    is_critical: true,
    sort_order: 2,
    enabled: true,
  },
  {
    id: "chk_oi",
    title: "Open Interest (OI) & Volume Confirming Move",
    category: "Derivatives",
    description: "Check whether OI is expanding with the trend (real conviction) vs dropping (weak short-covering).",
    is_critical: false,
    sort_order: 3,
    enabled: true,
  },
  {
    id: "chk_funding",
    title: "Funding Rate Checked (Not Overcrowded / Squeeze Risk)",
    category: "Derivatives",
    description: "Avoid chasing longs when funding is > +0.05% or shorting when funding is < -0.04%.",
    is_critical: false,
    sort_order: 4,
    enabled: true,
  },
  {
    id: "chk_whales",
    title: "Whales / Top Trader Long-Short Ratio vs Retail Checked",
    category: "Smart Money",
    description: "Ensure you are aligned with smart money positioning and not trapped with overcrowded retail.",
    is_critical: false,
    sort_order: 5,
    enabled: true,
  },
  {
    id: "chk_news",
    title: "Macro News / Economic Events Checked (CPI, FOMC, Token Unlocks)",
    category: "Macro & News",
    description: "Confirm no high-impact red-folder news is dropping in the next 30–60 minutes.",
    is_critical: false,
    sort_order: 6,
    enabled: true,
  },
  {
    id: "chk_risk",
    title: "Hard Stop-Loss, Take-Profit & Risk ≤ 1–2% Defined",
    category: "Risk Management",
    description: "Know your exact invalidation price, R:R ≥ 1:1.5, and position size before clicking enter.",
    is_critical: true,
    sort_order: 7,
    enabled: true,
  },
  {
    id: "chk_mindset",
    title: "Calm Emotional State (Zero FOMO / Zero Revenge Trading)",
    category: "Psychology",
    description: "Accept the stop-loss amount mentally before entering; walk away if tilted.",
    is_critical: true,
    sort_order: 8,
    enabled: true,
  },
];

// -----------------------------------------------------------------------------
// TRADING SESSIONS & DAY-OF-WEEK ANALYTICS
// -----------------------------------------------------------------------------
export type TradingSessionId = "ASIA" | "LONDON" | "OVERLAP" | "NEW_YORK" | "LATE_NY";

export interface SessionMeta {
  id: TradingSessionId;
  label: string;
  utcWindow: string;
  shortWindow: string;
}

export const TRADING_SESSIONS: SessionMeta[] = [
  { id: "ASIA", label: "Asia Session", utcWindow: "00:00 – 07:59 UTC", shortWindow: "00–08 UTC" },
  { id: "LONDON", label: "London Open", utcWindow: "08:00 – 12:59 UTC", shortWindow: "08–13 UTC" },
  { id: "OVERLAP", label: "London / NY Overlap", utcWindow: "13:00 – 16:59 UTC", shortWindow: "13–17 UTC" },
  { id: "NEW_YORK", label: "New York Session", utcWindow: "17:00 – 21:59 UTC", shortWindow: "17–22 UTC" },
  { id: "LATE_NY", label: "Late NY / Rollover", utcWindow: "22:00 – 23:59 UTC", shortWindow: "22–24 UTC" },
];

export function detectTradingSession(isoDate?: string | null, manualSession?: string): TradingSessionId {
  if (manualSession) {
    const up = manualSession.trim().toUpperCase();
    if (up.includes("OVERLAP")) return "OVERLAP";
    if (up.includes("ASIA") || up.includes("TOKYO") || up.includes("SYDNEY")) return "ASIA";
    if (up.includes("LONDON")) return "LONDON";
    if (up.includes("LATE")) return "LATE_NY";
    if (up.includes("NEW YORK") || up.includes("NY")) return "NEW_YORK";
  }
  const d = isoDate ? new Date(isoDate) : null;
  if (!d || isNaN(d.getTime())) return "ASIA";
  const h = d.getUTCHours();
  if (h >= 0 && h < 8) return "ASIA";
  if (h >= 8 && h < 13) return "LONDON";
  if (h >= 13 && h < 17) return "OVERLAP";
  if (h >= 17 && h < 22) return "NEW_YORK";
  return "LATE_NY";
}

export interface DirectionMetrics {
  direction: "LONG" | "SHORT";
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
  totalFees: number;
}

export function computeLongShortStats(trades: Trade[]): { long: DirectionMetrics; short: DirectionMetrics } {
  const build = (dir: "LONG" | "SHORT"): DirectionMetrics => {
    const subset = trades.filter((t) => (t.direction || "LONG").toUpperCase() === dir);
    let wins = 0;
    let losses = 0;
    let breakeven = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let bestTrade = 0;
    let worstTrade = 0;
    let totalFees = 0;

    for (const t of subset) {
      const pnl = Number(t.pnl || 0);
      totalFees += Math.abs(Number(t.trading_fee || 0)) - Number(t.funding_fee || 0);
      if (t.status === "WON" || pnl > 0) {
        wins++;
        grossProfit += pnl;
        if (pnl > bestTrade) bestTrade = pnl;
      } else if (t.status === "LOST" || pnl < 0) {
        losses++;
        grossLoss += Math.abs(pnl);
        if (Math.abs(pnl) > worstTrade) worstTrade = Math.abs(pnl);
      } else if (t.status === "BREAKEVEN") {
        breakeven++;
      }
    }

    const total = subset.length;
    const closed = wins + losses + breakeven;
    const netPnl = Number((grossProfit - grossLoss).toFixed(2));
    const winRate = closed > 0 ? Number(((wins / closed) * 100).toFixed(1)) : 0;
    const profitFactor =
      grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;
    const avgWin = wins > 0 ? Number((grossProfit / wins).toFixed(2)) : 0;
    const avgLoss = losses > 0 ? Number((grossLoss / losses).toFixed(2)) : 0;
    const expectancy = total > 0 ? Number((netPnl / total).toFixed(2)) : 0;

    return {
      direction: dir,
      trades: total,
      wins,
      losses,
      breakeven,
      winRate,
      netPnl,
      grossProfit: Number(grossProfit.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      profitFactor,
      avgWin,
      avgLoss,
      expectancy,
      bestTrade: Number(bestTrade.toFixed(2)),
      worstTrade: Number(worstTrade.toFixed(2)),
      totalFees: Number(totalFees.toFixed(2)),
    };
  };

  return { long: build("LONG"), short: build("SHORT") };
}

export interface SessionPerformance {
  id: TradingSessionId;
  label: string;
  utcWindow: string;
  shortWindow: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
  profitFactor: number;
}

export function computeSessionStats(trades: Trade[]): SessionPerformance[] {
  const buckets: Record<
    TradingSessionId,
    { trades: number; wins: number; losses: number; profit: number; loss: number; net: number }
  > = {
    ASIA: { trades: 0, wins: 0, losses: 0, profit: 0, loss: 0, net: 0 },
    LONDON: { trades: 0, wins: 0, losses: 0, profit: 0, loss: 0, net: 0 },
    OVERLAP: { trades: 0, wins: 0, losses: 0, profit: 0, loss: 0, net: 0 },
    NEW_YORK: { trades: 0, wins: 0, losses: 0, profit: 0, loss: 0, net: 0 },
    LATE_NY: { trades: 0, wins: 0, losses: 0, profit: 0, loss: 0, net: 0 },
  };

  for (const t of trades) {
    // Use closed_date or trade_date (Binance synced positions store closing timestamp in trade_date)
    const sid = detectTradingSession(t.trade_date || t.closed_date, t.session);
    const b = buckets[sid];
    const pnl = Number(t.pnl || 0);
    b.trades++;
    b.net += pnl;
    if (t.status === "WON" || pnl > 0) {
      b.wins++;
      b.profit += pnl;
    } else if (t.status === "LOST" || pnl < 0) {
      b.losses++;
      b.loss += Math.abs(pnl);
    }
  }

  return TRADING_SESSIONS.map((meta) => {
    const b = buckets[meta.id];
    const decided = b.wins + b.losses;
    return {
      ...meta,
      trades: b.trades,
      wins: b.wins,
      losses: b.losses,
      winRate: decided > 0 ? Number(((b.wins / decided) * 100).toFixed(1)) : 0,
      netPnl: Number(b.net.toFixed(2)),
      avgPnl: b.trades > 0 ? Number((b.net / b.trades).toFixed(2)) : 0,
      profitFactor:
        b.loss > 0 ? Number((b.profit / b.loss).toFixed(2)) : b.profit > 0 ? 99.9 : 0,
    };
  });
}

export interface DayOfWeekPerformance {
  dayIndex: number; // 0=Mon .. 6=Sun
  day: string;
  shortDay: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
}

const WEEKDAYS_MON_FIRST = [
  { jsDay: 1, day: "Monday", shortDay: "Mon" },
  { jsDay: 2, day: "Tuesday", shortDay: "Tue" },
  { jsDay: 3, day: "Wednesday", shortDay: "Wed" },
  { jsDay: 4, day: "Thursday", shortDay: "Thu" },
  { jsDay: 5, day: "Friday", shortDay: "Fri" },
  { jsDay: 6, day: "Saturday", shortDay: "Sat" },
  { jsDay: 0, day: "Sunday", shortDay: "Sun" },
];

export function computeDayOfWeekStats(trades: Trade[]): DayOfWeekPerformance[] {
  const byJsDay: Record<number, { trades: number; wins: number; losses: number; net: number }> = {
    0: { trades: 0, wins: 0, losses: 0, net: 0 },
    1: { trades: 0, wins: 0, losses: 0, net: 0 },
    2: { trades: 0, wins: 0, losses: 0, net: 0 },
    3: { trades: 0, wins: 0, losses: 0, net: 0 },
    4: { trades: 0, wins: 0, losses: 0, net: 0 },
    5: { trades: 0, wins: 0, losses: 0, net: 0 },
    6: { trades: 0, wins: 0, losses: 0, net: 0 },
  };

  for (const t of trades) {
    const d = new Date(t.trade_date);
    if (isNaN(d.getTime())) continue;
    const b = byJsDay[d.getUTCDay()];
    const pnl = Number(t.pnl || 0);
    b.trades++;
    b.net += pnl;
    if (t.status === "WON" || pnl > 0) b.wins++;
    else if (t.status === "LOST" || pnl < 0) b.losses++;
  }

  return WEEKDAYS_MON_FIRST.map((w, idx) => {
    const b = byJsDay[w.jsDay];
    const decided = b.wins + b.losses;
    return {
      dayIndex: idx,
      day: w.day,
      shortDay: w.shortDay,
      trades: b.trades,
      wins: b.wins,
      losses: b.losses,
      winRate: decided > 0 ? Number(((b.wins / decided) * 100).toFixed(1)) : 0,
      netPnl: Number(b.net.toFixed(2)),
      avgPnl: b.trades > 0 ? Number((b.net / b.trades).toFixed(2)) : 0,
    };
  });
}

export interface MistakeCostRow {
  tag: string;
  kind: "mistake" | "habit";
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  totalLossImpact: number;
}

export function computeMistakeStats(trades: Trade[]): MistakeCostRow[] {
  const map: Record<
    string,
    { count: number; wins: number; losses: number; net: number; lossImpact: number }
  > = {};

  for (const t of trades) {
    const tags = Array.isArray(t.mistake_tags) ? t.mistake_tags : [];
    const pnl = Number(t.pnl || 0);
    for (const raw of tags) {
      const tag = raw.trim();
      if (!tag) continue;
      if (!map[tag]) {
        map[tag] = { count: 0, wins: 0, losses: 0, net: 0, lossImpact: 0 };
      }
      map[tag].count++;
      map[tag].net += pnl;
      if (pnl > 0) map[tag].wins++;
      else if (pnl < 0) {
        map[tag].losses++;
        map[tag].lossImpact += Math.abs(pnl);
      }
    }
  }

  return Object.entries(map)
    .map(([tag, d]) => ({
      tag,
      kind: isHabitTag(tag) ? ("habit" as const) : ("mistake" as const),
      count: d.count,
      wins: d.wins,
      losses: d.losses,
      winRate: d.count > 0 ? Number(((d.wins / d.count) * 100).toFixed(1)) : 0,
      netPnl: Number(d.net.toFixed(2)),
      totalLossImpact: Number(d.lossImpact.toFixed(2)),
    }))
    .sort((a, b) => a.netPnl - b.netPnl);
}

// -----------------------------------------------------------------------------
// MARKET SENTIMENT & DIRECTION DETECTOR ENGINE (-100 to +100)
// -----------------------------------------------------------------------------
export interface SentimentInput {
  symbol: string;
  priceChange24hPct: number; // e.g., +3.4 or -2.1
  oiChangePct: number; // 4h/24h Open Interest % change
  fundingRatePct: number; // e.g., 0.01 means 0.01% (standard Binance 8h rate)
  whaleLongShortRatio: number; // Top Trader Position L/S Ratio (e.g., 1.35)
  retailLongShortRatio: number; // Global Account L/S Ratio (e.g., 0.88)
  takerBuySellRatio: number; // Taker Buy/Sell Volume Ratio (e.g., 1.15)
  htfTrend: "BULLISH" | "NEUTRAL" | "BEARISH"; // 4H/1D Price Action vs EMA50/200
  fearGreedIndex: number; // 0 (Extreme Fear) .. 100 (Extreme Greed)
  newsRisk: "CLEAR" | "BULLISH_CATALYST" | "BEARISH_CATALYST" | "HIGH_VOLATILITY_WAIT";
}

export interface SentimentFactorResult {
  name: string;
  valueLabel: string;
  score: number; // -25..+25
  maxWeight: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL" | "WARNING";
  explanation: string;
}

export type SentimentZone =
  | "EXTREME_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BEARISH"
  | "EXTREME_BEARISH";

export interface SentimentReport {
  score: number; // -100 .. +100
  zone: SentimentZone;
  zoneLabel: string;
  allowedDirection: "LONG_ONLY" | "SHORT_ONLY" | "WAIT_NO_TRADE";
  directionHeadline: string;
  strictRule: string;
  squeezeWarning: string | null;
  confidencePct: number;
  factors: SentimentFactorResult[];
}

export function evaluateMarketSentiment(input: SentimentInput): SentimentReport {
  const factors: SentimentFactorResult[] = [];
  let totalScore = 0;
  let squeezeWarning: string | null = null;

  // 1. Price Action + Open Interest Matrix (Max ±25 pts) — Strongest Futures Signal
  let paOiScore = 0;
  let paOiSignal: SentimentFactorResult["signal"] = "NEUTRAL";
  let paOiExp = "Price and Open Interest are flat — no fresh capital entering.";

  const p = input.priceChange24hPct;
  const oi = input.oiChangePct;

  if (p >= 0.8 && oi >= 1.5) {
    paOiScore = Math.min(25, Math.round(14 + Math.min(6, p * 1.5) + Math.min(5, oi * 0.8)));
    paOiSignal = "BULLISH";
    paOiExp = "Price UP + OI UP: Fresh leveraged longs entering with real buying conviction.";
  } else if (p <= -0.8 && oi >= 1.5) {
    paOiScore = -Math.min(25, Math.round(14 + Math.min(6, Math.abs(p) * 1.5) + Math.min(5, oi * 0.8)));
    paOiSignal = "BEARISH";
    paOiExp = "Price DOWN + OI UP: Aggressive fresh shorts piling in with downward momentum.";
  } else if (p >= 0.8 && oi <= -1.5) {
    paOiScore = 6;
    paOiSignal = "WARNING";
    paOiExp = "Price UP + OI DOWN: Rally driven by short-covering, not fresh buyers — caution on chasing.";
  } else if (p <= -0.8 && oi <= -1.5) {
    paOiScore = -6;
    paOiSignal = "WARNING";
    paOiExp = "Price DOWN + OI DOWN: Long liquidations flushing out — selling pressure may be exhausting.";
  } else if (p > 0.4) {
    paOiScore = 8;
    paOiSignal = "BULLISH";
    paOiExp = "Price leaning higher with stable Open Interest.";
  } else if (p < -0.4) {
    paOiScore = -8;
    paOiSignal = "BEARISH";
    paOiExp = "Price leaning lower with stable Open Interest.";
  }

  totalScore += paOiScore;
  factors.push({
    name: "Price + Open Interest Matrix",
    valueLabel: `Price ${p >= 0 ? "+" : ""}${p.toFixed(2)}% | OI ${oi >= 0 ? "+" : ""}${oi.toFixed(2)}%`,
    score: paOiScore,
    maxWeight: 25,
    signal: paOiSignal,
    explanation: paOiExp,
  });

  // 2. Higher-Timeframe Trend Structure (4H / 1D EMA) (Max ±20 pts)
  let htfScore = 0;
  let htfSignal: SentimentFactorResult["signal"] = "NEUTRAL";
  let htfExp = "Higher-timeframe structure is ranging/choppy — lower directional conviction.";
  if (input.htfTrend === "BULLISH") {
    htfScore = 20;
    htfSignal = "BULLISH";
    htfExp = "4H/1D structure is bullish (above key moving averages) — favors buying pullbacks.";
  } else if (input.htfTrend === "BEARISH") {
    htfScore = -20;
    htfSignal = "BEARISH";
    htfExp = "4H/1D structure is bearish (below key moving averages) — favors shorting rallies.";
  }
  totalScore += htfScore;
  factors.push({
    name: "Higher-Timeframe Trend (4H)",
    valueLabel: input.htfTrend,
    score: htfScore,
    maxWeight: 20,
    signal: htfSignal,
    explanation: htfExp,
  });

  // 3. Whales (Top Traders) vs Retail Long/Short Divergence (Max ±20 pts)
  const w = input.whaleLongShortRatio || 1;
  const r = input.retailLongShortRatio || 1;
  let lsScore = 0;
  let lsSignal: SentimentFactorResult["signal"] = "NEUTRAL";
  let lsExp = "Whales and retail positioning are balanced.";

  if (w >= 1.15 && r <= 1.0) {
    lsScore = 20;
    lsSignal = "BULLISH";
    lsExp = "Smart-Money Divergence: Whales are net LONG while retail is shorting — strong bullish fuel.";
  } else if (w <= 0.88 && r >= 1.15) {
    lsScore = -20;
    lsSignal = "BEARISH";
    lsExp = "Smart-Money Divergence: Whales are net SHORT while retail is heavily long — trap risk for longs.";
  } else if (w >= 1.12) {
    lsScore = r > 1.8 ? 6 : 12;
    lsSignal = r > 1.8 ? "WARNING" : "BULLISH";
    lsExp =
      r > 1.8
        ? "Whales are long, but retail is extremely crowded long (>1.8) — wait for a dip sweep."
        : "Top traders/whales are positioned net long.";
  } else if (w <= 0.88) {
    lsScore = r < 0.65 ? -6 : -12;
    lsSignal = r < 0.65 ? "WARNING" : "BEARISH";
    lsExp =
      r < 0.65
        ? "Whales are short, but retail is crowded short (<0.65) — watch for a short squeeze."
        : "Top traders/whales are positioned net short.";
  } else if (r >= 1.75) {
    lsScore = -10;
    lsSignal = "BEARISH";
    lsExp = "Contrarian signal: Retail accounts are heavily overcrowded long — liquidity sits below.";
  } else if (r <= 0.65) {
    lsScore = 10;
    lsSignal = "BULLISH";
    lsExp = "Contrarian signal: Retail accounts are overcrowded short — squeeze liquidity sits above.";
  }

  totalScore += lsScore;
  factors.push({
    name: "Whales vs. Retail L/S Ratio",
    valueLabel: `Whales ${w.toFixed(2)} | Retail ${r.toFixed(2)}`,
    score: lsScore,
    maxWeight: 20,
    signal: lsSignal,
    explanation: lsExp,
  });

  // 4. Taker Buy / Sell Volume Ratio (Aggressive Order Flow) (Max ±15 pts)
  const taker = input.takerBuySellRatio || 1;
  let takerScore = 0;
  let takerSignal: SentimentFactorResult["signal"] = "NEUTRAL";
  let takerExp = "Market buys and market sells are roughly balanced.";
  if (taker >= 1.12) {
    takerScore = 15;
    takerSignal = "BULLISH";
    takerExp = "Aggressive market buyers lifting offers strongly.";
  } else if (taker >= 1.04) {
    takerScore = 8;
    takerSignal = "BULLISH";
    takerExp = "Mild aggressive buying flow on futures orderbook.";
  } else if (taker <= 0.88) {
    takerScore = -15;
    takerSignal = "BEARISH";
    takerExp = "Aggressive market sellers hitting bids heavily.";
  } else if (taker <= 0.96) {
    takerScore = -8;
    takerSignal = "BEARISH";
    takerExp = "Mild aggressive selling pressure on futures orderbook.";
  }
  totalScore += takerScore;
  factors.push({
    name: "Taker Buy / Sell Volume Flow",
    valueLabel: `${taker.toFixed(2)}x`,
    score: takerScore,
    maxWeight: 15,
    signal: takerSignal,
    explanation: takerExp,
  });

  // 5. Funding Rate (Healthy Trend vs Crowded Squeeze Detector) (Max ±12 pts)
  const fr = input.fundingRatePct; // in %, e.g. 0.01 = 0.01%
  let frScore = 0;
  let frSignal: SentimentFactorResult["signal"] = "NEUTRAL";
  let frExp = "Neutral baseline funding (~0.01%). No leverage crowding.";
  if (fr >= 0.05) {
    frScore = -8; // Overheated longs = contrarian caution!
    frSignal = "WARNING";
    frExp = "EXTREME positive funding (≥ +0.05%): Longs are overcrowded and paying heavy fees — high long-squeeze risk!";
    squeezeWarning = "Overcrowded Longs (Funding ≥ +0.05%): Never chase green candles — wait for a liquidation flush / pullback.";
  } else if (fr <= -0.04) {
    frScore = 8; // Overheated shorts = squeeze fuel!
    frSignal = "WARNING";
    frExp = "EXTREME negative funding (≤ -0.04%): Shorts are overcrowded — sharp short-squeeze bounce risk!";
    squeezeWarning = "Overcrowded Shorts (Funding ≤ -0.04%): Do not chase breakdown shorts — watch for a violent short squeeze.";
  } else if (fr > 0.012) {
    frScore = 10;
    frSignal = "BULLISH";
    frExp = "Healthy positive funding: Buyers in control without dangerous overheating.";
  } else if (fr < -0.005) {
    frScore = -10;
    frSignal = "BEARISH";
    frExp = "Moderate negative funding: Bears leaning in without extreme squeeze levels yet.";
  }
  totalScore += frScore;
  factors.push({
    name: "Funding Rate & Squeeze Risk",
    valueLabel: `${fr >= 0 ? "+" : ""}${fr.toFixed(4)}%`,
    score: frScore,
    maxWeight: 12,
    signal: frSignal,
    explanation: frExp,
  });

  // 6. Fear & Greed + Macro News Filter (Max ±8 pts)
  const fg = input.fearGreedIndex;
  let fgScore = 0;
  let fgSignal: SentimentFactorResult["signal"] = "NEUTRAL";
  let fgExp = `Market Fear & Greed at ${fg}/100 (Balanced psychology).`;
  if (fg >= 75) {
    fgScore = 4;
    fgSignal = "WARNING";
    fgExp = `Extreme Greed (${fg}/100): Strong uptrend momentum, but tighten stops against sudden profit-taking.`;
  } else if (fg >= 58) {
    fgScore = 6;
    fgSignal = "BULLISH";
    fgExp = `Greed (${fg}/100): Risk-on appetite supporting upward continuation.`;
  } else if (fg <= 25) {
    fgScore = -4;
    fgSignal = "WARNING";
    fgExp = `Extreme Fear (${fg}/100): Bearish panic, watch for capitulation bounces near support.`;
  } else if (fg <= 42) {
    fgScore = -6;
    fgSignal = "BEARISH";
    fgExp = `Fear (${fg}/100): Defensive risk-off environment favoring downside setups.`;
  }

  if (input.newsRisk === "BULLISH_CATALYST") {
    fgScore += 6;
    fgExp += " + Positive news catalyst.";
  } else if (input.newsRisk === "BEARISH_CATALYST") {
    fgScore -= 6;
    fgExp += " + Negative news catalyst.";
  } else if (input.newsRisk === "HIGH_VOLATILITY_WAIT") {
    fgSignal = "WARNING";
    fgExp = "HIGH-IMPACT MACRO EVENT (CPI/FOMC/News): Expect stop-hunt wicks in both directions — stand aside!";
  }

  totalScore += fgScore;
  factors.push({
    name: "Fear & Greed + Macro News",
    valueLabel: `${fg}/100 • ${input.newsRisk.replace(/_/g, " ")}`,
    score: fgScore,
    maxWeight: 8,
    signal: fgSignal,
    explanation: fgExp,
  });

  // Clamp final score to [-100, +100]
  const clampedScore = Math.max(-100, Math.min(100, Math.round(totalScore)));

  // Determine zone & strict directional rule
  let zone: SentimentZone = "NEUTRAL";
  let zoneLabel = "Neutral / Choppy";
  let allowedDirection: SentimentReport["allowedDirection"] = "WAIT_NO_TRADE";
  let directionHeadline = "NO DIRECTIONAL EDGE — STAY FLAT";
  let strictRule =
    "Signals are mixed or flat. Do NOT force a trade here — wait until price breaks structure and confluence aligns.";

  if (input.newsRisk === "HIGH_VOLATILITY_WAIT") {
    zone = "NEUTRAL";
    zoneLabel = "High-Impact News Pause";
    allowedDirection = "WAIT_NO_TRADE";
    directionHeadline = "HOLD — MACRO EVENT VOLATILITY";
    strictRule =
      "High-impact news event active. Wait 15–30 minutes after the release for liquidity sweeps to finish before entering.";
  } else if (clampedScore >= 60) {
    zone = "EXTREME_BULLISH";
    zoneLabel = "Too Bullish / Overheated";
    allowedDirection = "LONG_ONLY";
    directionHeadline = "LONG ONLY (WAIT FOR PULLBACK)";
    strictRule =
      "Market is VERY bullish. Do NOT short into strength, and do NOT FOMO-chase green candles — only take LONG entries on clean support pullbacks.";
  } else if (clampedScore >= 20) {
    zone = "BULLISH";
    zoneLabel = "Bullish Bias";
    allowedDirection = "LONG_ONLY";
    directionHeadline = "LOOK FOR LONGS ONLY";
    strictRule =
      "Bias is cleanly BULLISH. Only execute LONG setups. Even if a tempting short pattern appears, SKIP IT and protect your win rate.";
  } else if (clampedScore <= -60) {
    zone = "EXTREME_BEARISH";
    zoneLabel = "Too Bearish / Stretched";
    allowedDirection = "SHORT_ONLY";
    directionHeadline = "SHORT ONLY (WAIT FOR BOUNCE)";
    strictRule =
      "Market is VERY bearish. Do NOT catch falling knives with longs, and do NOT chase breakdown candles — only take SHORT entries on resistance retests.";
  } else if (clampedScore <= -20) {
    zone = "BEARISH";
    zoneLabel = "Bearish Bias";
    allowedDirection = "SHORT_ONLY";
    directionHeadline = "LOOK FOR SHORTS ONLY";
    strictRule =
      "Bias is cleanly BEARISH. Only execute SHORT setups. Even if a tempting long bounce appears, SKIP IT and trade with the institutional flow.";
  }

  // Agreement / confidence calculation
  const bullishVotes = factors.filter((f) => f.score > 0).length;
  const bearishVotes = factors.filter((f) => f.score < 0).length;
  const dominantVotes = Math.max(bullishVotes, bearishVotes);
  const confidencePct = Math.round((dominantVotes / factors.length) * 100);

  return {
    score: clampedScore,
    zone,
    zoneLabel,
    allowedDirection,
    directionHeadline,
    strictRule,
    squeezeWarning,
    confidencePct,
    factors,
  };
}
