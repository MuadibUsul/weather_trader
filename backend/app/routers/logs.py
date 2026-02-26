"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..services.engine_service import engine_service

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("")
async def get_logs(_: User = Depends(get_current_user)):
    status = await engine_service.status()
    return [
        {
            "ts": datetime.now(UTC).isoformat(),
            "level": "INFO",
            "message": "strategy_status",
            "payload": status,
        }
    ]