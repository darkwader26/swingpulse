"""Agent 2: Signal Generator — swing setup detection (long & short)."""
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
          signals: list[dict]  # each with entry/stop/target/rr, direction long|short
        """
        watchlist = inputs.get("watchlist", inputs.get("universe", []))
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

            # ================================================================
            # LONG SETUPS (bull regime only)
            # ================================================================
            if regime == "bull":
                # Setup 1: Pullback to 20 EMA
                if abs(close - ema20) / close < 0.02 and close > ema50:
                    stop = max(round(close - 2 * atr14, 2), round(close - min_risk, 2))
                    risk = close - stop
                    if risk > 0:
                        target_1 = round(close + risk * 2, 2)
                        target_2 = round(close + risk * 3, 2)
                        signals.append({
                            "symbol": symbol,
                            "setup_type": "pullback_to_20ema",
                            "direction": "long",
                            "entry_price": round(close, 2),
                            "stop_price": stop,
                            "target_1": target_1,
                            "target_2": target_2,
                            "rr_ratio": round(min((target_1 - close) / risk, 10.0), 2),
                            "confidence": 0.72,
                        })

                # Setup 2: Trend continuation above 50 EMA
                if close > ema50 and close > prev.get("close", 0):
                    stop = max(round(ema50 * 0.985, 2), round(close - min_risk, 2))
                    risk = close - stop
                    if risk > 0:
                        target_1 = round(close + risk * 2, 2)
                        target_2 = round(close + risk * 3, 2)
                        signals.append({
                            "symbol": symbol,
                            "setup_type": "trend_continuation",
                            "direction": "long",
                            "entry_price": round(close, 2),
                            "stop_price": stop,
                            "target_1": target_1,
                            "target_2": target_2,
                            "rr_ratio": round(min((target_1 - close) / risk, 10.0), 2),
                            "confidence": 0.70,
                        })

            # ================================================================
            # SHORT SETUPS (bear regime only)
            # ================================================================
            if regime == "bear":
                # Setup 3: Pullback to 20 EMA (short)
                if abs(close - ema20) / close < 0.02 and close < ema50:
                    stop = min(round(close + 2 * atr14, 2), round(close + min_risk, 2))
                    risk = stop - close
                    if risk > 0:
                        target_1 = round(close - risk * 2, 2)
                        target_2 = round(close - risk * 3, 2)
                        signals.append({
                            "symbol": symbol,
                            "setup_type": "pullback_to_20ema_short",
                            "direction": "short",
                            "entry_price": round(close, 2),
                            "stop_price": stop,
                            "target_1": target_1,
                            "target_2": target_2,
                            "rr_ratio": round(min((close - target_1) / risk, 10.0), 2),
                            "confidence": 0.72,
                        })

                # Setup 4: Trend continuation below 50 EMA (short)
                if close < ema50 and close < prev.get("close", 0):
                    stop = min(round(ema50 * 1.015, 2), round(close + min_risk, 2))
                    risk = stop - close
                    if risk > 0:
                        target_1 = round(close - risk * 2, 2)
                        target_2 = round(close - risk * 3, 2)
                        signals.append({
                            "symbol": symbol,
                            "setup_type": "trend_continuation_short",
                            "direction": "short",
                            "entry_price": round(close, 2),
                            "stop_price": stop,
                            "target_1": target_1,
                            "target_2": target_2,
                            "rr_ratio": round(min((close - target_1) / risk, 10.0), 2),
                            "confidence": 0.70,
                        })

            # ================================================================
            # BREAKOUT / BREAKDOWN SETUPS (any regime)
            # ================================================================
            # Setup 5: Breakout above 20-day high (long)
            if close > high_20d and volume > avg_vol_20 * 1.5:
                stop = max(round(low_20d, 2), round(close - min_risk, 2))
                risk = close - stop
                if risk > 0:
                    target_1 = round(close + risk * 2, 2)
                    target_2 = round(close + risk * 3, 2)
                    signals.append({
                        "symbol": symbol,
                        "setup_type": "breakout_20d_high",
                        "direction": "long",
                        "entry_price": round(close, 2),
                        "stop_price": stop,
                        "target_1": target_1,
                        "target_2": target_2,
                        "rr_ratio": round(min((target_1 - close) / risk, 10.0), 2),
                        "confidence": 0.68,
                    })

            # Setup 6: Breakdown below 20-day low (short)
            if close < low_20d and volume > avg_vol_20 * 1.5:
                stop = min(round(high_20d, 2), round(close + min_risk, 2))
                risk = stop - close
                if risk > 0:
                    target_1 = round(close - risk * 2, 2)
                    target_2 = round(close - risk * 3, 2)
                    signals.append({
                        "symbol": symbol,
                        "setup_type": "breakdown_20d_low",
                        "direction": "short",
                        "entry_price": round(close, 2),
                        "stop_price": stop,
                        "target_1": target_1,
                        "target_2": target_2,
                        "rr_ratio": round(min((close - target_1) / risk, 10.0), 2),
                        "confidence": 0.68,
                    })

        # Sort by RR ratio desc, confidence desc
        signals.sort(key=lambda s: (s.get("rr_ratio", 0), s.get("confidence", 0)), reverse=True)

        await self.log_event("signals_generated", {
            "signal_count": len(signals),
            "symbols": [s["symbol"] for s in signals],
            "directions": {s["symbol"]: s["direction"] for s in signals},
        })

        return AgentResult(
            agent_name=self.name,
            success=True,
            data={"signals": signals},
        )
