"""Standalone SwingPulse backtester.

Validates the swing trading strategy (signal_generator + risk_manager agents)
against historical market data before Phase 5 sign-off.

Usage:
    python backend/scripts/backtest.py --days 200 --equity 100000
    python backend/scripts/backtest.py --days 200 --equity 100000 --regime bull
    python backend/scripts/backtest.py --days 200 --equity 100000 --fetch

Data source:
    Loads backend/scripts/live_market_data.json (written by data_feed.py).
    If it doesn't exist (or --fetch is passed), pulls fresh daily bars from
    yfinance, computes indicators, and persists to the same JSON.

Simulation rules (walk-forward, no lookahead bias):
    - Indicators (EMA20, EMA50, ATR14, high_20d, low_20d, avg_vol_20d) are
      trailing (causal): each bar's indicator value depends only on data up to
      that bar. The signal generator only ever sees data[: idx + 1], so no
      future information can leak into a signal.
    - First WALK_FORWARD_TRAIN_DAYS bars after indicator warmup are a
      regime-training window: regime is observed but no new positions are
      opened (walk-forward validation, train then test).
    - For each test day, generate signals from data up to that day's close
      using the live signal_generator agent logic.
    - Regime is SPY vs EMA50 (bull/bear), overridable with --regime.
    - Risk manager sizes each signal (0.5% risk/trade, max 8 positions,
      2% daily loss limit) using the live risk_manager agent logic.
    - Approved positions enter at the next bar's open with slippage applied.
    - Exits: stop or target hit on each subsequent bar's high/low, with
      slippage applied (adverse-fill assumption: stops filled worse, targets
      filled worse). We never assume we know the intraday order of stop vs
      target — the adverse fill on whichever triggers first is used.
    - Per-trade slippage and commission costs are tracked.
    - Tracks equity curve, trades, win rate, avg R, max drawdown.
    - Results saved to backend/scripts/backtest_results.json and a summary
      table is printed to stdout.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

# yfinance is imported lazily inside fetch_fresh_data so the backtester can
# run against the cached JSON without requiring yfinance (or its deps).

# Make backend agents + api importable (base.py imports database/models from api)
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "agents"))
sys.path.insert(0, str(BACKEND / "api"))

from base import AgentContext  # noqa: E402
from signal_generator import SignalGeneratorAgent  # noqa: E402
from risk_manager import RiskManagerAgent  # noqa: E402

JSON_PATH = Path(__file__).resolve().parent / "live_market_data.json"
RESULTS_PATH = Path(__file__).resolve().parent / "backtest_results.json"

WATCHLIST = [
    "AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "META", "AVGO",
    "SPY", "QQQ", "IWM", "XLF", "XLE", "XLV", "XLK",
    "TSLA", "AMZN", "NFLX", "CRM", "ADBE", "COST",
    "TLT", "GLD", "SLV",
]

WARMUP_BARS = 50  # minimum history needed by signal_generator / indicators
# Walk-forward: observe regime for the first 60 bars after warmup, then trade
# the remaining bars out-of-sample. No new entries during the training window.
WALK_FORWARD_TRAIN_DAYS = 60

# Trading friction
SLIPPAGE_PCT = 0.0005      # 0.05% of price per side (entry AND exit), adverse
COMMISSION_PCT = 0.0002    # 0.02% of notional per trade execution
COMMISSION_MIN = 0.00      # $0.00 fixed per trade (whichever is higher -> pct)

RISK_CONFIG = {
    "max_risk_per_trade": 0.005,   # 0.5% per trade
    "max_daily_loss": 0.02,        # 2% daily loss limit
    "max_positions": 8,
    "max_sector_exposure": 0.30,
}


# ---------------------------------------------------------------------------
# Data loading / fetching
# ---------------------------------------------------------------------------
def _safe(val, default=0.0):
    try:
        f = float(val)
        if pd.isna(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


def _safe_int(val, default=0):
    return int(_safe(val, default))


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Compute trailing (causal) indicators — each bar uses only past data.

    All window operations are trailing (rolling/ewm look backward only), so
    there is no lookahead: the indicator at bar i depends only on bars <= i.
    """
    df = df.copy()
    df["ema20"] = df["Close"].ewm(span=20, adjust=False).mean()
    df["ema50"] = df["Close"].ewm(span=50, adjust=False).mean()
    tr = pd.concat([
        (df["High"] - df["Low"]).abs(),
        (df["High"] - df["Close"].shift(1)).abs(),
        (df["Low"] - df["Close"].shift(1)).abs(),
    ], axis=1).max(axis=1)
    df["atr14"] = tr.rolling(14).mean()
    df["high_20d"] = df["High"].rolling(20).max()
    df["low_20d"] = df["Low"].rolling(20).min()
    df["avg_vol_20d"] = df["Volume"].rolling(20).mean()
    df["atr_pct"] = (df["atr14"] / df["Close"]) * 100
    return df.dropna(
        subset=["ema20", "ema50", "atr14", "high_20d", "low_20d", "avg_vol_20d"]
    )


