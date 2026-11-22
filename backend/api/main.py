"""FastAPI application entrypoint — SwingPulse agent pipeline API."""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import select, desc, func
import asyncio, os, uuid, httpx
from datetime import datetime, timedelta

from database import engine, AsyncSessionLocal, Base
from models import (
    Instrument, MarketData, Signal, RiskDecision, Fill, AgentEvent,
    User, SavedChart, SavedLayout,
)

# ---------------------------------------------------------------------------
# Database lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception:  # DB unavailable at startup — continue without it
        pass
    yield
    try:
        await engine.dispose()
    except Exception:
        pass


app = FastAPI(title="SwingPulse API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Google OAuth2
# ---------------------------------------------------------------------------
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"


@app.post("/api/v1/auth/google/callback")
async def google_auth_callback(payload: dict):
    """Exchange an OAuth2 authorization code for tokens and user profile."""
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
                "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI", ""),
                "grant_type": "authorization_code",
            },
        )
        if not token_res.is_success:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to exchange code for token: {token_res.text}",
            )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token in response")

        user_res = await client.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if not user_res.is_success:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch user profile: {user_res.text}",
            )
        user_info = user_res.json()

    email = user_info.get("email")
    user_record = None
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.email == email)
            )
            user_record = result.scalar_one_or_none()
            if not user_record:
                user_record = User(
                    email=email,
                    name=user_info.get("name"),
                    picture=user_info.get("picture"),
                )
                session.add(user_record)
                await session.commit()
                await session.refresh(user_record)
    except Exception:
        pass  # DB unavailable — still return token

    return {
        "access_token": access_token,
        "user": {
            "id": str(user_record.id) if user_record else None,
            "email": email,
            "name": user_info.get("name"),
            "picture": user_info.get("picture"),
        },
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "swingpulse-api", "mode": os.getenv("EXECUTION_MODE", "paper")}


# ---------------------------------------------------------------------------
# Agents status
# ---------------------------------------------------------------------------
@app.get("/api/v1/agents/status")
async def agents_status():
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(AgentEvent.agent_name, func.max(AgentEvent.created_at))
                .group_by(AgentEvent.agent_name)
            )
            last_runs = {name: dt for name, dt in result.all()}
    except Exception:  # DB unavailable
        last_runs = {}

    return {
        "scanner": {
            "status": "active",
            "last_run": last_runs.get("scanner"),
            "errors": 0,
        },
        "signal_generator": {
            "status": "active",
            "last_run": last_runs.get("signal_generator"),
            "errors": 0,
        },
        "risk_manager": {
            "status": "active",
            "last_run": last_runs.get("risk_manager"),
            "errors": 0,
        },
        "executor": {
            "status": "standby",
            "mode": os.getenv("EXECUTION_MODE", "paper"),
            "last_run": last_runs.get("executor"),
            "errors": 0,
        },
        "ops": {
            "status": "active",
            "last_run": last_runs.get("ops"),
            "errors": 0,
        },
    }


# ---------------------------------------------------------------------------
# Positions (from fills + latest market data)
# ---------------------------------------------------------------------------
@app.get("/api/v1/positions")
async def positions():
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Fill).order_by(Fill.filled_at.desc())
            )
            fills = result.scalars().all()

            latest_by_symbol: dict[str, Fill] = {}
            for f in fills:
                if f.symbol not in latest_by_symbol:
                    latest_by_symbol[f.symbol] = f

            positions = []
            for symbol, fill in latest_by_symbol.items():
                side = "long" if fill.side == "buy" else "short"
                entry = float(fill.fill_price)
                qty = float(fill.qty)

                close_result = await session.execute(
                    select(MarketData.close)
                    .where(MarketData.symbol == symbol)
                    .order_by(desc(MarketData.time))
                    .limit(1)
                )
                close = close_result.scalar_one_or_none()
                current_price = float(close) if close else entry

                if side == "long":
                    unrealized_pnl = (current_price - entry) * qty
                else:
                    unrealized_pnl = (entry - current_price) * qty

                positions.append({
                    "symbol": symbol,
                    "side": side,
                    "entry": round(entry, 2),
                    "stop": round(entry * 0.97, 2),
                    "target": round(entry * 1.06, 2),
                    "qty": round(qty, 4),
                    "unrealized_pnl": round(unrealized_pnl, 2),
                    "r_multiple": round(unrealized_pnl / (entry * 0.005 * qty), 2) if entry > 0 else 0,
                    "age": "1d",
                })
    except Exception:  # DB unavailable
        positions = []

    return positions


# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------
@app.get("/api/v1/signals")
async def signals(
    status: str | None = Query(None, description="Filter by status"),
):
    try:
        async with AsyncSessionLocal() as session:
            q = select(Signal).order_by(desc(Signal.created_at))
            if status:
                q = q.where(Signal.status == status)
            result = await session.execute(q)
            signals_list = result.scalars().all()

            return [
                {
                    "id": str(s.id),
                    "symbol": s.symbol,
                    "setup_type": s.setup_type,
                    "direction": s.direction,
                    "entry_price": float(s.entry_price) if s.entry_price else 0,
                    "stop_price": float(s.stop_price) if s.stop_price else 0,
                    "target_1": float(s.target_1) if s.target_1 else 0,
                    "target_2": float(s.target_2) if s.target_2 else 0,
                    "rr_ratio": float(s.rr_ratio) if s.rr_ratio else 0,
                    "confidence": float(s.confidence) if s.confidence else 0,
                    "status": s.status,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                }
                for s in signals_list
            ]
    except Exception:  # DB unavailable
        return []


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------
@app.get("/api/v1/risk")
async def risk():
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Fill).order_by(Fill.filled_at.desc()))
            fills = result.scalars().all()
            open_count = len({f.symbol for f in fills})

            sector_result = await session.execute(
                select(Instrument.asset_class, func.count(Instrument.id)).group_by(Instrument.asset_class)
            )
            sector_exposure = {row[0] or "equity": row[1] for row in sector_result.all()} or {"Technology": 34, "Healthcare": 12}
    except Exception:  # DB unavailable
        open_count = 0
        sector_exposure = {"Technology": 34, "Healthcare": 12}

    return {
        "daily_loss_percent": 0.0,
        "daily_loss_limit": float(os.getenv("MAX_DAILY_LOSS", "0.02")),
        "open_positions": open_count,
        "max_positions": int(os.getenv("MAX_POSITIONS", "8")),
        "sector_exposure": sector_exposure,
        "kill_switch": _KILL_SWITCH_STATE,
    }


# ---------------------------------------------------------------------------
# Kill switch toggle
# ---------------------------------------------------------------------------
_KILL_SWITCH_STATE = False

@app.post("/api/v1/risk/kill-switch")
async def kill_switch(payload: dict):
    global _KILL_SWITCH_STATE
    enabled = bool(payload.get("kill_switch", False))
    _KILL_SWITCH_STATE = enabled
    try:
        await manager.broadcast({
            "agent_name": "ops",
            "event_type": "kill_switch",
            "payload": {"kill_switch": enabled},
            "created_at": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass
    return {"kill_switch": _KILL_SWITCH_STATE}


# ---------------------------------------------------------------------------
# Market data (latest bar per symbol)
# ---------------------------------------------------------------------------
@app.get("/api/v1/market-data/{symbol}")
async def market_data_latest(symbol: str):
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(MarketData)
                .where(MarketData.symbol == symbol)
                .order_by(desc(MarketData.time))
                .limit(1)
            )
            md = result.scalar_one_or_none()
            if not md:
                raise HTTPException(status_code=404, detail=f"No market data for {symbol}")
            return {
                "symbol": md.symbol,
                "time": md.time.isoformat(),
                "open": float(md.open) if md.open else 0,
                "high": float(md.high) if md.high else 0,
                "low": float(md.low) if md.low else 0,
                "close": float(md.close) if md.close else 0,
                "volume": md.volume or 0,
            }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail=f"No market data for {symbol}")


# ---------------------------------------------------------------------------
# Historical market data (for charts, 1+ month)
# ---------------------------------------------------------------------------
@app.get("/api/v1/market-data/{symbol}/history")
async def market_data_history(
    symbol: str,
    days: int = Query(60, ge=1, le=365),
):
    try:
        async with AsyncSessionLocal() as session:
            cutoff = datetime.utcnow() - timedelta(days=days)
            result = await session.execute(
                select(MarketData)
                .where(MarketData.symbol == symbol)
                .where(MarketData.time >= cutoff)
                .order_by(MarketData.time)
            )
            rows = result.scalars().all()
            return {
                "symbol": symbol,
                "bars": [
                    {
                        "time": r.time.isoformat(),
                        "open": float(r.open) if r.open else 0,
                        "high": float(r.high) if r.high else 0,
                        "low": float(r.low) if r.low else 0,
                        "close": float(r.close) if r.close else 0,
                        "volume": r.volume or 0,
                    }
                    for r in rows
                ],
            }
    except Exception:  # DB unavailable
        return {"symbol": symbol, "bars": []}


