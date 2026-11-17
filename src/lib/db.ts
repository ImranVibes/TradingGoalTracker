import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { Trade, Cashflow, Goal, DailySummary, DashboardStats } from "./types";

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
  settings: Record<string, any>;
}

function loadLocalStore(): LocalStore {
  if (fs.existsSync(LOCAL_STORE_FILE)) {
    try {
      const content = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      console.error("[LocalStore] Error reading local store:", e);
    }
  }

  const initialStore: LocalStore = {
    trades: [],
    cashflows: [],
    goals: [],
    dailySummaries: {},
    settings: {
      account_balance: 10000,
      currency: "USD",
      risk_percentage: 1.0,
      default_leverage: 100,
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
      reason_entry TEXT DEFAULT '',
      reason_outcome TEXT DEFAULT '',
      lessons_learned TEXT DEFAULT '',
      emotions_notes TEXT DEFAULT '',
      chart_url TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

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

    query += " ORDER BY trade_date DESC";
    const res = await p.query(query, values);
    return res.rows.map((r: any) => ({
      ...r,
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

export async function createTrade(trade: Trade): Promise<Trade> {
  const { isPostgres } = await checkConnection();

  if (isPostgres) {
    const p = getPool();
    await p.query(
      `INSERT INTO tracker_trades (
        id, symbol, market, direction, entry_price, exit_price, stop_loss, take_profit,
        quantity, pnl, pnl_percentage, status, trade_date, closed_date, timeframe,
        session, strategy, reason_entry, reason_outcome, lessons_learned, emotions_notes,
        chart_url, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
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
        trade.reason_entry || "",
        trade.reason_outcome || "",
        trade.lessons_learned || "",
        trade.emotions_notes || "",
        trade.chart_url || "",
        JSON.stringify(trade.tags || []),
        trade.created_at || new Date().toISOString(),
        trade.updated_at || new Date().toISOString(),
      ]
    );
  } else {
    const store = loadLocalStore();
    store.trades.unshift(trade);
    saveLocalStore(store);
  }

  const dateKey = trade.trade_date.split("T")[0];
  await syncDailySummary(dateKey);
  await syncGoals();

  return trade;
}

export async function updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | null> {
  const existing = await getTradeById(id);
  if (!existing) return null;

  const updated: Trade = {
    ...existing,
    ...updates,
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
        strategy = $16, reason_entry = $17, reason_outcome = $18, lessons_learned = $19,
        emotions_notes = $20, chart_url = $21, tags = $22, updated_at = $23
      WHERE id = $24`,
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
        updated.reason_entry || "",
        updated.reason_outcome || "",
        updated.lessons_learned || "",
        updated.emotions_notes || "",
        updated.chart_url || "",
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

  let total_withdrawn = 0;
  let total_spent = 0;
  let total_deposits = 0;

  for (const c of cashflows) {
    const amt = Number(c.amount || 0);
    if (c.type === "WITHDRAWAL") total_withdrawn += amt;
    else if (c.type === "EXPENSE") total_spent += amt;
    else if (c.type === "DEPOSIT") total_deposits += amt;
  }

  const net_cash_extracted = total_withdrawn - total_deposits;

  const sortedDates = Object.keys(dailyPnlMap).sort();
  let cumulative = 0;
  const equity_curve = sortedDates.map((date) => {
    cumulative += dailyPnlMap[date];
    return {
      date,
      daily_pnl: Number(dailyPnlMap[date].toFixed(2)),
      cumulative_pnl: Number(cumulative.toFixed(2)),
    };
  });

  const pair_distribution = Object.entries(pairStats)
    .map(([symbol, data]) => ({
      symbol,
      pnl: Number(data.pnl.toFixed(2)),
      count: data.count,
      win_rate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);

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
    equity_curve,
    pair_distribution,
  };
}