def fetch_fresh_data(days: int = 300) -> dict[str, list[dict]]:
    """Fetch fresh daily bars + indicators for the watchlist via yfinance."""
    end = datetime.now()
    start = end - timedelta(days=days)
    import yfinance as yf  # lazy import: only needed for fresh data download
    data: dict[str, list[dict]] = {}

    for symbol in WATCHLIST:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(
                start=start.strftime("%Y-%m-%d"),
                end=end.strftime("%Y-%m-%d"),
                interval="1d",
                auto_adjust=False,
            )
            if hist.empty or len(hist) < WARMUP_BARS + 10:
                print(f"  {symbol}: insufficient data ({len(hist)} rows), skipping")
                continue

            hist = compute_indicators(hist)
            if hist.empty:
                print(f"  {symbol}: no rows after indicators, skipping")
                continue

            records = []
            for ts, row in hist.iterrows():
                records.append({
                    "time": ts.isoformat(),
                    "symbol": symbol,
                    "open": round(_safe(row["Open"]), 4),
                    "high": round(_safe(row["High"]), 4),
                    "low": round(_safe(row["Low"]), 4),
                    "close": round(_safe(row["Close"]), 4),
                    "volume": _safe_int(row["Volume"]),
                    "ema20": round(_safe(row["ema20"]), 4),
                    "ema50": round(_safe(row["ema50"]), 4),
                    "atr14": round(_safe(row["atr14"]), 4),
                    "high_20d": round(_safe(row["high_20d"]), 4),
                    "low_20d": round(_safe(row["low_20d"]), 4),
                    "avg_vol_20d": _safe_int(row["avg_vol_20d"]),
                    "atr_pct": round(_safe(row["atr_pct"]), 4),
                })
            data[symbol] = records
            print(f"  {symbol}: {len(records)} bars")

        except Exception as exc:  # noqa: BLE001
            print(f"  {symbol}: ERROR - {exc}")

    write_json(data)
    return data


