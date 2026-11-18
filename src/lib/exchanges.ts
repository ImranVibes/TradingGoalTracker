import crypto from "crypto";
import { Trade, Cashflow } from "./types";

export interface LiveOpenPosition {
  symbol: string;
  direction: "LONG" | "SHORT";
  positionSide: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  liquidationDistancePct: number | null;
  leverage: number;
  marginType: string;
  unrealizedPnl: number;
  roePct: number;
  notionalUsd: number;
  isolatedMargin: number;
  connectionId?: string;
  connectionLabel?: string;
  accountId?: string;
}

export interface ExchangeSyncResult {
  success: boolean;
  exchange: string;
  importedTrades: number;
  skippedIgnored?: number;
  importedCashflows: number;
  liveBalance?: number;
  message: string;
  error?: string;
  trades?: Partial<Trade>[];
  cashflows?: Partial<Cashflow>[];
}

interface RawFundingItem {
  symbol: string;
  amount: number; // signed: negative = paid, positive = received
  time: number;
  used: boolean;
}

interface ActivePositionAccumulator {
  direction: "LONG" | "SHORT";
  posSide: string;
  openTime: number;
  lastTime: number;
  netQty: number;
  entryNotional: number;
  entryQty: number;
  exitNotional: number;
  exitQty: number;
  grossPnl: number;
  tradingFee: number;
  fillCount: number;
  lastOrderId: string;
  lastTradeId: string;
  hasOpenLeg: boolean;
}

const STABLE_ASSETS = new Set(["USDT", "USDC", "BUSD", "FDUSD", "USD", "TUSD", "USDP"]);

