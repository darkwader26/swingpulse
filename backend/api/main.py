"""FastAPI application entrypoint."""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio, json, os, httpx

from database import engine, Base


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev only; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="SwingPulse API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"


@app.post("/api/v1/auth/google/callback")
async def google_auth_callback(payload: dict):
    """Exchange an OAuth2 authorization code for tokens and user profile."""
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    client_id = os.getenv("GOOGLE_CLIENT_ID")

    async with httpx.AsyncClient() as client:
        # Exchange the authorization code for an access token
        token_res = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
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

        # Fetch the user's profile from Google
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

    return {
        "access_token": access_token,
        "user": {
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "picture": user_info.get("picture"),
        },
    }


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "swingpulse-api", "mode": os.getenv("EXECUTION_MODE", "paper")}


@app.get("/api/v1/agents/status")
async def agents_status():
    return {
        "scanner": {"status": "active", "last_run": None, "errors": 0},
        "signal_generator": {"status": "active", "last_run": None, "errors": 0},
        "risk_manager": {"status": "active", "last_run": None, "errors": 0},
        "executor": {"status": "standby", "mode": os.getenv("EXECUTION_MODE", "paper"), "errors": 0},
        "ops": {"status": "active", "last_run": None, "errors": 0},
    }


@app.get("/api/v1/positions")
async def positions():
    # Placeholder - real implementation queries fills + market data
    return []


@app.get("/api/v1/signals")
async def signals():
    return []


@app.get("/api/v1/risk")
async def risk():
    return {
        "daily_loss_percent": 0.0,
        "daily_loss_limit": float(os.getenv("MAX_DAILY_LOSS", "0.02")),
        "open_positions": 0,
        "max_positions": int(os.getenv("MAX_POSITIONS", "8")),
        "sector_exposure": {},
        "kill_switch": False,
    }


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
