"""
Credential management and status APIs.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_db
from ..models import ApiKey, User, WalletBinding
from ..schemas import CredentialCreateRequest, CredentialToggleRequest, CredentialUpdateRequest
from ..services.crypto import encrypt_value
from ..services.engine_service import engine_service

router = APIRouter(prefix="/api/credentials", tags=["credentials"])
logger = logging.getLogger(__name__)


def _fingerprint(api_key: str) -> str:
    digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    return digest[:12]


def _normalize_name(value: str | None) -> str:
    return (value or "").strip()


async def _get_credential_by_id(user_id: str, credential_id: str, session: AsyncSession) -> ApiKey:
    row = (
        await session.execute(
            select(ApiKey).where(
                ApiKey.id == credential_id,
                ApiKey.user_id == user_id,
                ApiKey.provider == "polymarket",
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="credential_not_found")
    return row


async def _assert_unique_name(user_id: str, name: str, session: AsyncSession, exclude_id: str | None = None) -> None:
    stmt = select(ApiKey).where(
        ApiKey.user_id == user_id,
        ApiKey.provider == "polymarket",
        func.lower(ApiKey.name) == name.lower(),
    )
    if exclude_id:
        stmt = stmt.where(ApiKey.id != exclude_id)
    exists = (await session.execute(stmt)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="credential_name_exists")


def _serialize_credential(row: ApiKey, bound_wallet_count: int) -> dict[str, object]:
    checked_at = row.checked_at.isoformat() if row.checked_at else None
    return {
        "id": row.id,
        "name": row.name,
        "provider": row.provider,
        "fingerprint": row.key_fingerprint,
        "enabled": bool(row.enabled),
        "state": row.state or "UNKNOWN",
        "reason_code": row.reason_code or "",
        "message": row.status_message or "",
        "checked_at": checked_at,
        "latency_ms": row.latency_ms,
        "consecutive_failures": row.consecutive_failures,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "bound_wallet_count": bound_wallet_count,
    }


@router.get("")
async def list_credentials(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    rows = (
        await session.execute(
            select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == "polymarket").order_by(ApiKey.updated_at.desc())
        )
    ).scalars().all()
    counts = (
        await session.execute(
            select(WalletBinding.credential_id, func.count(WalletBinding.id))
            .where(WalletBinding.user_id == user.id, WalletBinding.credential_id.is_not(None))
            .group_by(WalletBinding.credential_id)
        )
    ).all()
    count_map = {str(credential_id): int(total) for credential_id, total in counts if credential_id}
    return [_serialize_credential(row, count_map.get(row.id, 0)) for row in rows]


@router.post("")
async def create_credential(payload: CredentialCreateRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    name = _normalize_name(payload.name)
    if not name:
        raise HTTPException(status_code=400, detail="credential_name_required")
    await _assert_unique_name(user.id, name, session)

    row = ApiKey(
        user_id=user.id,
        provider="polymarket",
        name=name,
        key_fingerprint=_fingerprint(payload.api_key),
        enabled=payload.enabled,
        key_ciphertext=encrypt_value(payload.api_key),
        secret_ciphertext=encrypt_value(payload.api_secret),
        passphrase_ciphertext=encrypt_value(payload.api_passphrase),
        state="UNKNOWN" if payload.enabled else "DISABLED",
        reason_code="",
        status_message="",
        checked_at=None,
        latency_ms=None,
        consecutive_failures=0,
        next_check_at=datetime.now(UTC) if payload.enabled else None,
        updated_at=datetime.now(UTC),
    )
    session.add(row)
    await session.commit()

    logger.info(
        "credential_action",
        extra={"action": "create", "user_id": user.id, "credential_id": row.id, "fingerprint": row.key_fingerprint},
    )

    connectivity = None
    if payload.save_and_test and payload.enabled:
        connectivity = await engine_service.test_polymarket_connection(user.id, session, credential_id=row.id)
    return {
        "status": "ok",
        "credential": _serialize_credential(row, 0),
        "connectivity": connectivity,
    }


@router.put("/{credential_id}")
async def update_credential(
    credential_id: str,
    payload: CredentialUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    row = await _get_credential_by_id(user.id, credential_id, session)

    if payload.name is not None:
        name = _normalize_name(payload.name)
        if not name:
            raise HTTPException(status_code=400, detail="credential_name_required")
        await _assert_unique_name(user.id, name, session, exclude_id=row.id)
        row.name = name

    replace_fields = [payload.api_key is not None, payload.api_secret is not None, payload.api_passphrase is not None]
    if any(replace_fields) and not all(replace_fields):
        raise HTTPException(status_code=400, detail="credential_replace_requires_all")
    if all(replace_fields):
        row.key_ciphertext = encrypt_value(payload.api_key or "")
        row.secret_ciphertext = encrypt_value(payload.api_secret or "")
        row.passphrase_ciphertext = encrypt_value(payload.api_passphrase or "")
        row.key_fingerprint = _fingerprint(payload.api_key or "")
        row.state = "UNKNOWN" if row.enabled else "DISABLED"
        row.reason_code = ""
        row.status_message = ""
        row.checked_at = None
        row.latency_ms = None
        row.consecutive_failures = 0
        row.next_check_at = datetime.now(UTC) if row.enabled else None

    if payload.enabled is not None:
        row.enabled = bool(payload.enabled)
        if row.enabled:
            row.state = "UNKNOWN"
            row.reason_code = ""
            row.status_message = ""
            row.next_check_at = datetime.now(UTC)
        else:
            row.state = "DISABLED"
            row.reason_code = "PERMISSION"
            row.status_message = "credential_disabled"
            row.checked_at = datetime.now(UTC)
            row.next_check_at = None

    row.updated_at = datetime.now(UTC)
    await session.commit()
    await engine_service.sync_live_credentials_from_db(user.id, session)

    logger.info(
        "credential_action",
        extra={"action": "update", "user_id": user.id, "credential_id": row.id, "fingerprint": row.key_fingerprint},
    )

    connectivity = None
    if payload.save_and_test and row.enabled:
        connectivity = await engine_service.test_polymarket_connection(user.id, session, credential_id=row.id)
    return {"status": "ok", "credential": _serialize_credential(row, 0), "connectivity": connectivity}


@router.delete("/{credential_id}")
async def delete_credential(credential_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    row = await _get_credential_by_id(user.id, credential_id, session)
    fingerprint = row.key_fingerprint

    wallets = (
        await session.execute(
            select(WalletBinding).where(WalletBinding.user_id == user.id, WalletBinding.credential_id == row.id)
        )
    ).scalars().all()
    for wallet in wallets:
        wallet.credential_id = None

    await session.delete(row)
    await session.commit()
    await engine_service.sync_live_credentials_from_db(user.id, session)

    logger.info(
        "credential_action",
        extra={"action": "delete", "user_id": user.id, "credential_id": credential_id, "fingerprint": fingerprint},
    )
    return {"status": "ok", "credential_id": credential_id, "deleted": True}


@router.post("/{credential_id}/test")
async def test_credential(credential_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    row = await _get_credential_by_id(user.id, credential_id, session)
    result = await engine_service.test_polymarket_connection(user.id, session, credential_id=row.id)
    logger.info(
        "credential_action",
        extra={"action": "test", "user_id": user.id, "credential_id": row.id, "fingerprint": row.key_fingerprint},
    )
    return {"status": "ok", "credential_id": row.id, "connectivity": result}


@router.post("/{credential_id}/toggle")
async def toggle_credential(
    credential_id: str,
    payload: CredentialToggleRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    row = await _get_credential_by_id(user.id, credential_id, session)
    row.enabled = bool(payload.enabled)
    row.updated_at = datetime.now(UTC)
    if row.enabled:
        row.state = "UNKNOWN"
        row.reason_code = ""
        row.status_message = ""
        row.next_check_at = datetime.now(UTC)
    else:
        row.state = "DISABLED"
        row.reason_code = "PERMISSION"
        row.status_message = "credential_disabled"
        row.checked_at = datetime.now(UTC)
        row.next_check_at = None

    await session.commit()
    await engine_service.sync_live_credentials_from_db(user.id, session)
    logger.info(
        "credential_action",
        extra={
            "action": "toggle",
            "enabled": row.enabled,
            "user_id": user.id,
            "credential_id": row.id,
            "fingerprint": row.key_fingerprint,
        },
    )
    return {"status": "ok", "credential_id": row.id, "enabled": row.enabled}


@router.get("/status")
async def list_credential_status(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    rows = (
        await session.execute(
            select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == "polymarket").order_by(ApiKey.updated_at.desc())
        )
    ).scalars().all()
    return [
        {
            "credential_id": row.id,
            "state": row.state or "UNKNOWN",
            "reason_code": row.reason_code or "",
            "message": row.status_message or "",
            "checked_at": row.checked_at.isoformat() if row.checked_at else None,
            "latency_ms": row.latency_ms,
            "enabled": bool(row.enabled),
            "consecutive_failures": row.consecutive_failures,
        }
        for row in rows
    ]
