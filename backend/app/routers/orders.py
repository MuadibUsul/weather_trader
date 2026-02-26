"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..services.engine_service import engine_service

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("")
async def orders(_: User = Depends(get_current_user)):
    status = await engine_service.status()
    return {
        "open_orders": status.get("open_orders", 0),
        "positions": status.get("positions", []),
    }


@router.get("/trades")
async def trades(_: User = Depends(get_current_user)):
    fills = await engine_service.orchestrator.execution.fills()
    return [
        {
            "order_id": f.order_id,
            "market_id": f.market_id,
            "bucket_id": f.bucket_id,
            "side": f.side.value,
            "price": f.price,
            "size": f.size,
            "ts": f.ts.isoformat(),
        }
        for f in fills
    ]