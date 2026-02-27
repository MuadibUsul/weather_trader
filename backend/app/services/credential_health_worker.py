"""
Background worker to refresh credential connectivity states.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal
from ..models import ApiKey, RuntimeLock
from .engine_service import engine_service

logger = logging.getLogger(__name__)


class CredentialHealthWorker:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._owner_id = f"worker-{uuid.uuid4().hex[:10]}"
        self._tick_seconds = 5
        self._lease_seconds = 20
        self._min_check_seconds = 10
        self._max_batch = 20
        self._concurrency = 3

    @staticmethod
    def _as_aware_utc(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name="credential_health_worker")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            await self._task

    async def _run(self) -> None:
        while not self._stop.is_set():
            try:
                await self._tick()
            except Exception:
                logger.exception("credential health worker tick failed")
            await asyncio.sleep(self._tick_seconds)

    async def _try_acquire_lease(self, session: AsyncSession) -> bool:
        now = datetime.now(UTC)
        lease_until = now + timedelta(seconds=self._lease_seconds)
        row = (await session.execute(select(RuntimeLock).where(RuntimeLock.name == "credential_health_worker"))).scalar_one_or_none()
        if row is None:
            session.add(RuntimeLock(name="credential_health_worker", owner_id=self._owner_id, lease_until=lease_until))
            await session.commit()
            return True
        row_lease_until = self._as_aware_utc(row.lease_until)
        if row.owner_id == self._owner_id or (row_lease_until is not None and row_lease_until <= now):
            row.owner_id = self._owner_id
            row.lease_until = lease_until
            await session.commit()
            return True
        return False

    async def _tick(self) -> None:
        async with SessionLocal() as session:
            if not await self._try_acquire_lease(session):
                return

            now = datetime.now(UTC)
            rows = (
                await session.execute(
                    select(ApiKey)
                    .where(
                        ApiKey.provider == "polymarket",
                        ApiKey.enabled == True,
                    )
                    .order_by(ApiKey.next_check_at.asc().nullsfirst(), ApiKey.updated_at.desc())
                    .limit(self._max_batch)
                )
            ).scalars().all()

            due_ids: list[tuple[str, str]] = []
            for row in rows:
                next_check_at = self._as_aware_utc(row.next_check_at)
                checked_at = self._as_aware_utc(row.checked_at)
                if next_check_at and next_check_at > now:
                    continue
                if checked_at and (now - checked_at).total_seconds() < self._min_check_seconds:
                    continue
                due_ids.append((row.user_id, row.id))

        if not due_ids:
            return

        semaphore = asyncio.Semaphore(self._concurrency)

        async def run_one(user_id: str, credential_id: str) -> None:
            async with semaphore:
                async with SessionLocal() as check_session:
                    row = (
                        await check_session.execute(
                            select(ApiKey).where(
                                ApiKey.id == credential_id,
                                ApiKey.user_id == user_id,
                                ApiKey.provider == "polymarket",
                            )
                        )
                    ).scalar_one_or_none()
                    if not row or not row.enabled:
                        return
                    await engine_service.test_polymarket_connection(user_id, check_session, credential_id=credential_id)

        await asyncio.gather(*(run_one(user_id, credential_id) for user_id, credential_id in due_ids), return_exceptions=True)


credential_health_worker = CredentialHealthWorker()
