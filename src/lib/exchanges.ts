import crypto from "crypto";
import { Trade, Cashflow } from "./types";

export interface ExchangeSyncResult {
  success: boolean;
  exchange: string;
  importedTrades: number;
  importedCashflows: number;
  liveBalance?: number;
  message: string;
  error?: string;
  trades?: Partial<Trade>[];
  cashflows?: Partial<Cashflow>[];
}

// -----------------------------------------------------------------------------
// BINANCE CLIENT
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

  // Test API credentials
  async testConnection(): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
      const timestamp = Date.now();
      const query = `timestamp=${timestamp}&recvWindow=10000`;
      const signature = this.sign(query);

      const res = await fetch(`${this.futuresBase}/fapi/v2/account?${query}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": this.apiKey },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ msg: res.statusText }));
        // Try spot if futures fails
        const spotRes = await fetch(`${this.spotBase}/api/v3/account?${query}&signature=${signature}`, {
          headers: { "X-MBX-APIKEY": this.apiKey },
        });
        if (!spotRes.ok) {
          return { success: false, message: `Binance Error: ${err.msg || err.message || res.statusText}` };
        }
        const spotData = await spotRes.json();
        return { success: true, message: "Connected to Binance Spot Account successfully" };
      }

      const data = await res.json();
      const totalMarginBalance = parseFloat(data.totalMarginBalance || data.totalWalletBalance || "0");
      return {
        success: true,
        message: `Connected to Binance Futures successfully! Wallet Equity: $${totalMarginBalance.toFixed(2)}`,
        balance: totalMarginBalance,
      };
    } catch (err: any) {
      return { success: false, message: `Network error connecting to Binance: ${err.message}` };
    }
  }

  // Fetch Realized PnL from Futures income history
  async getFuturesRealizedTrades(limit = 100): Promise<Partial<Trade>[]> {
    try {
      const timestamp = Date.now();
      const query = `incomeType=REALIZED_PNL&limit=${limit}&timestamp=${timestamp}&recvWindow=10000`;
      const signature = this.sign(query);

      const res = await fetch(`${this.futuresBase}/fapi/v1/income?${query}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": this.apiKey },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.msg || `Binance HTTP ${res.status}`);
      }

      const incomeItems: any[] = await res.json();
      const trades: Partial<Trade>[] = [];

      for (const item of incomeItems) {
        const pnl = parseFloat(item.income);
        const tradeDate = new Date(Number(item.time)).toISOString();
        const tranId = String(item.tranId);
        const symbol = String(item.symbol || "USDT").toUpperCase();

        trades.push({
          symbol,
          market: "CRYPTO",
          direction: pnl >= 0 ? "LONG" : "SHORT",
          pnl: Number(pnl.toFixed(4)),
          status: pnl > 0 ? "WON" : pnl < 0 ? "LOST" : "BREAKEVEN",
          trade_date: tradeDate,
          exchange: "BINANCE",
          exchange_trade_id: `binance_fut_${tranId}`,
          strategy: "Exchange Auto-Sync",
          signal_provider: "Self",
          reason_entry: `Auto-synced from Binance Futures. TranID: ${tranId}`,
          reason_outcome: pnl >= 0 ? `Realized profit of +$${pnl.toFixed(2)} on Binance` : `Realized loss of -$${Math.abs(pnl).toFixed(2)} on Binance`,
        });
      }

      return trades;
    } catch (err: any) {
      console.error("[Binance] Error fetching futures trades:", err);
      return [];
    }
  }

  // Fetch Live Balances
  async getBalance(): Promise<number> {
    try {
      const timestamp = Date.now();
      const query = `timestamp=${timestamp}&recvWindow=10000`;
      const signature = this.sign(query);

      const res = await fetch(`${this.futuresBase}/fapi/v2/account?${query}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": this.apiKey },
      });

      if (res.ok) {
        const data = await res.json();
        return parseFloat(data.totalMarginBalance || data.totalWalletBalance || "0");
      }
      return 0;
    } catch {
      return 0;
    }
  }
}

// -----------------------------------------------------------------------------
// BYBIT CLIENT (v5 API)
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

  async testConnection(): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
      const timestamp = String(Date.now());
      const queryString = "accountType=UNIFIED";
      const signature = this.sign(timestamp, queryString);

      const res = await fetch(`${this.baseUrl}/v5/account/wallet-balance?${queryString}`, {
        headers: {
          "X-BAPI-API-KEY": this.apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": "10000",
          "X-BAPI-SIGN": signature,
        },
      });

      const data = await res.json();
      if (data.retCode !== 0) {
        // Try CONTRACT account type if unified is not enabled
        const tsContract = String(Date.now());
        const qsContract = "accountType=CONTRACT";
        const sigContract = this.sign(tsContract, qsContract);
        const resContract = await fetch(`${this.baseUrl}/v5/account/wallet-balance?${qsContract}`, {
          headers: {
            "X-BAPI-API-KEY": this.apiKey,
            "X-BAPI-TIMESTAMP": tsContract,
            "X-BAPI-RECV-WINDOW": "10000",
            "X-BAPI-SIGN": sigContract,
          },
        });
        const dataContract = await resContract.json();
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

  // Fetch Closed PnL
  async getClosedPnL(limit = 100): Promise<Partial<Trade>[]> {
    try {
      const timestamp = String(Date.now());
      const queryString = `category=linear&limit=${limit}`;
      const signature = this.sign(timestamp, queryString);

      const res = await fetch(`${this.baseUrl}/v5/position/closed-pnl?${queryString}`, {
        headers: {
          "X-BAPI-API-KEY": this.apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": "10000",
          "X-BAPI-SIGN": signature,
        },
      });

      const data = await res.json();
      if (data.retCode !== 0) {
        throw new Error(data.retMsg || `Bybit error code ${data.retCode}`);
      }

      const list: any[] = data.result?.list || [];
      const trades: Partial<Trade>[] = [];

      for (const item of list) {
        const pnl = parseFloat(item.closedPnl || "0");
        const orderId = String(item.orderId || item.id);
        const tradeDate = new Date(Number(item.updatedTime || item.createdTime)).toISOString();
        const side = item.side === "Buy" ? "LONG" : "SHORT";
        const entryPrice = parseFloat(item.avgEntryPrice || "0") || null;
        const exitPrice = parseFloat(item.avgExitPrice || "0") || null;
        const qty = parseFloat(item.qty || "1");

        trades.push({
          symbol: String(item.symbol).toUpperCase(),
          market: "CRYPTO",
          direction: side,
          entry_price: entryPrice,
          exit_price: exitPrice,
          quantity: qty,
          pnl: Number(pnl.toFixed(4)),
          status: pnl > 0 ? "WON" : pnl < 0 ? "LOST" : "BREAKEVEN",
          trade_date: tradeDate,
          exchange: "BYBIT",
          exchange_trade_id: `bybit_${orderId}`,
          strategy: "Exchange Auto-Sync",
          signal_provider: "Self",
          reason_entry: `Auto-synced from Bybit Linear Perpetual. OrderID: ${orderId}`,
          reason_outcome: pnl >= 0 ? `Realized profit of +$${pnl.toFixed(2)} on Bybit` : `Realized loss of -$${Math.abs(pnl).toFixed(2)} on Bybit`,
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
      const timestamp = String(Date.now());
      const queryString = "accountType=UNIFIED";
      const signature = this.sign(timestamp, queryString);

      const res = await fetch(`${this.baseUrl}/v5/account/wallet-balance?${queryString}`, {
        headers: {
          "X-BAPI-API-KEY": this.apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": "10000",
          "X-BAPI-SIGN": signature,
        },
      });

      const data = await res.json();
      if (data.retCode === 0) {
        const total = parseFloat(data.result?.list?.[0]?.totalEquity || "0");
        return total;
      }
      return 0;
    } catch {
      return 0;
    }
  }
}
