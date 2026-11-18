import { Pool } from "pg";
import fs from "fs";
import path from "path";
import {
  Trade,
  Cashflow,
  Goal,
  DailySummary,
  DashboardStats,
  SignalProvider,
  SignalProviderStats,
  ExchangeConnection,
  UserSettings,
  DrawdownStats,
  TradingAccount,
  CustomIndicator,
} from "./types";
import { BinanceClient, BybitClient, ExchangeSyncResult } from "./exchanges";

const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_STORE_FILE = path.join(DATA_DIR, "tracker_store.json");

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {}
}

const DB_URL =
  process.env.DATABASE_URL ||
  process.env.INTERNAL_DATABASE_URL ||
  "postgres://postgres:SignalTerminalSecure2026%21@82yknlmfsi44aeizl0chsvce:5432/signal_terminal";

let pool: Pool | null = null;
let isPostgresAvailable = false;
let hasCheckedPostgres = false;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DB_URL,
      connectionTimeoutMillis: 3000,
      max: 10,
    });
  }
  return pool;
}

interface LocalStore {
  accounts: TradingAccount[];
  ignored_exchange_trade_ids: string[];
  trades: Trade[];
  cashflows: Cashflow[];
  goals: Goal[];
  dailySummaries: Record<string, DailySummary>;
  signal_providers: SignalProvider[];
  exchange_connections: ExchangeConnection[];
  indicators?: CustomIndicator[];
  settings: Record<string, any>;
}

const DEFAULT_ACCOUNT: TradingAccount = {
  id: "acc_default",
  name: "Main Account",
  type: "PERSONAL",
  starting_balance: 10000,
  target_amount: 0,
  initial_loss: 0,
  color: "sky",
  notes: "Default primary trading account",
  is_default: true,
  created_at: new Date().toISOString(),
};

function loadLocalStore(): LocalStore {
  if (fs.existsSync(LOCAL_STORE_FILE)) {
    try {
      const content = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (!parsed.accounts || parsed.accounts.length === 0) {
        parsed.accounts = [{ ...DEFAULT_ACCOUNT }];
      }
      if (!parsed.ignored_exchange_trade_ids) {
        parsed.ignored_exchange_trade_ids = [];
      }
      if (!parsed.signal_providers || parsed.signal_providers.length === 0) {
        parsed.signal_providers = [
          { id: "sp_self", name: "Self", notes: "My own trades & setups", color: "sky", created_at: new Date().toISOString() }
        ];
      }
      if (!parsed.exchange_connections) {
        parsed.exchange_connections = [];
      }
      if (!parsed.settings) {
        parsed.settings = {
          initial_balance: 10000,
          currency: "USD",
          risk_percentage: 1.0,
          default_leverage: 100,
          max_drawdown_limit: 10,
        };
      }
      return parsed;
    } catch (e) {
      console.error("[LocalStore] Error reading local store:", e);
    }
  }

  const initialStore: LocalStore = {
    accounts: [{ ...DEFAULT_ACCOUNT }],
    ignored_exchange_trade_ids: [],
    trades: [],
    cashflows: [],
    goals: [],
    dailySummaries: {},
    signal_providers: [
      { id: "sp_self", name: "Self", notes: "My own trades & setups", color: "sky", created_at: new Date().toISOString() }
    ],
    exchange_connections: [],
    settings: {
      initial_balance: 10000,
      currency: "USD",
      risk_percentage: 1.0,
      default_leverage: 100,
      max_drawdown_limit: 10,
    },
  };
  saveLocalStore(initialStore);
  return initialStore;
}

function saveLocalStore(store: LocalStore) {
  try {
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[LocalStore] Error saving store:", e);
  }
}

async function initPostgresTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tracker_trades (
      id VARCHAR(64) PRIMARY KEY,
      symbol VARCHAR(32) NOT NULL,
      market VARCHAR(32) NOT NULL DEFAULT 'FOREX',
      direction VARCHAR(16) NOT NULL DEFAULT 'LONG',
      entry_price DOUBLE PRECISION DEFAULT NULL,
      exit_price DOUBLE PRECISION DEFAULT NULL,
      stop_loss DOUBLE PRECISION DEFAULT NULL,
      take_profit DOUBLE PRECISION DEFAULT NULL,
      quantity DOUBLE PRECISION DEFAULT 1,
      pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
      pnl_percentage DOUBLE PRECISION DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      trade_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_date TIMESTAMPTZ,
      timeframe VARCHAR(16) DEFAULT '1h',
      session VARCHAR(32) DEFAULT '',
      strategy VARCHAR(64) DEFAULT '',
      signal_provider VARCHAR(100) DEFAULT 'Self',
      reason_entry TEXT DEFAULT '',
      reason_outcome TEXT DEFAULT '',
      lessons_learned TEXT DEFAULT '',
      emotions_notes TEXT DEFAULT '',
      chart_url TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Ensure signal_provider, exchange, exchange_trade_id, chart_image, account_id, and fee columns exist
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS signal_provider VARCHAR(100) DEFAULT 'Self';
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS exchange VARCHAR(64) DEFAULT 'MANUAL';
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS exchange_trade_id VARCHAR(128) DEFAULT NULL;
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS chart_image TEXT DEFAULT '';
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS account_id VARCHAR(64) DEFAULT 'acc_default';
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS gross_pnl DOUBLE PRECISION DEFAULT NULL;
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS trading_fee DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS funding_fee DOUBLE PRECISION DEFAULT 0;

    CREATE TABLE IF NOT EXISTS tracker_accounts (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'TARGET',
      starting_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      target_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      initial_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
      color VARCHAR(32) DEFAULT 'sky',
      notes TEXT DEFAULT '',
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO tracker_accounts (id, name, type, starting_balance, target_amount, initial_loss, color, notes, is_default)
    VALUES ('acc_default', 'Main Account', 'PERSONAL', 10000, 0, 0, 'sky', 'Default primary trading account', TRUE)
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS tracker_ignored_exchange_trades (
      exchange_trade_id VARCHAR(128) PRIMARY KEY,
      exchange VARCHAR(32) DEFAULT '',
      symbol VARCHAR(32) DEFAULT '',
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracker_exchange_connections (
      id VARCHAR(64) PRIMARY KEY,
      exchange VARCHAR(32) NOT NULL,
      name VARCHAR(64) NOT NULL,
      api_key TEXT NOT NULL,
      api_secret TEXT NOT NULL,
      account_type VARCHAR(32) DEFAULT 'FUTURES',
      account_id VARCHAR(64) DEFAULT 'acc_default',
      auto_sync BOOLEAN DEFAULT TRUE,
      sync_from_date TIMESTAMPTZ DEFAULT NULL,
      last_synced_trade_time BIGINT DEFAULT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE tracker_exchange_connections ADD COLUMN IF NOT EXISTS account_id VARCHAR(64) DEFAULT 'acc_default';
    ALTER TABLE tracker_exchange_connections ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT TRUE;
    ALTER TABLE tracker_exchange_connections ADD COLUMN IF NOT EXISTS sync_from_date TIMESTAMPTZ DEFAULT NULL;
    ALTER TABLE tracker_exchange_connections ADD COLUMN IF NOT EXISTS last_synced_trade_time BIGINT DEFAULT NULL;

    CREATE TABLE IF NOT EXISTS tracker_settings (
      key VARCHAR(64) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracker_indicators (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      code TEXT NOT NULL,
      language VARCHAR(16) NOT NULL DEFAULT 'pine',
      overlay BOOLEAN DEFAULT TRUE,
      is_enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracker_auth_attempts (
      ip VARCHAR(128) PRIMARY KEY,
      failed_count INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ DEFAULT NULL,
      last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracker_signal_providers (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      notes TEXT DEFAULT '',
      telegram_handle VARCHAR(100) DEFAULT '',
      color VARCHAR(32) DEFAULT 'sky',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Seed only Self provider; never re-seed dummy traders
    INSERT INTO tracker_signal_providers (id, name, notes, color)
    VALUES ('sp_self', 'Self', 'My own trades & setups', 'sky')
    ON CONFLICT (name) DO NOTHING;

    -- Permanently remove previously auto-seeded dummy example traders
    DELETE FROM tracker_signal_providers WHERE id IN ('sp_abc', 'sp_xyz');

    CREATE TABLE IF NOT EXISTS tracker_cashflows (
      id VARCHAR(64) PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      category VARCHAR(64) NOT NULL,
      description TEXT DEFAULT '',
      date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source VARCHAR(64) DEFAULT 'Trading Account',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracker_goals (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(128) NOT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'PROFIT_TARGET',
      target_amount DOUBLE PRECISION NOT NULL,
      current_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      target_date TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracker_daily_summaries (
      date DATE PRIMARY KEY,
      total_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_trades INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      breakeven INTEGER NOT NULL DEFAULT 0,
      win_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_withdrawn DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_spent DOUBLE PRECISION NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tracker_trades_date ON tracker_trades(trade_date);
    CREATE INDEX IF NOT EXISTS idx_tracker_trades_symbol ON tracker_trades(symbol);
    CREATE INDEX IF NOT EXISTS idx_tracker_trades_signal_provider ON tracker_trades(signal_provider);
    CREATE INDEX IF NOT EXISTS idx_tracker_trades_exchange ON tracker_trades(exchange);
    CREATE INDEX IF NOT EXISTS idx_tracker_trades_account_id ON tracker_trades(account_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_trades_exchange_trade_id ON tracker_trades(exchange_trade_id) WHERE exchange_trade_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_tracker_cashflow_date ON tracker_cashflows(date);
    ALTER TABLE tracker_cashflows ADD COLUMN IF NOT EXISTS account_id VARCHAR(64) DEFAULT 'acc_default';
    ALTER TABLE tracker_goals ADD COLUMN IF NOT EXISTS account_id VARCHAR(64) DEFAULT 'ALL';
    ALTER TABLE tracker_goals ADD COLUMN IF NOT EXISTS tracking_mode VARCHAR(32) DEFAULT 'AUTO_DATE';
    ALTER TABLE tracker_goals ADD COLUMN IF NOT EXISTS linked_trade_ids TEXT DEFAULT '[]';
  `);
}

export async function checkConnection(): Promise<{ isPostgres: boolean; message: string }> {
  if (hasCheckedPostgres && isPostgresAvailable) {
    return { isPostgres: true, message: "Connected to PostgreSQL database (signal_terminal)" };
  }

  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("SELECT 1");
      await initPostgresTables(client);
      isPostgresAvailable = true;
      hasCheckedPostgres = true;
      console.log("[DB Engine] Successfully connected to PostgreSQL signal_terminal and verified tables.");
      return { isPostgres: true, message: "Connected to PostgreSQL database (signal_terminal)" };
    } finally {
      client.release();
    }
  } catch (err: any) {
    isPostgresAvailable = false;
    hasCheckedPostgres = true;
    return {
      isPostgres: false,
      message: "Operating in resilient local storage mode (PG active when deployed to Coolify)",
    };
  }
}

// -----------------------------------------------------------------------------
// IGNORED EXCHANGE TRADES (NEVER RE-IMPORT DELETED POSITIONS)
// -----------------------------------------------------------------------------
export async function addIgnoredExchangeTrade(
  exchangeTradeId: string,
  exchange = "",
  symbol = ""
): Promise<void> {
  if (!exchangeTradeId) return;
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_ignored_exchange_trades (exchange_trade_id, exchange, symbol, deleted_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (exchange_trade_id) DO NOTHING`,
      [exchangeTradeId, exchange, symbol]
    );
  } else {
    const store = loadLocalStore();
    if (!store.ignored_exchange_trade_ids) store.ignored_exchange_trade_ids = [];
    if (!store.ignored_exchange_trade_ids.includes(exchangeTradeId)) {
      store.ignored_exchange_trade_ids.push(exchangeTradeId);
      saveLocalStore(store);
    }
  }
}

export async function isExchangeTradeIgnored(exchangeTradeId: string): Promise<boolean> {
  if (!exchangeTradeId) return false;
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const res = await p.query(
      "SELECT 1 FROM tracker_ignored_exchange_trades WHERE exchange_trade_id = $1 LIMIT 1",
      [exchangeTradeId]
    );
    return res.rows.length > 0;
  } else {
    const store = loadLocalStore();
    return (store.ignored_exchange_trade_ids || []).includes(exchangeTradeId);
  }
}

export async function getIgnoredExchangeTradeCount(): Promise<number> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT COUNT(*) AS cnt FROM tracker_ignored_exchange_trades");
    return Number(res.rows[0]?.cnt || 0);
  } else {
    const store = loadLocalStore();
    return (store.ignored_exchange_trade_ids || []).length;
  }
}

export async function clearIgnoredExchangeTrades(): Promise<void> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query("DELETE FROM tracker_ignored_exchange_trades");
  } else {
    const store = loadLocalStore();
    store.ignored_exchange_trade_ids = [];
    saveLocalStore(store);
  }
}

export async function removeIgnoredExchangeTrade(exchangeTradeId: string): Promise<void> {
  if (!exchangeTradeId) return;
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query("DELETE FROM tracker_ignored_exchange_trades WHERE exchange_trade_id = $1", [
      exchangeTradeId,
    ]);
  } else {
    const store = loadLocalStore();
    store.ignored_exchange_trade_ids = (store.ignored_exchange_trade_ids || []).filter(
      (id) => id !== exchangeTradeId
    );
    saveLocalStore(store);
  }
}

// -----------------------------------------------------------------------------
// TRADES API
// -----------------------------------------------------------------------------
function mapTradeRow(r: any): Trade {
  const pnl = Number(r.pnl || 0);
  const tradingFee = Number(r.trading_fee || 0);
  const fundingFee = Number(r.funding_fee || 0);
  const grossPnl = r.gross_pnl !== null && r.gross_pnl !== undefined ? Number(r.gross_pnl) : pnl;

  return {
    ...r,
    account_id: r.account_id || "acc_default",
    pnl,
    gross_pnl: grossPnl,
    trading_fee: tradingFee,
    funding_fee: fundingFee,
    signal_provider: r.signal_provider || "Self",
    exchange: r.exchange || "MANUAL",
    exchange_trade_id: r.exchange_trade_id || null,
    chart_image: r.chart_image || "",
    tags: typeof r.tags === "string" ? JSON.parse(r.tags || "[]") : r.tags || [],
    trade_date: new Date(r.trade_date).toISOString(),
    closed_date: r.closed_date ? new Date(r.closed_date).toISOString() : null,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
  };
}

export async function getTrades(filters?: {
  symbol?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  signal_provider?: string;
  exchange?: string;
  account_id?: string;
}): Promise<Trade[]> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    let query = "SELECT * FROM tracker_trades WHERE 1=1";
    const values: any[] = [];
    let idx = 1;

    if (filters?.account_id && filters.account_id !== "ALL") {
      if (filters.account_id === "acc_default") {
        query += ` AND (account_id = 'acc_default' OR account_id IS NULL OR account_id = '')`;
      } else {
        query += ` AND account_id = $${idx++}`;
        values.push(filters.account_id);
      }
    }
    if (filters?.symbol) {
      query += ` AND UPPER(symbol) = $${idx++}`;
      values.push(filters.symbol.toUpperCase());
    }
    if (filters?.status) {
      query += ` AND status = $${idx++}`;
      values.push(filters.status);
    }
    if (filters?.startDate) {
      query += ` AND trade_date >= $${idx++}`;
      values.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ` AND trade_date <= $${idx++}`;
      values.push(filters.endDate);
    }
    if (filters?.signal_provider) {
      if (filters.signal_provider.toLowerCase() === "self") {
        query += ` AND (signal_provider = 'Self' OR signal_provider IS NULL OR signal_provider = '')`;
      } else {
        query += ` AND UPPER(signal_provider) = $${idx++}`;
        values.push(filters.signal_provider.toUpperCase());
      }
    }
    if (filters?.exchange) {
      query += ` AND UPPER(exchange) = $${idx++}`;
      values.push(filters.exchange.toUpperCase());
    }

    query += " ORDER BY trade_date DESC";
    const res = await p.query(query, values);
    return res.rows.map(mapTradeRow);
  } else {
    const store = loadLocalStore();
    let result = [...store.trades].map((t) => ({
      ...t,
      account_id: t.account_id || "acc_default",
      gross_pnl: t.gross_pnl ?? t.pnl,
      trading_fee: t.trading_fee ?? 0,
      funding_fee: t.funding_fee ?? 0,
    }));

    if (filters?.account_id && filters.account_id !== "ALL") {
      result = result.filter((t) => (t.account_id || "acc_default") === filters.account_id);
    }
    if (filters?.symbol) {
      result = result.filter((t) => t.symbol.toUpperCase() === filters.symbol?.toUpperCase());
    }
    if (filters?.status) {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters?.startDate) {
      result = result.filter((t) => t.trade_date >= filters.startDate!);
    }
    if (filters?.endDate) {
      result = result.filter((t) => t.trade_date <= filters.endDate!);
    }
    if (filters?.signal_provider) {
      if (filters.signal_provider.toLowerCase() === "self") {
        result = result.filter((t) => !t.signal_provider || t.signal_provider.toLowerCase() === "self");
      } else {
        result = result.filter(
          (t) => t.signal_provider?.toLowerCase() === filters.signal_provider?.toLowerCase()
        );
      }
    }
    if (filters?.exchange) {
      result = result.filter((t) => (t.exchange || "MANUAL").toUpperCase() === filters.exchange?.toUpperCase());
    }

    return result.sort((a, b) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime());
  }
}

export async function getTradeById(id: string): Promise<Trade | null> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT * FROM tracker_trades WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    return mapTradeRow(res.rows[0]);
  } else {
    const store = loadLocalStore();
    return store.trades.find((t) => t.id === id) || null;
  }
}

