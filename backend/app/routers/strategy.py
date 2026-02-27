"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_db
from ..models import User
from ..schemas import StrategyConfigRequest, StrategyEnvironmentRequest, StrategyToggleRequest, StatusResponse
from ..services.audit import record_audit_event
from ..services.engine_service import engine_service
from ..services.security_service import verify_trade_pin

router = APIRouter(prefix="/api/strategy", tags=["strategy"])


@router.get("/status", response_model=StatusResponse)
async def status(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    return await engine_service.status_for_user(user.id, session)


@router.post("/config", response_model=StatusResponse)
async def configure(payload: StrategyConfigRequest, user: User = Depends(get_current_user)):
    try:
        effective_dry_run = (user.current_env or "PAPER").upper() != "REAL"
        return await engine_service.configure(order_size=payload.order_size, quote_delta=payload.quote_delta, dry_run=effective_dry_run)
    except RuntimeError as exc:
        if str(exc) == "live_trading_credentials_missing":
            raise HTTPException(status_code=400, detail="live_trading_credentials_missing") from exc
        raise


@router.post("/toggle", response_model=StatusResponse)
async def toggle(payload: StrategyToggleRequest, _: User = Depends(get_current_user)):
    try:
        if payload.enabled:
            return await engine_service.start_strategy()
        return await engine_service.stop_strategy()
    except RuntimeError as exc:
        if str(exc) == "live_trading_credentials_missing":
            raise HTTPException(status_code=400, detail="live_trading_credentials_missing") from exc
        raise


@router.post("/environment", response_model=StatusResponse)
async def switch_environment(
    payload: StrategyEnvironmentRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    pin_result = verify_trade_pin(user, payload.trade_pin)
    await session.commit()
    await record_audit_event(
        user_id=user.id,
        action="switch_environment_pin_verify",
        success=pin_result.ok,
        payload={
            "mode": payload.mode,
            "reason": pin_result.reason,
            "remaining_attempts": pin_result.remaining_attempts,
            "locked_until": pin_result.locked_until.isoformat() if pin_result.locked_until else None,
        },
    )
    if not pin_result.ok:
        raise HTTPException(status_code=400, detail=pin_result.reason)

    try:
        status = await engine_service.switch_environment(user_id=user.id, session=session, mode=payload.mode)
        user.current_env = "REAL" if payload.mode == "live" else "PAPER"
        await session.commit()
        await record_audit_event(
            user_id=user.id,
            action="switch_environment",
            success=True,
            payload={"mode": user.current_env},
        )
        return status
    except RuntimeError as exc:
        reason = str(exc)
        if reason in {"paper_wallet_missing", "wallet_missing", "wallet_credential_unbound", "private_key_missing", "credential_incomplete"}:
            raise HTTPException(status_code=400, detail=reason) from exc
        if reason == "unsupported_mode":
            raise HTTPException(status_code=400, detail="unsupported_mode") from exc
        raise
