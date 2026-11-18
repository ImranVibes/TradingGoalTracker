export type TradeStatus = "WON" | "LOST" | "BREAKEVEN" | "OPEN";
export type TradeDirection = "LONG" | "SHORT";
export type MarketType = "FOREX" | "CRYPTO" | "COMMODITY" | "INDEX" | "STOCKS";
export type AccountType = "PERSONAL" | "TARGET" | "RECOVERY" | "FUNDED";

export interface TradingAccount {
  id: string;
  name: string;
  type: AccountType;
  starting_balance: number;
  target_amount: number;
  initial_loss: number;
  color: string;
  notes?: string;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
  // Computed live stats (returned by GET /api/accounts)
  net_pnl?: number;
  gross_pnl?: number;
  total_fees?: number;
  total_trades?: number;
  wins?: number;
  losses?: number;
  win_rate?: number;
  current_balance?: number;
  progress_pct?: number;
}

export interface Trade {
  id: string;
  account_id?: string;
  symbol: string;
  market?: MarketType;
  direction?: TradeDirection;
  entry_price?: number | null;
  exit_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  quantity?: number;
  pnl: number;
  gross_pnl?: number | null;
  trading_fee?: number | null;
  funding_fee?: number | null;
  pnl_percentage?: number | null;
  status: TradeStatus;
  trade_date: string;
  closed_date?: string | null;
  timeframe?: string;
  session?: string;
  strategy?: string;
  signal_provider?: string;
  exchange?: string;
  exchange_trade_id?: string;
  reason_entry?: string;
  reason_outcome?: string;
  lessons_learned?: string;
  emotions_notes?: string;
  chart_url?: string;
  chart_image?: string;
  tags?: string[];
  mistake_tags?: string[];
  discipline_score?: number | null;
  created_at: string;
  updated_at: string;
}

export type CashflowType = "WITHDRAWAL" | "EXPENSE" | "DEPOSIT";

export interface Cashflow {
  id: string;
  account_id?: string;
  type: CashflowType;
  amount: number;
  category: string;
  description?: string;
  date: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export type GoalCategory = "PROFIT_TARGET" | "WITHDRAWAL_GOAL" | "ACCOUNT_BALANCE" | "DISCIPLINE_HABIT";
export type GoalStatus = "ACTIVE" | "ACHIEVED" | "PAUSED";
export type GoalTrackingMode = "AUTO_DATE" | "MANUAL_TRADES";

export interface Goal {
  id: string;
  account_id?: string;
  tracking_mode?: GoalTrackingMode;
  linked_trade_ids?: string[];
  title: string;
  category: GoalCategory;
  target_amount: number;
  current_amount: number;
  start_date: string;
  target_date?: string | null;
  status: GoalStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  total_pnl: number;
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  total_withdrawn: number;
  total_spent: number;
  notes?: string;
  trades?: Trade[];
}

export interface SignalProvider {
  id: string;
  name: string;
  notes?: string;
  telegram_handle?: string;
  color?: string;
  created_at: string;
  updated_at?: string;
}

export interface SignalProviderStats {
  name: string;
  is_self: boolean;
  color: string;
  notes?: string;
  telegram_handle?: string;
  total_pnl: number;
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  profit_factor: number;
  total_profit: number;
  total_loss: number;
  average_win: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  expectancy: number;
  top_pairs: {
    symbol: string;
    count: number;
    pnl: number;
    win_rate: number;
  }[];
  recent_trades?: Trade[];
}

export interface ExchangeConnection {
  id: string;
  exchange: "binance" | "bybit";
  name: string;
  label?: string;
  api_key: string;
  api_key_masked?: string;
  api_secret: string;
  account_type: "SPOT" | "FUTURES" | "ALL";
  category?: string;
  account_id?: string;
  auto_sync?: boolean;
  sync_from_date?: string | null;
  last_synced_trade_time?: number | null;
  is_active: boolean;
  last_synced_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface UserSettings {
  initial_balance: number;
  currency: string;
  risk_percentage?: number;
  risk_per_trade_pct?: number;
  default_leverage?: number;
  max_drawdown_limit?: number;
  max_drawdown_limit_pct?: number;
}

export interface DrawdownStats {
  current_balance: number;
  starting_balance: number;
  peak_equity: number;
  current_drawdown_pct: number;
  current_drawdown_amount: number;
  max_drawdown_pct: number;
  max_drawdown_amount: number;
  net_closed_pnl: number;
  net_cashflow: number;
}

export interface DashboardStats {
  net_pnl: number;
  gross_pnl: number;
  total_trading_fees: number;
  total_funding_fees: number;
  total_fees: number;
  total_profit: number;
  total_loss: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  open_trades: number;
  won_trades: number;
  lost_trades: number;
  breakeven_trades: number;
  total_withdrawn: number;
  total_spent: number;
  net_cash_extracted: number;
  average_win: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  starting_balance?: number;
  living_balance?: number;
  drawdown: DrawdownStats;
  equity_curve: {
    date: string;
    cumulative_pnl: number;
    daily_pnl: number;
    balance?: number;
  }[];
  pair_distribution: {
    symbol: string;
    pnl: number;
    count: number;
    win_rate: number;
  }[];
  provider_distribution: SignalProviderStats[];
  exchange_distribution: {
    exchange: string;
    pnl: number;
    total_pnl?: number;
    count: number;
    win_rate: number;
  }[];
}

export interface CustomIndicator {
  id: string;
  name: string;
  code: string;
  language: "pine" | "js";
  overlay: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TradingNote {
  id: string;
  account_id?: string;
  title: string;
  content: string;
  category: string;
  symbol?: string;
  tags: string[];
  is_pinned: boolean;
  note_date: string;
  image_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  description?: string;
  is_critical: boolean;
  sort_order: number;
  enabled: boolean;
  created_at: string;
}

export interface ChecklistLog {
  id: string;
  account_id: string;
  symbol: string;
  direction: TradeDirection;
  checked_ids: string[];
  total_items: number;
  critical_passed: boolean;
  score: number;
  sentiment_verdict?: string;
  notes?: string;
  created_at: string;
}