export async function getTradeByExchangeId(exchangeTradeId: string): Promise<Trade | null> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT * FROM tracker_trades WHERE exchange_trade_id = $1 LIMIT 1", [exchangeTradeId]);
    if (res.rows.length === 0) return null;
    return mapTradeRow(res.rows[0]);
  } else {
    const store = loadLocalStore();
    return store.trades.find((t) => t.exchange_trade_id === exchangeTradeId) || null;
  }
}

export async function createTrade(trade: Trade): Promise<Trade> {
  const { isPostgres } = await checkConnection();
  const provider = trade.signal_provider?.trim() || "Self";
  const exchange = trade.exchange?.trim().toUpperCase() || "MANUAL";
  const exchangeTradeId = trade.exchange_trade_id?.trim() || null;
  const chartImage = trade.chart_image?.trim() || "";
  const accountId = trade.account_id?.trim() || "acc_default";
  const tradingFee = Number(trade.trading_fee ?? 0);
  const fundingFee = Number(trade.funding_fee ?? 0);
  const grossPnl = trade.gross_pnl !== undefined && trade.gross_pnl !== null ? Number(trade.gross_pnl) : Number(trade.pnl || 0);

  if (exchangeTradeId) {
    const existing = await getTradeByExchangeId(exchangeTradeId);
    if (existing) return existing;
  }

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_trades (
        id, account_id, symbol, market, direction, entry_price, exit_price, stop_loss, take_profit,
        quantity, pnl, gross_pnl, trading_fee, funding_fee, pnl_percentage, status, trade_date, closed_date, timeframe,
        session, strategy, signal_provider, exchange, exchange_trade_id, reason_entry, reason_outcome, lessons_learned, emotions_notes,
        chart_url, chart_image, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)`,
      [
        trade.id,
        accountId,
        trade.symbol.toUpperCase(),
        trade.market || "FOREX",
        trade.direction || "LONG",
        trade.entry_price ?? null,
        trade.exit_price ?? null,
        trade.stop_loss ?? null,
        trade.take_profit ?? null,
        trade.quantity ?? 1,
        trade.pnl || 0,
        grossPnl,
        tradingFee,
        fundingFee,
        trade.pnl_percentage ?? 0,
        trade.status || "OPEN",
        trade.trade_date,
        trade.closed_date ?? null,
        trade.timeframe || "1h",
        trade.session || "",
        trade.strategy || "",
        provider,
        exchange,
        exchangeTradeId,
        trade.reason_entry || "",
        trade.reason_outcome || "",
        trade.lessons_learned || "",
        trade.emotions_notes || "",
        trade.chart_url || "",
        chartImage,
        JSON.stringify(trade.tags || []),
        trade.created_at || new Date().toISOString(),
        trade.updated_at || new Date().toISOString(),
      ]
    );
  } else {
    const store = loadLocalStore();
    const tradeWithExtras: Trade = {
      ...trade,
      account_id: accountId,
      gross_pnl: grossPnl,
      trading_fee: tradingFee,
      funding_fee: fundingFee,
      signal_provider: provider,
      exchange,
      exchange_trade_id: exchangeTradeId || undefined,
      chart_image: chartImage,
    };
    store.trades.unshift(tradeWithExtras);
    saveLocalStore(store);
  }

  if (provider && provider.toLowerCase() !== "self") {
    await ensureSignalProviderExists(provider);
  }

  const dateKey = trade.trade_date.split("T")[0];
  await syncDailySummary(dateKey);
  await syncGoals();

  return {
    ...trade,
    account_id: accountId,
    gross_pnl: grossPnl,
    trading_fee: tradingFee,
    funding_fee: fundingFee,
    signal_provider: provider,
    exchange,
    exchange_trade_id: exchangeTradeId || undefined,
    chart_image: chartImage,
  };
}

export async function updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | null> {
  const existing = await getTradeById(id);
  if (!existing) return null;

  const provider =
    updates.signal_provider !== undefined
      ? updates.signal_provider?.trim() || "Self"
      : existing.signal_provider || "Self";
  const exchange =
    updates.exchange !== undefined
      ? updates.exchange?.trim().toUpperCase() || "MANUAL"
      : existing.exchange || "MANUAL";
  const chartImage =
    updates.chart_image !== undefined
      ? updates.chart_image?.trim() || ""
      : existing.chart_image || "";
  const accountId =
    updates.account_id !== undefined
      ? updates.account_id?.trim() || "acc_default"
      : existing.account_id || "acc_default";
  const tradingFee =
    updates.trading_fee !== undefined && updates.trading_fee !== null
      ? Number(updates.trading_fee)
      : Number(existing.trading_fee ?? 0);
  const fundingFee =
    updates.funding_fee !== undefined && updates.funding_fee !== null
      ? Number(updates.funding_fee)
      : Number(existing.funding_fee ?? 0);
  const grossPnl =
    updates.gross_pnl !== undefined && updates.gross_pnl !== null
      ? Number(updates.gross_pnl)
      : existing.gross_pnl ?? updates.pnl ?? existing.pnl;

  const updated: Trade = {
    ...existing,
    ...updates,
    account_id: accountId,
    gross_pnl: grossPnl,
    trading_fee: tradingFee,
    funding_fee: fundingFee,
    signal_provider: provider,
    exchange,
    chart_image: chartImage,
    updated_at: new Date().toISOString(),
  };

  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `UPDATE tracker_trades SET
        account_id = $1, symbol = $2, market = $3, direction = $4, entry_price = $5, exit_price = $6,
        stop_loss = $7, take_profit = $8, quantity = $9, pnl = $10, gross_pnl = $11, trading_fee = $12, funding_fee = $13, pnl_percentage = $14,
        status = $15, trade_date = $16, closed_date = $17, timeframe = $18, session = $19,
        strategy = $20, signal_provider = $21, exchange = $22, reason_entry = $23, reason_outcome = $24,
        lessons_learned = $25, emotions_notes = $26, chart_url = $27, chart_image = $28, tags = $29, updated_at = $30
      WHERE id = $31`,
      [
        accountId,
        updated.symbol.toUpperCase(),
        updated.market || "FOREX",
        updated.direction || "LONG",
        updated.entry_price ?? null,
        updated.exit_price ?? null,
        updated.stop_loss ?? null,
        updated.take_profit ?? null,
        updated.quantity ?? 1,
        updated.pnl,
        grossPnl,
        tradingFee,
        fundingFee,
        updated.pnl_percentage ?? null,
        updated.status,
        updated.trade_date,
        updated.closed_date ?? null,
        updated.timeframe || "",
        updated.session || "",
        updated.strategy || "",
        provider,
        exchange,
        updated.reason_entry || "",
        updated.reason_outcome || "",
        updated.lessons_learned || "",
        updated.emotions_notes || "",
        updated.chart_url || "",
        chartImage,
        JSON.stringify(updated.tags || []),
        updated.updated_at,
        id,
      ]
    );
  } else {
    const store = loadLocalStore();
    const idx = store.trades.findIndex((t) => t.id === id);
    if (idx !== -1) {
      store.trades[idx] = updated;
      saveLocalStore(store);
    }
  }

  if (provider && provider.toLowerCase() !== "self") {
    await ensureSignalProviderExists(provider);
  }

  const dateKey = updated.trade_date.split("T")[0];
  await syncDailySummary(dateKey);
  await syncGoals();

  return updated;
}

export async function deleteTrade(id: string, recordIgnore = true): Promise<boolean> {
  const existing = await getTradeById(id);
  if (!existing) return false;

  // Permanently remember deleted exchange positions so future syncs NEVER re-import them
  if (recordIgnore && existing.exchange_trade_id) {
    await addIgnoredExchangeTrade(
      existing.exchange_trade_id,
      existing.exchange || "",
      existing.symbol || ""
    );
  }

  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    await p.query("DELETE FROM tracker_trades WHERE id = $1", [id]);
  } else {
    const store = loadLocalStore();
    store.trades = store.trades.filter((t) => t.id !== id);
    saveLocalStore(store);
  }

  const dateKey = existing.trade_date.split("T")[0];
  await syncDailySummary(dateKey);
  await syncGoals();

  return true;
}

export async function deleteTradesBulk(ids: string[]): Promise<number> {
  let deleted = 0;
  for (const id of ids) {
    const ok = await deleteTrade(id, true);
    if (ok) deleted++;
  }
  return deleted;
}

export async function updateTradesBulk(
  ids: string[],
  updates: { signal_provider?: string; account_id?: string }
): Promise<number> {
  if (ids.length === 0) return 0;
  const { isPostgres } = await checkConnection();

  const provider =
    updates.signal_provider !== undefined ? updates.signal_provider.trim() || "Self" : undefined;
  const accountId =
    updates.account_id !== undefined ? updates.account_id.trim() || "acc_default" : undefined;

  if (provider && provider.toLowerCase() !== "self") {
    await ensureSignalProviderExists(provider);
  }

  let updatedCount = 0;
  if (isPostgres) {
    const p = getPool();
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (provider !== undefined) {
      sets.push(`signal_provider = $${idx++}`);
      vals.push(provider);
    }
    if (accountId !== undefined) {
      sets.push(`account_id = $${idx++}`);
      vals.push(accountId);
    }
    if (sets.length === 0) return 0;
    sets.push(`updated_at = NOW()`);
    vals.push(ids);

    const res = await p.query(
      `UPDATE tracker_trades SET ${sets.join(", ")} WHERE id = ANY($${idx}::varchar[])`,
      vals
    );
    updatedCount = res.rowCount || ids.length;
  } else {
    const store = loadLocalStore();
    const idSet = new Set(ids);
    store.trades = store.trades.map((t) => {
      if (!idSet.has(t.id)) return t;
      updatedCount++;
      return {
        ...t,
        ...(provider !== undefined ? { signal_provider: provider } : {}),
        ...(accountId !== undefined ? { account_id: accountId } : {}),
        updated_at: new Date().toISOString(),
      };
    });
    saveLocalStore(store);
  }

  await syncGoals();
  return updatedCount;
}

export async function cleanupLegacyPartialFills(): Promise<number> {
  const trades = await getTrades();
  const legacy = trades.filter(
    (t) => t.exchange_trade_id && t.exchange_trade_id.startsWith("binance_fut_")
  );
  let removed = 0;
  for (const t of legacy) {
    const ok = await deleteTrade(t.id, false);
    if (ok) removed++;
  }
  return removed;
}

// -----------------------------------------------------------------------------
// CASHFLOW API
// -----------------------------------------------------------------------------
export async function getCashflows(filters?: { type?: string; startDate?: string; endDate?: string }): Promise<Cashflow[]> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    let query = "SELECT * FROM tracker_cashflows WHERE 1=1";
    const values: any[] = [];
    let idx = 1;

    if (filters?.type) {
      query += ` AND type = $${idx++}`;
      values.push(filters.type);
    }
    if (filters?.startDate) {
      query += ` AND date >= $${idx++}`;
      values.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ` AND date <= $${idx++}`;
      values.push(filters.endDate);
    }

    query += " ORDER BY date DESC";
    const res = await p.query(query, values);
    return res.rows.map((r: any) => ({
      ...r,
      date: new Date(r.date).toISOString(),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  } else {
    const store = loadLocalStore();
    let result = [...store.cashflows];

    if (filters?.type) {
      result = result.filter((c) => c.type === filters.type);
    }
    if (filters?.startDate) {
      result = result.filter((c) => c.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      result = result.filter((c) => c.date <= filters.endDate!);
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export async function createCashflow(cashflow: Cashflow): Promise<Cashflow> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_cashflows (
        id, type, amount, category, description, date, source, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        cashflow.id,
        cashflow.type,
        cashflow.amount,
        cashflow.category,
        cashflow.description || "",
        cashflow.date,
        cashflow.source || "Trading Account",
        cashflow.created_at || new Date().toISOString(),
        cashflow.updated_at || new Date().toISOString(),
      ]
    );
  } else {
    const store = loadLocalStore();
    store.cashflows.unshift(cashflow);
    saveLocalStore(store);
  }

  const dateKey = cashflow.date.split("T")[0];
  await syncDailySummary(dateKey);
  await syncGoals();

  return cashflow;
}

export async function deleteCashflow(id: string): Promise<boolean> {
  let targetDate = "";
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT date FROM tracker_cashflows WHERE id = $1", [id]);
    if (res.rows.length === 0) return false;
    targetDate = new Date(res.rows[0].date).toISOString().split("T")[0];
    await p.query("DELETE FROM tracker_cashflows WHERE id = $1", [id]);
  } else {
    const store = loadLocalStore();
    const found = store.cashflows.find((c) => c.id === id);
    if (!found) return false;
    targetDate = found.date.split("T")[0];
    store.cashflows = store.cashflows.filter((c) => c.id !== id);
    saveLocalStore(store);
  }

  if (targetDate) {
    await syncDailySummary(targetDate);
  }
  await syncGoals();
  return true;
}

// -----------------------------------------------------------------------------
// GOALS API
// -----------------------------------------------------------------------------
function parseLinkedTradeIds(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function getGoals(accountId?: string): Promise<Goal[]> {
  const { isPostgres } = await checkConnection();
  let goals: Goal[] = [];

  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT * FROM tracker_goals ORDER BY created_at DESC");
    goals = res.rows.map((r: any) => ({
      ...r,
      account_id: r.account_id || "ALL",
      tracking_mode: r.tracking_mode === "MANUAL_TRADES" ? "MANUAL_TRADES" : "AUTO_DATE",
      linked_trade_ids: parseLinkedTradeIds(r.linked_trade_ids),
      target_amount: Number(r.target_amount || 0),
      current_amount: Number(r.current_amount || 0),
      start_date: new Date(r.start_date).toISOString(),
      target_date: r.target_date ? new Date(r.target_date).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  } else {
    const store = loadLocalStore();
    goals = [...store.goals]
      .map((g) => ({
        ...g,
        account_id: g.account_id || "ALL",
        tracking_mode: g.tracking_mode === "MANUAL_TRADES" ? ("MANUAL_TRADES" as const) : ("AUTO_DATE" as const),
        linked_trade_ids: parseLinkedTradeIds(g.linked_trade_ids),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  if (accountId && accountId !== "ALL") {
    return goals.filter((g) => !g.account_id || g.account_id === "ALL" || g.account_id === accountId);
  }
  return goals;
}

export async function createGoal(goal: Goal): Promise<Goal> {
  const { isPostgres } = await checkConnection();
  const accountId = goal.account_id || "ALL";
  const trackingMode = goal.tracking_mode === "MANUAL_TRADES" ? "MANUAL_TRADES" : "AUTO_DATE";
  const linkedIds = parseLinkedTradeIds(goal.linked_trade_ids);

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_goals (
        id, account_id, tracking_mode, linked_trade_ids, title, category, target_amount, current_amount, start_date, target_date, status, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        goal.id,
        accountId,
        trackingMode,
        JSON.stringify(linkedIds),
        goal.title,
        goal.category,
        goal.target_amount,
        goal.current_amount || 0,
        goal.start_date,
        goal.target_date ?? null,
        goal.status || "ACTIVE",
        goal.notes || "",
        goal.created_at || new Date().toISOString(),
        goal.updated_at || new Date().toISOString(),
      ]
    );
  } else {
    const store = loadLocalStore();
    store.goals.unshift({
      ...goal,
      account_id: accountId,
      tracking_mode: trackingMode,
      linked_trade_ids: linkedIds,
    });
    saveLocalStore(store);
  }

  await syncGoals();
  const refreshed = (await getGoals()).find((g) => g.id === goal.id);
  return refreshed || { ...goal, account_id: accountId, tracking_mode: trackingMode, linked_trade_ids: linkedIds };
}

export async function updateGoal(
  id: string,
  updates: Partial<Goal>,
  skipResync = false
): Promise<Goal | null> {
  const { isPostgres } = await checkConnection();
  let updated: Goal | null = null;

  if (isPostgres) {
    const p = getPool();
    const existingRes = await p.query("SELECT * FROM tracker_goals WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) return null;
    const existing = existingRes.rows[0];

    const trackingMode =
      updates.tracking_mode !== undefined
        ? updates.tracking_mode === "MANUAL_TRADES"
          ? "MANUAL_TRADES"
          : "AUTO_DATE"
        : existing.tracking_mode === "MANUAL_TRADES"
        ? "MANUAL_TRADES"
        : "AUTO_DATE";

    const linkedIds =
      updates.linked_trade_ids !== undefined
        ? parseLinkedTradeIds(updates.linked_trade_ids)
        : parseLinkedTradeIds(existing.linked_trade_ids);

    updated = {
      ...existing,
      ...updates,
      account_id: updates.account_id !== undefined ? updates.account_id : existing.account_id || "ALL",
      tracking_mode: trackingMode,
      linked_trade_ids: linkedIds,
      target_amount: Number(updates.target_amount ?? existing.target_amount ?? 0),
      current_amount: Number(updates.current_amount ?? existing.current_amount ?? 0),
      start_date: updates.start_date
        ? new Date(updates.start_date).toISOString()
        : new Date(existing.start_date).toISOString(),
      target_date:
        updates.target_date !== undefined
          ? updates.target_date
            ? new Date(updates.target_date).toISOString()
            : null
          : existing.target_date
          ? new Date(existing.target_date).toISOString()
          : null,
      updated_at: new Date().toISOString(),
    };

    await p.query(
      `UPDATE tracker_goals SET
        account_id = $1, tracking_mode = $2, linked_trade_ids = $3, title = $4, category = $5, target_amount = $6, current_amount = $7,
        start_date = $8, target_date = $9, status = $10, notes = $11, updated_at = $12
      WHERE id = $13`,
      [
        updated.account_id,
        trackingMode,
        JSON.stringify(linkedIds),
        updated.title,
        updated.category,
        updated.target_amount,
        updated.current_amount,
        updated.start_date,
        updated.target_date ?? null,
        updated.status,
        updated.notes || "",
        updated.updated_at,
        id,
      ]
    );
  } else {
    const store = loadLocalStore();
    const idx = store.goals.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    store.goals[idx] = {
      ...store.goals[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveLocalStore(store);
    updated = store.goals[idx];
  }

  if (!skipResync) {
    await syncGoals();
    const refreshed = (await getGoals()).find((g) => g.id === id);
    if (refreshed) return refreshed;
  }

  return updated;
}

export async function deleteGoal(id: string): Promise<boolean> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    await p.query("DELETE FROM tracker_goals WHERE id = $1", [id]);
  } else {
    const store = loadLocalStore();
    store.goals = store.goals.filter((g) => g.id !== id);
    saveLocalStore(store);
  }
  return true;
}

// -----------------------------------------------------------------------------
// DAILY SUMMARIES & STATS COMPUTATION
// -----------------------------------------------------------------------------
export async function syncDailySummary(dateKey: string): Promise<void> {
  const startDate = `${dateKey}T00:00:00.000Z`;
  const endDate = `${dateKey}T23:59:59.999Z`;

  const trades = await getTrades({ startDate, endDate });
  const cashflows = await getCashflows({ startDate, endDate });

  let total_pnl = 0;
  let wins = 0;
  let losses = 0;
  let breakeven = 0;

  for (const t of trades) {
    total_pnl += Number(t.pnl || 0);
    if (t.status === "WON") wins++;
    else if (t.status === "LOST") losses++;
    else if (t.status === "BREAKEVEN") breakeven++;
  }

  const total_trades = trades.length;
  const win_rate = total_trades > 0 ? Number(((wins / total_trades) * 100).toFixed(1)) : 0;

  let total_withdrawn = 0;
  let total_spent = 0;

  for (const c of cashflows) {
    if (c.type === "WITHDRAWAL") total_withdrawn += Number(c.amount || 0);
    else if (c.type === "EXPENSE") total_spent += Number(c.amount || 0);
  }

  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_daily_summaries (
        date, total_pnl, total_trades, wins, losses, breakeven, win_rate, total_withdrawn, total_spent, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (date) DO UPDATE SET
        total_pnl = EXCLUDED.total_pnl,
        total_trades = EXCLUDED.total_trades,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        breakeven = EXCLUDED.breakeven,
        win_rate = EXCLUDED.win_rate,
        total_withdrawn = EXCLUDED.total_withdrawn,
        total_spent = EXCLUDED.total_spent,
        updated_at = NOW()`,
      [dateKey, total_pnl, total_trades, wins, losses, breakeven, win_rate, total_withdrawn, total_spent]
    );
  } else {
    const store = loadLocalStore();
    store.dailySummaries[dateKey] = {
      date: dateKey,
      total_pnl,
      total_trades,
      wins,
      losses,
      breakeven,
      win_rate,
      total_withdrawn,
      total_spent,
    };
    saveLocalStore(store);
  }
}