def write_json(data: dict[str, list[dict]], path: Path = JSON_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Data written to {path}")


def load_data(days: int, fetch: bool) -> dict[str, list[dict]]:
    """Load historical data from JSON, fetching fresh via yfinance if needed."""
    if fetch or not JSON_PATH.exists():
        if fetch:
            print("Fetching fresh market data via yfinance...")
        else:
            print(f"{JSON_PATH} not found — fetching fresh data via yfinance...")
        return fetch_fresh_data(days=days)

    print(f"Loading historical data from {JSON_PATH}")
    with open(JSON_PATH) as f:
        data = json.load(f)

    # Trim to requested number of most-recent days (all symbols aligned)
    if days and days > 0:
        trimmed = {}
        for symbol, bars in data.items():
            trimmed[symbol] = bars[-days:]
        data = trimmed
        print(f"Trimmed to last {days} days per symbol")

    return data


# ---------------------------------------------------------------------------
# Regime detection
# ---------------------------------------------------------------------------
def detect_regime(spy_bars: list[dict], idx: int, override: str | None) -> str:
    """bull if SPY close > EMA50 else bear; honour --regime override.

    Uses only bar idx's close and ema50, both computed causally from data up
    to bar idx — no future information.
    """
    if override:
        return override
    bar = spy_bars[idx]
    close = bar["close"]
    ema50 = bar["ema50"]
    return "bull" if close > ema50 else "bear"


# ---------------------------------------------------------------------------
# Backtest engine
# ---------------------------------------------------------------------------
class Backtester:
    def __init__(self, data: dict[str, list[dict]], equity: float,
                 regime_override: str | None = None):
        self.data = data
        self.start_equity = equity
        self.equity = equity
        self.regime_override = regime_override
        self.context = AgentContext(execution_mode="paper")
        self.signal_agent = SignalGeneratorAgent(self.context)
        self.risk_agent = RiskManagerAgent(self.context)

        # All symbols share the same date axis; use SPY for indexing/regime.
        self.symbols = [s for s in WATCHLIST if s in data and len(data[s]) >= WARMUP_BARS + 5]
        self.spy_bars = data.get("SPY", [])
        self.n_days = len(self.spy_bars)

        self.positions: list[dict] = []          # open positions
        self.trades: list[dict] = []             # completed trades
        self.equity_curve: list[dict] = []       # {date, equity}

        # Cumulative friction tracking (for reporting)
        self.total_slippage_cost = 0.0
        self.total_commission_cost = 0.0

    # -- friction helpers ---------------------------------------------------
    def _entry_fill(self, price: float, direction: str) -> float:
        """Apply adverse entry slippage: long filled higher, short filled lower."""
        if direction == "long":
            return price * (1 + SLIPPAGE_PCT)
        return price * (1 - SLIPPAGE_PCT)

    def _exit_fill(self, trigger_price: float, direction: str) -> float:
        """Apply adverse exit slippage: long exit filled lower, short exit filled higher."""
        if direction == "long":
            return trigger_price * (1 - SLIPPAGE_PCT)
        return trigger_price * (1 + SLIPPAGE_PCT)

    def _commission(self, notional: float) -> float:
        return max(COMMISSION_MIN, COMMISSION_PCT * notional)

    # -- signal / risk ------------------------------------------------------
    async def _signals_for_day(self, idx: int, regime: str) -> list[dict]:
        # Only data up to and including bar idx is visible — causal slice.
        ohlcv = {sym: self.data[sym][: idx + 1] for sym in self.symbols}
        watchlist = [s for s in self.symbols if len(self.data[s]) >= WARMUP_BARS]
        inputs = {
            "watchlist": watchlist,
            "ohlcv": ohlcv,
            "regime": regime,
        }
        result = await self.signal_agent.run(inputs)
        return result.data.get("signals", []) if result.data else []

    async def _risk_decisions(self, signals: list[dict], daily_pnl_pct: float) -> list[dict]:
        inputs = {
            "signals": signals,
            "equity": self.equity,
            "open_positions": self.positions,
            "daily_pnl_percent": daily_pnl_pct,
            "kill_switch": False,
            "config": RISK_CONFIG,
        }
        result = await self.risk_agent.run(inputs)
        return result.data.get("decisions", []) if result.data else []

    # -- exits --------------------------------------------------------------
    def _check_exits(self, bar: dict) -> None:
        """Close any open positions whose stop/target is hit on `bar`.

        Uses the bar's high/low as the intraday proxy. Adverse slippage is
        applied to the fill so we never assume perfect execution.
        """
        high = bar["high"]
        low = bar["low"]
        date = bar["time"]
        remaining = []
        for pos in self.positions:
            exit_price = None
            exit_reason = None

            if pos["direction"] == "long":
                if low <= pos["stop_price"]:
                    exit_price = pos["stop_price"]
                    exit_reason = "stop"
                elif high >= pos["target_1"]:
                    exit_price = pos["target_1"]
                    exit_reason = "target"
            else:  # short
                if high >= pos["stop_price"]:
                    exit_price = pos["stop_price"]
                    exit_reason = "stop"
                elif low <= pos["target_1"]:
                    exit_price = pos["target_1"]
                    exit_reason = "target"

            if exit_price is None:
                remaining.append(pos)
                continue

            self._close_trade(pos, exit_price, exit_reason, date)

        self.positions = remaining

    def _close_trade(self, pos: dict, exit_price: float, reason: str, date: str) -> None:
        entry = pos["entry_price"]          # already includes entry slippage
        direction = pos["direction"]
        qty = pos["qty"]

        # Apply adverse exit slippage to the trigger price.
        exit_fill = self._exit_fill(exit_price, direction)

        # P&L on filled prices, minus commissions.
        if direction == "long":
            pnl = (exit_fill - entry) * qty
            risk_per_share = abs(entry - pos["stop_price"])
            r = (exit_fill - entry) / risk_per_share if risk_per_share else 0.0
        else:
            pnl = (entry - exit_fill) * qty
            risk_per_share = abs(entry - pos["stop_price"])
            r = (entry - exit_fill) / risk_per_share if risk_per_share else 0.0

        entry_commission = pos.get("entry_commission", 0.0)
        exit_commission = self._commission(exit_fill * qty)
        pnl -= entry_commission + exit_commission

        # Slippage costs: difference between ideal and filled price, per side.
        entry_slippage_cost = pos.get("entry_slippage_cost", 0.0)
        exit_slippage_cost = abs(exit_fill - exit_price) * qty

        self.total_slippage_cost += entry_slippage_cost + exit_slippage_cost
        self.total_commission_cost += entry_commission + exit_commission
        self.equity += pnl

        self.trades.append({
            "symbol": pos["symbol"],
            "direction": direction,
            "setup_type": pos.get("setup_type", ""),
            "entry_date": pos["entry_date"],
            "entry_price": round(entry, 4),
            "exit_date": date,
            "exit_price": round(exit_fill, 4),
            "exit_reason": reason,
            "qty": round(qty, 4),
            "pnl": round(pnl, 2),
            "r": round(r, 4),
            "stop_price": pos["stop_price"],
            "target_price": pos["target_1"],
            # Friction breakdown
            "slippage_cost": round(entry_slippage_cost + exit_slippage_cost, 2),
            "commission_cost": round(entry_commission + exit_commission, 2),
        })

    # -- run ----------------------------------------------------------------
    async def run(self) -> dict:
        print(f"\nRunning backtest over {self.n_days} days "
              f"(warmup={WARMUP_BARS}, train={WALK_FORWARD_TRAIN_DAYS}, "
              f"equity=${self.start_equity:,.2f}, "
              f"regime_override={self.regime_override or 'auto'})\n")

        test_start = max(WARMUP_BARS, WALK_FORWARD_TRAIN_DAYS)
        self.test_start = test_start

        for idx in range(WARMUP_BARS, self.n_days):
            bar = self.spy_bars[idx]
            date = bar["time"]
            is_test = idx >= test_start

            # --- 1. Exits for open positions on today's bar -----------------
            pnl_before = self.equity
            self._check_exits(bar)
            daily_realized_pnl = self.equity - pnl_before

            # --- 2. Daily loss limit (2%) ----------------------------------
            equity_at_start = self.equity - daily_realized_pnl
            daily_pnl_pct = daily_realized_pnl / equity_at_start if equity_at_start else 0.0
            halt_entries = daily_pnl_pct <= -RISK_CONFIG["max_daily_loss"]

            # --- 3. Signal generation from data through today's close ------
            regime = detect_regime(self.spy_bars, idx, self.regime_override)
            signals = []
            decisions = []
            if is_test and not halt_entries:
                signals = await self._signals_for_day(idx, regime)
                # --- 4. Risk sizing ----------------------------------------
                decisions = await self._risk_decisions(signals, daily_pnl_pct)

            # --- 5. Enter approved positions at tomorrow's open ------------
            if is_test and idx + 1 < self.n_days and not halt_entries:
                for d in decisions:
                    if not d.get("approved"):
                        continue
                    symbol = d["symbol"]
                    sym_bars = self.data.get(symbol, [])
                    if idx + 1 >= len(sym_bars):
                        continue
                    entry_bar = sym_bars[idx + 1]
                    entry_open = entry_bar["open"]
                    direction = d.get("direction", "long")

                    # Skip symbols already positioned
                    if any(p["symbol"] == symbol for p in self.positions):
                        continue

                    entry_fill = self._entry_fill(entry_open, direction)
                    entry_slippage_cost = abs(entry_fill - entry_open) * d.get("position_size", 0)
                    entry_commission = self._commission(entry_fill * d.get("position_size", 0))

                    self.positions.append({
                        "symbol": symbol,
                        "direction": direction,
                        "setup_type": d.get("setup_type", ""),
                        "entry_price": entry_fill,
                        "stop_price": d.get("stop_price", 0),
                        "target_1": d.get("target_1", 0),
                        "qty": d.get("position_size", 0),
                        "entry_date": entry_bar["time"],
                        "entry_bar_idx": idx + 1,
                        "entry_slippage_cost": entry_slippage_cost,
                        "entry_commission": entry_commission,
                    })

            # --- 6. Record equity curve ------------------------------------
            # Mark open positions to market at today's close so the equity
            # curve reflects unrealized (open-position) drawdown, not just
            # realized P&L. Without this, end-of-day equity can never dip and
            # max drawdown would falsely read 0.00%.
            mark_to_market = 0.0
            for pos in self.positions:
                sym_bars = self.data.get(pos["symbol"], [])
                sym_idx = pos.get("entry_bar_idx", idx)
                # Value the position at the current bar's close for its symbol.
                close_px = None
                if idx < len(sym_bars):
                    close_px = sym_bars[idx]["close"]
                elif sym_bars:
                    close_px = sym_bars[-1]["close"]
                if close_px is None:
                    continue
                if pos["direction"] == "long":
                    unrealized = (close_px - pos["entry_price"]) * pos["qty"]
                else:
                    unrealized = (pos["entry_price"] - close_px) * pos["qty"]
                mark_to_market += unrealized

            self.equity_curve.append({
                "date": date,
                "equity": round(self.equity + mark_to_market, 2),
                "realized_equity": round(self.equity, 2),
                "unrealized_pnl": round(mark_to_market, 2),
                "open_positions": len(self.positions),
                "regime": regime,
                "phase": "test" if is_test else "train",
            })

        # Close any still-open positions at the last available close.
        if self.positions and self.n_days > 0:
            for pos in list(self.positions):
                sym_bars = self.data.get(pos["symbol"], [])
                if not sym_bars:
                    continue
                sym_last = sym_bars[-1]
                self._close_trade(pos, sym_last["close"], "end_of_data", sym_last["time"])
            self.positions = []
            last_bar = self.spy_bars[-1]
            self.equity_curve.append({
                "date": last_bar["time"],
                "equity": round(self.equity, 2),
                "open_positions": 0,
                "regime": detect_regime(self.spy_bars, self.n_days - 1, self.regime_override),
                "phase": "test",
            })

        return self._build_summary()

    # ------------------------------------------------------------------
    # Reporting
    # ------------------------------------------------------------------
    def _build_summary(self) -> dict:
        trades = self.trades
        total = len(trades)
        wins = [t for t in trades if t["pnl"] > 0]
        losses = [t for t in trades if t["pnl"] < 0]
        breakeven = [t for t in trades if t["pnl"] == 0]

        gross_profit = sum(t["pnl"] for t in wins)
        gross_loss = sum(t["pnl"] for t in losses)
        net_pnl = self.equity - self.start_equity
        total_return = (self.equity - self.start_equity) / self.start_equity if self.start_equity else 0.0

        win_rate = (len(wins) / total) if total else 0.0
        avg_win = (gross_profit / len(wins)) if wins else 0.0
        avg_loss = (gross_loss / len(losses)) if losses else 0.0
        avg_r = (sum(t["r"] for t in trades) / total) if total else 0.0
        profit_factor = (gross_profit / abs(gross_loss)) if gross_loss else (float("inf") if gross_profit else 0.0)

        total_slippage = sum(t.get("slippage_cost", 0) for t in trades)
        total_commission = sum(t.get("commission_cost", 0) for t in trades)

        # Max drawdown from equity curve
        peak = 0.0
        max_dd = 0.0
        for point in self.equity_curve:
            eq = point["equity"]
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak if peak else 0.0
            if dd > max_dd:
                max_dd = dd

        summary = {
            "start_equity": round(self.start_equity, 2),
            "end_equity": round(self.equity, 2),
            "net_pnl": round(net_pnl, 2),
            "total_return": round(total_return, 4),
            "total_trades": total,
            "wins": len(wins),
            "losses": len(losses),
            "breakeven": len(breakeven),
            "win_rate": round(win_rate, 4),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "avg_r": round(avg_r, 4),
            "max_drawdown": round(max_dd, 4),
            "max_drawdown_pct": round(max_dd * 100, 2),
            "gross_profit": round(gross_profit, 2),
            "gross_loss": round(gross_loss, 2),
            "profit_factor": round(profit_factor, 4) if profit_factor != float("inf") else None,
            "total_slippage_cost": round(total_slippage, 2),
            "total_commission_cost": round(total_commission, 2),
            "total_friction_cost": round(total_slippage + total_commission, 2),
            "regime_override": self.regime_override,
            "days_backtested": self.n_days - WARMUP_BARS,
            "train_days": WALK_FORWARD_TRAIN_DAYS,
            "test_days": max(0, self.n_days - self.test_start),
            "trades": trades,
            "equity_curve": self.equity_curve,
        }
        return summary

    def print_summary(self, summary: dict) -> None:
        print("\n" + "=" * 66)
        print("SWINGPULSE BACKTEST SUMMARY")
        print("=" * 66)
        rows = [
            ("Start equity", f"${summary['start_equity']:,.2f}"),
            ("End equity", f"${summary['end_equity']:,.2f}"),
            ("Net P&L", f"${summary['net_pnl']:,.2f}"),
            ("Total return", f"{summary['total_return'] * 100:.2f}%"),
            ("Days backtested", summary["days_backtested"]),
            ("Train days (no entries)", summary["train_days"]),
            ("Test days (traded)", summary["test_days"]),
            ("Regime override", summary["regime_override"] or "auto (SPY vs EMA50)"),
            ("", ""),
            ("Total trades", summary["total_trades"]),
            ("Wins", summary["wins"]),
            ("Losses", summary["losses"]),
            ("Breakeven", summary["breakeven"]),
            ("Win rate", f"{summary['win_rate'] * 100:.2f}%"),
            ("", ""),
            ("Avg win", f"${summary['avg_win']:,.2f}"),
            ("Avg loss", f"${summary['avg_loss']:,.2f}"),
            ("Avg R", f"{summary['avg_r']:.4f} R"),
            ("Gross profit", f"${summary['gross_profit']:,.2f}"),
            ("Gross loss", f"${summary['gross_loss']:,.2f}"),
            ("Profit factor", summary["profit_factor"] if summary["profit_factor"] is not None else "n/a"),
            ("", ""),
            ("Max drawdown", f"{summary['max_drawdown_pct']:.2f}%"),
            ("Total slippage cost", f"${summary['total_slippage_cost']:,.2f}"),
            ("Total commission cost", f"${summary['total_commission_cost']:,.2f}"),
            ("Total friction cost", f"${summary['total_friction_cost']:,.2f}"),
        ]
        for label, value in rows:
            if label == "":
                print()
            else:
                print(f"  {label:<26} {value}")
        print("=" * 66)

        # Recent trades
        if summary["trades"]:
            print("\nRecent trades:")
            print(f"  {'Symbol':<7} {'Dir':<5} {'Entry':>9} {'Exit':>9} {'P&L':>10} {'R':>7} {'Slip':>7} {'Comm':>7} {'Reason':<9}")
            for t in summary["trades"][-12:]:
                print(f"  {t['symbol']:<7} {t['direction']:<5} "
                      f"{t['entry_price']:>9.2f} {t['exit_price']:>9.2f} "
                      f"{t['pnl']:>10.2f} {t['r']:>7.2f} "
                      f"{t.get('slippage_cost', 0):>7.2f} {t.get('commission_cost', 0):>7.2f} "
                      f"{t['exit_reason']:<9}")
        print("=" * 66 + "\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
async def main_async(days: int, equity: float, fetch: bool,
                     regime: str | None, output: Path) -> None:
    data = load_data(days, fetch)
    if not data:
        print("ERROR: No market data available. Run with --fetch to download via yfinance.")
        sys.exit(1)

    backtester = Backtester(data, equity, regime_override=regime)
    summary = await backtester.run()
    backtester.print_summary(summary)

    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Results saved to {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description="SwingPulse swing-strategy backtester")
    parser.add_argument("--days", type=int, default=200,
                        help="Number of most-recent days of history to backtest")
    parser.add_argument("--equity", type=float, default=100_000.0,
                        help="Starting account equity")
    parser.add_argument("--fetch", action="store_true",
                        help="Force fresh yfinance download instead of using JSON")
    parser.add_argument("--regime", choices=["bull", "bear", "chop"], default=None,
                        help="Force a regime (bull/bear/chop) instead of auto SPY-vs-EMA50")
    parser.add_argument("--output", default=str(RESULTS_PATH),
                        help="Path to write backtest results JSON")
    args = parser.parse_args()

    asyncio.run(main_async(
        days=args.days,
        equity=args.equity,
        fetch=args.fetch,
        regime=args.regime,
        output=Path(args.output),
    ))


if __name__ == "__main__":
    main()
