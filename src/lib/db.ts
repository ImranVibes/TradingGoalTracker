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
  trades: Trade[];
  cashflows: Cashflow[];
  goals: Goal[];
  dailySummaries: Record<string, DailySummary>;
  signal_providers: SignalProvider[];
  exchange_connections: ExchangeConnection[];
  settings: Record<string, any>;
}

function loadLocalStore(): LocalStore {
  if (fs.existsSync(LOCAL_STORE_FILE)) {
    try {
      const content = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (!parsed.signal_providers || parsed.signal_providers.length === 0) {
        parsed.signal_providers = [
          { id: "sp_self", name: "Self", notes: "My own trades & setups", color: "sky", created_at: new Date().toISOString() },
          { id: "sp_abc", name: "ABC Trader", notes: "Signals from ABC Trader", color: "violet", created_at: new Date().toISOString() },
          { id: "sp_xyz", name: "XYZ Trader", notes: "Signals from XYZ Trader", color: "emerald", created_at: new Date().toISOString() }
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
    trades: [],
    cashflows: [],
    goals: [],
    dailySummaries: {},
    signal_providers: [
      { id: "sp_self", name: "Self", notes: "My own trades & setups", color: "sky", created_at: new Date().toISOString() },
      { id: "sp_abc", name: "ABC Trader", notes: "Signals from ABC Trader", color: "violet", created_at: new Date().toISOString() },
      { id: "sp_xyz", name: "XYZ Trader", notes: "Signals from XYZ Trader", color: "emerald", created_at: new Date().toISOString() }
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

    -- Ensure signal_provider, exchange, exchange_trade_id, and chart_image columns exist
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS signal_provider VARCHAR(100) DEFAULT 'Self';
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS exchange VARCHAR(64) DEFAULT 'MANUAL';
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS exchange_trade_id VARCHAR(128) DEFAULT NULL;
    ALTER TABLE tracker_trades ADD COLUMN IF NOT EXISTS chart_image TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS tracker_exchange_connections (
      id VARCHAR(64) PRIMARY KEY,
      exchange VARCHAR(32) NOT NULL,
      name VARCHAR(64) NOT NULL,
      api_key TEXT NOT NULL,
      api_secret TEXT NOT NULL,
      account_type VARCHAR(32) DEFAULT 'FUTURES',
      is_active BOOLEAN DEFAULT TRUE,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracker_settings (
      key VARCHAR(64) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

    -- Seed default providers if table is empty
    INSERT INTO tracker_signal_providers (id, name, notes, color)
    VALUES 
      ('sp_self', 'Self', 'My own trades & setups', 'sky'),
      ('sp_abc', 'ABC Trader', 'Signals from ABC Trader', 'violet'),
      ('sp_xyz', 'XYZ Trader', 'Signals from XYZ Trader', 'emerald')
    ON CONFLICT (name) DO NOTHING;

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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_trades_exchange_trade_id ON tracker_trades(exchange_trade_id) WHERE exchange_trade_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_tracker_cashflow_date ON tracker_cashflows(date);
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
// TRADES API
// -----------------------------------------------------------------------------
export async function getTrades(filters?: {
  symbol?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  signal_provider?: string;
  exchange?: string;
}): Promise<Trade[]> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    let query = "SELECT * FROM tracker_trades WHERE 1=1";
    const values: any[] = [];
    let idx = 1;

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
    return res.rows.map((r: any) => ({
      ...r,
      signal_provider: r.signal_provider || "Self",
      exchange: r.exchange || "MANUAL",
      exchange_trade_id: r.exchange_trade_id || null,
      chart_image: r.chart_image || "",
      tags: typeof r.tags === "string" ? JSON.parse(r.tags || "[]") : r.tags || [],
      trade_date: new Date(r.trade_date).toISOString(),
      closed_date: r.closed_date ? new Date(r.closed_date).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  } else {
    const store = loadLocalStore();
    let result = [...store.trades];

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
    const r = res.rows[0];
    return {
      ...r,
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
    const r = res.rows[0];
    return {
      ...r,
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

  if (exchangeTradeId) {
    const existing = await getTradeByExchangeId(exchangeTradeId);
    if (existing) return existing;
  }

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_trades (
        id, symbol, market, direction, entry_price, exit_price, stop_loss, take_profit,
        quantity, pnl, pnl_percentage, status, trade_date, closed_date, timeframe,
        session, strategy, signal_provider, exchange, exchange_trade_id, reason_entry, reason_outcome, lessons_learned, emotions_notes,
        chart_url, chart_image, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)`,
      [
        trade.id,
        trade.symbol.toUpperCase(),
        trade.market || "FOREX",
        trade.direction || "LONG",
        trade.entry_price ?? null,
        trade.exit_price ?? null,
        trade.stop_loss ?? null,
        trade.take_profit ?? null,
        trade.quantity ?? 1,
        trade.pnl || 0,
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
    const tradeWithExtras = {
      ...trade,
      signal_provider: provider,
      exchange,
      exchange_trade_id: exchangeTradeId,
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
    signal_provider: provider,
    exchange,
    exchange_trade_id: exchangeTradeId,
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

  const updated: Trade = {
    ...existing,
    ...updates,
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
        symbol = $1, market = $2, direction = $3, entry_price = $4, exit_price = $5,
        stop_loss = $6, take_profit = $7, quantity = $8, pnl = $9, pnl_percentage = $10,
        status = $11, trade_date = $12, closed_date = $13, timeframe = $14, session = $15,
        strategy = $16, signal_provider = $17, exchange = $18, reason_entry = $19, reason_outcome = $20,
        lessons_learned = $21, emotions_notes = $22, chart_url = $23, chart_image = $24, tags = $25, updated_at = $26
      WHERE id = $27`,
      [
        updated.symbol.toUpperCase(),
        updated.market || "FOREX",
        updated.direction || "LONG",
        updated.entry_price ?? null,
        updated.exit_price ?? null,
        updated.stop_loss ?? null,
        updated.take_profit ?? null,
        updated.quantity ?? 1,
        updated.pnl,
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

export async function deleteTrade(id: string): Promise<boolean> {
  const existing = await getTradeById(id);
  if (!existing) return false;

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
export async function getGoals(): Promise<Goal[]> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    const res = await p.query("SELECT * FROM tracker_goals ORDER BY created_at DESC");
    return res.rows.map((r: any) => ({
      ...r,
      start_date: new Date(r.start_date).toISOString(),
      target_date: r.target_date ? new Date(r.target_date).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  } else {
    const store = loadLocalStore();
    return [...store.goals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

export async function createGoal(goal: Goal): Promise<Goal> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_goals (
        id, title, category, target_amount, current_amount, start_date, target_date, status, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        goal.id,
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
    store.goals.unshift(goal);
    saveLocalStore(store);
  }

  await syncGoals();
  return goal;
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | null> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    const existingRes = await p.query("SELECT * FROM tracker_goals WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) return null;
    const existing = existingRes.rows[0];

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await p.query(
      `UPDATE tracker_goals SET
        title = $1, category = $2, target_amount = $3, current_amount = $4,
        start_date = $5, target_date = $6, status = $7, notes = $8, updated_at = $9
      WHERE id = $10`,
      [
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
    return updated;
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
    return store.goals[idx];
  }
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

  const netPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const totalWithdrawn = cashflows
    .filter((c) => c.type === "WITHDRAWAL")
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  for (const g of goals) {
    let newAmount = g.current_amount;
    if (g.category === "PROFIT_TARGET") {
      newAmount = Math.max(0, netPnl);
    } else if (g.category === "WITHDRAWAL_GOAL") {
      newAmount = totalWithdrawn;
    }

    if (newAmount !== g.current_amount) {
      const newStatus = newAmount >= g.target_amount ? "ACHIEVED" : g.status;
      await updateGoal(g.id, { current_amount: newAmount, status: newStatus });
    }
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const trades = await getTrades();
  const cashflows = await getCashflows();

  let total_profit = 0;
  let total_loss = 0;
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
  const closed_trades = won_trades + lost_trades + breakeven_trades;
  const win_rate = closed_trades > 0 ? Number(((won_trades / closed_trades) * 100).toFixed(1)) : 0;
  const profit_factor = total_loss > 0 ? Number((total_profit / total_loss).toFixed(2)) : total_profit > 0 ? 99.9 : 0;
  const average_win = won_trades > 0 ? Number((total_profit / won_trades).toFixed(2)) : 0;
  const average_loss = lost_trades > 0 ? Number((total_loss / lost_trades).toFixed(2)) : 0;

  const settings = await getUserSettings();
  const starting_balance = Number(settings.initial_balance || 10000);

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
      count: data.count,
      win_rate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  const provider_distribution = await getSignalProviderStats();

  return {
    net_pnl: Number(net_pnl.toFixed(2)),
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

export async function getSignalProviderStats(): Promise<SignalProviderStats[]> {
  const trades = await getTrades();
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
      is_active: r.is_active ?? true,
      last_synced_at: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    }));
  } else {
    const store = loadLocalStore();
    return store.exchange_connections || [];
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
  const is_active = conn.is_active ?? true;

  const item: ExchangeConnection = {
    id,
    exchange,
    name,
    api_key,
    api_secret,
    account_type,
    is_active,
    last_synced_at: conn.last_synced_at || null,
    created_at: now,
    updated_at: now,
  };

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_exchange_connections (id, exchange, name, api_key, api_secret, account_type, is_active, last_synced_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET exchange = EXCLUDED.exchange, name = EXCLUDED.name, api_key = EXCLUDED.api_key, api_secret = EXCLUDED.api_secret, account_type = EXCLUDED.account_type, is_active = EXCLUDED.is_active, updated_at = NOW()`,
      [id, exchange, name, api_key, api_secret, account_type, is_active, item.last_synced_at, now, now]
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

export async function syncExchange(id: string): Promise<ExchangeSyncResult> {
  const connections = await getExchangeConnections();
  const conn = connections.find((c) => c.id === id);
  if (!conn) {
    return { success: false, exchange: "unknown", importedTrades: 0, importedCashflows: 0, message: "Connection not found" };
  }

  let importedTrades = 0;
  let importedCashflows = 0;
  let liveBalance: number | undefined;

  try {
    if (conn.exchange === "binance") {
      const client = new BinanceClient(conn.api_key, conn.api_secret);
      const test = await client.testConnection();
      if (!test.success) {
        return { success: false, exchange: "binance", importedTrades: 0, importedCashflows: 0, message: test.message };
      }
      liveBalance = test.balance;

      const rawTrades = await client.getFuturesRealizedTrades(100);
      for (const t of rawTrades) {
        if (!t.exchange_trade_id) continue;
        const existing = await getTradeByExchangeId(t.exchange_trade_id);
        if (!existing) {
          const now = new Date().toISOString();
          const newTrade: Trade = {
            id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            symbol: t.symbol || "BTCUSDT",
            market: "CRYPTO",
            direction: t.direction || "LONG",
            pnl: t.pnl || 0,
            status: t.status || "OPEN",
            trade_date: t.trade_date || now,
            exchange: "BINANCE",
            exchange_trade_id: t.exchange_trade_id,
            strategy: "Exchange Auto-Sync",
            signal_provider: "Self",
            reason_entry: t.reason_entry || "Auto-synced from Binance",
            reason_outcome: t.reason_outcome || "",
            created_at: now,
            updated_at: now,
          };
          await createTrade(newTrade);
          importedTrades++;
        }
      }
    } else if (conn.exchange === "bybit") {
      const client = new BybitClient(conn.api_key, conn.api_secret);
      const test = await client.testConnection();
      if (!test.success) {
        return { success: false, exchange: "bybit", importedTrades: 0, importedCashflows: 0, message: test.message };
      }
      liveBalance = test.balance;

      const rawTrades = await client.getClosedPnL(100);
      for (const t of rawTrades) {
        if (!t.exchange_trade_id) continue;
        const existing = await getTradeByExchangeId(t.exchange_trade_id);
        if (!existing) {
          const now = new Date().toISOString();
          const newTrade: Trade = {
            id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            symbol: t.symbol || "BTCUSDT",
            market: "CRYPTO",
            direction: t.direction || "LONG",
            entry_price: t.entry_price,
            exit_price: t.exit_price,
            quantity: t.quantity,
            pnl: t.pnl || 0,
            status: t.status || "OPEN",
            trade_date: t.trade_date || now,
            exchange: "BYBIT",
            exchange_trade_id: t.exchange_trade_id,
            strategy: "Exchange Auto-Sync",
            signal_provider: "Self",
            reason_entry: t.reason_entry || "Auto-synced from Bybit",
            reason_outcome: t.reason_outcome || "",
            created_at: now,
            updated_at: now,
          };
          await createTrade(newTrade);
          importedTrades++;
        }
      }
    }

    // Update connection last_synced_at
    const now = new Date().toISOString();
    const { isPostgres } = await checkConnection();
    if (isPostgres) {
      const p = getPool();
      await p.query("UPDATE tracker_exchange_connections SET last_synced_at = NOW(), updated_at = NOW() WHERE id = $1", [id]);
    } else {
      const store = loadLocalStore();
      const idx = store.exchange_connections.findIndex((c) => c.id === id);
      if (idx !== -1) {
        store.exchange_connections[idx].last_synced_at = now;
        saveLocalStore(store);
      }
    }

    return {
      success: true,
      exchange: conn.exchange,
      importedTrades,
      importedCashflows,
      liveBalance,
      message: `Sync complete! Imported ${importedTrades} new closed trade(s).`,
    };
  } catch (err: any) {
    return { success: false, exchange: conn.exchange, importedTrades: 0, importedCashflows: 0, message: err.message };
  }
}

export async function syncAllExchanges(): Promise<{ results: ExchangeSyncResult[]; totalImported: number }> {
  const connections = await getExchangeConnections();
  const active = connections.filter((c) => c.is_active);
  const results: ExchangeSyncResult[] = [];
  let totalImported = 0;

  for (const c of active) {
    const res = await syncExchange(c.id);
    results.push(res);
    totalImported += res.importedTrades;
  }

  return { results, totalImported };
}
