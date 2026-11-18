import { NextRequest, NextResponse } from "next/server";
import {
  getTrades,
  getDailyDosDontsLogs,
  getChecklistLogs,
  getExchangeConnections,
  getDashboardStats,
} from "@/lib/db";
import {
  computeLongShortStats,
  computeSessionStats,
  computeDayOfWeekStats,
  computeMistakeStats,
  evaluateMarketSentiment,
} from "@/lib/tradingMetrics";
import { BinanceClient, LiveOpenPosition } from "@/lib/exchanges";
import { callConfiguredLlm, getAgentOsConfig } from "@/lib/agentConfig";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CopilotRequestSchema = z.object({
  message: z.string().trim().min(1, "Ask a question first").max(2000),
  account_id: z.string().optional().default("ALL"),
  symbol: z.string().trim().max(20).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(12)
    .optional()
    .default([]),
});

const KNOWN_BASE_ALIASES = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "DOGE",
  "PEPE",
  "NEAR",
  "QNT",
  "ZEC",
  "BOME",
  "EVAA",
  "KITE",
  "VVV",
  "SUI",
  "ADA",
  "AVAX",
  "LINK",
  "ARB",
  "OP",
  "XAU",
  "XAG",
  "TRUMP",
];

function detectSymbolFromMessage(msg: string, explicitSym?: string, tradedSymbols: string[] = []): string | null {
  if (explicitSym && explicitSym.trim().length >= 3) {
    const clean = explicitSym.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return clean.endsWith("USDT") || clean.endsWith("USDC") ? clean : `${clean}USDT`;
  }
  const upper = msg.toUpperCase();
  // Match explicit USDT/USDC pair first
  const pairMatch = upper.match(/\b([A-Z0-9]{2,12}(?:USDT|USDC))\b/);
  if (pairMatch) return pairMatch[1];

  // Match user's own traded pairs by base
  for (const ts of tradedSymbols) {
    const base = ts.replace(/(USDT|USDC)$/, "");
    if (base.length >= 2 && new RegExp(`\\b${base}\\b`).test(upper)) {
      return ts;
    }
  }

  for (const alias of KNOWN_BASE_ALIASES) {
    if (new RegExp(`\\b${alias}\\b`).test(upper)) {
      return `${alias}USDT`;
    }
  }
  return null;
}

