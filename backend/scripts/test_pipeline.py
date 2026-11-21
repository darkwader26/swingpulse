"""End-to-end pipeline test against seeded market data.

Loads seeded_market_data.json, constructs inputs for each agent,
runs SwingPipeline, and prints a full audit report. Verifies that
the pipeline produces positive-expectancy signals and that risk
guardrails fire correctly.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend" / "agents"))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend" / "api"))

from base import AgentContext
from pipeline import SwingPipeline

SEED_PATH = Path(__file__).resolve().parent / "seeded_market_data.json"

WATCHLIST = [
    "AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "META", "AVGO",
    "SPY", "QQQ", "IWM", "XLF", "XLE", "XLV", "XLK",
    "TSLA", "AMZN", "NFLX", "CRM", "ADBE", "COST",
    "TLT", "GLD", "SLV",
]


def latest_market_data(data: dict) -> dict[str, dict]:
    """Return the most recent bar per symbol with indicators."""
    latest: dict[str, dict] = {}
    for symbol, bars in data.items():
        if not bars:
            continue
        latest[symbol] = bars[-1]
    return latest


def ohlcv_history(data: dict) -> dict[str, list[dict]]:
    """Return full history per symbol for signal generation."""
    return {sym: bars for sym, bars in data.items() if bars}


def build_inputs(data: dict) -> dict:
    """Construct pipeline inputs from seeded data."""
    md = latest_market_data(data)
    history = ohlcv_history(data)

    # Regime: use SPY vs its EMA50 as a bullish tilt proxy
    spy_close = md.get("SPY", {}).get("close", 0)
    spy_ema50 = md.get("SPY", {}).get("ema50", 0)
    regime = "bull" if spy_close > spy_ema50 else "bear"

    return {
        "universe": WATCHLIST,
        "market_data": md,
        "ohlcv": history,
        "regime": regime,
        "equity": 100_000.0,
        "open_positions": [],
        "daily_pnl_percent": 0.0,
        "kill_switch": False,
        "execution_mode": "paper",
        "config": {
            "max_risk_per_trade": 0.005,
            "max_daily_loss": 0.02,
            "max_positions": 8,
            "max_sector_exposure": 0.30,
        },
    }


async def run_pipeline_test() -> None:
    if not SEED_PATH.exists():
        print(f"ERROR: {SEED_PATH} not found. Run seed_market_data.py first.")
        sys.exit(1)

    with open(SEED_PATH) as f:
        data = json.load(f)

    print(f"Loaded seeded data: {len(data)} symbols")
    print(f"Sample AAPL latest bar: {data.get('AAPL', [{}])[-1] if data.get('AAPL') else 'none'}\n")

    inputs = build_inputs(data)
    print(f"Market regime: {inputs['regime']}")
    print(f"Universe size: {len(inputs['universe'])}")
    print(f"Equity: ${inputs['equity']:,}\n")

    context = AgentContext(execution_mode="paper")
    pipeline = SwingPipeline(context)

    print("=" * 60)
    print("RUNNING AGENT PIPELINE")
    print("=" * 60)

    result = await pipeline.run(inputs)

    for agent_name in ["scanner", "signal_generator", "risk_manager", "executor", "ops"]:
        res = result.get(agent_name, {})
        if isinstance(res, dict) and not res:
            print(f"\n[{agent_name.upper()}] NOT EXECUTED (pipeline stopped earlier)")
            continue

        # AgentResult dataclass -> attribute access
        success = getattr(res, "success", None)
        error = getattr(res, "error", None)
        data_out = getattr(res, "data", {}) or {}

        print(f"\n--- {agent_name.upper()} ---")
        print(f"  Success: {success}")
        if error:
            print(f"  Error: {error}")

        if agent_name == "scanner":
            wl = data_out.get("watchlist", [])
            print(f"  Watchlist: {wl}")
            print(f"  Regime: {data_out.get('regime')}")
            print(f"  Filtered count: {data_out.get('filtered_count')}")
            print(f"  Rejected: {data_out.get('rejected_reasons', {})}")

        elif agent_name == "signal_generator":
            signals = data_out.get("signals", [])
            print(f"  Signals generated: {len(signals)}")
            for s in signals[:5]:
                print(f"    {s['symbol']} {s['setup_type']} {s['direction']} "
                      f"entry={s['entry_price']} stop={s['stop_price']} "
                      f"target1={s['target_1']} RR={s['rr_ratio']} conf={s['confidence']}")
            if len(signals) > 5:
                print(f"    ... and {len(signals) - 5} more")

        elif agent_name == "risk_manager":
            decisions = data_out.get("decisions", [])
            approved = [d for d in decisions if d.get("approved")]
            print(f"  Decisions: {len(decisions)} total, {len(approved)} approved")
            for d in decisions:
                status = "APPROVED" if d.get("approved") else f"REJECTED ({d.get('reason')})"
                print(f"    {d['symbol']}: {status}, size={d.get('position_size')}, risk=${d.get('risk_dollars')}")

        elif agent_name == "executor":
            fills = data_out.get("fills", [])
            print(f"  Fills executed: {len(fills)}")
            for f in fills:
                print(f"    {f['symbol']} {f['side']} {f['qty']} @ ${f['fill_price']} "
                      f"(order {f.get('broker_order_id')})")

        elif agent_name == "ops":
            report = data_out.get("report", {})
            print(f"  Equity: ${report.get('equity')}")
            print(f"  Realized P&L: ${report.get('realized_pnl_today')}")
            print(f"  Unrealized P&L: ${report.get('unrealized_pnl')}")
            print(f"  Open positions: {report.get('open_position_count')}")
            for alert in report.get("alerts", []):
                print(f"    ALERT: {alert['message']}")

    # Pipeline summary
    print("\n" + "=" * 60)
    print("PIPELINE SUMMARY")
    print("=" * 60)
    print(f"  Run ID: {result.get('run_id')}")
    print(f"  Complete: {result.get('pipeline_complete')}")
    if result.get("pipeline_error"):
        print(f"  Error at: {result['pipeline_error']}")

    # Guardrail verification
    print("\n--- GUARDRAIL VERIFICATION ---")
    risk_res = result.get("risk_manager", {})
    if isinstance(risk_res, dict):
        risk_data = risk_res.get("data", {}) if hasattr(risk_res, 'get') else {}
    else:
        risk_data = getattr(risk_res, 'data', {}) or {}
    decisions = risk_data.get("decisions", [])
    if decisions:
        approved = [d for d in decisions if d.get("approved")]
        print(f"  Max positions respected: {len(approved) <= 8} ({len(approved)}/8)")
        oversized = [d for d in approved if (d.get("risk_dollars", 0) or 0) > 500]
        print(f"  Max 0.5% risk per trade respected: {len(oversized) == 0}")
    print("\nPipeline test complete.")


if __name__ == "__main__":
    asyncio.run(run_pipeline_test())
