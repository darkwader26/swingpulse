"""Agent 4: Execution Agent — paper broker simulation."""
from __future__ import annotations

from typing import Any, Dict, List
from base import BaseAgent, AgentResult, AgentContext


class ExecutionAgent(BaseAgent):
    name = "executor"

    async def run(self, inputs: Dict[str, Any]) -> AgentResult:
        """
        Inputs:
          decisions: list[dict]  # from risk_manager (approved=True)
          market_data: dict[symbol, {bid, ask, last}]
          execution_mode: str  # paper | live

        Output:
          fills: list[dict]
        """
        decisions = inputs.get("decisions", [])
        market_data = inputs.get("market_data", {})
        mode = inputs.get("execution_mode", self.context.execution_mode)

        fills: List[Dict[str, Any]] = []

        for d in decisions:
            if not d.get("approved"):
                continue

            symbol = d["symbol"]
            size = d.get("position_size", 0)
            md = market_data.get(symbol, {})
            fill_price = md.get("ask") or md.get("last") or d.get("entry_price", 0)

            if size <= 0 or fill_price <= 0:
                continue

            fill = {
                "symbol": symbol,
                "side": "buy" if d.get("direction", "long") == "long" else "sell",
                "qty": round(size, 4),
                "fill_price": round(fill_price, 4),
                "execution_mode": mode,
                "broker_order_id": f"PAP-{symbol}-{abs(hash(symbol)) % 100000:05d}" if mode == "paper" else None,
            }
            fills.append(fill)

        await self.log_event("fills_executed", {"fills": fills, "mode": mode})

        return AgentResult(
            agent_name=self.name,
            success=True,
            data={"fills": fills},
        )
