"""Agent 2: Signal Generator — swing setup detection."""
from __future__ import annotations

from typing import Any, Dict, List
from base import BaseAgent, AgentResult, AgentContext


def _safe(val: Any, default: float = 0.0) -> float:
    """Safely coerce a value to float."""
    try:
        f = float(val)
        if f != f:  # NaN check
            return default
        return f
    except (TypeError, ValueError):
        return default


class SignalGeneratorAgent(BaseAgent):
    name = "signal_generator"

    async def run(self, inputs: Dict[str, Any]) -> AgentResult:
        """
        Inputs:
          watchlist: list[str]
          ohlcv: dict[symbol, list[dict]]  # daily candles with indicators
          regime: str  # bull | bear | chop

        Output:
          signals: list[dict]  # each with entry/stop/target/rr, capped at sane RR
        """
        watchlist = inputs.get("watchlist", [])
        ohlcv = inputs.get("ohlcv", {})
        regime = inputs.get("regime", "chop")

        signals: List[Dict[str, Any]] = []

        for symbol in watchlist:
            candles = ohlcv.get(symbol, [])
            if len(candles) < 50:
                continue

            latest = candles[-1]
            prev = candles[-2] if len(candles) >= 2 else latest

            close = _safe(latest.get("close", 0))
            ema20 = _safe(latest.get("ema20", close))
            ema50 = _safe(latest.get("ema50", close))
            atr14 = _safe(latest.get("atr14", close * 0.02))
            high_20d = _safe(latest.get("high_20d", close))
            low_20d = _safe(latest.get("low_20d", close))
            volume = _safe(latest.get("volume", 0))
            avg_vol_20 = _safe(latest.get("avg_vol_20d", volume))

            # Minimum risk distance: 1% of entry price (prevents absurd RR from tight stops)
            min_risk = close * 0.01

            # --- Setup 1: Pullback to 20 EMA (bull regime only) ---
            if regime == "bull":
                if abs(close - ema20) / close < 0.02 and close > ema50:
                    # ATR-based stop: 2x ATR below entry, with minimum risk floor
                    stop = max(round(close - 2 * atr14, 2), round(close - min_risk, 2))
                    risk = close - stop
                    if risk > 0:
                        target_1 = round(close + risk * 2, 2)   # 2:1 RR
                        target_2 = round(close + risk * 3, 2)   # 3:1 RR
                        rr = round((target_1 - close) / risk, 2)
                        rr = min(rr, 10.0)  # cap unrealistic RR
                        signals.append({
                            "symbol": symbol,
                            "setup_type": "pullback_to_20ema",
                            "direction": "long",
                            "entry_price": round(close, 2),
                            "stop_price": stop,
                            "target_1": target_1,
                            "target_2": target_2,
                            "rr_ratio": rr,
                            "confidence": 0.72,
                        })

            # --- Setup 2: Breakout above 20-day high (any regime) ---
            if close > high_20d and volume > avg_vol_20 * 1.5:
                stop = max(round(low_20d, 2), round(close - min_risk, 2))
                risk = close - stop
                if risk > 0:
                    target_1 = round(close + risk * 2, 2)
                    target_2 = round(close + risk * 3, 2)
                    rr = round((target_1 - close) / risk, 2)
                    rr = min(rr, 10.0)
                    signals.append({
                        "symbol": symbol,
                        "setup_type": "breakout_20d_high",
                        "direction": "long",
                        "entry_price": round(close, 2),
                        "stop_price": stop,
                        "target_1": target_1,
                        "target_2": target_2,
                        "rr_ratio": rr,
                        "confidence": 0.68,
                    })

            # --- Setup 3: Trend continuation above 50 EMA (bull regime) ---
            if regime == "bull" and close > ema50 and close > prev.get("close", 0):
                stop = max(round(ema50 * 0.985, 2), round(close - min_risk, 2))
                risk = close - stop
                if risk > 0:
                    target_1 = round(close + risk * 2, 2)
                    target_2 = round(close + risk * 3, 2)
                    rr = round((target_1 - close) / risk, 2)
                    rr = min(rr, 10.0)
                    signals.append({
                        "symbol": symbol,
                        "setup_type": "trend_continuation",
                        "direction": "long",
                        "entry_price": round(close, 2),
                        "stop_price": stop,
                        "target_1": target_1,
                        "target_2": target_2,
                        "rr_ratio": rr,
                        "confidence": 0.70,
                    })

        # Sort by RR ratio desc, confidence desc
        signals.sort(key=lambda s: (s.get("rr_ratio", 0), s.get("confidence", 0)), reverse=True)

        await self.log_event("signals_generated", {
            "signal_count": len(signals),
            "symbols": [s["symbol"] for s in signals],
        })

        return AgentResult(
            agent_name=self.name,
            success=True,
            data={"signals": signals},
        )