export async function getDailySummaries(month?: string): Promise<Record<string, DailySummary>> {
  const { isPostgres } = await checkConnection();
  const result: Record<string, DailySummary> = {};

  if (isPostgres) {
    const p = getPool();
    let query = "SELECT * FROM tracker_daily_summaries";
    const values: any[] = [];
    if (month) {
      query += " WHERE TO_CHAR(date, 'YYYY-MM') = $1";
      values.push(month);
    }
    query += " ORDER BY date ASC";
    const res = await p.query(query, values);
    for (const r of res.rows) {
      const d = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date);
      result[d] = {
        date: d,
        total_pnl: Number(r.total_pnl),
        total_trades: Number(r.total_trades),
        wins: Number(r.wins),
        losses: Number(r.losses),
        breakeven: Number(r.breakeven),
        win_rate: Number(r.win_rate),
        total_withdrawn: Number(r.total_withdrawn),
        total_spent: Number(r.total_spent),
        notes: r.notes || "",
      };
    }
  } else {
    const store = loadLocalStore();
    for (const [k, v] of Object.entries(store.dailySummaries)) {
      if (!month || k.startsWith(month)) {
        result[k] = v;
      }
    }
  }

  return result;
}

export async function syncGoals(): Promise<void> {
  const trades = await getTrades();
  const cashflows = await getCashflows();
  const goals = await getGoals();

  for (const g of goals) {
    const startIso = g.start_date ? new Date(g.start_date).toISOString() : "1970-01-01T00:00:00.000Z";
    const startDateKey = startIso.split("T")[0];
    const startMs = new Date(startIso).getTime();
    const isExactTimestamp = !startIso.endsWith("T00:00:00.000Z");

    const targetDateKey = g.target_date ? new Date(g.target_date).toISOString().split("T")[0] : null;
    const filterAccount = g.account_id && g.account_id !== "ALL" ? g.account_id : null;
    const trackingMode = g.tracking_mode === "MANUAL_TRADES" ? "MANUAL_TRADES" : "AUTO_DATE";
    const linkedSet = new Set(parseLinkedTradeIds(g.linked_trade_ids));

    const inDateWindow = (isoDate: string) => {
      if (!isoDate) return false;
      const dateKey = isoDate.split("T")[0];
      if (isExactTimestamp) {
        if (new Date(isoDate).getTime() < startMs) return false;
      } else {
        if (dateKey < startDateKey) return false;
      }
      if (targetDateKey && dateKey > targetDateKey) return false;
      return true;
    };

    let newAmount = Number(g.current_amount || 0);

    if (g.category === "PROFIT_TARGET" || trackingMode === "MANUAL_TRADES") {
      const scopedTrades =
        trackingMode === "MANUAL_TRADES"
          ? trades.filter((t) => linkedSet.has(t.id))
          : trades.filter((t) => {
              if (linkedSet.has(t.id)) return true;
              if (filterAccount && (t.account_id || "acc_default") !== filterAccount) return false;
              return inDateWindow(t.trade_date);
            });
      const netPnl = scopedTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
      newAmount = Number(netPnl.toFixed(2));
    } else if (g.category === "WITHDRAWAL_GOAL") {
      const scopedWithdrawals = cashflows.filter((c) => {
        if (c.type !== "WITHDRAWAL") return false;
        if (filterAccount && (c.account_id || "acc_default") !== filterAccount) return false;
        return inDateWindow(c.date);
      });
      const totalWithdrawn = scopedWithdrawals.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      newAmount = Number(totalWithdrawn.toFixed(2));
    }

    let newStatus = g.status;
    if (
      g.category === "PROFIT_TARGET" ||
      g.category === "WITHDRAWAL_GOAL" ||
      trackingMode === "MANUAL_TRADES"
    ) {
      if (newAmount >= Number(g.target_amount || 0) && Number(g.target_amount || 0) > 0) {
        newStatus = "ACHIEVED";
      } else if (g.status === "ACHIEVED") {
        newStatus = "ACTIVE";
      }
    }

    if (newAmount !== Number(g.current_amount || 0) || newStatus !== g.status) {
      await updateGoal(g.id, { current_amount: newAmount, status: newStatus }, true);
    }
  }
}

