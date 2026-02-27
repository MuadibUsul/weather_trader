"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

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
    note: str | None = None
    challenge_message: str | None = None
    signature: str | None = None


class WalletPrivateKeyRequest(BaseModel):
    private_key: str
    note: str | None = None


class WalletActivateRequest(BaseModel):
    wallet_id: str


class PaperWalletCreateRequest(BaseModel):
    initial_usdc: Literal[1000, 5000, 10000] = 1000
    note: str


class ApiKeyRequest(BaseModel):
    provider: str = "polymarket"
    api_key: str
    api_secret: str
    api_passphrase: str


class CredentialCreateRequest(BaseModel):
    name: str
    api_key: str
    api_secret: str
    api_passphrase: str
    enabled: bool = True
    save_and_test: bool = True


class CredentialUpdateRequest(BaseModel):
    name: str | None = None
    api_key: str | None = None
    api_secret: str | None = None
    api_passphrase: str | None = None
    enabled: bool | None = None
    save_and_test: bool = False


class CredentialToggleRequest(BaseModel):
    enabled: bool


class WalletCredentialBindRequest(BaseModel):
    wallet_id: str
    credential_id: str | None = None


class TradePlaceRequest(BaseModel):
    market_id: str = Field(min_length=1)
    bucket_id: str = Field(min_length=1)
    side: Literal["BUY", "SELL", "buy", "sell"]
    size: float = Field(gt=0)
    price: float = Field(gt=0, lt=1)
    max_slippage: float = Field(default=0.02, ge=0, le=0.5)
    note: str | None = None
    trade_pin: str | None = None


class StrategyConfigRequest(BaseModel):
    order_size: float = Field(default=25.0, ge=1)
    quote_delta: float = Field(default=0.01, ge=0.001, le=0.1)
    dry_run: bool = True


class StrategyToggleRequest(BaseModel):
    enabled: bool


class StrategyEnvironmentRequest(BaseModel):
    mode: Literal["live", "paper"]
    trade_pin: str


class TradePinSetRequest(BaseModel):
    current_password: str
    trade_pin: str = Field(min_length=6, max_length=6)


class TradePinVerifyRequest(BaseModel):
    trade_pin: str = Field(min_length=6, max_length=6)


class EmailBindRequest(BaseModel):
    email: str
    current_password: str


class EmailCodeVerifyRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)


class TradePinResetRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)
    new_trade_pin: str = Field(min_length=6, max_length=6)


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirmRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


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
