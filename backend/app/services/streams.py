"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any, Dict, List, Set

from fastapi import WebSocket

from .engine_service import engine_service


class ConnectionHub:
    def __init__(self) -> None:
        self._metrics_clients: Set[WebSocket] = set()
        self._log_clients: Set[WebSocket] = set()
        self._task: asyncio.Task | None = None

    async def connect_metrics(self, ws: WebSocket) -> None:
        await ws.accept()
        self._metrics_clients.add(ws)

    async def connect_logs(self, ws: WebSocket) -> None:
        await ws.accept()
        self._log_clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._metrics_clients.discard(ws)
        self._log_clients.discard(ws)

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._publisher_loop(), name="ws_publisher")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task

    async def _publisher_loop(self) -> None:
        while True:
            status = await engine_service.status()
            metrics_payload = {
                "type": "metrics",
                "ts": datetime.now(UTC).isoformat(),
                "metrics": status.get("metrics", {}),
                "risk": status.get("risk", {}),
                "positions": status.get("positions", []),
                "running": status.get("running", False),
            }
            await self._broadcast(self._metrics_clients, metrics_payload)

            log_payload = {
                "type": "log",
                "ts": datetime.now(UTC).isoformat(),
                "level": "INFO",
                "message": "heartbeat",
                "payload": {"running": status.get("running", False), "open_orders": status.get("open_orders", 0)},
            }
            await self._broadcast(self._log_clients, log_payload)
            await asyncio.sleep(2)

    async def _broadcast(self, clients: Set[WebSocket], payload: Dict[str, Any]) -> None:
        stale: List[WebSocket] = []
        for ws in list(clients):
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


import contextlib

hub = ConnectionHub()