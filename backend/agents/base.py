"""Base agent class for SwingPulse pipeline."""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from database import AsyncSessionLocal
from models import AgentEvent


@dataclass
class AgentContext:
    """Shared context passed between agents."""
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    execution_mode: str = "paper"  # paper | live


@dataclass
class AgentResult:
    """Standard output from any agent."""
    agent_name: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    events: List[Dict[str, Any]] = field(default_factory=list)


class BaseAgent(ABC):
    """All pipeline agents inherit from this."""

    name: str = "base"

    def __init__(self, context: Optional[AgentContext] = None):
        self.context = context or AgentContext()

    @abstractmethod
    async def run(self, inputs: Dict[str, Any]) -> AgentResult:
        """Execute the agent logic."""
        ...

    async def log_event(self, event_type: str, payload: Optional[Dict[str, Any]] = None) -> None:
        """Persist an agent decision event to the audit table.

        Gracefully degrades when PostgreSQL is unavailable (offline testing).
        """
        try:
            async with AsyncSessionLocal() as session:
                session.add(AgentEvent(
                    agent_name=self.name,
                    event_type=event_type,
                    payload=payload or {},
                ))
                await session.commit()
        except Exception:  # noqa: BLE001
            # DB unavailable — continue without persisting audit event
            pass
