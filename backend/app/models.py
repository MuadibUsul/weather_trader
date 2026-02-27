"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trade_pin_hash: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    trade_pin_salt: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    trade_pin_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trade_pin_fail_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    trade_pin_locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_env: Mapped[str] = mapped_column(String(16), default="PAPER", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class WalletBinding(Base):
    __tablename__ = "wallet_bindings"
    __table_args__ = (UniqueConstraint("user_id", "wallet_address", name="uq_wallet_binding_user_addr"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    wallet_address: Mapped[str] = mapped_column(String(128), nullable=False)
    note: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    chain_id: Mapped[int] = mapped_column(Integer, default=137)
    credential_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class WalletSigner(Base):
    __tablename__ = "wallet_signers"
    __table_args__ = (UniqueConstraint("user_id", "wallet_address", name="uq_wallet_signer_user_addr"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    wallet_address: Mapped[str] = mapped_column(String(128), nullable=False)
    private_key_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    signature_type: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class PaperWallet(Base):
    __tablename__ = "paper_wallets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    wallet_address: Mapped[str] = mapped_column(String(128), nullable=False)
    note: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    initial_usdc: Mapped[float] = mapped_column(Float, default=1000.0)
    balance_usdc: Mapped[float] = mapped_column(Float, default=1000.0)
    pnl: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PaperOrder(Base):
    __tablename__ = "paper_orders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    wallet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("paper_wallets.id", ondelete="SET NULL"), nullable=True)
    market_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    bucket_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(8), nullable=False)
    size: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="filled")
    note: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    paper: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    key_fingerprint: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    key_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    secret_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    passphrase_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(String(32), default="UNKNOWN", nullable=False)
    reason_code: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    status_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    next_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    test_status: Mapped[str] = mapped_column(String(32), default="unknown", nullable=False)
    test_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RuntimeLock(Base):
    __tablename__ = "runtime_locks"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), nullable=False)
    lease_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class MarketMetadata(Base):
    __tablename__ = "market_metadata"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    market_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    station: Mapped[str] = mapped_column(String(64), nullable=False)
    resolution_url: Mapped[str] = mapped_column(Text, nullable=False)
    settlement_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    bucket_definitions: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class WeatherCache(Base):
    __tablename__ = "weather_cache"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    market_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    station: Mapped[str] = mapped_column(String(64), nullable=False)
    market_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class StrategyConfig(Base):
    __tablename__ = "strategy_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_running: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    market_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    bucket_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(8), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    size: Mapped[float] = mapped_column(Float, nullable=False)
    filled_size: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    order_id: Mapped[str] = mapped_column(String(64), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    market_id: Mapped[str] = mapped_column(String(128), nullable=False)
    bucket_id: Mapped[str] = mapped_column(String(128), nullable=False)
    side: Mapped[str] = mapped_column(String(8), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    size: Mapped[float] = mapped_column(Float, nullable=False)
    pnl_realized: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RiskEvent(Base):
    __tablename__ = "risk_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PerformanceHistory(Base):
    __tablename__ = "performance_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    realized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    gross_exposure: Mapped[float] = mapped_column(Float, default=0.0)
    net_exposure: Mapped[float] = mapped_column(Float, default=0.0)
    sharpe_rolling: Mapped[float] = mapped_column(Float, default=0.0)


class AppLog(Base):
    __tablename__ = "app_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    level: Mapped[str] = mapped_column(String(16), nullable=False)
    service: Mapped[str] = mapped_column(String(64), nullable=False)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
