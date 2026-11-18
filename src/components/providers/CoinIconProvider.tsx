"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const SESSION_CACHE_KEY = "tg_binance_icons_v1";
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CoinIconContextValue {
  icons: Record<string, string>;
  getAssetIcon: (assetCode: string) => string | null;
  loaded: boolean;
}

const CoinIconContext = createContext<CoinIconContextValue>({
  icons: {},
  getAssetIcon: () => null,
  loaded: false,
});

const KNOWN_QUOTES = [
  "USDT",
  "USDC",
  "FDUSD",
  "BUSD",
  "TUSD",
  "USDP",
  "USD",
  "BTC",
  "ETH",
  "BNB",
  "EUR",
  "GBP",
  "JPY",
  "TRY",
  "AUD",
  "CAD",
  "CHF",
  "NZD",
];

export function parsePairSymbol(rawSymbol: string): {
  base: string;
  lookupBase: string;
  quote: string | null;
} {
  const cleaned = (rawSymbol || "")
    .trim()
    .toUpperCase()
    .replace(/\.P$/i, "")
    .replace(/PERP$/i, "")
    .replace(/[-_]/g, "");

  if (!cleaned) return { base: "", lookupBase: "", quote: null };

  // Explicit slash format like BTC/USDT or EUR/USD
  if (cleaned.includes("/")) {
    const [rawBase, rawQuote] = cleaned.split("/");
    const lookupBase = stripFuturesMultiplier(rawBase);
    return { base: rawBase, lookupBase, quote: rawQuote || null };
  }

  // Known indices / single-ticker assets
  if (["NAS100", "US30", "SPX500", "US100", "NDX", "SPX", "DXY", "USOIL", "UKOIL", "WTI"].includes(cleaned)) {
    return { base: cleaned, lookupBase: cleaned, quote: null };
  }

  for (const quote of KNOWN_QUOTES) {
    if (cleaned.endsWith(quote) && cleaned.length > quote.length) {
      const base = cleaned.slice(0, cleaned.length - quote.length);
      return {
        base,
        lookupBase: stripFuturesMultiplier(base),
        quote,
      };
    }
  }

  return {
    base: cleaned,
    lookupBase: stripFuturesMultiplier(cleaned),
    quote: null,
  };
}

function stripFuturesMultiplier(base: string): string {
  // Handle Binance Futures contracts like 1000PEPE, 1000000MOG, 1MBABYDOGE
  const strippedNum = base.replace(/^(1000000|100000|10000|1000|1M)/, "");
  return strippedNum || base;
}

export const CoinIconProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    // 1. Check sessionStorage cache first for instant zero-flicker rendering
    try {
      const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.icons &&
          typeof parsed.fetchedAt === "number" &&
          Date.now() - parsed.fetchedAt < SESSION_TTL_MS &&
          Object.keys(parsed.icons).length > 50
        ) {
          setIcons(parsed.icons);
          setLoaded(true);
          return;
        }
      }
    } catch {}

    // 2. Fetch live Binance asset logo registry from our cached backend endpoint
    fetch("/api/binance/icons")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.success && data.icons && typeof data.icons === "object") {
          setIcons(data.icons);
          try {
            sessionStorage.setItem(
              SESSION_CACHE_KEY,
              JSON.stringify({ icons: data.icons, fetchedAt: Date.now() })
            );
          } catch {}
        }
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const getAssetIcon = useCallback(
    (assetCode: string): string | null => {
      const key = (assetCode || "").trim().toUpperCase();
      if (!key) return null;
      return icons[key] || null;
    },
    [icons]
  );

  return (
    <CoinIconContext.Provider value={{ icons, getAssetIcon, loaded }}>
      {children}
    </CoinIconContext.Provider>
  );
};

export function useCoinIcons() {
  return useContext(CoinIconContext);
}
