"""
FastAPI 应用入口。

职责：
1. 初始化数据库与默认管理员账号。
2. 注册 REST 路由与 WebSocket 端点。
3. 管理后台生命周期（引擎初始化、流推送启动与关闭）。
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from trading_engine.logging_utils import configure_logging

from .auth import get_current_user, hash_password
from .config import get_settings
from .db import Base, engine
from .models import User
from .routers import apikey, auth, health, logs, metrics, orders, strategy, wallet
from .services.engine_service import engine_service
from .services.streams import hub

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """服务生命周期：启动初始化 + 停机释放。"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # bootstrap default admin for local usage
    async with engine.begin() as conn:
        pass

    from sqlalchemy.ext.asyncio import AsyncSession
    from .db import SessionLocal

    async with SessionLocal() as session:
        user = (await session.execute(select(User).where(User.username == "admin"))).scalar_one_or_none()
        if not user:
            session.add(User(username="admin", hashed_password=hash_password("admin123")))
            await session.commit()

    await engine_service.initialize()
    await hub.start()
    yield
    await hub.stop()
    await engine_service.shutdown()


app = FastAPI(title="Weather Trader API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(wallet.router)
app.include_router(apikey.router)
app.include_router(strategy.router)
app.include_router(metrics.router)
app.include_router(orders.router)
app.include_router(logs.router)


@app.get("/")
async def root():
    """根路由：用于快速确认服务在线与可用入口。"""
    return {
        "service": "weather-trader-backend",
        "status": "ok",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "openapi": "/openapi.json",
        },
    }


@app.websocket("/ws/metrics")
async def ws_metrics(ws: WebSocket):
    """指标流 WebSocket。"""
    await hub.connect_metrics(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(ws)


@app.websocket("/ws/logs")
async def ws_logs(ws: WebSocket):
    """日志流 WebSocket。"""
    await hub.connect_logs(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(ws)
