# SwingPulse Agents

This directory contains the 5-agent pipeline:

| Agent | File | Responsibility |
|-------|------|----------------|
| 1. Market Scanner | `scanner.py` | Universe filter, regime detection |
| 2. Signal Generator | `signal_generator.py` | Swing setup detection (pullback, breakout, trend) |
| 3. Risk Manager | `risk_manager.py` | Position sizing, correlation, kill-switch gate |
| 4. Execution Agent | `executor.py` | Paper broker simulation |
| 5. Ops & Reporting | `ops_reporting.py` | P&L, equity curve, journal, alerts |

## Pipeline Orchestrator

`pipeline.py` — `SwingPipeline` runs agents sequentially, merging outputs.

## Usage

```python
from agents.pipeline import SwingPipeline
from base import AgentContext

context = AgentContext(execution_mode="paper")
pipeline = SwingPipeline(context)

result = await pipeline.run({
    "universe": ["AAPL", "NVDA", "MSFT", ...],
    "market_data": {...},
    "equity": 100000.0,
    "execution_mode": "paper",
})
```

Each agent logs decisions to `agent_events` for full audit trail.
