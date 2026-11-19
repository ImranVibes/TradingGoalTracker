import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_INTERVALS = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const rawInterval = searchParams.get("interval") || "15m";
    const interval = ALLOWED_INTERVALS.has(rawInterval) ? rawInterval : "15m";
    const requestedMarket = searchParams.get("market"); // "futures" | "spot" | null
    const limit = Math.min(1000, Math.max(50, Number(searchParams.get("limit") || 1000)));

    if (!rawSymbol || rawSymbol.length < 3 || rawSymbol.length > 24) {
      return NextResponse.json({ success: false, error: "Invalid symbol" }, { status: 400 });
    }

    let market: "futures" | "spot" = requestedMarket === "spot" ? "spot" : "futures";
    let res: Response;

    if (market === "futures") {
      res = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${rawSymbol}&interval=${interval}&limit=${limit}`,
        { cache: "no-store" }
      );
      if (!res.ok && !requestedMarket) {
        // Fallback to Spot if not specified and Futures failed
        market = "spot";
        res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${rawSymbol}&interval=${interval}&limit=${limit}`,
          { cache: "no-store" }
        );
      }
    } else {
      res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${rawSymbol}&interval=${interval}&limit=${limit}`,
        { cache: "no-store" }
      );
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: res.statusText }));
      return NextResponse.json(
        { success: false, error: errData.msg || `Symbol ${rawSymbol} not found on Binance` },
        { status: 404 }
      );
    }

    const rawKlines: any[][] = await res.json();
    const candles = rawKlines.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000), // UNIX seconds for lightweight-charts
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    return NextResponse.json({
      success: true,
      symbol: rawSymbol,
      interval,
      market,
      candles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch Binance klines" },
      { status: 500 }
    );
  }
}
