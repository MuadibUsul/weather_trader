"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class WalletBindRequest(BaseModel):
    wallet_address: str
    chain_id: int = 137


class ApiKeyRequest(BaseModel):
    provider: str = "polymarket"
    api_key: str
    api_secret: str
    api_passphrase: str


class StrategyConfigRequest(BaseModel):
    order_size: float = Field(default=25.0, ge=1)
    quote_delta: float = Field(default=0.01, ge=0.001, le=0.1)
    dry_run: bool = True


class StrategyToggleRequest(BaseModel):
    enabled: bool


class StatusResponse(BaseModel):
    running: bool
    started_at: Optional[str]
    market_count: int
    open_orders: int
    positions: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    risk: Dict[str, Any]
    fill_count: int
    config: Dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    ts: datetime
    services: Dict[str, str]