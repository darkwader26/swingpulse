"""Database models for SwingPulse agent pipeline."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Numeric, DateTime, Boolean, Text, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Instrument(Base):
    __tablename__ = "instruments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    asset_class: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # equity, etf, crypto
    exchange: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    market_data = relationship("MarketData", back_populates="instrument", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="instrument")


class MarketData(Base):
    __tablename__ = "market_data"

    time: Mapped[datetime] = mapped_column(DateTime, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), ForeignKey("instruments.symbol"), primary_key=True)
    open: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    high: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    low: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    close: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    volume: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    instrument = relationship("Instrument", back_populates="market_data")

    __table_args__ = (
        Index("ix_market_data_symbol_time", "symbol", "time"),
    )


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    setup_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # pullback_ema, breakout, trend_cont
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # long, short
    entry_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    stop_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    target_1: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    target_2: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    rr_ratio: Mapped[Optional[float]] = mapped_column(Numeric(6, 3), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending, approved, rejected, expired, executed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    instrument = relationship("Instrument", back_populates="signals")
    risk_decision = relationship("RiskDecision", back_populates="signal", uselist=False, cascade="all, delete-orphan")
    fills = relationship("Fill", back_populates="signal", cascade="all, delete-orphan")


class RiskDecision(Base):
    __tablename__ = "risk_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    signal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signals.id"), nullable=False, unique=True)
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    position_size: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)  # shares / contracts
    risk_dollars: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    signal = relationship("Signal", back_populates="risk_decision")


class Fill(Base):
    __tablename__ = "fills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    signal_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("signals.id"), nullable=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(10), nullable=False)  # buy, sell
    qty: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    fill_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    filled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    broker_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    execution_mode: Mapped[str] = mapped_column(String(20), default="paper")  # paper, live

    signal = relationship("Signal", back_populates="fills")


class AgentEvent(Base):
    __tablename__ = "agent_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
