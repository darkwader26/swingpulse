"""Agent 1: Market Scanner — universe filter + regime detection."""
from __future__ import annotations

from typing import Any, Dict, List
from base import BaseAgent, AgentResult, AgentContext


class MarketScannerAgent(BaseAgent):
    name = "scanner"

    async def run(self, inputs: Dict[str, Any]) -> AgentResult:
        """
        Inputs:
          universe: list[str]  # candidate symbols
          market_data: dict  # symbol -> {close, volume, atr_pct, above_200ema}
          macro_calendar: list  # upcoming events (optional)

        Output:
          watchlist: list[str]
          regime: str  # bull | bear | chop
          filtered_count: int
          rejected_reasons: dict[symbol, str]
        """
        universe = inputs.get("universe", [])
        market_data = inputs.get("market_data", {})
        regime_input = inputs.get("regime", "bull")  # from macro/index ETF

        watchlist: List[str] = []
        rejected: Dict[str, str] = {}

        for symbol in universe:
            md = market_data.get(symbol, {})
            volume = md.get("volume", 0)
            atr_pct = md.get("atr_pct", 0)
            price = md.get("close", 0)

            # Hard filters
            if price <= 10:
                rejected[symbol] = "price below $10"
                continue
            if volume < 500_000:
                rejected[symbol] = "volume below 500k"
                continue
            if atr_pct < 1.5:
                rejected[symbol] = "ATR% below 1.5% (too quiet)"
                continue

            watchlist.append(symbol)

        regime = regime_input if regime_input in ("bull", "bear", "chop") else "chop"

        await self.log_event("scan_complete", {
            "watchlist": watchlist,
            "regime": regime,
            "rejected": rejected,
        })

        return AgentResult(
            agent_name=self.name,
            success=True,
            data={
                "watchlist": watchlist,
                "regime": regime,
                "filtered_count": len(watchlist),
                "rejected_reasons": rejected,
            },
        )
