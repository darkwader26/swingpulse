# SwingPulse — P5 Validation & Performance Report

**Company:** SwingPulse (agent-pipeline swing trading desk)
**Phase:** P5 — Validation & Handoff (gate to live trading review)
**Prepared:** 2026-11-22
**Status:** FAIL — not cleared for live capital

---

## 1. Executive Summary

The fixed backtester (with walk-forward validation, slippage, and commission modeling) shows the strategy is **NOT profitable** across all market regimes:

| Regime | Total Return | Win Rate | Profit Factor | Max Drawdown | Avg R | Trades | Assessment |
|--------|-------------|----------|---------------|--------------|-------|--------|------------|
| Bear (short) | -77.93% | 23.44% | 0.26 | 77.93% | -0.60 R | 337 | Strategy loses in bear markets |
| Bull (long) | +5,977.55% | 89.04% | 9.50 | 0.00%† | +5.82 R | 511 | Implausible — 0% drawdown not credible |
| Chop (flat) | 0.00% | — | 0.00 | 0.00% | $0 | 0 | Regime filter working (no trades) |

† Bull regime 0.00% max drawdown over 511 trades / 60 test days is statistically implausible. Likely residual data artifact or the specific 200-day period was an unusually strong trend with no meaningful pullbacks.

**Key takeaway:** The strategy loses -77.93% in bear regime and produces implausible results in bull regime. **The desk is not ready for live capital.** The strategy needs significant rework before Phase 5 sign-off.

**Gate recommendation:** FAIL P5. Do not proceed to live trading.

---

## 2. Methodology

### 2.1 Data Source
- Historical daily OHLCV bars from **yfinance**, cached to `backend/scripts/live_market_data.json`
- Watchlist: 23 symbols (AAPL, MSFT, NVDA, AMD, GOOGL, META, AVGO, SPY, QQQ, IWM, XLF, XLE, XLV, XLK, TSLA, AMZN, NFLX, CRM, ADBE, COST, TLT, GLD, SLV)
- Regime filter: SPY vs EMA50
- 200-day lookback, trimmed to ~120 bars after 50-bar indicator warmup
- Walk-forward: first 60 days after warmup = training (regime observed, no entries), remaining 60 days = testing

### 2.2 Simulation Rules (from `backend/scripts/backtest.py`)

| Rule | Value |
|------|-------|
| Risk per trade | 0.5% of equity |
| Max positions | 8 concurrent |
| Max sector exposure | 30% of equity |
| Daily loss limit (kill-switch) | 2% of equity |
| Min risk distance | 1% of entry price |
| Entry slippage | 0.05% (adverse: long filled higher, short filled lower) |
| Exit slippage | 0.05% (adverse: long exit filled lower, short exit filled higher) |
| Commission | $1.00 minimum or 0.02% of notional, whichever is higher |
| Entry | Next bar's open with slippage |
| Exit | Stop or target_1 hit on subsequent bar's high/low |
| Walk-forward | 60 train days (no entries), then test days |

---

## 3. Regime-by-Regime Results

### Bear Regime (Short-Only)
- **End equity:** $22,071.36 | **Net P&L:** $-77,928.64 | **Return:** -77.93%
- **Test days:** 60 | **Total trades:** 337 | **Wins:** 79 | **Losses:** 258
- **Win rate:** 23.44% | **Avg win:** $341.83 | **Avg loss:** $-406.72 | **Avg R:** -0.60 R
- **Gross profit:** $27,004.63 | **Gross loss:** $-104,933.35 | **Profit factor:** 0.26
- **Max drawdown:** 77.93%
- **Total friction cost:** $14,005.76 (slippage $10,004 + commission $4,002)

### Bull Regime (Long-Only)
- **End equity:** $6,077,547.72 | **Net P&L:** $5,977,547.72 | **Return:** +5,977.55%
- **Test days:** 60 | **Total trades:** 511 | **Wins:** 455 | **Losses:** 56
- **Win rate:** 89.04% | **Avg win:** $14,683.23 | **Avg loss:** $-12,559.35 | **Avg R:** +5.82 R
- **Gross profit:** $6,680,871.51 | **Gross loss:** $-703,323.73 | **Profit factor:** 9.50
- **Max drawdown:** 0.00% (not credible — see §Data Quality)
- **Total friction cost:** $548,372.26

### Chop Regime (No Directional Bias)
- **End equity:** $100,000.00 | **Return:** 0.00%
- **Total trades:** 0 — regime filter correctly suppresses all entries

---

## 4. Expectancy Analysis

Formula: `Expectancy = (win_rate × avg_win) – (loss_rate × avg_loss)`

