"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..services.engine_service import engine_service

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/pnl")
async def pnl(_: User = Depends(get_current_user)):
    status = await engine_service.status()
    return status.get("metrics", {})


@router.get("/risk")
async def risk(_: User = Depends(get_current_user)):
    status = await engine_service.status()
    return status.get("risk", {})