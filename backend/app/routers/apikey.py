"""
API key management routes.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_db
from ..models import ApiKey, User, WalletBinding
from ..schemas import ApiKeyRequest
from ..services.crypto import decrypt_value, encrypt_value
from ..services.engine_service import engine_service

router = APIRouter(prefix="/api/keys", tags=["keys"])
CREDENTIAL_PROVIDER = "polymarket"


def _fingerprint(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12]


@router.post("")
async def upsert_api_key(payload: ApiKeyRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    if payload.provider != CREDENTIAL_PROVIDER:
        raise HTTPException(status_code=400, detail="unsupported_provider")

    existing = (
        await session.execute(
            select(ApiKey).where(
                ApiKey.user_id == user.id,
                ApiKey.provider == CREDENTIAL_PROVIDER,
                func.lower(ApiKey.name) == "default",
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.name = existing.name or "default"
        existing.enabled = True
        existing.key_fingerprint = _fingerprint(payload.api_key)
        existing.key_ciphertext = encrypt_value(payload.api_key)
        existing.secret_ciphertext = encrypt_value(payload.api_secret)
        existing.passphrase_ciphertext = encrypt_value(payload.api_passphrase)
        existing.updated_at = datetime.now(UTC)
    else:
        existing = ApiKey(
            user_id=user.id,
            provider=CREDENTIAL_PROVIDER,
            name="default",
            enabled=True,
            key_fingerprint=_fingerprint(payload.api_key),
            key_ciphertext=encrypt_value(payload.api_key),
            secret_ciphertext=encrypt_value(payload.api_secret),
            passphrase_ciphertext=encrypt_value(payload.api_passphrase),
            state="UNKNOWN",
        )
        session.add(existing)
    wallet = (
        await session.execute(
            select(WalletBinding).where(
                WalletBinding.user_id == user.id,
                WalletBinding.is_active == True,
            )
        )
    ).scalar_one_or_none()
    if wallet and not wallet.credential_id:
        wallet.credential_id = existing.id

    await session.commit()

    await engine_service.sync_live_credentials_from_db(user.id, session)
    test_result = await engine_service.test_polymarket_connection(user.id, session, credential_id=existing.id)
    return {"status": "ok", "provider": CREDENTIAL_PROVIDER, "connectivity": test_result}


@router.get("")
async def list_api_keys(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    rows = (
        await session.execute(
            select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == CREDENTIAL_PROVIDER)
        )
    ).scalars().all()
    active_wallet = (
        await session.execute(
            select(WalletBinding).where(
                WalletBinding.user_id == user.id,
                WalletBinding.is_active == True,
            )
        )
    ).scalar_one_or_none()
    active_credential_id = str(active_wallet.credential_id) if active_wallet and active_wallet.credential_id else ""
    rows = sorted(
        rows,
        key=lambda row: (
            0 if active_credential_id and str(row.id) == active_credential_id else 1,
            0 if (row.name or "").strip().lower() == "default" else 1,
            0 if row.provider == "polymarket" else 1,
            -(row.updated_at.timestamp() if row.updated_at else 0),
        ),
    )
    data = []
    for row in rows:
        key = decrypt_value(row.key_ciphertext)
        data.append(
            {
                "provider": row.provider,
                "api_key_masked": f"{key[:4]}***{key[-4:]}" if len(key) >= 8 else "****",
                "id": row.id,
                "name": row.name,
                "enabled": row.enabled,
                "test_status": row.test_status,
                "test_message": row.test_message,
                "last_tested_at": row.last_tested_at.isoformat() if row.last_tested_at else None,
                "is_active_wallet_credential": bool(active_credential_id and str(row.id) == active_credential_id),
            }
        )
    return data


@router.post("/test")
async def test_api_key_connectivity(
    provider: str = CREDENTIAL_PROVIDER,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if provider != CREDENTIAL_PROVIDER:
        raise HTTPException(status_code=400, detail="unsupported_provider")
    result = await engine_service.test_polymarket_connection(user.id, session)
    return {"status": "ok", "provider": provider, "connectivity": result}


@router.delete("")
async def delete_api_key(
    provider: str = CREDENTIAL_PROVIDER,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if provider != CREDENTIAL_PROVIDER:
        raise HTTPException(status_code=400, detail="unsupported_provider")
    rows = (
        await session.execute(select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == provider))
    ).scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="api_key_not_found")
    for row in rows:
        await session.delete(row)
    await session.commit()
    await engine_service.sync_live_credentials_from_db(user.id, session)
    return {"status": "ok", "provider": provider, "deleted": True}
