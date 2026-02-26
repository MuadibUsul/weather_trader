"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_db
from ..models import ApiKey, User
from ..schemas import ApiKeyRequest
from ..services.crypto import decrypt_value, encrypt_value

router = APIRouter(prefix="/api/keys", tags=["keys"])


@router.post("")
async def upsert_api_key(payload: ApiKeyRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    existing = (
        await session.execute(select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == payload.provider))
    ).scalar_one_or_none()

    if existing:
        existing.key_ciphertext = encrypt_value(payload.api_key)
        existing.secret_ciphertext = encrypt_value(payload.api_secret)
        existing.passphrase_ciphertext = encrypt_value(payload.api_passphrase)
    else:
        existing = ApiKey(
            user_id=user.id,
            provider=payload.provider,
            key_ciphertext=encrypt_value(payload.api_key),
            secret_ciphertext=encrypt_value(payload.api_secret),
            passphrase_ciphertext=encrypt_value(payload.api_passphrase),
        )
        session.add(existing)
    await session.commit()
    return {"status": "ok", "provider": payload.provider}


@router.get("")
async def list_api_keys(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    rows = (await session.execute(select(ApiKey).where(ApiKey.user_id == user.id))).scalars().all()
    data = []
    for row in rows:
        key = decrypt_value(row.key_ciphertext)
        data.append({"provider": row.provider, "api_key_masked": f"{key[:4]}***{key[-4:]}" if len(key) >= 8 else "****"})
    return data