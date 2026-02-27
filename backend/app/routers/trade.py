"""
Manual trade execution routes.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_db
from ..models import PaperOrder, User
from ..schemas import TradePlaceRequest
from ..services.audit import record_audit_event
from ..services.engine_service import engine_service
from ..services.security_service import verify_trade_pin

router = APIRouter(prefix="/api/trade", tags=["trade"])
logger = logging.getLogger(__name__)


@router.post("/place")
async def place_trade(payload: TradePlaceRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    current_env = (user.current_env or "PAPER").upper()
    if current_env == "REAL":
        if not (payload.trade_pin or "").strip():
            raise HTTPException(status_code=400, detail="trade_pin_required")
        pin_result = verify_trade_pin(user, payload.trade_pin or "")
        await session.commit()
        await record_audit_event(
            user_id=user.id,
            action="place_order_pin_verify",
            success=pin_result.ok,
            payload={
                "reason": pin_result.reason,
                "remaining_attempts": pin_result.remaining_attempts,
                "locked_until": pin_result.locked_until.isoformat() if pin_result.locked_until else None,
            },
        )
        if not pin_result.ok:
            raise HTTPException(status_code=400, detail=pin_result.reason)

    result = await engine_service.place_manual_order(
        user_id=user.id,
        session=session,
        environment=current_env,
        market_id=payload.market_id,
        bucket_id=payload.bucket_id,
        side=payload.side,
        size=payload.size,
        price=payload.price,
        max_slippage=payload.max_slippage,
        note=payload.note,
    )
    if not result.get("ok"):
        await record_audit_event(
            user_id=user.id,
            action="place_order",
            success=False,
            payload={
                "environment": current_env,
                "error": str(result.get("error", "place_order_failed")),
                "market_id": payload.market_id,
                "bucket_id": payload.bucket_id,
            },
        )
        raise HTTPException(status_code=400, detail=str(result.get("error", "place_order_failed")))

    logger.info(
        "trade_action",
        extra={
            "action": "place_order",
            "user_id": user.id,
            "order_id": result.get("order_id"),
            "wallet_address": result.get("wallet_address"),
            "credential_id": result.get("credential_id"),
            "market_id": payload.market_id,
            "bucket_id": payload.bucket_id,
            "side": payload.side,
            "size": payload.size,
            "price": payload.price,
        },
    )
    await record_audit_event(
        user_id=user.id,
        action="place_order",
        success=True,
        payload={
            "environment": current_env,
            "order_id": result.get("order_id"),
            "wallet_address": result.get("wallet_address"),
            "credential_id": result.get("credential_id"),
            "paper": bool(result.get("paper")),
            "market_id": payload.market_id,
            "bucket_id": payload.bucket_id,
            "side": payload.side,
            "size": payload.size,
            "price": payload.price,
        },
    )
    return {"status": "ok", **result}


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    paper_order = (
        await session.execute(select(PaperOrder).where(PaperOrder.id == order_id, PaperOrder.user_id == user.id))
    ).scalar_one_or_none()
    if paper_order:
        return {
            "order_id": paper_order.id,
            "status": paper_order.status,
            "market_id": paper_order.market_id,
            "bucket_id": paper_order.bucket_id,
            "side": paper_order.side,
            "price": paper_order.price,
            "size": paper_order.size,
            "filled_size": paper_order.size,
            "paper": True,
            "created_at": paper_order.created_at.isoformat() if paper_order.created_at else None,
            "fills": [],
        }

    orders = await engine_service.orchestrator.execution.open_orders()
    order = orders.get(order_id)
    fills = [f for f in await engine_service.orchestrator.execution.fills() if f.order_id == order_id]
    if not order and not fills:
        raise HTTPException(status_code=404, detail="order_not_found")

    return {
        "order_id": order_id,
        "status": order.status.value if order else ("filled" if fills else "unknown"),
        "market_id": order.market_id if order else (fills[0].market_id if fills else ""),
        "bucket_id": order.bucket_id if order else (fills[0].bucket_id if fills else ""),
        "side": order.side.value if order else (fills[0].side.value if fills else ""),
        "price": order.price if order else None,
        "size": order.size if order else None,
        "filled_size": order.filled_size if order else sum(float(f.size) for f in fills),
        "fills": [
            {
                "price": float(f.price),
                "size": float(f.size),
                "side": f.side.value,
                "ts": f.ts.isoformat(),
            }
            for f in fills
        ],
    }
