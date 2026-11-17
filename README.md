# Trading Journal & Financial Goal Tracker

A sleek Trading Journal, Goal Setup, and Personal Cashflow Tracker built with **Next.js (App Router)**, **Tailwind CSS**, and **PostgreSQL (Coolify dedicated persistent container)**.

---

## Features

### 1. Currency & Trade Execution Journal
- **Full Multi-Asset Support**: Forex currencies (`EURUSD`, `GBPUSD`, `USDJPY`, etc.), Crypto (`BTCUSDT`, `ETHUSDT`), Commodities (`XAUUSD` Gold, `USOIL`), and Indices (`US30`, `NAS100`).
- **Directional Precision**: BUY / LONG and SELL / SHORT positions with entry price, exit price, stop loss, take profit, quantity/lots, and automated R:R calculation.
- **Deep Trade Autopsy**:
  - **Why I took the trade**: Entry checklist, market structure confluence, order blocks, FVG, session timing.
  - **Why profit / loss was made**: Post-trade execution review, slippage, psychology, lessons learned.
  - **Screenshot & Chart Link**: Embedded TradingView / screenshot URL.

### 2. Daily Earnings & Losses Tracker ("Made that much / Lost that much")
- **Interactive Calendar Heatmap**: View every day of the month with green profit badges (+$520.00, 3 trades) and red loss badges (-$180.00, 2 trades).
- **Daily Financial Ledger Modal**: Click any date to drill into all trades taken on that day, day profit, day loss, net day PnL, and outflows.

### 3. Cashflow & Personal Life Finance
- **Withdrawals**: Track every dollar taken out of broker accounts to your bank or crypto wallet.
- **Spending & Expenses ("Spent on what or whatever")**: Categorize living expenses, rent, hardware, trading desk gear, subscriptions, and lifestyle rewards.
- **Net Wealth Extraction**: Track total profit vs total cash extracted out of the market.

### 4. Goals & Milestone Setup ("Actually its a goal setup")
- **Target Net Profits**: E.g. $5,000 monthly profit milestone.
- **Account Balance Scaling**: E.g. Prop firm phase 1 ($5,000 target with 8% limit), phase 2, and funded payout milestones.
- **Withdrawal Goals**: E.g. Withdraw $2,000 for new setup.
- **Progress Tracking**: Real-time progress bars and milestone completion badges with celebration confetti.

---

## Database Architecture

Connected directly to the PostgreSQL database container `signal_terminal` from `u:\My Projects\TradingSetup\UnifiedSignalTerminal\.env`.

### Isolated Project Tables
- `tracker_trades`: Execution log, currency symbol, market, entry/exit prices, PnL, and entry/outcome reasons.
- `tracker_cashflows`: Withdrawals, expenses, deposits, categories, and descriptions.
- `tracker_goals`: Target amounts, deadlines, and milestone completion status.
- `tracker_daily_summaries`: Pre-aggregated daily metrics for high-speed calendar rendering.

---

## Local Development & Running

```bash
# 1. Install dependencies
pnpm install

# 2. Start local dev server
pnpm dev

# 3. Production build
pnpm build
pnpm start
```