# ---------------------------------------------------------------------------
# Bulk market data ingestion (used by scheduled GitHub Actions pipeline)
# ---------------------------------------------------------------------------
@app.post("/api/v1/market-data/bulk")
async def market_data_bulk(payload: dict):
    """Receive a batch of market data bars from the scheduled data feed.
    Stores them so the dashboard can serve live/historical data on demand.
    """
    try:
        async with AsyncSessionLocal() as session:
            bars = payload.get("bars", [])
            count = 0
            for row in bars:
                symbol = row.get("symbol")
                time_str = row.get("time")
                if not symbol or not time_str:
                    continue
                result = await session.execute(
                    select(Instrument).where(Instrument.symbol == symbol)
                )
                inst = result.scalar_one_or_none()
                if not inst:
                    inst = Instrument(symbol=symbol, asset_class="equity")
                    session.add(inst)
                    await session.commit()
                    await session.refresh(inst)
                ts = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                # MarketData.time is TIMESTAMP WITHOUT TIME ZONE — strip tz
                if ts.tzinfo is not None:
                    ts = ts.replace(tzinfo=None)
                session.add(MarketData(
                    time=ts,
                    symbol=symbol,
                    open=float(row.get("open", 0) or 0),
                    high=float(row.get("high", 0) or 0),
                    low=float(row.get("low", 0) or 0),
                    close=float(row.get("close", 0) or 0),
                    volume=int(row.get("volume", 0) or 0),
                ))
                count += 1
            await session.commit()
            return {"status": "ok", "bars_written": count}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ---------------------------------------------------------------------------
# Run pipeline on demand
# ---------------------------------------------------------------------------
@app.post("/api/v1/pipeline/run")
async def pipeline_run():
    """Trigger the agent pipeline against latest persisted market data."""
    import subprocess, sys
    from pathlib import Path
    script = Path(__file__).resolve().parents[1] / "scripts" / "run_pipeline.py"
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(script),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        return {
            "status": "ok" if proc.returncode == 0 else "error",
            "output": stdout.decode()[-2000:] if stdout else "",
            "error": stderr.decode()[-2000:] if stderr else "",
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# User saved charts — save a snapshot with 1+ month historical data
# ---------------------------------------------------------------------------
@app.post("/api/v1/user/charts")
async def save_chart(payload: dict):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    try:
        async with AsyncSessionLocal() as session:
            chart = SavedChart(
                user_id=uuid.UUID(user_id),
                name=payload.get("name", "Untitled Chart"),
                symbols=payload.get("symbols", []),
                regime=payload.get("regime"),
                market_data=payload.get("market_data"),
                signals=payload.get("signals"),
                positions=payload.get("positions"),
                risk=payload.get("risk"),
            )
            session.add(chart)
            await session.commit()
            await session.refresh(chart)
            return {"id": str(chart.id), "message": "Chart saved"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database not configured")


@app.get("/api/v1/user/charts")
async def list_charts(user_id: str = Query(...)):
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(SavedChart)
                .where(SavedChart.user_id == uuid.UUID(user_id))
                .order_by(desc(SavedChart.updated_at))
            )
            charts = result.scalars().all()
            return [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "symbols": c.symbols,
                    "regime": c.regime,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                }
                for c in charts
            ]
    except Exception:
        return []


@app.get("/api/v1/user/charts/{chart_id}")
async def get_chart(chart_id: str):
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(SavedChart).where(SavedChart.id == uuid.UUID(chart_id))
            )
            chart = result.scalar_one_or_none()
            if not chart:
                raise HTTPException(status_code=404, detail="Chart not found")
            return {
                "id": str(chart.id),
                "name": chart.name,
                "symbols": chart.symbols,
                "regime": chart.regime,
                "market_data": chart.market_data,
                "signals": chart.signals,
                "positions": chart.positions,
                "risk": chart.risk,
                "created_at": chart.created_at.isoformat() if chart.created_at else None,
                "updated_at": chart.updated_at.isoformat() if chart.updated_at else None,
            }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Chart not found")


# ---------------------------------------------------------------------------
# User saved layouts
# ---------------------------------------------------------------------------
@app.post("/api/v1/user/layouts")
async def save_layout(payload: dict):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    try:
        async with AsyncSessionLocal() as session:
            layout = SavedLayout(
                user_id=uuid.UUID(user_id),
                name=payload.get("name", "Untitled Layout"),
                layout_config=payload.get("layout_config", {}),
            )
            session.add(layout)
            await session.commit()
            await session.refresh(layout)
            return {"id": str(layout.id), "message": "Layout saved"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database not configured")


@app.get("/api/v1/user/layouts")
async def list_layouts(user_id: str = Query(...)):
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(SavedLayout)
                .where(SavedLayout.user_id == uuid.UUID(user_id))
                .order_by(desc(SavedLayout.updated_at))
            )
            layouts = result.scalars().all()
            return [
                {
                    "id": str(l.id),
                    "name": l.name,
                    "layout_config": l.layout_config,
                    "created_at": l.created_at.isoformat() if l.created_at else None,
                    "updated_at": l.updated_at.isoformat() if l.updated_at else None,
                }
                for l in layouts
            ]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# WebSocket for live agent log
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keepalive
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("API_PORT", "8000")))
