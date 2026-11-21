"""Live data feed connector for SwingPulse.

Polls market data from yfinance (free, no API key) on a schedule and
persists to PostgreSQL/TimescaleDB. Falls back to JSON when the database
is unavailable so the pipeline can run offline.

Designed for Phase 5 paper-trading validation: run this continuously
during market hours, then run the agent pipeline against the latest bars.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

# Make backend/api importable for DB models
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

WATCHLIST = [
    "AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "META", "AVGO",
    "SPY", "QQQ", "IWM", "XLF", "XLE", "XLV", "XLK",
    "TSLA", "AMZN", "NFLX", "CRM", "ADBE", "COST",
    "TLT", "GLD", "SLV",
]

JSON_PATH = Path(__file__).resolve().parent / "live_market_data.json"


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
    return df.dropna(subset=["ema20", "ema50", "atr14", "high_20d", "low_20d", "avg_vol_20d"])


def fetch_latest_bars(days: int = 60) -> dict[str, list[dict]]:
    """Download recent daily bars + indicators for the watchlist."""
    end = datetime.now()
    start = end - timedelta(days=days)
    data: dict[str, list[dict]] = {}

    for symbol in WATCHLIST:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(start=start.strftime("%Y-%m-%d"),
                                  end=end.strftime("%Y-%m-%d"),
                                  interval="1d", auto_adjust=False)
            if hist.empty or len(hist) < 50:
                print(f"  {symbol}: insufficient data ({len(hist)} rows)")
                continue

            hist = compute_indicators(hist)
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

    return data


def write_json(data: dict[str, list[dict]], path: Path = JSON_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Data written to {path}")


def write_postgres(data: dict[str, list[dict]]) -> None:
    """Best-effort write to PostgreSQL via SQLAlchemy async."""
    try:
        import asyncio
        from database import AsyncSessionLocal
        from models import Instrument, MarketData

        async def _write():
            async with AsyncSessionLocal() as session:
                for symbol, records in data.items():
                    inst = await session.get(Instrument, symbol)
                    if not inst:
                        session.add(Instrument(symbol=symbol, asset_class="equity"))
                        await session.commit()
                    for r in records:
                        session.add(MarketData(
                            time=datetime.fromisoformat(r["time"]),
                            symbol=symbol,
                            open=r["open"],
                            high=r["high"],
                            low=r["low"],
                            close=r["close"],
                            volume=r["volume"],
                        ))
                    await session.commit()
            print("Data written to PostgreSQL.")

        asyncio.run(_write())
    except Exception as exc:  # noqa: BLE001
        print(f"PostgreSQL write skipped: {exc}")


def run_once(days: int = 60, use_postgres: bool = False) -> dict[str, list[dict]]:
    """Single fetch + persist cycle."""
    print(f"[{datetime.now().isoformat()}] Fetching market data for {len(WATCHLIST)} symbols...")
    data = fetch_latest_bars(days=days)
    total = sum(len(v) for v in data.values())
    print(f"Fetched {len(data)} symbols, {total} bars")

    write_json(data)
    if use_postgres:
        write_postgres(data)

    return data


def run_daemon(interval_seconds: int = 300, use_postgres: bool = False) -> None:
    """Run the data feed continuously. Ctrl+C to stop."""
    print(f"Starting SwingPulse data feed daemon (interval={interval_seconds}s)")
    print("Press Ctrl+C to stop.\n")
    try:
        while True:
            run_once(use_postgres=use_postgres)
            print(f"Sleeping {interval_seconds}s until next poll...\n")
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        print("\nData feed daemon stopped.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="SwingPulse live data feed")
    parser.add_argument("--once", action="store_true", help="Run a single fetch and exit")
    parser.add_argument("--daemon", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=300, help="Daemon poll interval in seconds")
    parser.add_argument("--postgres", action="store_true", help="Also write to PostgreSQL")
    parser.add_argument("--days", type=int, default=60, help="Days of history to fetch")
    args = parser.parse_args()

    if args.daemon:
        run_daemon(interval_seconds=args.interval, use_postgres=args.postgres)
    else:
        run_once(days=args.days, use_postgres=args.postgres)
