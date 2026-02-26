"""后端 API 路由功能测试（使用依赖覆盖与 mock 服务）。"""

from __future__ import annotations

from typing import Any, Dict

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.auth import get_current_user
from backend.app.main import app
from backend.app.models import User
from backend.app.routers import strategy as strategy_router


@pytest.fixture
def strategy_status_payload() -> Dict[str, Any]:
    return {
        "running": False,
        "started_at": None,
        "market_count": 2,
        "open_orders": 0,
        "positions": [],
        "metrics": {
            "realized_pnl": 0.0,
            "unrealized_pnl": 0.0,
            "gross_exposure": 0.0,
            "net_exposure": 0.0,
            "win_rate": 0.0,
            "fill_count": 0,
            "rejection_count": 0,
        },
        "risk": {
            "total_exposure": 0.0,
            "max_drawdown": 0.0,
            "halted": False,
            "halt_reason": "",
        },
        "fill_count": 0,
        "config": {
            "order_size": 25.0,
            "quote_delta": 0.01,
            "dry_run": True,
        },
    }


@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.fixture(autouse=True)
def clear_overrides() -> None:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    resp = await client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["services"]["backend"] == "ok"


@pytest.mark.asyncio
async def test_strategy_status_endpoint(client: AsyncClient, monkeypatch: pytest.MonkeyPatch, strategy_status_payload: Dict[str, Any]) -> None:
    async def fake_user() -> User:
        return User(username="tester", hashed_password="hashed")

    async def fake_status() -> Dict[str, Any]:
        return strategy_status_payload

    app.dependency_overrides[get_current_user] = fake_user
    monkeypatch.setattr(strategy_router.engine_service, "status", fake_status)

    resp = await client.get("/api/strategy/status")

    assert resp.status_code == 200
    assert resp.json()["market_count"] == 2


@pytest.mark.asyncio
async def test_strategy_toggle_start_stop(client: AsyncClient, monkeypatch: pytest.MonkeyPatch, strategy_status_payload: Dict[str, Any]) -> None:
    calls: list[str] = []

    async def fake_user() -> User:
        return User(username="tester", hashed_password="hashed")

    async def fake_start() -> Dict[str, Any]:
        calls.append("start")
        payload = dict(strategy_status_payload)
        payload["running"] = True
        return payload

    async def fake_stop() -> Dict[str, Any]:
        calls.append("stop")
        payload = dict(strategy_status_payload)
        payload["running"] = False
        return payload

    app.dependency_overrides[get_current_user] = fake_user
    monkeypatch.setattr(strategy_router.engine_service, "start_strategy", fake_start)
    monkeypatch.setattr(strategy_router.engine_service, "stop_strategy", fake_stop)

    start_resp = await client.post("/api/strategy/toggle", json={"enabled": True})
    stop_resp = await client.post("/api/strategy/toggle", json={"enabled": False})

    assert start_resp.status_code == 200
    assert stop_resp.status_code == 200
    assert start_resp.json()["running"] is True
    assert stop_resp.json()["running"] is False
    assert calls == ["start", "stop"]
