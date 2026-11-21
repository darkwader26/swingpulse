"""Agent 3: Risk Manager — position sizing, correlation, kill-switch gate."""
from __future__ import annotations

from typing import Any, Dict, List
from base import BaseAgent, AgentResult, AgentContext


class RiskManagerAgent(BaseAgent):
    name = "risk_manager"

    async def run(self, inputs: Dict[str, Any]) -> AgentResult:
        """
        Inputs:
          signals: list[dict]  # from signal_generator
          equity: float  # total account equity
          open_positions: list[dict]  # current book {symbol, sector, unrealized_pnl}
          daily_pnl_percent: float  # today's P&L as % of equity
          kill_switch: bool  # manual halt
          config: dict  # risk parameters

        Output:
          decisions: list[dict]  # signal_id -> approved/rejected + size
        """
        signals = inputs.get("signals", [])
        equity = inputs.get("equity", 100_000.0)
        open_positions = inputs.get("open_positions", [])
        daily_pnl_percent = inputs.get("daily_pnl_percent", 0.0)
        kill_switch = inputs.get("kill_switch", False)
        config = inputs.get("config", {})

        max_risk_per_trade = config.get("max_risk_per_trade", 0.005)  # 0.5%
        max_daily_loss = config.get("max_daily_loss", 0.02)  # 2%
        max_positions = config.get("max_positions", 8)
        max_sector_exposure = config.get("max_sector_exposure", 0.30)

        decisions: List[Dict[str, Any]] = []

        # Kill-switch gate
        if kill_switch:
            for s in signals:
                decisions.append({
                    "signal_id": s.get("id") or s.get("symbol"),
                    "symbol": s["symbol"],
                    "approved": False,
                    "position_size": 0,
                    "risk_dollars": 0,
                    "reason": "kill_switch_active",
                })
            await self.log_event("risk_decisions", {"decisions": decisions, "reason": "kill_switch"})
            return AgentResult(agent_name=self.name, success=True, data={"decisions": decisions})

        # Daily loss limit gate
        if daily_pnl_percent <= -max_daily_loss:
            for s in signals:
                decisions.append({
                    "signal_id": s.get("id") or s.get("symbol"),
                    "symbol": s["symbol"],
                    "approved": False,
                    "position_size": 0,
                    "risk_dollars": 0,
                    "reason": "daily_loss_limit",
                })
            await self.log_event("risk_decisions", {"decisions": decisions, "reason": "daily_loss_limit"})
            return AgentResult(agent_name=self.name, success=True, data={"decisions": decisions})

        # Sector exposure tracking
        sector_exposure: Dict[str, float] = {}
        for pos in open_positions:
            sector = pos.get("sector", "unknown")
            sector_exposure[sector] = sector_exposure.get(sector, 0.0) + abs(pos.get("market_value", 0))

        open_symbols = {p.get("symbol") for p in open_positions}

        for s in signals:
            symbol = s["symbol"]
            entry = s.get("entry_price", 0)
            stop = s.get("stop_price", 0)
            risk_per_share = abs(entry - stop)

            # Skip if already have position in symbol
            if symbol in open_symbols:
                decisions.append({
                    "signal_id": s.get("id") or symbol,
                    "symbol": symbol,
                    "approved": False,
                    "position_size": 0,
                    "risk_dollars": 0,
                    "reason": "already_positioned",
                })
                continue

            # Risk per trade
            risk_dollars = equity * max_risk_per_trade
            if risk_per_share > 0:
                position_size = risk_dollars / risk_per_share
            else:
                position_size = 0

            # Sector check
            sector = s.get("sector", "unknown")
            current_sector_exposure = sector_exposure.get(sector, 0.0)
            if current_sector_exposure / equity > max_sector_exposure:
                decisions.append({
                    "signal_id": s.get("id") or symbol,
                    "symbol": symbol,
                    "approved": False,
                    "position_size": 0,
                    "risk_dollars": 0,
                    "reason": "sector_limit",
                })
                continue

            # Max positions check
            if len(open_positions) >= max_positions:
                decisions.append({
                    "signal_id": s.get("id") or symbol,
                    "symbol": symbol,
                    "approved": False,
                    "position_size": 0,
                    "risk_dollars": 0,
                    "reason": "max_positions",
                })
                continue

            decisions.append({
                "signal_id": s.get("id") or symbol,
                "symbol": symbol,
                "approved": True,
                "position_size": round(position_size, 2),
                "risk_dollars": round(risk_dollars, 2),
                "entry_price": s.get("entry_price", 0),
                "stop_price": s.get("stop_price", 0),
                "target_1": s.get("target_1", 0),
                "target_2": s.get("target_2", 0),
                "direction": s.get("direction", "long"),
                "setup_type": s.get("setup_type", ""),
                "reason": "approved",
            })

        await self.log_event("risk_decisions", {"decisions": decisions})

        return AgentResult(
            agent_name=self.name,
            success=True,
            data={"decisions": decisions},
        )
