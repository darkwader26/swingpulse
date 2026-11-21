"""Agent 5: Ops & Reporting — P&L, equity curve, journal."""
from __future__ import annotations

from typing import Any, Dict, List
from base import BaseAgent, AgentResult, AgentContext


class OpsReportingAgent(BaseAgent):
    name = "ops"

    async def run(self, inputs: Dict[str, Any]) -> AgentResult:
        """
        Inputs:
          fills: list[dict]  # from execution
          market_data: dict[symbol, {close}]
          open_positions: list[dict]
          equity: float

        Output:
          report: dict  # P&L, win rate, equity curve point, alerts
        """
        fills = inputs.get("fills", [])
        market_data = inputs.get("market_data", {})
        open_positions = inputs.get("open_positions", [])
        equity = inputs.get("equity", 100_000.0)

        # Calculate unrealized P&L on open positions
        unrealized_pnl = 0.0
        for pos in open_positions:
            symbol = pos["symbol"]
            current_price = market_data.get(symbol, {}).get("close", pos.get("entry_price", 0))
            entry = pos.get("entry_price", 0)
            qty = pos.get("qty", 0)
            side = pos.get("side", "long")

            if side == "long":
                unrealized_pnl += (current_price - entry) * qty
            else:
                unrealized_pnl += (entry - current_price) * qty

        realized_pnl = sum(f.get("realized_pnl", 0) for f in fills if "realized_pnl" in f)

        report = {
            "equity": round(equity + unrealized_pnl, 2),
            "realized_pnl_today": round(realized_pnl, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "open_position_count": len(open_positions),
            "alerts": [],
        }

        # Alerts
        if unrealized_pnl < -equity * 0.01:
            report["alerts"].append({
                "type": "drawdown_warning",
                "message": f"Unrealized drawdown ${abs(unrealized_pnl):.2f} exceeds 1% of equity",
            })

        await self.log_event("report_generated", report)

        return AgentResult(
            agent_name=self.name,
            success=True,
            data={"report": report},
        )
