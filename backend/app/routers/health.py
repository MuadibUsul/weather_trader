"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from datetime import UTC, datetime

from fastapi import APIRouter

from ..schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        ts=datetime.now(UTC),
        services={
            "backend": "ok",
            "engine": "ok",
            "db": "ok",
        },
    )