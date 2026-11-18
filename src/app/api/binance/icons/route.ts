import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface IconCache {
  icons: Record<string, string>;
  fetchedAt: number;
}

let serverCache: IconCache | null = null;

function isTrustedBinanceLogo(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) return false;
  return (
    url.startsWith("https://bin.bnbstatic.com/") ||
    url.startsWith("https://public.bnbstatic.com/")
  );
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TradingGoalTracker/1.0)",
        Accept: "application/json",
      },
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

async function loadBinanceIcons(): Promise<Record<string, string>> {
  const icons: Record<string, string> = {};

  // Fetch both official Binance public logo registries in parallel:
  // 1) Main Spot/Futures asset registry (~1,100+ coins)
  // 2) Binance Alpha / Web3 / Futures-only token registry (~680+ newer coins like EVAA, VVV, KITE)
  const [spotData, alphaData] = await Promise.all([
    fetchJsonWithTimeout("https://www.binance.com/bapi/asset/v2/public/asset/asset/get-all-asset"),
    fetchJsonWithTimeout(
      "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
    ),
  ]);

  // Populate Alpha first so main Spot/Exchange icons take precedence when both exist
  if (alphaData && Array.isArray(alphaData.data)) {
    for (const item of alphaData.data) {
      const sym = typeof item?.symbol === "string" ? item.symbol.trim().toUpperCase() : "";
      if (sym && isTrustedBinanceLogo(item?.iconUrl) && !icons[sym]) {
        icons[sym] = item.iconUrl;
      }
    }
  }

  if (spotData && Array.isArray(spotData.data)) {
    for (const item of spotData.data) {
      const code = typeof item?.assetCode === "string" ? item.assetCode.trim().toUpperCase() : "";
      if (code && isTrustedBinanceLogo(item?.logoUrl)) {
        icons[code] = item.logoUrl;
      }
    }
  }

  return icons;
}

export async function GET() {
  try {
    const now = Date.now();
    if (serverCache && now - serverCache.fetchedAt < CACHE_TTL_MS && Object.keys(serverCache.icons).length > 0) {
      return NextResponse.json(
        {
          success: true,
          cached: true,
          count: Object.keys(serverCache.icons).length,
          icons: serverCache.icons,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=43200",
          },
        }
      );
    }

    const icons = await loadBinanceIcons();
    if (Object.keys(icons).length > 0) {
      serverCache = { icons, fetchedAt: now };
    }

    const resultIcons = serverCache?.icons || icons;
    return NextResponse.json(
      {
        success: true,
        cached: false,
        count: Object.keys(resultIcons).length,
        icons: resultIcons,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=43200",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: true,
        cached: false,
        count: serverCache ? Object.keys(serverCache.icons).length : 0,
        icons: serverCache?.icons || {},
      },
      { status: 200 }
    );
  }
}
