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

Simulation rules:
    - For each day, generate signals from data up to that day's close using the
      live signal_generator agent logic.
    - Regime is SPY vs EMA50 (bull/bear), overridable with --regime.
    - Risk manager sizes each signal (0.5% risk/trade, max 8 positions,
      2% daily loss limit) using the live risk_manager agent logic.
    - Approved positions enter at the next day's open.
    - Exits: stop or target hit on any subsequent bar (intraday high/low).
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
import yfinance as yf

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

WARMUP_BARS = 50  # minimum history needed by signal_generator

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
    """bull if SPY close > EMA50 else bear; honour --regime override."""
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

    async def _signals_for_day(self, idx: int, regime: str) -> list[dict]:
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

    def _check_exits(self, bar: dict) -> None:
        """Close any open positions whose stop/target is hit on `bar`."""
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
        entry = pos["entry_price"]
        risk_per_share = abs(entry - pos["stop_price"])
        if pos["direction"] == "long":
            pnl = (exit_price - entry) * pos["qty"]
            r = (exit_price - entry) / risk_per_share if risk_per_share else 0.0
        else:
            pnl = (entry - exit_price) * pos["qty"]
            r = (entry - exit_price) / risk_per_share if risk_per_share else 0.0

        self.equity += pnl
        self.trades.append({
            "symbol": pos["symbol"],
            "direction": pos["direction"],
            "setup_type": pos.get("setup_type", ""),
            "entry_date": pos["entry_date"],
            "entry_price": round(entry, 4),
            "exit_date": date,
            "exit_price": round(exit_price, 4),
            "exit_reason": reason,
            "qty": round(pos["qty"], 4),
            "pnl": round(pnl, 2),
            "r": round(r, 4),
            "stop_price": pos["stop_price"],
            "target_price": pos["target_1"],
        })

    async def run(self) -> dict:
        print(f"\nRunning backtest over {self.n_days} days "
              f"(warmup={WARMUP_BARS}, equity=${self.equity:,.2f}, "
              f"regime_override={self.regime_override or 'auto'})\n")

        for idx in range(WARMUP_BARS, self.n_days):
            bar = self.spy_bars[idx]
            date = bar["time"]

            # --- 1. Exits for open positions on today's bar -----------------
            equity_at_start = self.equity
            daily_realized_pnl = 0.0
            pnl_before = self.equity
            self._check_exits(bar)
            daily_realized_pnl = self.equity - pnl_before

            # --- 2. Daily loss limit (2%) ----------------------------------
            daily_pnl_pct = daily_realized_pnl / equity_at_start if equity_at_start else 0.0
            halt_entries = daily_pnl_pct <= -RISK_CONFIG["max_daily_loss"]

            # --- 3. Signal generation from data through today's close ------
            regime = detect_regime(self.spy_bars, idx, self.regime_override)
            signals = await self._signals_for_day(idx, regime)

            # --- 4. Risk sizing --------------------------------------------
            decisions = await self._risk_decisions(signals, daily_pnl_pct)

            # --- 5. Enter approved positions at tomorrow's open -------------
            if idx + 1 < self.n_days and not halt_entries:
                tomorrow = self.spy_bars[idx + 1]
                # Map symbol -> tomorrow's open for entry pricing
                for d in decisions:
                    if not d.get("approved"):
                        continue
                    symbol = d["symbol"]
                    sym_bars = self.data.get(symbol, [])
                    if idx + 1 >= len(sym_bars):
                        continue
                    entry_bar = sym_bars[idx + 1]
                    entry_price = entry_bar["open"]

                    # Skip symbols already positioned
                    if any(p["symbol"] == symbol for p in self.positions):
                        continue

                    self.positions.append({
                        "symbol": symbol,
                        "direction": d.get("direction", "long"),
                        "setup_type": d.get("setup_type", ""),
                        "entry_price": entry_price,
                        "stop_price": d.get("stop_price", 0),
                        "target_1": d.get("target_1", 0),
                        "qty": d.get("position_size", 0),
                        "entry_date": tomorrow["time"],
                        "entry_bar_idx": idx + 1,
                    })

            # --- 6. Record equity curve ------------------------------------
            self.equity_curve.append({
                "date": date,
                "equity": round(self.equity, 2),
                "open_positions": len(self.positions),
            })

        # Close any still-open positions at the last available close
        if self.positions and self.n_days > 0:
            last_bar = self.spy_bars[-1]
            last_close = last_bar["close"]
            last_date = last_bar["time"]
            # Need each symbol's last close; use SPY close as proxy is wrong.
            # Instead, close at each symbol's own last close.
            for pos in list(self.positions):
                sym_bars = self.data.get(pos["symbol"], [])
                if not sym_bars:
                    continue
                sym_last = sym_bars[-1]
                self._close_trade(pos, sym_last["close"], "end_of_data", sym_last["time"])
            self.positions = []
            self.equity_curve.append({
                "date": last_date,
                "equity": round(self.equity, 2),
                "open_positions": 0,
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
        net_pnl = self.equity - 100000.0  # replaced below with actual start
        start_equity = 100000.0
        total_return = (self.equity - start_equity) / start_equity if start_equity else 0.0

        win_rate = (len(wins) / total) if total else 0.0
        avg_win = (gross_profit / len(wins)) if wins else 0.0
        avg_loss = (gross_loss / len(losses)) if losses else 0.0
        avg_r = (sum(t["r"] for t in trades) / total) if total else 0.0
        profit_factor = (gross_profit / abs(gross_loss)) if gross_loss else (float("inf") if gross_profit else 0.0)

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
            "start_equity": start_equity,
            "end_equity": round(self.equity, 2),
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
            "regime_override": self.regime_override,
            "days_backtested": self.n_days - WARMUP_BARS,
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
            ("Total return", f"{summary['total_return'] * 100:.2f}%"),
            ("Days backtested", summary["days_backtested"]),
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
        ]
        for label, value in rows:
            if label == "":
                print()
            else:
                print(f"  {label:<22} {value}")
        print("=" * 66)

        # Recent trades
        if summary["trades"]:
            print("\nRecent trades:")
            print(f"  {'Symbol':<7} {'Dir':<5} {'Entry':>9} {'Exit':>9} {'P&L':>10} {'R':>7} {'Reason':<9}")
            for t in summary["trades"][-12:]:
                print(f"  {t['symbol']:<7} {t['direction']:<5} "
                      f"{t['entry_price']:>9.2f} {t['exit_price']:>9.2f} "
                      f"{t['pnl']:>10.2f} {t['r']:>7.2f} {t['exit_reason']:<9}")
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
