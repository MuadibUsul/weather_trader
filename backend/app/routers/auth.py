"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import authenticate_user, create_access_token, get_current_user, hash_password
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(payload: LoginRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = (await session.execute(select(User).where(User.username == payload.username))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="username exists")

    user = User(username=payload.username, hashed_password=hash_password(payload.password))
    session.add(user)
    await session.commit()
    return TokenResponse(access_token=create_access_token(user.username))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await authenticate_user(session, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="invalid credentials")
    return TokenResponse(access_token=create_access_token(user.username))


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "email_verified": bool(user.email_verified),
        "trade_pin_set": bool(user.trade_pin_hash and user.trade_pin_salt),
        "current_env": user.current_env or "PAPER",
    }