| Regime | Expectancy per Trade | As % of Risk ($500) | Verdict |
|--------|---------------------|---------------------|---------|
| Bear | (0.2344 × $341.83) – (0.7656 × $406.72) = **-$224** | -45% of risk | **Negative expectancy** |
| Bull | (0.8904 × $14,683.23) – (0.1096 × $12,559.35) = **+$11,877** | +2,375% of risk | Implausible — see §Data Quality |
| Chop | $0 (no trades) | $0 | Neutral (correctly flat) |

---

## 5. Data Quality Issues

### Critical: Bull 0.00% Drawdown
A 0.00% max drawdown over 511 trades and 60 test days is statistically impossible for any real trading system. Even in the strongest bull market, longs will experience closing-price drawdowns below entry.

**Likely causes:**
1. **Mark-to-market at close only:** The equity curve uses end-of-day close prices for unrealized P&L. In a strongly trending bull market, longs may close above entry on most days, but intraday drawdowns are not captured.
2. **Wide stops (2× ATR):** In a strong uptrend, 2× ATR stops are rarely hit, so losing trades are infrequent.
3. **Specific data period:** The 200-day lookback may correspond to an unusually smooth bull trend with minimal pullbacks.

### Position Sizing Aggressiveness
Position sizes are very large relative to account equity in bull regime (e.g., 335 shares of XLK at ~$149 = ~$50,000 notional on a $100k account with multiple concurrent positions). This creates concentration risk not fully captured by the 30% sector exposure limit.

### Friction Costs
Slippage + commission total $14,005 in bear regime (14% of starting equity) and $548,372 in bull regime. These are real costs that further erode already-negative bear returns.

---

## 6. Risk Limit Evaluation

| Limit | Current Value | Assessment |
|-------|--------------|------------|
| Risk per trade | 0.5% of equity | Appropriate size, but bear regime shows the strategy loses even at this size |
| Max positions | 8 concurrent | Too many for a strategy with negative bear expectancy |
| Max sector exposure | 30% of equity | Not binding — sector concentration wasn't the issue |
| Daily loss limit | 2% of equity | Kill-switch would trigger in bear regime, but only after significant losses |
| Min risk distance | 1% of entry price | Prevents absurd RR ratios but doesn't fix negative expectancy |

**The 2% daily kill-switch would have triggered in bear regime**, but the -77.93% total return shows the strategy loses money even with the kill-switch active.

---

## 7. Phase 5 Gate Decision: FAIL

**Conditions NOT met:**
- [x] Positive expectancy in all regimes — **FAIL** (bear regime: -45% of risk per trade)
- [x] Credible max drawdown (<15%) — **FAIL** (bear: 77.93%, bull: 0.00% not credible)
- [x] Profit factor > 1.5 — **FAIL** (bear: 0.26)
- [x] Backtester validated against live paper trading — **NOT DONE**
- [x] Slippage/commission modeled — **DONE** (but reveals negative bear expectancy)
- [x] Walk-forward validation — **DONE** (reveals negative bear expectancy)

**The strategy is not profitable enough to justify live capital.** It loses in bear markets and produces implausible results in bull markets.

---

## 8. Recommendations

### 1. Fix the Strategy Logic (Critical)
The signal generator produces setups with negative expectancy in bear regime. Possible fixes:
- **Reduce bear regime position size** (0.25% risk instead of 0.5%)
- **Add bear-market filters** (e.g., only take shorts when VIX > 20, or when breadth is negative)
- **Improve short entry quality** (current shorts have 23% win rate — too low)
- **Consider being flat in bear regime** rather than short (the strategy is clearly not good at shorting)

### 2. Fix Backtester Limitations
- Add intraday bar data (1-hour or 5-minute) for realistic exit simulation
- Add market impact modeling for large position sizes
- Run Monte Carlo simulations for drawdown distribution
- Test multiple 200-day windows, not just one

### 3. Run Live Paper Trading
- Run the pipeline in paper trading for 30+ days via GitHub Actions
- Compare paper results to backtest — large discrepancies indicate backtest issues
- Track slippage and fill quality in real market conditions

### 4. Re-Gate After Fixes
Once the above are addressed, re-run P5 validation. Only proceed to live capital if:
- Positive expectancy in both bull and bear regimes (or flat in bear)
- Max drawdown < 15% in all regimes
- 30+ days of paper trading matching backtest within 20%

---

## 9. Files Referenced

- `backend/scripts/backtest.py` — backtesting engine (walk-forward, slippage, commission)
- `backend/scripts/backtest_results.json` — latest backtest results
- `backend/agents/signal_generator.py` — signal logic (reused in backtest)
- `backend/agents/risk_manager.py` — risk logic (reused in backtest)
- `backend/scripts/data_feed.py` — market data fetcher
- `backend/P5_VALIDATION_REPORT.md` — this report
- `.github/workflows/pipeline.yml` — scheduled paper trading
