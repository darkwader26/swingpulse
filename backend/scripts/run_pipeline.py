"""Run the SwingPulse agent pipeline against the latest market data.

Loads live_market_data.json (written by data_feed.py), constructs
pipeline inputs, runs SwingPipeline, and prints a full audit report.
Use this for Phase 5 paper-trading validation.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "agents"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

from base import AgentContext
from pipeline import SwingPipeline

JSON_PATH = Path(__file__).resolve().parent / "live_market_data.json"

WATCHLIST = [
    "AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "META", "AVGO",
    "SPY", "QQQ", "IWM", "XLF", "XLE", "XLV", "XLK",
    "TSLA", "AMZN", "NFLX", "CRM", "ADBE", "COST",
    "TLT", "GLD", "SLV",
]


def latest_market_data(data: dict) -> dict[str, dict]:
    latest: dict[str, dict] = {}
    for symbol, bars in data.items():
        if not bars:
            continue
        latest[symbol] = bars[-1]
    return latest


def ohlcv_history(data: dict) -> dict[str, list[dict]]:
    return {sym: bars for sym, bars in data.items() if bars}


def build_inputs(data: dict, equity: float = 100_000.0,
                 open_positions: list | None = None,
                 daily_pnl_percent: float = 0.0,
                 kill_switch: bool = False) -> dict:
    md = latest_market_data(data)
    history = ohlcv_history(data)

    # Regime: SPY vs EMA50
    spy_close = md.get("SPY", {}).get("close", 0)
    spy_ema50 = md.get("SPY", {}).get("ema50", 0)
    regime = "bull" if spy_close > spy_ema50 else "bear"

    return {
        "universe": WATCHLIST,
        "market_data": md,
        "ohlcv": history,
        "regime": regime,
        "equity": equity,
        "open_positions": open_positions or [],
        "daily_pnl_percent": daily_pnl_percent,
        "kill_switch": kill_switch,
        "execution_mode": "paper",
        "config": {
            "max_risk_per_trade": 0.005,
            "max_daily_loss": 0.02,
            "max_positions": 8,
            "max_sector_exposure": 0.30,
        },
    }


async def run_pipeline(equity: float = 100_000.0) -> None:
    if not JSON_PATH.exists():
        print(f"ERROR: {JSON_PATH} not found. Run data_feed.py first.")
        sys.exit(1)

    with open(JSON_PATH) as f:
        data = json.load(f)

    print(f"Loaded {len(data)} symbols from {JSON_PATH}")
    inputs = build_inputs(data, equity=equity)
    print(f"Market regime: {inputs['regime']} | Equity: ${equity:,.2f}\n")

    ctx = AgentContext(execution_mode="paper")
    pipe = SwingPipeline(ctx)
    result = await pipe.run(inputs)

    print("=" * 60)
    print("PIPELINE RESULTS")
    print("=" * 60)

    for agent_name in ["scanner", "signal_generator", "risk_manager", "executor", "ops"]:
        res = result.get(agent_name, {})
        if not res:
            print(f"\n[{agent_name.upper()}] NOT EXECUTED")
            continue
        success = getattr(res, "success", None)
        data_out = getattr(res, "data", {}) or {}
        error = getattr(res, "error", None)
        print(f"\n--- {agent_name.upper()} (success={success})" + (f" error={error}" if error else ""))
        if agent_name == "scanner":
            print(f"  Regime: {data_out.get('regime')} | Watchlist: {len(data_out.get('watchlist', []))} symbols")
        elif agent_name == "signal_generator":
            signals = data_out.get("signals", [])
            print(f"  Signals: {len(signals)}")
            for s in signals[:8]:
                print(f"    {s['symbol']} {s['setup_type']} entry=${s['entry_price']} stop=${s['stop_price']} T1=${s['target_1']} RR={s['rr_ratio']}")
        elif agent_name == "risk_manager":
            decisions = data_out.get("decisions", [])
            approved = [d for d in decisions if d.get("approved")]
            print(f"  Decisions: {len(decisions)} total, {len(approved)} approved")
            for d in approved:
                print(f"    APPROVED {d['symbol']}: size={d['position_size']} risk=${d['risk_dollars']}")
            for d in decisions:
                if not d.get("approved"):
                    print(f"    REJECTED {d['symbol']}: {d['reason']}")
        elif agent_name == "executor":
            fills = data_out.get("fills", [])
            print(f"  Paper fills: {len(fills)}")
            for f in fills:
                print(f"    {f['symbol']} {f['side']} {f['qty']} @ ${f['fill_price']} order={f.get('broker_order_id')}")
        elif agent_name == "ops":
            report = data_out.get("report", {})
            print(f"  Equity: ${report.get('equity')} | Unrealized: ${report.get('unrealized_pnl')} | Positions: {report.get('open_position_count')}")
            for a in report.get("alerts", []):
                print(f"    ALERT: {a['message']}")

    print(f"\nPipeline complete: {result.get('pipeline_complete')}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run SwingPulse agent pipeline on latest data")
    parser.add_argument("--equity", type=float, default=100_000.0, help="Account equity for position sizing")
    args = parser.parse_args()
    asyncio.run(run_pipeline(equity=args.equity))