async function fetchQuickLiveSentiment(symbol: string) {
  try {
    const base = "https://fapi.binance.com";
    const fetchJ = async (url: string) => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 5000);
      try {
        const r = await fetch(url, { signal: c.signal, cache: "no-store" });
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    };

    const [ticker, premium, oiHist, whalePos, globalLs, takerLs, depth] = await Promise.all([
      fetchJ(`${base}/fapi/v1/ticker/24hr?symbol=${symbol}`),
      fetchJ(`${base}/fapi/v1/premiumIndex?symbol=${symbol}`),
      fetchJ(`${base}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=24`),
      fetchJ(`${base}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=1h&limit=2`),
      fetchJ(`${base}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=2`),
      fetchJ(`${base}/futures/data/takerlongshortRatio?symbol=${symbol}&period=1h&limit=2`),
      fetchJ(`${base}/fapi/v1/depth?symbol=${symbol}&limit=30`),
    ]);

    if (!ticker || ticker.code) return null;

    const lastPrice = Number(ticker.lastPrice || 0);
    const priceChange24hPct = Number(ticker.priceChangePercent || 0);
    const fundingRatePct = Number(premium?.lastFundingRate || 0) * 100;

    let oiChangePct = 0;
    let oiUsd = 0;
    if (Array.isArray(oiHist) && oiHist.length > 1) {
      oiUsd = Number(oiHist[oiHist.length - 1]?.sumOpenInterestValue || 0);
      const prev = Number(oiHist[0]?.sumOpenInterestValue || oiUsd);
      if (prev > 0) oiChangePct = Number((((oiUsd - prev) / prev) * 100).toFixed(2));
    }

    const whaleLS = Number(whalePos?.[whalePos.length - 1]?.longShortRatio || 1);
    const retailLS = Number(globalLs?.[globalLs.length - 1]?.longShortRatio || 1);
    const takerRatio = Number(takerLs?.[takerLs.length - 1]?.buySellRatio || 1);

    let bidUsd = 0;
    let askUsd = 0;
    if (depth?.bids && depth?.asks) {
      for (const [p, q] of depth.bids) bidUsd += Number(p) * Number(q);
      for (const [p, q] of depth.asks) askUsd += Number(p) * Number(q);
    }
    const bidPct = bidUsd + askUsd > 0 ? Number(((bidUsd / (bidUsd + askUsd)) * 100).toFixed(1)) : 50;

    const htfTrend: "BULLISH" | "NEUTRAL" | "BEARISH" =
      priceChange24hPct >= 1.2 ? "BULLISH" : priceChange24hPct <= -1.2 ? "BEARISH" : "NEUTRAL";

    const report = evaluateMarketSentiment({
      symbol,
      priceChange24hPct,
      oiChangePct,
      fundingRatePct,
      whaleLongShortRatio: whaleLS,
      retailLongShortRatio: retailLS,
      takerBuySellRatio: takerRatio,
      htfTrend,
      fearGreedIndex: 50,
      newsRisk: "CLEAR",
    });

    return {
      symbol,
      lastPrice,
      priceChange24hPct,
      oiUsd,
      oiChangePct,
      fundingRatePct,
      whaleLS,
      retailLS,
      takerRatio,
      bidPct,
      report,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, account_id, symbol: explicitSym, history } = CopilotRequestSchema.parse(body);
    const filterAcc = account_id && account_id !== "ALL" ? account_id : undefined;

    const [trades, stats, ddLogs, chkLogs, connections, agentCfg] = await Promise.all([
      getTrades(filterAcc ? { account_id: filterAcc } : undefined),
      getDashboardStats(filterAcc),
      getDailyDosDontsLogs(filterAcc),
      getChecklistLogs(filterAcc, 30),
      getExchangeConnections(),
      getAgentOsConfig(),
    ]);

    const tradedSymbols = Array.from(new Set(trades.map((t) => t.symbol.toUpperCase())));
    const targetSymbol = detectSymbolFromMessage(message, explicitSym, tradedSymbols);

    // Fetch live open positions + target symbol live Binance sentiment in parallel
    let openPositions: LiveOpenPosition[] = [];
    const activeBinance = connections.find((c) => c.is_active && c.exchange === "binance" && c.api_key && c.api_secret);

    const [liveSentiment, livePosSnap] = await Promise.all([
      targetSymbol ? fetchQuickLiveSentiment(targetSymbol) : Promise.resolve(null),
      activeBinance
        ? new BinanceClient(activeBinance.api_key, activeBinance.api_secret)
            .getFuturesOpenPositions()
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    if (livePosSnap?.positions) {
      openPositions = livePosSnap.positions;
    }

    // Compute deep behavioral & edge analytics from user's REAL data
    const longShort = computeLongShortStats(trades);
    const sessions = computeSessionStats(trades).filter((s) => s.trades > 0);
    const bestSession = [...sessions].sort((a, b) => b.netPnl - a.netPnl)[0] || null;
    const worstSession = [...sessions].filter((s) => s.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl)[0] || null;
    const weekdays = computeDayOfWeekStats(trades).filter((d) => d.trades > 0);
    const bestDay = [...weekdays].sort((a, b) => b.netPnl - a.netPnl)[0] || null;
    const worstDay = [...weekdays].filter((d) => d.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl)[0] || null;
    const mistakes = computeMistakeStats(trades).filter((m) => m.kind === "mistake");

    // Recent 14-day Do's & Don'ts rollup
    const cutoff14d = new Date(Date.now() - 14 * 86400_000).toISOString().split("T")[0];
    const recentDontCounts: Record<string, number> = {};
    const recentDoCounts: Record<string, number> = {};
    for (const log of ddLogs) {
      if (log.date < cutoff14d) continue;
      for (const item of log.items || []) {
        if (item.kind === "DONT") {
          recentDontCounts[item.label] = (recentDontCounts[item.label] || 0) + item.count;
        } else {
          recentDoCounts[item.label] = (recentDoCounts[item.label] || 0) + item.count;
        }
      }
    }
    const topRecentDonts = Object.entries(recentDontCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topRecentDos = Object.entries(recentDoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const avgChecklistScore =
      chkLogs.length > 0
        ? Math.round(chkLogs.reduce((s, l) => s + Number(l.score || 0), 0) / chkLogs.length)
        : null;

    // Context summary object passed to LLM AND returned to UI badges
    const contextSummary = {
      tradesAnalyzed: trades.length,
      netPnl: stats.net_pnl,
      winRate: stats.win_rate,
      profitFactor: stats.profit_factor,
      openPositionsCount: openPositions.length,
      detectedSymbol: targetSymbol,
      liveSentimentZone: liveSentiment?.report.zoneLabel || null,
      liveSentimentDirection: liveSentiment?.report.allowedDirection || null,
      dosDontsDaysLogged: ddLogs.length,
      checklistAvgScore: avgChecklistScore,
    };

    // Build structured data briefing for LLM
    const dataBrief = [
      `USER ACCOUNT PERFORMANCE (${trades.length} closed positions):`,
      `- Net P&L: $${stats.net_pnl.toFixed(2)} | Gross: $${stats.gross_pnl.toFixed(2)} | Fees: $${stats.total_fees.toFixed(2)} | Win Rate: ${stats.win_rate}% | Profit Factor: ${stats.profit_factor}`,
      `- Long Edge: ${longShort.long.trades} trades, ${longShort.long.winRate}% WR, $${longShort.long.netPnl} | Short Edge: ${longShort.short.trades} trades, ${longShort.short.winRate}% WR, $${longShort.short.netPnl}`,
      bestSession ? `- Best Session: ${bestSession.label} (${bestSession.utcWindow}) = $${bestSession.netPnl} (${bestSession.winRate}% WR)` : "",
      worstSession ? `- Weakest Session: ${worstSession.label} (${worstSession.utcWindow}) = $${worstSession.netPnl} (${worstSession.winRate}% WR)` : "",
      bestDay ? `- Best Weekday: ${bestDay.day} ($${bestDay.netPnl}, ${bestDay.winRate}% WR)` : "",
      worstDay ? `- Worst Weekday: ${worstDay.day} ($${worstDay.netPnl}, ${worstDay.winRate}% WR)` : "",
      `- Top Pairs: ${stats.pair_distribution.slice(0, 5).map((p) => `${p.symbol} ($${p.pnl}, ${p.win_rate}% WR)`).join(", ") || "None"}`,
      `- Tagged Trade Mistakes: ${mistakes.slice(0, 5).map((m) => `${m.tag}: $${m.netPnl} (${m.count}x)`).join(", ") || "None tagged yet"}`,
      `- Last 14d Daily Don'ts: ${topRecentDonts.map(([k, v]) => `${k} (${v}x)`).join(", ") || "None logged"}`,
      `- Last 14d Daily Do's: ${topRecentDos.map(([k, v]) => `${k} (${v}x)`).join(", ") || "None logged"}`,
      `- Avg Pre-Trade Checklist Discipline: ${avgChecklistScore !== null ? `${avgChecklistScore}%` : "Not logged yet"}`,
      `- Daily Loss Limit Guard: $${agentCfg.dailyLossLimitUsd}`,
      `LIVE OPEN POSITIONS (${openPositions.length}):`,
      openPositions.length > 0
        ? openPositions
            .map(
              (p) =>
                `- ${p.symbol} ${p.direction} ${p.leverage}x | Entry: ${p.entryPrice} | Mark: ${p.markPrice} | Liq: ${p.liquidationPrice} (${p.liquidationDistancePct ?? "?"}% away) | uPnL: $${p.unrealizedPnl} (${p.roePct}% ROE)`
            )
            .join("\n")
        : "- Currently flat (0 open Futures positions).",
      liveSentiment
        ? [
            `LIVE BINANCE FUTURES SENTIMENT FOR ${liveSentiment.symbol}:`,
            `- Price: $${liveSentiment.lastPrice} (24h: ${liveSentiment.priceChange24hPct >= 0 ? "+" : ""}${liveSentiment.priceChange24hPct}%)`,
            `- Open Interest: $${(liveSentiment.oiUsd / 1e6).toFixed(1)}M (24h OI Change: ${liveSentiment.oiChangePct >= 0 ? "+" : ""}${liveSentiment.oiChangePct}%)`,
            `- Funding Rate: ${liveSentiment.fundingRatePct.toFixed(4)}% | Whale L/S: ${liveSentiment.whaleLS} | Retail L/S: ${liveSentiment.retailLS} | Taker Buy/Sell: ${liveSentiment.takerRatio}x`,
            `- Order Book Bid Pressure: ${liveSentiment.bidPct}% Bids vs ${(100 - liveSentiment.bidPct).toFixed(1)}% Asks`,
            `- Sentiment Score: ${liveSentiment.report.score}/100 (${liveSentiment.report.zoneLabel}) -> STRICT DIRECTION: ${liveSentiment.report.allowedDirection}`,
            liveSentiment.report.squeezeWarning ? `- Squeeze Warning: ${liveSentiment.report.squeezeWarning}` : "",
          ].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `You are an elite, brutally honest AI Trading Coach & Risk Manager integrated inside the user's personal Trading Journal & Binance Agent OS dashboard.
Rules:
1. Always ground every claim in the REAL numbers provided below (never invent trades or fake metrics).
2. If the user asks whether to take a Long or Short on a coin, compare their requested direction directly against the Live Binance Futures Sentiment, Funding/Squeeze risk, their personal Long vs Short stats, their historical stats on that coin, and their recent mistakes/Do's & Don'ts. Give a decisive GO / CAUTION / SKIP verdict.
3. Keep replies crisp, structured in markdown with bold key numbers, bullet points, and a concrete Action Rule at the end.
4. Never promise guaranteed profits; always remind them to protect capital with a hard stop-loss and pass their Pre-Trade Checklist.

LIVE DATA CONTEXT:
${dataBrief}`;

    // Try external LLM first (Gemini / OpenAI / Anthropic / OpenRouter)
    const llmResult = await callConfiguredLlm(systemPrompt, message, history);
    if (llmResult) {
      return NextResponse.json({
        success: true,
        reply: llmResult.text,
        engine: llmResult.providerLabel,
        context: contextSummary,
        liveSentiment,
      });
    }

    // Built-in Quantitative Intelligence Coach Fallback (works 100% live without needing an external LLM key!)
    const replyParts: string[] = [];
    const lowerMsg = message.toLowerCase();
    const wantsLong = /\blong\b|\bbuy\b/.test(lowerMsg);
    const wantsShort = /\bshort\b|\bsell\b/.test(lowerMsg);

    if (liveSentiment) {
      const r = liveSentiment.report;
      const pairHistory = stats.pair_distribution.find((p) => p.symbol === liveSentiment.symbol);
      let verdict = "CAUTION — WAIT FOR CONFIRMATION";
      if (wantsLong) {
        verdict =
          r.allowedDirection === "LONG_ONLY"
            ? "✅ ALIGNED — LONG ALLOWED (Wait for pullback & pass Checklist)"
            : r.allowedDirection === "SHORT_ONLY"
            ? "🛑 SKIP THIS LONG — Counter-Sentiment (Market is SHORT ONLY)"
            : "⚠️ HOLD — Market is Neutral/Choppy (No clear edge for a Long)";
      } else if (wantsShort) {
        verdict =
          r.allowedDirection === "SHORT_ONLY"
            ? "✅ ALIGNED — SHORT ALLOWED (Wait for resistance retest & pass Checklist)"
            : r.allowedDirection === "LONG_ONLY"
            ? "🛑 SKIP THIS SHORT — Counter-Sentiment (Market is LONG ONLY)"
            : "⚠️ HOLD — Market is Neutral/Choppy (No clear edge for a Short)";
      } else {
        verdict = `🧭 ${r.directionHeadline} (Score: ${r.score > 0 ? "+" : ""}${r.score}/100)`;
      }

      replyParts.push(`### ${liveSentiment.symbol} Live Go / No-Go Verdict\n**${verdict}**`);
      replyParts.push(
        `**Live Binance Futures Readout:**\n` +
          `- **Price:** \`$${liveSentiment.lastPrice}\` (${liveSentiment.priceChange24hPct >= 0 ? "+" : ""}${liveSentiment.priceChange24hPct}% 24h)\n` +
          `- **Open Interest:** \`$${(liveSentiment.oiUsd / 1e6).toFixed(1)}M\` (${liveSentiment.oiChangePct >= 0 ? "+" : ""}${liveSentiment.oiChangePct}% 24h) | **Funding:** \`${liveSentiment.fundingRatePct.toFixed(4)}%\`\n` +
          `- **Whales vs Retail L/S:** Whales \`${liveSentiment.whaleLS}\` vs Retail \`${liveSentiment.retailLS}\` | **Taker Flow:** \`${liveSentiment.takerRatio}x\`\n` +
          `- **Order Book Pressure:** \`${liveSentiment.bidPct}%\` Bids vs \`${(100 - liveSentiment.bidPct).toFixed(1)}%\` Asks\n` +
          `- **Strict Rule:** ${r.strictRule}`
      );
      if (r.squeezeWarning) {
        replyParts.push(`> ⚠️ **Squeeze Alert:** ${r.squeezeWarning}`);
      }
      if (pairHistory) {
        replyParts.push(
          `**Your Personal History on ${liveSentiment.symbol}:** \`${pairHistory.count} trades\`, **${pairHistory.win_rate}% win rate**, net **${pairHistory.pnl >= 0 ? "+" : ""}$${pairHistory.pnl.toFixed(2)}**.`
        );
      }
    }

    if (openPositions.length > 0 && (lowerMsg.includes("open") || lowerMsg.includes("position") || lowerMsg.includes("risk") || !liveSentiment)) {
      const totalU = openPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
      replyParts.push(
        `### Live Open Positions (${openPositions.length})\n` +
          openPositions
            .map(
              (p) =>
                `- **${p.symbol} ${p.direction} (${p.leverage}x)**: Entry \`${p.entryPrice}\` → Mark \`${p.markPrice}\` | Unrealized: **${p.unrealizedPnl >= 0 ? "+" : ""}$${p.unrealizedPnl}** (${p.roePct}% ROE)${
                  p.liquidationDistancePct !== null ? ` | Liq distance: \`${p.liquidationDistancePct}%\`` : ""
                }`
            )
            .join("\n") +
          `\n- **Total Live Unrealized P&L:** **${totalU >= 0 ? "+" : ""}$${totalU.toFixed(2)}**`
      );
    }

    // Journal Edge & Behavioral Audit
    replyParts.push(
      `### Your Account Edge & Risk Profile (${trades.length} Closed Positions)\n` +
        `- **Net P&L:** **${stats.net_pnl >= 0 ? "+" : ""}$${stats.net_pnl.toFixed(2)}** | **Win Rate:** \`${stats.win_rate}%\` | **Profit Factor:** \`${stats.profit_factor}\` | **Total Fees:** \`$${stats.total_fees.toFixed(2)}\`\n` +
        `- **Long vs Short:** Longs \`${longShort.long.winRate}%\` WR (**$${longShort.long.netPnl}**) vs Shorts \`${longShort.short.winRate}%\` WR (**$${longShort.short.netPnl}**)\n` +
        (bestSession
          ? `- **Best Session:** **${bestSession.label}** (${bestSession.utcWindow}) → **+$${bestSession.netPnl}** (${bestSession.winRate}% WR)\n`
          : "") +
        (worstSession
          ? `- **Weakest Session:** **${worstSession.label}** (${worstSession.utcWindow}) → **$${worstSession.netPnl}** (${worstSession.winRate}% WR) — reduce size here!\n`
          : "") +
        (bestDay ? `- **Best Weekday:** ${bestDay.day} (**$${bestDay.netPnl}**)` : "") +
        (worstDay ? ` | **Worst Weekday:** ${worstDay.day} (**$${worstDay.netPnl}**)` : "")
    );

    if (mistakes.length > 0 || topRecentDonts.length > 0) {
      replyParts.push(
        `### Behavioral Leaks to Guard Against\n` +
          (mistakes.length > 0
            ? `- **Costliest Tagged Trade Mistakes:** ${mistakes
                .slice(0, 3)
                .map((m) => `**${m.tag}** (${m.count}x → \`$${m.netPnl}\`)`)
                .join(", ")}\n`
            : "") +
          (topRecentDonts.length > 0
            ? `- **Repeated Daily Don'ts (Last 14d):** ${topRecentDonts
                .slice(0, 3)
                .map(([lbl, cnt]) => `**${lbl}** (\`${cnt}x\`)`)
                .join(", ")}`
            : "")
      );
    }

    replyParts.push(
      `**Next Step:** Run the **Pre-Trade Checklist** (aim for ≥ ${agentCfg.requireChecklistScore}% + all required rules) before placing any order, and respect your **-$${agentCfg.dailyLossLimitUsd}** daily loss limit.`
    );

    return NextResponse.json({
      success: true,
      reply: replyParts.join("\n\n"),
      engine: "Built-in Quant Intelligence Engine (Add Gemini/OpenAI API key in Settings for full LLM chat)",
      context: contextSummary,
      liveSentiment,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error("[API agent/copilot POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
