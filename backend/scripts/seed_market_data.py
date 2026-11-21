"""Seed market data from yfinance (free, open source, no API key required).

Pulls daily OHLCV for a liquid swing-trading watchlist and computes
the indicators the agent pipeline needs (EMA20, EMA50, ATR, 20d high/low,
20d avg volume). Writes to JSON for offline pipeline testing (PostgreSQL
best-effort if running).
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

WATCHLIST = [
    "AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "META", "AVGO",
    "SPY", "QQQ", "IWM", "XLF", "XLE", "XLV", "XLK",
    "TSLA", "AMZN", "NFLX", "CRM", "ADBE", "COST",
    "TLT", "GLD", "SLV",
]

START_DATE = (datetime.now() - timedelta(days=200)).strftime("%Y-%m-%d")
END_DATE = datetime.now().strftime("%Y-%m-%d")


def _clean_number(val, default=0.0):
    """Safely convert a value to float, returning default for NaN/None."""
    try:
        f = float(val)
        if pd.isna(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


def _clean_int(val, default=0):
    """Safely convert to int, returning default for NaN/None."""
    return int(_clean_number(val, default))


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add EMA20, EMA50, ATR(14), 20d high/low, 20d avg volume."""
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

    # Drop rows where indicators aren't ready yet (first ~50 rows)
    df = df.dropna(subset=["ema20", "ema50", "atr14", "high_20d", "low_20d", "avg_vol_20d"])
    return df


def fetch_watchlist() -> dict[str, list[dict]]:
    """Download and compute indicators for all symbols."""
    data: dict[str, list[dict]] = {}

    for symbol in WATCHLIST:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(start=START_DATE, end=END_DATE, interval="1d", auto_adjust=False)
            if hist.empty or len(hist) < 60:
                print(f"  {symbol}: insufficient data ({len(hist)} rows), skipping")
                continue

            hist = compute_indicators(hist)
            if hist.empty:
                print(f"  {symbol}: no rows after indicator computation, skipping")
                continue

            records = []
            for ts, row in hist.iterrows():
                records.append({
                    "time": ts.isoformat(),
                    "symbol": symbol,
                    "open": round(_clean_number(row["Open"]), 4),
                    "high": round(_clean_number(row["High"]), 4),
                    "low": round(_clean_number(row["Low"]), 4),
                    "close": round(_clean_number(row["Close"]), 4),
                    "volume": _clean_int(row["Volume"]),
                    "ema20": round(_clean_number(row["ema20"]), 4),
                    "ema50": round(_clean_number(row["ema50"]), 4),
                    "atr14": round(_clean_number(row["atr14"]), 4),
                    "high_20d": round(_clean_number(row["high_20d"]), 4),
                    "low_20d": round(_clean_number(row["low_20d"]), 4),
                    "avg_vol_20d": _clean_int(row["avg_vol_20d"]),
                    "atr_pct": round(_clean_number(row["atr_pct"]), 4),
                })

            data[symbol] = records
            print(f"  {symbol}: {len(records)} days seeded")

        except Exception as exc:  # noqa: BLE001
            print(f"  {symbol}: ERROR - {exc}")

    return data


def write_json(data: dict[str, list[dict]], path: Path) -> None:
    """Write seeded data to JSON for offline pipeline testing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\nSeeded data written to {path}")


def main() -> None:
    print(f"Seeding market data for {len(WATCHLIST)} symbols...")
    print(f"Date range: {START_DATE} to {END_DATE}\n")

    data = fetch_watchlist()
    total_rows = sum(len(v) for v in data.values())
    print(f"\nTotal: {len(data)} symbols, {total_rows} daily bars")

    write_json(data, Path(__file__).resolve().parent / "seeded_market_data.json")


if __name__ == "__main__":
    main()
