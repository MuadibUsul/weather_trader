"""Audit logging helpers."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from ..db import SessionLocal
from ..models import AppLog


async def record_audit_event(
    *,
    user_id: str,
    action: str,
    success: bool = True,
    payload: dict[str, Any] | None = None,
) -> None:
    safe_payload = dict(payload or {})
    safe_payload.setdefault("user_id", user_id)
    safe_payload.setdefault("success", success)
    safe_payload.setdefault("ts", datetime.now(UTC).isoformat())

    async with SessionLocal() as session:
        session.add(
            AppLog(
                level="INFO" if success else "WARN",
                service="audit",
                correlation_id=user_id,
                message=action,
                payload=safe_payload,
            )
        )
        await session.commit()
