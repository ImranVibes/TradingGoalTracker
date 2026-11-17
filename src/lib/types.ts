export type TradeStatus = "WON" | "LOST" | "BREAKEVEN" | "OPEN";
export type TradeDirection = "LONG" | "SHORT";
export type MarketType = "FOREX" | "CRYPTO" | "COMMODITY" | "INDEX" | "STOCKS";

export interface Trade {
  id: string;
  symbol: string;
  market: MarketType;
  direction: TradeDirection;
  entry_price: number;
  exit_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  quantity: number;
  pnl: number;
  pnl_percentage?: number | null;
  status: TradeStatus;
  trade_date: string;
  closed_date?: string | null;
  timeframe?: string;
  session?: string;
  strategy?: string;
  reason_entry: string;
  reason_outcome: string;
  lessons_learned?: string;
  emotions_notes?: string;
  chart_url?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export type CashflowType = "WITHDRAWAL" | "EXPENSE" | "DEPOSIT";

export interface Cashflow {
  id: string;
  type: CashflowType;
  amount: number;
  category: string;
  description: string;
  date: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export type GoalCategory = "PROFIT_TARGET" | "WITHDRAWAL_GOAL" | "ACCOUNT_BALANCE" | "DISCIPLINE_HABIT";
export type GoalStatus = "ACTIVE" | "ACHIEVED" | "PAUSED";

export interface Goal {
  id: string;
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

export interface DashboardStats {
  net_pnl: number;
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
  equity_curve: {
    date: string;
    cumulative_pnl: number;
    daily_pnl: number;
  }[];
  pair_distribution: {
    symbol: string;
    pnl: number;
    count: number;
    win_rate: number;
  }[];
}
