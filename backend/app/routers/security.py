"""Security routes for trade PIN and email verification."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, hash_password, verify_password
from ..db import get_db
from ..models import User
from ..schemas import (
    EmailBindRequest,
    EmailCodeVerifyRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    TradePinResetRequest,
    TradePinSetRequest,
    TradePinVerifyRequest,
)
from ..services.audit import record_audit_event
from ..services.security_service import (
    create_email_code,
    send_email_code,
    set_trade_pin,
    verify_email_code,
    verify_trade_pin,
)

router = APIRouter(prefix="/api/security", tags=["security"])


@router.get("/profile")
async def security_profile(user: User = Depends(get_current_user)):
    return {
        "email": user.email,
        "email_verified": bool(user.email_verified),
        "trade_pin_set": bool(user.trade_pin_hash and user.trade_pin_salt),
        "trade_pin_locked_until": user.trade_pin_locked_until.isoformat() if user.trade_pin_locked_until else None,
        "current_env": user.current_env or "PAPER",
    }


@router.post("/trade-pin/set")
async def set_trade_pin_api(
    payload: TradePinSetRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, user.hashed_password):
        await record_audit_event(
            user_id=user.id,
            action="trade_pin_set",
            success=False,
            payload={"reason": "current_password_invalid"},
        )
        raise HTTPException(status_code=400, detail="current_password_invalid")

    try:
        set_trade_pin(user, payload.trade_pin)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await session.commit()
    await record_audit_event(user_id=user.id, action="trade_pin_set", success=True)
    return {"status": "ok", "trade_pin_set": True, "updated_at": user.trade_pin_updated_at.isoformat() if user.trade_pin_updated_at else None}


@router.post("/trade-pin/verify")
async def verify_trade_pin_api(
    payload: TradePinVerifyRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    result = verify_trade_pin(user, payload.trade_pin)
    await session.commit()
    await record_audit_event(
        user_id=user.id,
        action="trade_pin_verify",
        success=result.ok,
        payload={
            "reason": result.reason,
            "remaining_attempts": result.remaining_attempts,
            "locked_until": result.locked_until.isoformat() if result.locked_until else None,
        },
    )
    return {
        "ok": result.ok,
        "reason": result.reason,
        "remaining_attempts": result.remaining_attempts,
        "locked_until": result.locked_until.isoformat() if result.locked_until else None,
    }


@router.post("/email/bind/request")
async def request_bind_email(
    payload: EmailBindRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="email_invalid")
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="current_password_invalid")

    user.email = email
    user.email_verified = False
    code, expires_at = create_email_code(email, "bind")
    send_result = send_email_code(to_email=email, purpose="bind", code=code, expires_at=expires_at)
    await session.commit()

    await record_audit_event(
        user_id=user.id,
        action="bind_email_request",
        success=True,
        payload={"email": email, "delivery": send_result.get("channel", "stub")},
    )

    response = {
        "status": "ok",
        "email": email,
        "expires_at": expires_at.isoformat(),
        "delivery": send_result,
    }
    if not send_result.get("sent"):
        response["debug_code"] = code
    return response


@router.post("/email/bind/verify")
async def verify_bind_email(
    payload: EmailCodeVerifyRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    email = payload.email.strip().lower()
    if email != (user.email or "").strip().lower():
        raise HTTPException(status_code=400, detail="email_mismatch")
    if not verify_email_code(email, "bind", payload.code):
        raise HTTPException(status_code=400, detail="email_code_invalid")

    user.email_verified = True
    await session.commit()
    await record_audit_event(user_id=user.id, action="bind_email_verify", success=True, payload={"email": email})
    return {"status": "ok", "email": email, "email_verified": True}


@router.post("/trade-pin/reset/request")
async def request_trade_pin_reset(
    payload: PasswordResetRequest,
    user: User = Depends(get_current_user),
):
    email = payload.email.strip().lower()
    if not user.email_verified or email != (user.email or "").strip().lower():
        raise HTTPException(status_code=400, detail="email_not_verified")

    code, expires_at = create_email_code(email, "trade_pin_reset")
    send_result = send_email_code(to_email=email, purpose="trade_pin_reset", code=code, expires_at=expires_at)

    await record_audit_event(
        user_id=user.id,
        action="trade_pin_reset_request",
        success=True,
        payload={"email": email, "delivery": send_result.get("channel", "stub")},
    )

    response = {
        "status": "ok",
        "expires_at": expires_at.isoformat(),
        "delivery": send_result,
    }
    if not send_result.get("sent"):
        response["debug_code"] = code
    return response


@router.post("/trade-pin/reset/confirm")
async def reset_trade_pin(
    payload: TradePinResetRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    email = payload.email.strip().lower()
    if not user.email_verified or email != (user.email or "").strip().lower():
        raise HTTPException(status_code=400, detail="email_not_verified")
    if not verify_email_code(email, "trade_pin_reset", payload.code):
        raise HTTPException(status_code=400, detail="email_code_invalid")

    try:
        set_trade_pin(user, payload.new_trade_pin)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await session.commit()
    await record_audit_event(user_id=user.id, action="trade_pin_reset_confirm", success=True, payload={"email": email})
    return {"status": "ok", "trade_pin_set": True}


@router.post("/password/reset/request")
async def request_password_reset(payload: PasswordResetRequest, session: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()
    row = (
        await session.execute(
            select(User).where(User.email == email, User.email_verified == True)
        )
    ).scalar_one_or_none()
    if not row:
        return {"status": "ok"}

    code, expires_at = create_email_code(email, "password_reset")
    send_result = send_email_code(to_email=email, purpose="password_reset", code=code, expires_at=expires_at)

    await record_audit_event(
        user_id=row.id,
        action="password_reset_request",
        success=True,
        payload={"email": email, "delivery": send_result.get("channel", "stub")},
    )

    response = {
        "status": "ok",
        "expires_at": expires_at.isoformat(),
        "delivery": send_result,
    }
    if not send_result.get("sent"):
        response["debug_code"] = code
    return response


@router.post("/password/reset/confirm")
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    session: AsyncSession = Depends(get_db),
):
    email = payload.email.strip().lower()
    row = (
        await session.execute(
            select(User).where(User.email == email, User.email_verified == True)
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=400, detail="email_not_verified")
    if not verify_email_code(email, "password_reset", payload.code):
        raise HTTPException(status_code=400, detail="email_code_invalid")

    row.hashed_password = hash_password(payload.new_password)
    await session.commit()
    await record_audit_event(user_id=row.id, action="password_reset_confirm", success=True, payload={"email": email})
    return {"status": "ok", "updated_at": datetime.now(UTC).isoformat()}
