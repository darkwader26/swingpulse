"""Agent pipeline orchestrator — runs agents in sequence."""
from __future__ import annotations

from typing import Any, Dict
import asyncio

from base import BaseAgent, AgentContext
from scanner import MarketScannerAgent
from signal_generator import SignalGeneratorAgent
from risk_manager import RiskManagerAgent
from executor import ExecutionAgent
from ops_reporting import OpsReportingAgent


class SwingPipeline:
    """Orchestrates the 5-agent pipeline in order."""

    def __init__(self, context: AgentContext | None = None):
        self.context = context or AgentContext()
        self.agents: list[BaseAgent] = [
            MarketScannerAgent(self.context),
            SignalGeneratorAgent(self.context),
            RiskManagerAgent(self.context),
            ExecutionAgent(self.context),
            OpsReportingAgent(self.context),
        ]

    async def run(self, initial_inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs the pipeline sequentially. Each agent's output becomes the next
        agent's input (merged with initial_inputs).
        """
        outputs: Dict[str, Any] = {}
        current_inputs = dict(initial_inputs)

        for agent in self.agents:
            try:
                result = await agent.run(current_inputs)
                outputs[agent.name] = result

                if not result.success:
                    outputs["pipeline_error"] = {
                        "agent": agent.name,
                        "error": result.error,
                    }
                    break

                # Merge agent output into next inputs
                if result.data:
                    current_inputs.update(result.data)

            except Exception as exc:  # noqa: BLE001
                outputs[agent.name] = {
                    "success": False,
                    "error": str(exc),
                }
                break

        outputs["pipeline_complete"] = True
        outputs["run_id"] = self.context.run_id
        return outputs