export async function getDashboardStats(accountId?: string): Promise<DashboardStats> {
  const filterAcc = accountId && accountId !== "ALL" ? accountId : undefined;
  const trades = await getTrades(filterAcc ? { account_id: filterAcc } : undefined);
  const allCashflows = await getCashflows();
  const cashflows = filterAcc
    ? allCashflows.filter((c) => (c.account_id || "acc_default") === filterAcc)
    : allCashflows;

  let total_profit = 0;
  let total_loss = 0;
  let total_gross_pnl = 0;
  let total_trading_fees = 0;
  let total_funding_fees = 0;
  let won_trades = 0;
  let lost_trades = 0;
  let breakeven_trades = 0;
  let open_trades = 0;
  let largest_win = 0;
  let largest_loss = 0;

  const pairStats: Record<string, { pnl: number; count: number; wins: number }> = {};
  const dailyPnlMap: Record<string, number> = {};

  for (const t of trades) {
    const pnl = Number(t.pnl || 0);
    const gross = t.gross_pnl !== undefined && t.gross_pnl !== null ? Number(t.gross_pnl) : pnl;
    const tFee = Number(t.trading_fee || 0);
    const fFee = Number(t.funding_fee || 0);

    total_gross_pnl += gross;
    total_trading_fees += Math.abs(tFee);
    total_funding_fees += fFee;

    const dateKey = t.trade_date.split("T")[0];
    dailyPnlMap[dateKey] = (dailyPnlMap[dateKey] || 0) + pnl;

    const sym = t.symbol.toUpperCase();
    if (!pairStats[sym]) pairStats[sym] = { pnl: 0, count: 0, wins: 0 };
    pairStats[sym].pnl += pnl;
    pairStats[sym].count += 1;

    if (t.status === "WON" || pnl > 0) {
      won_trades++;
      pairStats[sym].wins += 1;
      total_profit += pnl;
      if (pnl > largest_win) largest_win = pnl;
    } else if (t.status === "LOST" || pnl < 0) {
      lost_trades++;
      total_loss += Math.abs(pnl);
      if (Math.abs(pnl) > largest_loss) largest_loss = Math.abs(pnl);
    } else if (t.status === "BREAKEVEN") {
      breakeven_trades++;
    } else if (t.status === "OPEN") {
      open_trades++;
    }
  }

  const net_pnl = total_profit - total_loss;
  // Total net fee impact (positive = cost paid)
  const total_fees = Number((total_trading_fees - total_funding_fees).toFixed(4));
  const closed_trades = won_trades + lost_trades + breakeven_trades;
  const win_rate = closed_trades > 0 ? Number(((won_trades / closed_trades) * 100).toFixed(1)) : 0;
  const profit_factor = total_loss > 0 ? Number((total_profit / total_loss).toFixed(2)) : total_profit > 0 ? 99.9 : 0;
  const average_win = won_trades > 0 ? Number((total_profit / won_trades).toFixed(2)) : 0;
  const average_loss = lost_trades > 0 ? Number((total_loss / lost_trades).toFixed(2)) : 0;

  const settings = await getUserSettings();
  let starting_balance = Number(settings.initial_balance || 10000);
  if (filterAcc) {
    const acc = await getAccountById(filterAcc);
    if (acc) {
      starting_balance = Number(acc.starting_balance ?? 0);
    }
  }

  let total_withdrawn = 0;
  let total_spent = 0;
  let total_deposits = 0;

  for (const c of cashflows) {
    const amt = Number(c.amount || 0);
    if (c.type === "WITHDRAWAL") total_withdrawn += amt;
    else if (c.type === "EXPENSE") total_spent += amt;
    else if (c.type === "DEPOSIT") total_deposits += amt;
  }

  const net_cashflow = total_deposits - total_withdrawn;
  const net_cash_extracted = total_withdrawn - total_deposits;
  const current_balance = Number((starting_balance + net_pnl + net_cashflow).toFixed(2));

  const sortedDates = Object.keys(dailyPnlMap).sort();
  let cumulative = 0;
  let runningBalance = starting_balance;
  let peakEquity = starting_balance;
  let maxDrawdownPct = 0;
  let maxDrawdownAmount = 0;

  const equity_curve = sortedDates.map((date) => {
    const dayPnl = dailyPnlMap[date];
    cumulative += dayPnl;
    runningBalance += dayPnl;

    if (runningBalance > peakEquity) {
      peakEquity = runningBalance;
    }

    const ddAmount = Math.max(0, peakEquity - runningBalance);
    const ddPct = peakEquity > 0 ? (ddAmount / peakEquity) * 100 : 0;

    if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    if (ddAmount > maxDrawdownAmount) maxDrawdownAmount = ddAmount;

    return {
      date,
      daily_pnl: Number(dayPnl.toFixed(2)),
      cumulative_pnl: Number(cumulative.toFixed(2)),
      balance: Number(runningBalance.toFixed(2)),
    };
  });

  const currentDdAmount = Math.max(0, peakEquity - current_balance);
  const currentDdPct = peakEquity > 0 ? Number(((currentDdAmount / peakEquity) * 100).toFixed(2)) : 0;

  const drawdown: DrawdownStats = {
    current_balance,
    starting_balance,
    peak_equity: Number(peakEquity.toFixed(2)),
    current_drawdown_pct: currentDdPct,
    current_drawdown_amount: Number(currentDdAmount.toFixed(2)),
    max_drawdown_pct: Number(maxDrawdownPct.toFixed(2)),
    max_drawdown_amount: Number(maxDrawdownAmount.toFixed(2)),
    net_closed_pnl: Number(net_pnl.toFixed(2)),
    net_cashflow: Number(net_cashflow.toFixed(2)),
  };

  const pair_distribution = Object.entries(pairStats)
    .map(([symbol, data]) => ({
      symbol,
      pnl: Number(data.pnl.toFixed(2)),
      count: data.count,
      win_rate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  // Exchange breakdown
  const exchangeStats: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (const t of trades) {
    const ex = (t.exchange?.trim() || "MANUAL").toUpperCase();
    if (!exchangeStats[ex]) exchangeStats[ex] = { pnl: 0, count: 0, wins: 0 };
    exchangeStats[ex].count += 1;
    exchangeStats[ex].pnl += Number(t.pnl || 0);
    if (t.status === "WON" || Number(t.pnl || 0) > 0) {
      exchangeStats[ex].wins += 1;
    }
  }

  const exchange_distribution = Object.entries(exchangeStats)
    .map(([exchange, data]) => ({
      exchange,
      pnl: Number(data.pnl.toFixed(2)),
      total_pnl: Number(data.pnl.toFixed(2)),
      count: data.count,
      win_rate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  const provider_distribution = await getSignalProviderStats(filterAcc);

  return {
    net_pnl: Number(net_pnl.toFixed(2)),
    gross_pnl: Number(total_gross_pnl.toFixed(2)),
    total_trading_fees: Number(total_trading_fees.toFixed(2)),
    total_funding_fees: Number(total_funding_fees.toFixed(2)),
    total_fees: Number(total_fees.toFixed(2)),
    total_profit: Number(total_profit.toFixed(2)),
    total_loss: Number(total_loss.toFixed(2)),
    win_rate,
    profit_factor,
    total_trades: trades.length,
    open_trades,
    won_trades,
    lost_trades,
    breakeven_trades,
    total_withdrawn: Number(total_withdrawn.toFixed(2)),
    total_spent: Number(total_spent.toFixed(2)),
    net_cash_extracted: Number(net_cash_extracted.toFixed(2)),
    average_win,
    average_loss,
    largest_win: Number(largest_win.toFixed(2)),
    largest_loss: Number(largest_loss.toFixed(2)),
    starting_balance,
    living_balance: current_balance,
    drawdown,
    equity_curve,
    pair_distribution,
    provider_distribution,
    exchange_distribution,
  };
}

// -----------------------------------------------------------------------------
// SIGNAL PROVIDERS API
// -----------------------------------------------------------------------------
const PROVIDER_COLORS = ["sky", "violet", "emerald", "amber", "rose", "fuchsia", "cyan", "indigo"];

export async function getSignalProviders(): Promise<SignalProvider[]> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT * FROM tracker_signal_providers ORDER BY created_at ASC");
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      notes: r.notes || "",
      telegram_handle: r.telegram_handle || "",
      color: r.color || "sky",
      created_at: new Date(r.created_at).toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    }));
  } else {
    const store = loadLocalStore();
    return store.signal_providers || [];
  }
}

export async function ensureSignalProviderExists(name: string, notes?: string): Promise<SignalProvider> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Provider name is required");

  const existingProviders = await getSignalProviders();
  const existing = existingProviders.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) return existing;

  const colorIndex = existingProviders.length % PROVIDER_COLORS.length;
  const color = PROVIDER_COLORS[colorIndex];
  return await createSignalProvider({ name: cleanName, notes: notes || `Signals from ${cleanName}`, color });
}

