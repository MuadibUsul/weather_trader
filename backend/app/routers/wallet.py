"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_db
from ..models import User, WalletBinding
from ..schemas import WalletBindRequest

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


@router.post("/bind")
async def bind_wallet(payload: WalletBindRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    existing = (await session.execute(select(WalletBinding).where(WalletBinding.user_id == user.id, WalletBinding.is_active == True))).scalars().all()
    for row in existing:
        row.is_active = False

    record = WalletBinding(user_id=user.id, wallet_address=payload.wallet_address, chain_id=payload.chain_id, is_active=True)
    session.add(record)
    await session.commit()
    return {"status": "ok", "wallet_address": payload.wallet_address, "chain_id": payload.chain_id}


@router.get("")
async def get_wallet(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    record = (
        await session.execute(select(WalletBinding).where(WalletBinding.user_id == user.id, WalletBinding.is_active == True))
    ).scalar_one_or_none()
    if not record:
        return {"wallet_address": None, "chain_id": 137}
    return {"wallet_address": record.wallet_address, "chain_id": record.chain_id}