// -----------------------------------------------------------------------------
// BINANCE CLIENT (Consolidated Closed Positions + Trading & Funding Fees)
// -----------------------------------------------------------------------------
export class BinanceClient {
  private apiKey: string;
  private apiSecret: string;
  private futuresBase = "https://fapi.binance.com";
  private spotBase = "https://api.binance.com";

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
  }

  private sign(queryString: string): string {
    return crypto.createHmac("sha256", this.apiSecret).update(queryString).digest("hex");
  }

  private async fetchFuturesSigned(path: string, params: Record<string, string | number | undefined> = {}) {
    const queryParts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        queryParts.push(`${k}=${encodeURIComponent(String(v))}`);
      }
    }
    queryParts.push(`timestamp=${Date.now()}`);
    queryParts.push(`recvWindow=10000`);
    const query = queryParts.join("&");
    const signature = this.sign(query);

    const res = await fetch(`${this.futuresBase}${path}?${query}&signature=${signature}`, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ msg: res.statusText }));
      throw new Error(err.msg || err.message || `Binance HTTP ${res.status}`);
    }
    return res.json();
  }

  private async getBnbPriceUsd(): Promise<number> {
    try {
      const res = await fetch(`${this.futuresBase}/fapi/v1/ticker/price?symbol=BNBUSDT`);
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.price || "0");
        if (price > 0) return price;
      }
    } catch {
      // fallback
    }
    return 600;
  }

  private toUsdFee(amount: number, asset: string, bnbPrice: number): number {
    const abs = Math.abs(amount);
    if (abs === 0) return 0;
    const upper = (asset || "USDT").toUpperCase();
    if (STABLE_ASSETS.has(upper)) return abs;
    if (upper === "BNB") return abs * bnbPrice;
    return abs;
  }

  // Test API credentials
  async testConnection(): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
      const data = await this.fetchFuturesSigned("/fapi/v2/account");
      const totalMarginBalance = parseFloat(data.totalMarginBalance || data.totalWalletBalance || "0");
      return {
        success: true,
        message: `Connected to Binance Futures successfully! Wallet Equity: $${totalMarginBalance.toFixed(2)}`,
        balance: totalMarginBalance,
      };
    } catch (futErr: any) {
      try {
        const timestamp = Date.now();
        const query = `timestamp=${timestamp}&recvWindow=10000`;
        const signature = this.sign(query);
        const spotRes = await fetch(`${this.spotBase}/api/v3/account?${query}&signature=${signature}`, {
          headers: { "X-MBX-APIKEY": this.apiKey },
        });
        if (!spotRes.ok) {
          return { success: false, message: `Binance Error: ${futErr.message}` };
        }
        return { success: true, message: "Connected to Binance Spot Account successfully" };
      } catch (err: any) {
        return { success: false, message: `Network error connecting to Binance: ${err.message}` };
      }
    }
  }

  /**
   * Reconstruct consolidated CLOSED POSITIONS from Binance Futures userTrades + income (funding fees).
   * Combines all partial fills of a position into ONE single position record with:
   * - True direction (LONG/SHORT)
   * - Weighted average entry price & exit price
   * - Total quantity
   * - Gross P&L, Trading Fee, Funding Fee, and Net P&L
   */
  async getFuturesClosedPositions(sinceMs?: number): Promise<Partial<Trade>[]> {
    try {
      // 1. Fetch currently open positions so we never prematurely emit a still-open position
      const openPosMap = new Map<string, number>();
      try {
        const posRisks: any[] = await this.fetchFuturesSigned("/fapi/v2/positionRisk");
        for (const pr of posRisks) {
          const amt = Math.abs(parseFloat(pr.positionAmt || "0"));
          if (amt > 0) {
            const sym = String(pr.symbol).toUpperCase();
            const ps = String(pr.positionSide || "BOTH").toUpperCase();
            openPosMap.set(`${sym}_${ps}`, amt);
          }
        }
      } catch (e) {
        console.warn("[Binance] positionRisk check failed, continuing:", e);
      }

      // 2. Fetch income records (REALIZED_PNL, COMMISSION, FUNDING_FEE) to discover active symbols & funding fees
      const incomeParams: Record<string, string | number | undefined> = { limit: 1000 };
      if (sinceMs && sinceMs > 0) {
        // Look back 7 days before sinceMs to capture funding fees for positions opened earlier
        incomeParams.startTime = Math.max(0, sinceMs - 7 * 24 * 60 * 60 * 1000);
      }

      const incomeItems: any[] = await this.fetchFuturesSigned("/fapi/v1/income", incomeParams);

      const activeSymbols = new Set<string>();
      const fundingBySymbol = new Map<string, RawFundingItem[]>();
      let needsBnbPrice = false;

      for (const item of incomeItems) {
        const sym = String(item.symbol || "").toUpperCase();
        if (!sym) continue;
        const type = String(item.incomeType || "").toUpperCase();
        const asset = String(item.asset || "USDT").toUpperCase();
        if (asset === "BNB") needsBnbPrice = true;

        if (type === "REALIZED_PNL") {
          activeSymbols.add(sym);
        } else if (type === "FUNDING_FEE") {
          const arr = fundingBySymbol.get(sym) || [];
          arr.push({
            symbol: sym,
            amount: parseFloat(item.income || "0"),
            time: Number(item.time),
            used: false,
          });
          fundingBySymbol.set(sym, arr);
        }
      }

      if (activeSymbols.size === 0) {
        return [];
      }

      const bnbPrice = needsBnbPrice ? await this.getBnbPriceUsd() : 600;
      const symbolList = Array.from(activeSymbols);
      const positions: Partial<Trade>[] = [];

      // 3. Process symbols in batches of 5 to respect Binance rate limits
      for (let i = 0; i < symbolList.length; i += 5) {
        const batch = symbolList.slice(i, i + 5);
        const batchResults = await Promise.all(
          batch.map((sym) =>
            this.reconstructSymbolPositions(sym, fundingBySymbol.get(sym) || [], openPosMap, bnbPrice, sinceMs)
          )
        );
        for (const list of batchResults) {
          positions.push(...list);
        }
      }

      // Sort newest closed first
      positions.sort((a, b) => {
        const ta = new Date(a.trade_date || 0).getTime();
        const tb = new Date(b.trade_date || 0).getTime();
        return tb - ta;
      });

      return positions;
    } catch (err: any) {
      console.error("[Binance] Error reconstructing futures positions:", err);
      return [];
    }
  }

  private async reconstructSymbolPositions(
    symbol: string,
    fundingItems: RawFundingItem[],
    openPosMap: Map<string, number>,
    bnbPrice: number,
    sinceMs?: number
  ): Promise<Partial<Trade>[]> {
    let rawFills: any[] = [];
    try {
      rawFills = await this.fetchFuturesSigned("/fapi/v1/userTrades", {
        symbol,
        limit: 500,
      });
    } catch (err) {
      console.warn(`[Binance] Failed to fetch userTrades for ${symbol}:`, err);
      return [];
    }

    if (!Array.isArray(rawFills) || rawFills.length === 0) return [];

    // Sort chronologically ASC
    rawFills.sort((a, b) => Number(a.time) - Number(b.time) || Number(a.id) - Number(b.id));

    // Group by positionSide (BOTH in One-Way mode, LONG / SHORT in Hedge mode)
    const byPosSide = new Map<string, any[]>();
    for (const fill of rawFills) {
      const ps = String(fill.positionSide || "BOTH").toUpperCase();
      const arr = byPosSide.get(ps) || [];
      arr.push(fill);
      byPosSide.set(ps, arr);
    }

    const emitted: Partial<Trade>[] = [];

    const finalizePosition = (acc: ActivePositionAccumulator) => {
      // Only emit if we actually had closing fills / realized PnL
      if (acc.exitQty <= 0 && acc.grossPnl === 0) return;

      // Filter by incremental cutoff if provided
      if (sinceMs && acc.lastTime <= sinceMs) return;

      // Attach funding fees within [openTime - 60s, closeTime + 60s]
      let fundingSum = 0;
      const windowStart = acc.hasOpenLeg ? acc.openTime - 60_000 : acc.lastTime - 8 * 3600_000;
      const windowEnd = acc.lastTime + 60_000;
      for (const fi of fundingItems) {
        if (!fi.used && fi.time >= windowStart && fi.time <= windowEnd) {
          fundingSum += fi.amount;
          fi.used = true;
        }
      }

      const grossPnl = Number(acc.grossPnl.toFixed(4));
      const tradingFee = Number(Math.abs(acc.tradingFee).toFixed(4));
      const fundingFee = Number(fundingSum.toFixed(4));
      // Net PnL = Gross Realized PnL - Trading Fee + Funding Fee (fundingFee is negative if paid, positive if earned)
      const netPnl = Number((grossPnl - tradingFee + fundingFee).toFixed(4));

      const entryPrice = acc.entryQty > 0 ? Number((acc.entryNotional / acc.entryQty).toFixed(6)) : null;
      const exitPrice = acc.exitQty > 0 ? Number((acc.exitNotional / acc.exitQty).toFixed(6)) : null;
      const quantity = Number(Math.max(acc.exitQty, acc.entryQty).toFixed(6));

      const closeIso = new Date(acc.lastTime).toISOString();
      const posId = `binance_pos_${symbol}_${acc.posSide}_${acc.lastTime}`;

      const feeSummary = [
        `Gross: ${grossPnl >= 0 ? "+" : ""}$${grossPnl.toFixed(2)}`,
        `Trading Fee: -$${tradingFee.toFixed(2)}`,
        fundingFee !== 0 ? `Funding: ${fundingFee >= 0 ? "+" : ""}$${fundingFee.toFixed(2)}` : null,
        `Fills: ${acc.fillCount}`,
      ]
        .filter(Boolean)
        .join(" | ");

      emitted.push({
        symbol,
        market: "CRYPTO",
        direction: acc.direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity,
        gross_pnl: grossPnl,
        trading_fee: tradingFee,
        funding_fee: fundingFee,
        pnl: netPnl,
        status: netPnl > 0 ? "WON" : netPnl < 0 ? "LOST" : "BREAKEVEN",
        trade_date: closeIso,
        closed_date: closeIso,
        exchange: "BINANCE",
        exchange_trade_id: posId,
        strategy: "Exchange Auto-Sync",
        signal_provider: "Self",
        reason_entry: `Consolidated Binance Futures ${acc.direction} position (${acc.fillCount} fills).`,
        reason_outcome: feeSummary,
      });
    };

    for (const [posSide, fills] of Array.from(byPosSide.entries())) {
      let active: ActivePositionAccumulator | null = null;
      let orphanClose: ActivePositionAccumulator | null = null;

      for (const f of fills) {
        const qty = Math.abs(parseFloat(f.qty || "0"));
        const price = parseFloat(f.price || "0");
        const rpnl = parseFloat(f.realizedPnl || "0");
        const commUsd = this.toUsdFee(
          parseFloat(f.commission || "0"),
          String(f.commissionAsset || "USDT"),
          bnbPrice
        );
        const side = String(f.side || "BUY").toUpperCase();
        const time = Number(f.time);
        const orderId = String(f.orderId || "");
        const tradeId = String(f.id || "");

        if (qty <= 0) continue;

        // Determine whether this fill is opening or closing
        let isOpening = false;
        if (posSide === "LONG") {
          isOpening = side === "BUY";
        } else if (posSide === "SHORT") {
          isOpening = side === "SELL";
        } else {
          // One-Way Mode (BOTH)
          if (Math.abs(rpnl) > 1e-10) {
            isOpening = false;
          } else if (!active) {
            isOpening = true;
          } else {
            isOpening =
              (active.direction === "LONG" && side === "BUY") ||
              (active.direction === "SHORT" && side === "SELL");
          }
        }

        // Flush orphan closing cluster if a new opening or >5 min gap arrives
        if (orphanClose && (isOpening || time - orphanClose.lastTime > 5 * 60_000)) {
          finalizePosition(orphanClose);
          orphanClose = null;
        }

        if (isOpening) {
          const dir: "LONG" | "SHORT" =
            posSide === "LONG" ? "LONG" : posSide === "SHORT" ? "SHORT" : side === "BUY" ? "LONG" : "SHORT";

          if (!active) {
            active = {
              direction: dir,
              posSide,
              openTime: time,
              lastTime: time,
              netQty: qty,
              entryNotional: price * qty,
              entryQty: qty,
              exitNotional: 0,
              exitQty: 0,
              grossPnl: 0,
              tradingFee: commUsd,
              fillCount: 1,
              lastOrderId: orderId,
              lastTradeId: tradeId,
              hasOpenLeg: true,
            };
          } else {
            active.netQty += qty;
            active.entryNotional += price * qty;
            active.entryQty += qty;
            active.tradingFee += commUsd;
            active.fillCount += 1;
            active.lastTime = time;
            active.lastOrderId = orderId;
            active.lastTradeId = tradeId;
          }
        } else {
          // Closing fill
          if (!active) {
            // Opening fill was outside the 500-trade window -> cluster consecutive closing fills into 1 position
            const inferredDir: "LONG" | "SHORT" =
              posSide === "LONG" ? "LONG" : posSide === "SHORT" ? "SHORT" : side === "SELL" ? "LONG" : "SHORT";

            if (orphanClose && orphanClose.direction !== inferredDir) {
              finalizePosition(orphanClose);
              orphanClose = null;
            }

            if (!orphanClose) {
              orphanClose = {
                direction: inferredDir,
                posSide,
                openTime: time,
                lastTime: time,
                netQty: 0,
                entryNotional: 0,
                entryQty: 0,
                exitNotional: price * qty,
                exitQty: qty,
                grossPnl: rpnl,
                tradingFee: commUsd,
                fillCount: 1,
                lastOrderId: orderId,
                lastTradeId: tradeId,
                hasOpenLeg: false,
              };
            } else {
              orphanClose.exitNotional += price * qty;
              orphanClose.exitQty += qty;
              orphanClose.grossPnl += rpnl;
              orphanClose.tradingFee += commUsd;
              orphanClose.fillCount += 1;
              orphanClose.lastTime = time;
              orphanClose.lastOrderId = orderId;
              orphanClose.lastTradeId = tradeId;
            }
          } else if (posSide === "BOTH" && qty > active.netQty + 1e-6) {
            // One-Way Mode Flip: closes current position and opens opposite position in the same fill
            const closeQty: number = active.netQty;
            const flipQty: number = qty - closeQty;
            const closeRatio = closeQty / qty;
            const flipRatio = flipQty / qty;

            active.exitNotional += price * closeQty;
            active.exitQty += closeQty;
            active.grossPnl += rpnl;
            active.tradingFee += commUsd * closeRatio;
            active.fillCount += 1;
            active.lastTime = time;
            active.lastOrderId = orderId;
            active.lastTradeId = tradeId;
            active.netQty = 0;

            finalizePosition(active);

            // Start new flipped position
            const newDir: "LONG" | "SHORT" = side === "BUY" ? "LONG" : "SHORT";
            active = {
              direction: newDir,
              posSide,
              openTime: time,
              lastTime: time,
              netQty: flipQty,
              entryNotional: price * flipQty,
              entryQty: flipQty,
              exitNotional: 0,
              exitQty: 0,
              grossPnl: 0,
              tradingFee: commUsd * flipRatio,
              fillCount: 1,
              lastOrderId: orderId,
              lastTradeId: tradeId,
              hasOpenLeg: true,
            };
          } else {
            // Normal closing fill (partial or full)
            active.exitNotional += price * qty;
            active.exitQty += qty;
            active.netQty = Math.max(0, active.netQty - qty);
            active.grossPnl += rpnl;
            active.tradingFee += commUsd;
            active.fillCount += 1;
            active.lastTime = time;
            active.lastOrderId = orderId;
            active.lastTradeId = tradeId;

            // Check if position is now fully closed (allowing tiny floating-point dust)
            const epsilon = Math.max(1e-6, active.entryQty * 0.0005);
            if (active.netQty <= epsilon) {
              finalizePosition(active);
              active = null;
            }
          }
        }
      }

      // Flush remaining orphan cluster
      if (orphanClose) {
        finalizePosition(orphanClose);
        orphanClose = null;
      }

      // If there's a leftover active accumulator with realized closes AND Binance reports NO open position for this symbol,
      // then the position is actually closed (e.g., partial history cutoff) -> finalize it!
      if (active && active.exitQty > 0) {
        const currentlyOpen = openPosMap.get(`${symbol}_${posSide}`) || 0;
        if (currentlyOpen <= 1e-8) {
          finalizePosition(active);
        }
      }
    }

    return emitted;
  }

  // Keep backwards-compatible alias
  async getFuturesRealizedTrades(_limit = 100, sinceMs?: number): Promise<Partial<Trade>[]> {
    return this.getFuturesClosedPositions(sinceMs);
  }

  private async fetchFuturesSignedPost(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ) {
    const queryParts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        queryParts.push(`${k}=${encodeURIComponent(String(v))}`);
      }
    }
    queryParts.push(`timestamp=${Date.now()}`);
    queryParts.push(`recvWindow=10000`);
    const query = queryParts.join("&");
    const signature = this.sign(query);

    const res = await fetch(`${this.futuresBase}${path}?${query}&signature=${signature}`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ msg: res.statusText }));
      throw new Error(err.msg || err.message || `Binance HTTP ${res.status}`);
    }
    return res.json();
  }

  // Fetch Live Balances
  async getBalance(): Promise<number> {
    try {
      const data = await this.fetchFuturesSigned("/fapi/v2/account");
      return parseFloat(data.totalMarginBalance || data.totalWalletBalance || "0");
    } catch {
      return 0;
    }
  }

  // Fetch Live Open Futures Positions + Account Equity
  async getFuturesOpenPositions(): Promise<{
    positions: LiveOpenPosition[];
    accountEquity: number;
    availableBalance: number;
    totalUnrealizedPnl: number;
  }> {
    const [posRisks, account] = await Promise.all([
      this.fetchFuturesSigned("/fapi/v2/positionRisk"),
      this.fetchFuturesSigned("/fapi/v2/account").catch(() => null),
    ]);

    const positions: LiveOpenPosition[] = [];
    let totalUnrealizedPnl = 0;

    if (Array.isArray(posRisks)) {
      for (const pr of posRisks) {
        const rawAmt = parseFloat(pr.positionAmt || "0");
        const absAmt = Math.abs(rawAmt);
        if (absAmt <= 1e-10) continue;

        const direction: "LONG" | "SHORT" =
          pr.positionSide === "SHORT"
            ? "SHORT"
            : pr.positionSide === "LONG"
            ? "LONG"
            : rawAmt >= 0
            ? "LONG"
            : "SHORT";
        const entryPrice = parseFloat(pr.entryPrice || "0");
        const markPrice = parseFloat(pr.markPrice || "0");
        const liquidationPrice = parseFloat(pr.liquidationPrice || "0");
        const leverage = Math.max(1, parseInt(pr.leverage || "1", 10));
        const unrealizedPnl = parseFloat(pr.unRealizedProfit || "0");
        const notionalUsd = Math.abs(parseFloat(pr.notional || "0")) || absAmt * markPrice;
        const isolatedMargin = parseFloat(pr.isolatedMargin || "0");
        const initialMargin = notionalUsd / leverage;
        const roePct = initialMargin > 0 ? Number(((unrealizedPnl / initialMargin) * 100).toFixed(2)) : 0;

        let liquidationDistancePct: number | null = null;
        if (liquidationPrice > 0 && markPrice > 0) {
          liquidationDistancePct = Number(
            ((Math.abs(markPrice - liquidationPrice) / markPrice) * 100).toFixed(2)
          );
        }

        totalUnrealizedPnl += unrealizedPnl;
        positions.push({
          symbol: String(pr.symbol || "").toUpperCase(),
          direction,
          positionSide: String(pr.positionSide || "BOTH"),
          positionAmt: absAmt,
          entryPrice,
          markPrice,
          liquidationPrice,
          liquidationDistancePct,
          leverage,
          marginType: String(pr.marginType || "cross").toUpperCase(),
          unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
          roePct,
          notionalUsd: Number(notionalUsd.toFixed(2)),
          isolatedMargin: Number(isolatedMargin.toFixed(2)),
        });
      }
    }

    const accountEquity = parseFloat(
      account?.totalMarginBalance || account?.totalWalletBalance || "0"
    );
    const availableBalance = parseFloat(account?.availableBalance || "0");

    return {
      positions: positions.sort((a, b) => Math.abs(b.notionalUsd) - Math.abs(a.notionalUsd)),
      accountEquity: Number(accountEquity.toFixed(2)),
      availableBalance: Number(availableBalance.toFixed(2)),
      totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),
    };
  }

  /**
   * Place a Checklist-Gated Assisted Futures Order with mandatory Hard Stop-Loss
   * and optional Take-Profit on an isolated Binance Agentic Sub-Account.
   */
  async placeProtectedFuturesOrder(opts: {
    symbol: string;
    direction: "LONG" | "SHORT";
    quantity: number;
    leverage: number;
    stopLoss: number;
    takeProfit?: number | null;
    orderType?: "MARKET" | "LIMIT";
    limitPrice?: number | null;
  }): Promise<{
    entryOrderId: string;
    stopOrderId: string | null;
    tpOrderId: string | null;
    roundedQty: number;
    roundedSl: number;
    roundedTp: number | null;
  }> {
    const symbol = opts.symbol.trim().toUpperCase();

    // 1. Fetch exchange precision rules (stepSize & tickSize)
    const exInfoRes = await fetch(`${this.futuresBase}/fapi/v1/exchangeInfo`);
    const exInfo = exInfoRes.ok ? await exInfoRes.json() : null;
    const symInfo = exInfo?.symbols?.find((s: any) => s.symbol === symbol);
    if (!symInfo) {
      throw new Error(`Symbol ${symbol} is not listed on Binance USD-M Futures.`);
    }

    const lotFilter = symInfo.filters?.find((f: any) => f.filterType === "LOT_SIZE");
    const priceFilter = symInfo.filters?.find((f: any) => f.filterType === "PRICE_FILTER");

    const countDecimals = (stepStr?: string): number => {
      if (!stepStr) return 3;
      const trimmed = stepStr.replace(/0+$/, "");
      const idx = trimmed.indexOf(".");
      return idx === -1 ? 0 : trimmed.length - idx - 1;
    };

    const qtyDecimals = countDecimals(lotFilter?.stepSize);
    const priceDecimals = countDecimals(priceFilter?.tickSize);
    const stepSize = parseFloat(lotFilter?.stepSize || "0.001");
    const minQty = parseFloat(lotFilter?.minQty || "0.001");

    const rawRoundedQty = Math.floor(opts.quantity / stepSize) * stepSize;
    const roundedQty = Number(rawRoundedQty.toFixed(qtyDecimals));
    if (roundedQty < minQty) {
      throw new Error(
        `Calculated quantity (${roundedQty}) is below Binance minimum (${minQty}) for ${symbol}. Increase risk USD or tighten stop distance.`
      );
    }

    const roundedSl = Number(opts.stopLoss.toFixed(priceDecimals));
    const roundedTp =
      opts.takeProfit && opts.takeProfit > 0 ? Number(opts.takeProfit.toFixed(priceDecimals)) : null;

    // 2. Set leverage first
    await this.fetchFuturesSignedPost("/fapi/v1/leverage", {
      symbol,
      leverage: Math.max(1, Math.round(opts.leverage)),
    });

    // 3. Place entry order
    const entrySide = opts.direction === "LONG" ? "BUY" : "SELL";
    const closeSide = opts.direction === "LONG" ? "SELL" : "BUY";
    const isLimit = opts.orderType === "LIMIT" && opts.limitPrice && opts.limitPrice > 0;

    const entryOrder = await this.fetchFuturesSignedPost("/fapi/v1/order", {
      symbol,
      side: entrySide,
      type: isLimit ? "LIMIT" : "MARKET",
      quantity: roundedQty,
      ...(isLimit
        ? {
            price: Number(opts.limitPrice!.toFixed(priceDecimals)),
            timeInForce: "GTC",
          }
        : {}),
    });

    // 4. Attach mandatory hard Stop-Loss (STOP_MARKET closePosition=true)
    let stopOrderId: string | null = null;
    try {
      const slRes = await this.fetchFuturesSignedPost("/fapi/v1/order", {
        symbol,
        side: closeSide,
        type: "STOP_MARKET",
        stopPrice: roundedSl,
        closePosition: "true",
        workingType: "MARK_PRICE",
      });
      stopOrderId = slRes?.orderId ? String(slRes.orderId) : null;
    } catch (slErr: any) {
      console.error("[Binance Assisted Order] Stop-Loss attachment failed:", slErr?.message);
    }

    // 5. Attach optional Take-Profit (TAKE_PROFIT_MARKET closePosition=true)
    let tpOrderId: string | null = null;
    if (roundedTp) {
      try {
        const tpRes = await this.fetchFuturesSignedPost("/fapi/v1/order", {
          symbol,
          side: closeSide,
          type: "TAKE_PROFIT_MARKET",
          stopPrice: roundedTp,
          closePosition: "true",
          workingType: "MARK_PRICE",
        });
        tpOrderId = tpRes?.orderId ? String(tpRes.orderId) : null;
      } catch (tpErr: any) {
        console.error("[Binance Assisted Order] Take-Profit attachment failed:", tpErr?.message);
      }
    }

    return {
      entryOrderId: String(entryOrder?.orderId || ""),
      stopOrderId,
      tpOrderId,
      roundedQty,
      roundedSl,
      roundedTp,
    };
  }
}