export async function createSignalProvider(data: Partial<SignalProvider>): Promise<SignalProvider> {
  const { isPostgres } = await checkConnection();
  const now = new Date().toISOString();
  const id = data.id || `sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const name = data.name?.trim() || "Unknown Trader";
  const notes = data.notes?.trim() || "";
  const telegram_handle = data.telegram_handle?.trim() || "";
  const color = data.color || PROVIDER_COLORS[Math.floor(Math.random() * PROVIDER_COLORS.length)];

  const provider: SignalProvider = {
    id,
    name,
    notes,
    telegram_handle,
    color,
    created_at: now,
    updated_at: now,
  };

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_signal_providers (id, name, notes, telegram_handle, color, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name) DO UPDATE SET notes = EXCLUDED.notes, telegram_handle = EXCLUDED.telegram_handle, color = EXCLUDED.color, updated_at = NOW()`,
      [id, name, notes, telegram_handle, color, now, now]
    );
  } else {
    const store = loadLocalStore();
    if (!store.signal_providers) store.signal_providers = [];
    const idx = store.signal_providers.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    if (idx !== -1) {
      store.signal_providers[idx] = { ...store.signal_providers[idx], notes, telegram_handle, color, updated_at: now };
    } else {
      store.signal_providers.push(provider);
    }
    saveLocalStore(store);
  }

  return provider;
}

export async function deleteSignalProvider(idOrName: string): Promise<boolean> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    await p.query("DELETE FROM tracker_signal_providers WHERE id = $1 OR UPPER(name) = UPPER($1)", [idOrName]);
    return true;
  } else {
    const store = loadLocalStore();
    if (!store.signal_providers) return false;
    store.signal_providers = store.signal_providers.filter(
      (p) => p.id !== idOrName && p.name.toLowerCase() !== idOrName.toLowerCase()
    );
    saveLocalStore(store);
    return true;
  }
}

