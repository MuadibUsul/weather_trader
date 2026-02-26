"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..schemas import StrategyConfigRequest, StrategyToggleRequest, StatusResponse
from ..services.engine_service import engine_service

router = APIRouter(prefix="/api/strategy", tags=["strategy"])


@router.get("/status", response_model=StatusResponse)
async def status(_: User = Depends(get_current_user)):
    return await engine_service.status()


@router.post("/config", response_model=StatusResponse)
async def configure(payload: StrategyConfigRequest, _: User = Depends(get_current_user)):
    return await engine_service.configure(order_size=payload.order_size, quote_delta=payload.quote_delta, dry_run=payload.dry_run)


@router.post("/toggle", response_model=StatusResponse)
async def toggle(payload: StrategyToggleRequest, _: User = Depends(get_current_user)):
    if payload.enabled:
        return await engine_service.start_strategy()
    return await engine_service.stop_strategy()