// -----------------------------------------------------------------------------
// BYBIT CLIENT (v5 API - Closed Positions + Fee Calculation)
// -----------------------------------------------------------------------------
export class BybitClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = "https://api.bybit.com";

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
  }

  private sign(timestamp: string, queryString = ""): string {
    const recvWindow = "10000";
    const signString = timestamp + this.apiKey + recvWindow + queryString;
    return crypto.createHmac("sha256", this.apiSecret).update(signString).digest("hex");
  }

  private async fetchBybitSigned(path: string, queryString: string) {
    const timestamp = String(Date.now());
    const signature = this.sign(timestamp, queryString);

    const res = await fetch(`${this.baseUrl}${path}?${queryString}`, {
      headers: {
        "X-BAPI-API-KEY": this.apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": "10000",
        "X-BAPI-SIGN": signature,
      },
    });
    return res.json();
  }

  async testConnection(): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
      const data = await this.fetchBybitSigned("/v5/account/wallet-balance", "accountType=UNIFIED");
      if (data.retCode !== 0) {
        const dataContract = await this.fetchBybitSigned("/v5/account/wallet-balance", "accountType=CONTRACT");
        if (dataContract.retCode !== 0) {
          return { success: false, message: `Bybit Error: ${data.retMsg || "Invalid credentials"}` };
        }
        return { success: true, message: "Connected to Bybit Contract Account successfully!" };
      }

      const coins = data.result?.list?.[0]?.coin || [];
      const usdt = coins.find((c: any) => c.coin === "USDT");
      const totalEquity = parseFloat(data.result?.list?.[0]?.totalEquity || usdt?.equity || "0");

      return {
        success: true,
        message: `Connected to Bybit Unified Account successfully! Equity: $${totalEquity.toFixed(2)}`,
        balance: totalEquity,
      };
    } catch (err: any) {
      return { success: false, message: `Network error connecting to Bybit: ${err.message}` };
    }
  }

  // Fetch Consolidated Closed Positions with Fees
  async getClosedPnL(limit = 100, sinceMs?: number): Promise<Partial<Trade>[]> {
    try {
      let queryString = `category=linear&limit=${limit}`;
      if (sinceMs && sinceMs > 0) {
        queryString += `&startTime=${sinceMs}`;
      }

      const data = await this.fetchBybitSigned("/v5/position/closed-pnl", queryString);
      if (data.retCode !== 0) {
        throw new Error(data.retMsg || `Bybit error code ${data.retCode}`);
      }

      // Also fetch recent funding/settlement logs to split funding fees accurately
      const fundingBySymbol = new Map<string, RawFundingItem[]>();
      try {
        const txData = await this.fetchBybitSigned(
          "/v5/account/transaction-log",
          "accountType=UNIFIED&category=linear&type=SETTLEMENT&limit=50"
        );
        if (txData.retCode === 0 && Array.isArray(txData.result?.list)) {
          for (const tx of txData.result.list) {
            const sym = String(tx.symbol || "").toUpperCase();
            if (!sym) continue;
            const arr = fundingBySymbol.get(sym) || [];
            arr.push({
              symbol: sym,
              amount: parseFloat(tx.funding || tx.change || "0"),
              time: Number(tx.transactionTime || 0),
              used: false,
            });
            fundingBySymbol.set(sym, arr);
          }
        }
      } catch {
        // optional funding detail
      }

      const list: any[] = data.result?.list || [];
      const trades: Partial<Trade>[] = [];

      for (const item of list) {
        const closeTime = Number(item.updatedTime || item.createdTime);
        if (sinceMs && closeTime <= sinceMs) continue;

        const netPnl = parseFloat(item.closedPnl || "0");
        const orderId = String(item.orderId || item.id);
        const symbol = String(item.symbol).toUpperCase();
        const closeIso = new Date(closeTime).toISOString();
        const openTime = Number(item.createdTime || closeTime);

        // On Bybit closed-pnl, side is the CLOSING order side: Sell closes a LONG, Buy closes a SHORT
        const direction: "LONG" | "SHORT" = item.side === "Sell" ? "LONG" : "SHORT";
        const entryPrice = parseFloat(item.avgEntryPrice || "0") || null;
        const exitPrice = parseFloat(item.avgExitPrice || "0") || null;
        const qty = parseFloat(item.qty || "1");
        const cumEntryVal = parseFloat(item.cumEntryValue || "0");
        const cumExitVal = parseFloat(item.cumExitValue || "0");

        // Gross price PnL before fees
        const grossPnl =
          cumEntryVal > 0 && cumExitVal > 0
            ? Number((direction === "LONG" ? cumExitVal - cumEntryVal : cumEntryVal - cumExitVal).toFixed(4))
            : Number(netPnl.toFixed(4));

        // Match funding fees
        let fundingSum = 0;
        const fList = fundingBySymbol.get(symbol) || [];
        for (const fi of fList) {
          if (!fi.used && fi.time >= openTime - 60_000 && fi.time <= closeTime + 60_000) {
            fundingSum += fi.amount;
            fi.used = true;
          }
        }
        const fundingFee = Number(fundingSum.toFixed(4));
        const impliedTradingFee = Number(Math.max(0, grossPnl + fundingFee - netPnl).toFixed(4));

        const feeSummary = [
          `Gross: ${grossPnl >= 0 ? "+" : ""}$${grossPnl.toFixed(2)}`,
          `Trading Fee: -$${impliedTradingFee.toFixed(2)}`,
          fundingFee !== 0 ? `Funding: ${fundingFee >= 0 ? "+" : ""}$${fundingFee.toFixed(2)}` : null,
        ]
          .filter(Boolean)
          .join(" | ");

        trades.push({
          symbol,
          market: "CRYPTO",
          direction,
          entry_price: entryPrice,
          exit_price: exitPrice,
          quantity: qty,
          gross_pnl: grossPnl,
          trading_fee: impliedTradingFee,
          funding_fee: fundingFee,
          pnl: Number(netPnl.toFixed(4)),
          status: netPnl > 0 ? "WON" : netPnl < 0 ? "LOST" : "BREAKEVEN",
          trade_date: closeIso,
          closed_date: closeIso,
          exchange: "BYBIT",
          exchange_trade_id: `bybit_pos_${symbol}_${orderId}`,
          strategy: "Exchange Auto-Sync",
          signal_provider: "Self",
          reason_entry: `Consolidated Bybit Linear ${direction} position. OrderID: ${orderId}`,
          reason_outcome: feeSummary,
        });
      }

      return trades;
    } catch (err: any) {
      console.error("[Bybit] Error fetching closed PnL:", err);
      return [];
    }
  }

  async getBalance(): Promise<number> {
    try {
      const data = await this.fetchBybitSigned("/v5/account/wallet-balance", "accountType=UNIFIED");
      if (data.retCode === 0) {
        return parseFloat(data.result?.list?.[0]?.totalEquity || "0");
      }
      return 0;
    } catch {
      return 0;
    }
  }
}