export async function getSignalProviderStats(accountId?: string): Promise<SignalProviderStats[]> {
  const trades = await getTrades(accountId && accountId !== "ALL" ? { account_id: accountId } : undefined);
  const registeredProviders = await getSignalProviders();

  // Map of known providers
  const providerMap = new Map<string, { id: string; name: string; notes?: string; telegram_handle?: string; color: string }>();

  // Ensure 'Self' always exists
  providerMap.set("self", {
    id: "sp_self",
    name: "Self",
    notes: "My own independent analysis & trades",
    telegram_handle: "",
    color: "sky",
  });

  for (const p of registeredProviders) {
    providerMap.set(p.name.toLowerCase(), {
      id: p.id,
      name: p.name,
      notes: p.notes,
      telegram_handle: p.telegram_handle,
      color: p.color || "violet",
    });
  }

  // Also discover any provider names from trades that might not be registered
  for (const t of trades) {
    const name = t.signal_provider?.trim() || "Self";
    const key = name.toLowerCase();
    if (!providerMap.has(key)) {
      providerMap.set(key, {
        id: `sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        notes: `Signals from ${name}`,
        telegram_handle: "",
        color: PROVIDER_COLORS[providerMap.size % PROVIDER_COLORS.length],
      });
    }
  }

  // Calculate detailed stats for each provider
  const statsList: SignalProviderStats[] = [];

  for (const [key, meta] of providerMap.entries()) {
    const isSelf = key === "self";
    const providerTrades = trades.filter((t) => {
      const pName = (t.signal_provider?.trim() || "Self").toLowerCase();
      return pName === key;
    });

    let total_profit = 0;
    let total_loss = 0;
    let won_trades = 0;
    let lost_trades = 0;
    let breakeven_trades = 0;
    let largest_win = 0;
    let largest_loss = 0;

    const pairMap: Record<string, { count: number; pnl: number; wins: number }> = {};

    for (const t of providerTrades) {
      const pnl = Number(t.pnl || 0);
      const sym = t.symbol.toUpperCase();
      if (!pairMap[sym]) pairMap[sym] = { count: 0, pnl: 0, wins: 0 };
      pairMap[sym].count += 1;
      pairMap[sym].pnl += pnl;

      if (t.status === "WON" || pnl > 0) {
        won_trades++;
        pairMap[sym].wins += 1;
        total_profit += pnl;
        if (pnl > largest_win) largest_win = pnl;
      } else if (t.status === "LOST" || pnl < 0) {
        lost_trades++;
        total_loss += Math.abs(pnl);
        if (Math.abs(pnl) > largest_loss) largest_loss = Math.abs(pnl);
      } else if (t.status === "BREAKEVEN") {
        breakeven_trades++;
      }
    }

    const total_trades = providerTrades.length;
    const closed_trades = won_trades + lost_trades + breakeven_trades;
    const win_rate = closed_trades > 0 ? Number(((won_trades / closed_trades) * 100).toFixed(1)) : 0;
    const total_pnl = total_profit - total_loss;
    const profit_factor = total_loss > 0 ? Number((total_profit / total_loss).toFixed(2)) : total_profit > 0 ? 99.9 : 0;
    const average_win = won_trades > 0 ? Number((total_profit / won_trades).toFixed(2)) : 0;
    const average_loss = lost_trades > 0 ? Number((total_loss / lost_trades).toFixed(2)) : 0;
    const expectancy = total_trades > 0 ? Number((total_pnl / total_trades).toFixed(2)) : 0;

    const top_pairs = Object.entries(pairMap)
      .map(([symbol, data]) => ({
        symbol,
        count: data.count,
        pnl: Number(data.pnl.toFixed(2)),
        win_rate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    statsList.push({
      name: meta.name,
      is_self: isSelf,
      color: meta.color,
      notes: meta.notes,
      telegram_handle: meta.telegram_handle,
      total_pnl: Number(total_pnl.toFixed(2)),
      total_trades,
      wins: won_trades,
      losses: lost_trades,
      breakeven: breakeven_trades,
      win_rate,
      profit_factor,
      total_profit: Number(total_profit.toFixed(2)),
      total_loss: Number(total_loss.toFixed(2)),
      average_win,
      average_loss,
      largest_win: Number(largest_win.toFixed(2)),
      largest_loss: Number(largest_loss.toFixed(2)),
      expectancy,
      top_pairs,
      recent_trades: providerTrades.slice(0, 5),
    });
  }

  // Sort: Put "Self" first, then sort followed signal providers by highest net_pnl descending
  return statsList.sort((a, b) => {
    if (a.is_self) return -1;
    if (b.is_self) return 1;
    return b.total_pnl - a.total_pnl;
  });
}

// -----------------------------------------------------------------------------
// USER SETTINGS API
// -----------------------------------------------------------------------------
const DEFAULT_SETTINGS: UserSettings = {
  initial_balance: 10000,
  currency: "USD",
  risk_percentage: 1.0,
  default_leverage: 100,
  max_drawdown_limit: 10,
};

export async function getUserSettings(): Promise<UserSettings> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT value FROM tracker_settings WHERE key = 'user_settings'");
    if (res.rows.length > 0 && res.rows[0].value) {
      return { ...DEFAULT_SETTINGS, ...res.rows[0].value };
    }
    return DEFAULT_SETTINGS;
  } else {
    const store = loadLocalStore();
    return { ...DEFAULT_SETTINGS, ...(store.settings || {}) };
  }
}

export async function updateUserSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings();
  const updated: UserSettings = { ...current, ...updates };

  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_settings (key, value, updated_at)
       VALUES ('user_settings', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(updated)]
    );
  } else {
    const store = loadLocalStore();
    store.settings = updated;
    saveLocalStore(store);
  }
  return updated;
}

// -----------------------------------------------------------------------------
// TRADING ACCOUNTS / PORTFOLIOS API (MULTI-TARGET & LOSS RECOVERY)
// -----------------------------------------------------------------------------
export async function getAccounts(): Promise<TradingAccount[]> {
  const { isPostgres } = await checkConnection();
  let accounts: TradingAccount[] = [];

  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT * FROM tracker_accounts ORDER BY is_default DESC, created_at ASC");
    accounts = res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type || "PERSONAL",
      starting_balance: Number(r.starting_balance || 0),
      target_amount: Number(r.target_amount || 0),
      initial_loss: Number(r.initial_loss || 0),
      color: r.color || "sky",
      notes: r.notes || "",
      is_default: Boolean(r.is_default),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    }));
    if (accounts.length === 0) {
      accounts = [{ ...DEFAULT_ACCOUNT }];
    }
  } else {
    const store = loadLocalStore();
    accounts = store.accounts && store.accounts.length > 0 ? store.accounts : [{ ...DEFAULT_ACCOUNT }];
  }

  // Enrich each account with live P&L, fees, win rate, and target/recovery progress
  const allTrades = await getTrades();
  const allCashflows = await getCashflows();

  return accounts.map((acc) => {
    const accTrades = allTrades.filter((t) => (t.account_id || "acc_default") === acc.id);
    const accCashflows = allCashflows.filter((c) => (c.account_id || "acc_default") === acc.id);

    let net_pnl = 0;
    let gross_pnl = 0;
    let total_fees = 0;
    let wins = 0;
    let losses = 0;

    for (const t of accTrades) {
      const p = Number(t.pnl || 0);
      const g = t.gross_pnl !== undefined && t.gross_pnl !== null ? Number(t.gross_pnl) : p;
      const tf = Math.abs(Number(t.trading_fee || 0));
      const ff = Number(t.funding_fee || 0);
      net_pnl += p;
      gross_pnl += g;
      total_fees += tf - ff;
      if (t.status === "WON" || p > 0) wins++;
      else if (t.status === "LOST" || p < 0) losses++;
    }

    let netCashflow = 0;
    for (const c of accCashflows) {
      if (c.type === "DEPOSIT") netCashflow += Number(c.amount || 0);
      else if (c.type === "WITHDRAWAL") netCashflow -= Number(c.amount || 0);
    }

    const closed = wins + losses;
    const win_rate = closed > 0 ? Number(((wins / closed) * 100).toFixed(1)) : 0;
    const current_balance = Number((Number(acc.starting_balance || 0) + net_pnl + netCashflow).toFixed(2));

    // Target or Recovery progress calculation
    const goalTarget =
      acc.type === "RECOVERY"
        ? Number(acc.initial_loss || acc.target_amount || 0)
        : Number(acc.target_amount || 0);
    const progress_pct =
      goalTarget > 0 ? Number(Math.max(0, Math.min(100, (net_pnl / goalTarget) * 100)).toFixed(1)) : 0;

    return {
      ...acc,
      net_pnl: Number(net_pnl.toFixed(2)),
      gross_pnl: Number(gross_pnl.toFixed(2)),
      total_fees: Number(total_fees.toFixed(2)),
      total_trades: accTrades.length,
      wins,
      losses,
      win_rate,
      current_balance,
      progress_pct,
    };
  });
}

export async function getAccountById(id: string): Promise<TradingAccount | null> {
  const accounts = await getAccounts();
  return accounts.find((a) => a.id === id) || null;
}

export async function createAccount(data: Partial<TradingAccount>): Promise<TradingAccount> {
  const { isPostgres } = await checkConnection();
  const now = new Date().toISOString();
  const id = data.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const name = data.name?.trim() || "New Account";
  const type = data.type || "TARGET";
  const starting_balance = Number(data.starting_balance ?? 0);
  const target_amount = Number(data.target_amount ?? 0);
  const initial_loss = Number(data.initial_loss ?? (type === "RECOVERY" ? target_amount : 0));
  const color = data.color || (type === "RECOVERY" ? "amber" : type === "TARGET" ? "emerald" : "sky");
  const notes = data.notes?.trim() || "";
  const is_default = Boolean(data.is_default);

  const account: TradingAccount = {
    id,
    name,
    type,
    starting_balance,
    target_amount,
    initial_loss,
    color,
    notes,
    is_default,
    created_at: now,
    updated_at: now,
  };

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_accounts (id, name, type, starting_balance, target_amount, initial_loss, color, notes, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, name, type, starting_balance, target_amount, initial_loss, color, notes, is_default, now, now]
    );
  } else {
    const store = loadLocalStore();
    if (!store.accounts) store.accounts = [{ ...DEFAULT_ACCOUNT }];
    store.accounts.push(account);
    saveLocalStore(store);
  }

  return account;
}

export async function updateAccount(id: string, updates: Partial<TradingAccount>): Promise<TradingAccount | null> {
  const existing = await getAccountById(id);
  if (!existing) return null;

  const updated: TradingAccount = {
    ...existing,
    ...updates,
    id,
    name: updates.name !== undefined ? updates.name.trim() || existing.name : existing.name,
    starting_balance:
      updates.starting_balance !== undefined ? Number(updates.starting_balance) : existing.starting_balance,
    target_amount: updates.target_amount !== undefined ? Number(updates.target_amount) : existing.target_amount,
    initial_loss: updates.initial_loss !== undefined ? Number(updates.initial_loss) : existing.initial_loss,
    updated_at: new Date().toISOString(),
  };

  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query(
      `UPDATE tracker_accounts SET name = $1, type = $2, starting_balance = $3, target_amount = $4, initial_loss = $5, color = $6, notes = $7, updated_at = NOW()
       WHERE id = $8`,
      [
        updated.name,
        updated.type,
        updated.starting_balance,
        updated.target_amount,
        updated.initial_loss,
        updated.color,
        updated.notes || "",
        id,
      ]
    );
  } else {
    const store = loadLocalStore();
    const idx = (store.accounts || []).findIndex((a) => a.id === id);
    if (idx !== -1) {
      store.accounts[idx] = updated;
      saveLocalStore(store);
    }
  }

  return updated;
}

export async function deleteAccount(id: string): Promise<boolean> {
  if (id === "acc_default") {
    throw new Error("Cannot delete the primary Main Account");
  }
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    // Move any trades in this account safely back to Main Account rather than losing them
    await p.query("UPDATE tracker_trades SET account_id = 'acc_default' WHERE account_id = $1", [id]);
    await p.query("UPDATE tracker_exchange_connections SET account_id = 'acc_default' WHERE account_id = $1", [id]);
    await p.query("DELETE FROM tracker_accounts WHERE id = $1", [id]);
    return true;
  } else {
    const store = loadLocalStore();
    store.trades = store.trades.map((t) => (t.account_id === id ? { ...t, account_id: "acc_default" } : t));
    store.accounts = (store.accounts || []).filter((a) => a.id !== id);
    saveLocalStore(store);
    return true;
  }
}

// -----------------------------------------------------------------------------
// EXCHANGE CONNECTIONS & AUTO-SYNC API
// -----------------------------------------------------------------------------
export async function getExchangeConnections(): Promise<ExchangeConnection[]> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT * FROM tracker_exchange_connections ORDER BY created_at ASC");
    return res.rows.map((r: any) => ({
      id: r.id,
      exchange: r.exchange,
      name: r.name,
      api_key: r.api_key,
      api_secret: r.api_secret,
      account_type: r.account_type || "FUTURES",
      account_id: r.account_id || "acc_default",
      auto_sync: r.auto_sync ?? true,
      sync_from_date: r.sync_from_date ? new Date(r.sync_from_date).toISOString() : null,
      last_synced_trade_time: r.last_synced_trade_time ? Number(r.last_synced_trade_time) : null,
      is_active: r.is_active ?? true,
      last_synced_at: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    }));
  } else {
    const store = loadLocalStore();
    return (store.exchange_connections || []).map((c) => ({
      ...c,
      account_id: c.account_id || "acc_default",
      auto_sync: c.auto_sync ?? true,
    }));
  }
}

export async function saveExchangeConnection(conn: Partial<ExchangeConnection>): Promise<ExchangeConnection> {
  const { isPostgres } = await checkConnection();
  const now = new Date().toISOString();
  const id = conn.id || `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const exchange = conn.exchange || "binance";
  const name = conn.name?.trim() || `${exchange.toUpperCase()} Connection`;
  const api_key = conn.api_key?.trim() || "";
  const api_secret = conn.api_secret?.trim() || "";
  const account_type = conn.account_type || "FUTURES";
  const account_id = conn.account_id || "acc_default";
  const auto_sync = conn.auto_sync ?? true;
  const sync_from_date = conn.sync_from_date || null;
  const is_active = conn.is_active ?? true;

  const item: ExchangeConnection = {
    id,
    exchange,
    name,
    api_key,
    api_secret,
    account_type,
    account_id,
    auto_sync,
    sync_from_date,
    last_synced_trade_time: conn.last_synced_trade_time ?? null,
    is_active,
    last_synced_at: conn.last_synced_at || null,
    created_at: now,
    updated_at: now,
  };

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_exchange_connections (id, exchange, name, api_key, api_secret, account_type, account_id, auto_sync, sync_from_date, is_active, last_synced_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         exchange = EXCLUDED.exchange,
         name = EXCLUDED.name,
         api_key = EXCLUDED.api_key,
         api_secret = EXCLUDED.api_secret,
         account_type = EXCLUDED.account_type,
         account_id = EXCLUDED.account_id,
         auto_sync = EXCLUDED.auto_sync,
         sync_from_date = EXCLUDED.sync_from_date,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      [id, exchange, name, api_key, api_secret, account_type, account_id, auto_sync, sync_from_date, is_active, item.last_synced_at, now, now]
    );
  } else {
    const store = loadLocalStore();
    if (!store.exchange_connections) store.exchange_connections = [];
    const idx = store.exchange_connections.findIndex((c) => c.id === id);
    if (idx !== -1) {
      store.exchange_connections[idx] = item;
    } else {
      store.exchange_connections.push(item);
    }
    saveLocalStore(store);
  }
  return item;
}

export async function updateExchangeConnectionSettings(
  id: string,
  updates: { account_id?: string; auto_sync?: boolean; sync_from_date?: string | null; name?: string }
): Promise<boolean> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (updates.account_id !== undefined) {
      sets.push(`account_id = $${idx++}`);
      vals.push(updates.account_id);
    }
    if (updates.auto_sync !== undefined) {
      sets.push(`auto_sync = $${idx++}`);
      vals.push(updates.auto_sync);
    }
    if (updates.sync_from_date !== undefined) {
      sets.push(`sync_from_date = $${idx++}`);
      vals.push(updates.sync_from_date || null);
    }
    if (updates.name !== undefined) {
      sets.push(`name = $${idx++}`);
      vals.push(updates.name.trim());
    }
    if (sets.length === 0) return true;
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    await p.query(`UPDATE tracker_exchange_connections SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
    return true;
  } else {
    const store = loadLocalStore();
    const idx = (store.exchange_connections || []).findIndex((c) => c.id === id);
    if (idx === -1) return false;
    store.exchange_connections[idx] = {
      ...store.exchange_connections[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveLocalStore(store);
    return true;
  }
}

export async function deleteExchangeConnection(id: string): Promise<boolean> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query("DELETE FROM tracker_exchange_connections WHERE id = $1", [id]);
    return true;
  } else {
    const store = loadLocalStore();
    if (!store.exchange_connections) return false;
    store.exchange_connections = store.exchange_connections.filter((c) => c.id !== id);
    saveLocalStore(store);
    return true;
  }
}

export async function syncExchange(
  id: string,
  options?: { forceFull?: boolean }
): Promise<ExchangeSyncResult> {
  const connections = await getExchangeConnections();
  const conn = connections.find((c) => c.id === id);
  if (!conn) {
    return {
      success: false,
      exchange: "unknown",
      importedTrades: 0,
      skippedIgnored: 0,
      importedCashflows: 0,
      message: "Connection not found",
    };
  }

  let importedTrades = 0;
  let skippedIgnored = 0;
  let importedCashflows = 0;
  let liveBalance: number | undefined;
  let maxTradeTimeMs = conn.last_synced_trade_time || 0;

  // Determine incremental cutoff timestamp:
  // Always honor sync_from_date if set. If not forceFull and we already synced positions before,
  // use (last_synced_trade_time - 2 hours safety overlap) so only latest closed positions are scanned!
  const syncFromMs = conn.sync_from_date ? new Date(conn.sync_from_date).getTime() : 0;
  let sinceMs: number | undefined = syncFromMs > 0 ? syncFromMs : undefined;
  if (!options?.forceFull && conn.last_synced_trade_time && conn.last_synced_trade_time > 0) {
    const incrementalMs = Math.max(0, conn.last_synced_trade_time - 2 * 60 * 60 * 1000);
    sinceMs = Math.max(syncFromMs, incrementalMs);
  }

  const targetAccountId = conn.account_id || "acc_default";

  try {
    let rawPositions: Partial<Trade>[] = [];

    if (conn.exchange === "binance") {
      const client = new BinanceClient(conn.api_key, conn.api_secret);
      const test = await client.testConnection();
      if (!test.success) {
        return {
          success: false,
          exchange: "binance",
          importedTrades: 0,
          skippedIgnored: 0,
          importedCashflows: 0,
          message: test.message,
        };
      }
      liveBalance = test.balance;
      rawPositions = await client.getFuturesClosedPositions(sinceMs);
    } else if (conn.exchange === "bybit") {
      const client = new BybitClient(conn.api_key, conn.api_secret);
      const test = await client.testConnection();
      if (!test.success) {
        return {
          success: false,
          exchange: "bybit",
          importedTrades: 0,
          skippedIgnored: 0,
          importedCashflows: 0,
          message: test.message,
        };
      }
      liveBalance = test.balance;
      rawPositions = await client.getClosedPnL(100, sinceMs);
    }

    for (const t of rawPositions) {
      if (!t.exchange_trade_id) continue;

      const tMs = t.trade_date ? new Date(t.trade_date).getTime() : 0;
      if (syncFromMs > 0 && tMs > 0 && tMs < syncFromMs) {
        continue;
      }

      // Skip if user previously deleted this position
      const isIgnored = await isExchangeTradeIgnored(t.exchange_trade_id);
      if (isIgnored) {
        skippedIgnored++;
        if (tMs > maxTradeTimeMs) maxTradeTimeMs = tMs;
        continue;
      }

      // Skip if already imported
      const existing = await getTradeByExchangeId(t.exchange_trade_id);
      if (existing) {
        if (tMs > maxTradeTimeMs) maxTradeTimeMs = tMs;
        continue;
      }

      const now = new Date().toISOString();
      const newTrade: Trade = {
        id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        account_id: targetAccountId,
        symbol: t.symbol || "BTCUSDT",
        market: "CRYPTO",
        direction: t.direction || "LONG",
        entry_price: t.entry_price ?? null,
        exit_price: t.exit_price ?? null,
        quantity: t.quantity ?? 1,
        gross_pnl: t.gross_pnl ?? t.pnl ?? 0,
        trading_fee: t.trading_fee ?? 0,
        funding_fee: t.funding_fee ?? 0,
        pnl: t.pnl || 0,
        status: t.status || "OPEN",
        trade_date: t.trade_date || now,
        closed_date: t.closed_date || t.trade_date || now,
        exchange: conn.exchange.toUpperCase(),
        exchange_trade_id: t.exchange_trade_id,
        strategy: "Exchange Auto-Sync",
        signal_provider: "Self",
        reason_entry: t.reason_entry || `Auto-synced from ${conn.exchange.toUpperCase()}`,
        reason_outcome: t.reason_outcome || "",
        created_at: now,
        updated_at: now,
      };
      await createTrade(newTrade);
      importedTrades++;
      if (tMs > maxTradeTimeMs) maxTradeTimeMs = tMs;
    }

    // Update connection last_synced_at & last_synced_trade_time
    const now = new Date().toISOString();
    const { isPostgres } = await checkConnection();
    if (isPostgres) {
      const p = getPool();
      await p.query(
        "UPDATE tracker_exchange_connections SET last_synced_at = NOW(), last_synced_trade_time = $1, updated_at = NOW() WHERE id = $2",
        [maxTradeTimeMs || null, id]
      );
    } else {
      const store = loadLocalStore();
      const idx = store.exchange_connections.findIndex((c) => c.id === id);
      if (idx !== -1) {
        store.exchange_connections[idx].last_synced_at = now;
        store.exchange_connections[idx].last_synced_trade_time = maxTradeTimeMs || null;
        saveLocalStore(store);
      }
    }

    return {
      success: true,
      exchange: conn.exchange,
      importedTrades,
      skippedIgnored,
      importedCashflows,
      liveBalance,
      message:
        importedTrades > 0
          ? `Synced ${importedTrades} new closed position(s)${skippedIgnored > 0 ? ` (${skippedIgnored} deleted skipped)` : ""}.`
          : `Already up to date. No new closed positions found.`,
    };
  } catch (err: any) {
    return {
      success: false,
      exchange: conn.exchange,
      importedTrades: 0,
      skippedIgnored: 0,
      importedCashflows: 0,
      message: err.message,
    };
  }
}

export async function syncAllExchanges(options?: {
  auto?: boolean;
  forceFull?: boolean;
}): Promise<{ results: ExchangeSyncResult[]; totalImported: number; skippedCooldown?: boolean }> {
  const connections = await getExchangeConnections();
  let active = connections.filter((c) => c.is_active);

  // In background auto-sync mode, only sync connections with auto_sync enabled
  // and skip if synced within the last 60 seconds to prevent rate-limiting.
  if (options?.auto) {
    const nowMs = Date.now();
    active = active.filter((c) => {
      if (c.auto_sync === false) return false;
      if (c.last_synced_at) {
        const diffMs = nowMs - new Date(c.last_synced_at).getTime();
        if (diffMs < 60_000) return false;
      }
      return true;
    });
    if (active.length === 0) {
      return { results: [], totalImported: 0, skippedCooldown: true };
    }
  }

  const results: ExchangeSyncResult[] = [];
  let totalImported = 0;

  for (const c of active) {
    const res = await syncExchange(c.id, { forceFull: options?.forceFull });
    results.push(res);
    totalImported += res.importedTrades;
  }

  return { results, totalImported };
}

export interface PreviewExchangePosition extends Partial<Trade> {
  connection_id: string;
  connection_name: string;
  default_account_id: string;
  alreadyImported: boolean;
  wasDeleted: boolean;
}

export async function previewExchangePositions(
  connectionId?: string
): Promise<{ success: boolean; positions: PreviewExchangePosition[]; errors: string[] }> {
  const connections = await getExchangeConnections();
  const targets = connectionId
    ? connections.filter((c) => c.id === connectionId)
    : connections.filter((c) => c.is_active);

  if (targets.length === 0) {
    return { success: false, positions: [], errors: ["No active exchange connections found."] };
  }

  // Load existing & ignored exchange_trade_ids once for fast O(1) lookup
  const existingTrades = await getTrades();
  const existingIds = new Set(
    existingTrades.map((t) => t.exchange_trade_id).filter((id): id is string => Boolean(id))
  );

  const ignoredIds = new Set<string>();
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT exchange_trade_id FROM tracker_ignored_exchange_trades");
    for (const r of res.rows) {
      if (r.exchange_trade_id) ignoredIds.add(String(r.exchange_trade_id));
    }
  } else {
    const store = loadLocalStore();
    for (const id of store.ignored_exchange_trade_ids || []) {
      ignoredIds.add(id);
    }
  }

  const positions: PreviewExchangePosition[] = [];
  const errors: string[] = [];

  for (const conn of targets) {
    try {
      let raw: Partial<Trade>[] = [];
      if (conn.exchange === "binance") {
        const client = new BinanceClient(conn.api_key, conn.api_secret);
        raw = await client.getFuturesClosedPositions();
      } else if (conn.exchange === "bybit") {
        const client = new BybitClient(conn.api_key, conn.api_secret);
        raw = await client.getClosedPnL(100);
      }

      for (const item of raw) {
        if (!item.exchange_trade_id) continue;
        positions.push({
          ...item,
          exchange: conn.exchange.toUpperCase(),
          connection_id: conn.id,
          connection_name: conn.name,
          default_account_id: conn.account_id || "acc_default",
          alreadyImported: existingIds.has(item.exchange_trade_id),
          wasDeleted: ignoredIds.has(item.exchange_trade_id),
        });
      }
    } catch (err: any) {
      errors.push(`${conn.name}: ${err.message}`);
    }
  }

  positions.sort((a, b) => {
    const ta = new Date(a.trade_date || 0).getTime();
    const tb = new Date(b.trade_date || 0).getTime();
    return tb - ta;
  });

  return { success: true, positions, errors };
}

export async function importSelectedExchangePositions(
  positions: Partial<Trade>[],
  options?: { account_id?: string; signal_provider?: string }
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const t of positions) {
    if (!t.exchange_trade_id) {
      skipped++;
      continue;
    }

    // Explicitly un-ignore this trade ID so the user can restore a previously deleted trade
    await removeIgnoredExchangeTrade(t.exchange_trade_id);

    const existing = await getTradeByExchangeId(t.exchange_trade_id);
    if (existing) {
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    const newTrade: Trade = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      account_id: options?.account_id || t.account_id || "acc_default",
      symbol: (t.symbol || "BTCUSDT").toUpperCase(),
      market: "CRYPTO",
      direction: t.direction || "LONG",
      entry_price: t.entry_price ?? null,
      exit_price: t.exit_price ?? null,
      quantity: t.quantity ?? 1,
      gross_pnl: t.gross_pnl ?? t.pnl ?? 0,
      trading_fee: t.trading_fee ?? 0,
      funding_fee: t.funding_fee ?? 0,
      pnl: Number(t.pnl || 0),
      status: t.status || (Number(t.pnl || 0) > 0 ? "WON" : Number(t.pnl || 0) < 0 ? "LOST" : "BREAKEVEN"),
      trade_date: t.trade_date || now,
      closed_date: t.closed_date || t.trade_date || now,
      exchange: (t.exchange || "BINANCE").toUpperCase(),
      exchange_trade_id: t.exchange_trade_id,
      strategy: t.strategy || "Exchange Auto-Sync",
      signal_provider: options?.signal_provider?.trim() || t.signal_provider || "Self",
      reason_entry: t.reason_entry || "Imported selectively from exchange",
      reason_outcome: t.reason_outcome || "",
      created_at: now,
      updated_at: now,
    };

    await createTrade(newTrade);
    imported++;
  }

  return { imported, skipped };
}

// -----------------------------------------------------------------------------
// CUSTOM INDICATORS (PINE SCRIPT & JS) API
// -----------------------------------------------------------------------------
export async function getIndicators(): Promise<CustomIndicator[]> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT * FROM tracker_indicators ORDER BY created_at DESC");
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      language: r.language === "js" ? "js" : "pine",
      overlay: r.overlay ?? true,
      is_enabled: r.is_enabled ?? true,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    }));
  } else {
    const store = loadLocalStore();
    return store.indicators || [];
  }
}

export async function saveIndicator(data: Partial<CustomIndicator>): Promise<CustomIndicator> {
  const { isPostgres } = await checkConnection();
  const now = new Date().toISOString();
  const id = data.id || `ind_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const name = data.name?.trim() || "Custom Indicator";
  const code = data.code || "";
  const language: "pine" | "js" = data.language === "js" ? "js" : "pine";
  const overlay = data.overlay ?? true;
  const is_enabled = data.is_enabled ?? true;

  const item: CustomIndicator = {
    id,
    name,
    code,
    language,
    overlay,
    is_enabled,
    created_at: now,
    updated_at: now,
  };

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_indicators (id, name, code, language, overlay, is_enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         language = EXCLUDED.language,
         overlay = EXCLUDED.overlay,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()`,
      [id, name, code, language, overlay, is_enabled, now, now]
    );
  } else {
    const store = loadLocalStore();
    if (!store.indicators) store.indicators = [];
    const idx = store.indicators.findIndex((i) => i.id === id);
    if (idx !== -1) {
      store.indicators[idx] = item;
    } else {
      store.indicators.unshift(item);
    }
    saveLocalStore(store);
  }
  return item;
}

export async function deleteIndicator(id: string): Promise<boolean> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query("DELETE FROM tracker_indicators WHERE id = $1", [id]);
    return true;
  } else {
    const store = loadLocalStore();
    store.indicators = (store.indicators || []).filter((i) => i.id !== id);
    saveLocalStore(store);
    return true;
  }
}

// -----------------------------------------------------------------------------
// AUTH PASSWORD & BRUTE-FORCE PROTECTION (5 ATTEMPTS MAX, 15 MIN LOCKOUT)
// -----------------------------------------------------------------------------
export const MAX_AUTH_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const localAuthAttempts = new Map<string, { failed_count: number; locked_until: number | null }>();

export async function getStoredPasswordHash(): Promise<{ salt: string; hash: string } | null> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT value FROM tracker_settings WHERE key = 'auth_password_hash'");
    if (res.rows.length > 0 && res.rows[0].value?.hash && res.rows[0].value?.salt) {
      return { salt: String(res.rows[0].value.salt), hash: String(res.rows[0].value.hash) };
    }
    return null;
  } else {
    const store = loadLocalStore();
    const v = store.settings?.auth_password_hash;
    if (v?.hash && v?.salt) return { salt: String(v.salt), hash: String(v.hash) };
    return null;
  }
}

export async function setStoredPasswordHash(salt: string, hash: string): Promise<void> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_settings (key, value, updated_at)
       VALUES ('auth_password_hash', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ salt, hash })]
    );
  } else {
    const store = loadLocalStore();
    if (!store.settings) store.settings = {};
    store.settings.auth_password_hash = { salt, hash };
    saveLocalStore(store);
  }
}

export interface AuthAttemptState {
  failedCount: number;
  remainingAttempts: number;
  isLocked: boolean;
  lockedUntilMs: number | null;
  retryAfterSeconds: number;
}

export async function getAuthAttemptState(ip: string): Promise<AuthAttemptState> {
  const now = Date.now();
  const { isPostgres } = await checkConnection();

  let failedCount = 0;
  let lockedUntilMs: number | null = null;

  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT failed_count, locked_until FROM tracker_auth_attempts WHERE ip = $1", [ip]);
    if (res.rows.length > 0) {
      failedCount = Number(res.rows[0].failed_count || 0);
      lockedUntilMs = res.rows[0].locked_until ? new Date(res.rows[0].locked_until).getTime() : null;
    }
  } else {
    const rec = localAuthAttempts.get(ip);
    if (rec) {
      failedCount = rec.failed_count;
      lockedUntilMs = rec.locked_until;
    }
  }

  // If previous lockout expired, auto-reset cleanly
  if (lockedUntilMs && now >= lockedUntilMs) {
    await resetAuthAttempts(ip);
    return {
      failedCount: 0,
      remainingAttempts: MAX_AUTH_ATTEMPTS,
      isLocked: false,
      lockedUntilMs: null,
      retryAfterSeconds: 0,
    };
  }

  const isLocked = Boolean(lockedUntilMs && now < lockedUntilMs);
  const retryAfterSeconds = isLocked && lockedUntilMs ? Math.ceil((lockedUntilMs - now) / 1000) : 0;
  const remainingAttempts = isLocked ? 0 : Math.max(0, MAX_AUTH_ATTEMPTS - failedCount);

  return {
    failedCount,
    remainingAttempts,
    isLocked,
    lockedUntilMs,
    retryAfterSeconds,
  };
}

export async function recordFailedAuthAttempt(ip: string): Promise<AuthAttemptState> {
  const current = await getAuthAttemptState(ip);
  if (current.isLocked) return current;

  const nextCount = current.failedCount + 1;
  const shouldLock = nextCount >= MAX_AUTH_ATTEMPTS;
  const lockedUntilMs = shouldLock ? Date.now() + LOCKOUT_DURATION_MS : null;
  const lockedUntilIso = lockedUntilMs ? new Date(lockedUntilMs).toISOString() : null;

  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_auth_attempts (ip, failed_count, locked_until, last_attempt_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (ip) DO UPDATE SET
         failed_count = EXCLUDED.failed_count,
         locked_until = EXCLUDED.locked_until,
         last_attempt_at = NOW()`,
      [ip, nextCount, lockedUntilIso]
    );
  } else {
    localAuthAttempts.set(ip, { failed_count: nextCount, locked_until: lockedUntilMs });
  }

  return {
    failedCount: nextCount,
    remainingAttempts: shouldLock ? 0 : Math.max(0, MAX_AUTH_ATTEMPTS - nextCount),
    isLocked: shouldLock,
    lockedUntilMs,
    retryAfterSeconds: shouldLock ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0,
  };
}

export async function resetAuthAttempts(ip: string): Promise<void> {
  const { isPostgres } = await checkConnection();
  if (isPostgres) {
    const p = getPool();
    await p.query("DELETE FROM tracker_auth_attempts WHERE ip = $1", [ip]);
  } else {
    localAuthAttempts.delete(ip);
  }
}
