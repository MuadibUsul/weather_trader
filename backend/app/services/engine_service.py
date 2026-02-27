"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from time import perf_counter
from datetime import datetime, UTC, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from trading_engine.config import get_engine_settings
from trading_engine.execution_engine import PolymarketLiveConfig
from trading_engine.models import BucketRange
from trading_engine.orchestrator import MarketDefinition, StrategyOrchestrator

from ..models import ApiKey, PaperOrder, PaperWallet, WalletBinding, WalletSigner
from .crypto import decrypt_value

logger = logging.getLogger(__name__)


class EngineService:
    def __init__(self) -> None:
        self.orchestrator = StrategyOrchestrator(get_engine_settings())
        self._initialized = False
        self._init_lock = asyncio.Lock()

    async def initialize(self) -> None:
        async with self._init_lock:
            if self._initialized:
                return
            markets_path = Path("database/sample_markets.json")
            if markets_path.exists():
                data = json.loads(markets_path.read_text(encoding="utf-8"))
                for item in data:
                    await self.orchestrator.register_market(
                        MarketDefinition(
                            market_id=item["market_id"],
                            resolution_url=item["resolution_url"],
                            buckets=[BucketRange(**bucket) for bucket in item["buckets"]],
                        )
                    )
            self._initialized = True

    async def start_strategy(self) -> Dict[str, Any]:
        await self.initialize()
        if not self.orchestrator.config.dry_run and not await self.orchestrator.execution.live_trading_ready():
            raise RuntimeError("live_trading_credentials_missing")
        await self.orchestrator.start()
        return await self.orchestrator.status()

    async def stop_strategy(self) -> Dict[str, Any]:
        await self.orchestrator.stop()
        return await self.orchestrator.status()

    async def configure(self, order_size: float, quote_delta: float, dry_run: bool) -> Dict[str, Any]:
        if not dry_run and not await self.orchestrator.execution.live_trading_ready():
            raise RuntimeError("live_trading_credentials_missing")
        await self.orchestrator.update_config(order_size=order_size, quote_delta=quote_delta, dry_run=dry_run)
        return await self.orchestrator.status()

    async def status(self) -> Dict[str, Any]:
        await self.initialize()
        return await self.orchestrator.status()

    async def shutdown(self) -> None:
        await self.orchestrator.close()

    async def force_paper_mode(self) -> Dict[str, Any]:
        """强制切换为纸面模式（dry-run）。"""
        await self.orchestrator.update_config(dry_run=True)
        return await self.orchestrator.status()

    async def sync_paper_wallet_from_db(self, user_id: str, session: AsyncSession) -> Dict[str, Any]:
        active_paper = (
            await session.execute(select(PaperWallet).where(PaperWallet.user_id == user_id, PaperWallet.is_active == True))
        ).scalar_one_or_none()
        if not active_paper:
            await self.orchestrator.execution.configure_paper_account(None, None)
            return {"ready": False}
        await self.orchestrator.execution.configure_paper_account(active_paper.id, active_paper.balance_usdc)
        return {"ready": True, "wallet_id": active_paper.id, "balance_usdc": active_paper.balance_usdc}

    async def persist_active_paper_wallet_balance(self, user_id: str, session: AsyncSession) -> Dict[str, Any]:
        state = await self.orchestrator.execution.paper_account_state()
        wallet_id = state.get("wallet_id")
        balance = state.get("balance_usdc")
        if not wallet_id or balance is None:
            return {"updated": False}
        row = (
            await session.execute(select(PaperWallet).where(PaperWallet.id == wallet_id, PaperWallet.user_id == user_id))
        ).scalar_one_or_none()
        if not row:
            return {"updated": False}
        if abs(float(row.balance_usdc) - float(balance)) <= 1e-9:
            return {"updated": False}
        row.balance_usdc = float(balance)
        await session.commit()
        return {"updated": True, "wallet_id": wallet_id, "balance_usdc": float(balance)}

    async def status_for_user(self, user_id: str, session: AsyncSession) -> Dict[str, Any]:
        await self.persist_active_paper_wallet_balance(user_id, session)
        return await self.status()

    async def _active_live_wallet(self, user_id: str, session: AsyncSession) -> WalletBinding | None:
        return (
            await session.execute(select(WalletBinding).where(WalletBinding.user_id == user_id, WalletBinding.is_active == True))
        ).scalar_one_or_none()

    async def _active_paper_wallet(self, user_id: str, session: AsyncSession) -> PaperWallet | None:
        return (
            await session.execute(select(PaperWallet).where(PaperWallet.user_id == user_id, PaperWallet.is_active == True))
        ).scalar_one_or_none()

    async def _load_credential(self, user_id: str, session: AsyncSession, credential_id: str | None) -> ApiKey | None:
        if not credential_id:
            return None
        return (
            await session.execute(
                select(ApiKey).where(
                    ApiKey.id == credential_id,
                    ApiKey.user_id == user_id,
                    ApiKey.provider == "polymarket",
                )
            )
        ).scalar_one_or_none()

    async def _load_preferred_credential(self, user_id: str, session: AsyncSession) -> ApiKey | None:
        rows = (
            await session.execute(
                select(ApiKey).where(
                    ApiKey.user_id == user_id,
                    ApiKey.provider == "polymarket",
                ).order_by(ApiKey.updated_at.desc())
            )
        ).scalars().all()
        if not rows:
            return None

        # Prefer explicitly named default credential, then the latest enabled one.
        for row in rows:
            if (row.name or "").strip().lower() == "default":
                return row
        for row in rows:
            if bool(row.enabled):
                return row
        return rows[0]

    async def _load_wallet_signer(self, user_id: str, wallet_address: str, session: AsyncSession) -> WalletSigner | None:
        return (
            await session.execute(
                select(WalletSigner).where(
                    WalletSigner.user_id == user_id,
                    func.lower(WalletSigner.wallet_address) == wallet_address.lower(),
                )
            )
        ).scalar_one_or_none()

    def _classify_connectivity_error(self, message: str) -> tuple[str, str]:
        msg = (message or "").strip().lower()
        if "429" in msg or "rate" in msg:
            return ("DEGRADED", "RATE_LIMIT")
        if "timeout" in msg:
            return ("DEGRADED", "TIMEOUT")
        if "network" in msg or "dns" in msg or "connection" in msg:
            return ("DEGRADED", "NETWORK")
        if "401" in msg or "invalid api key" in msg or "unauthorized" in msg:
            return ("ERROR", "AUTH_FAILED")
        if "403" in msg or "permission" in msg:
            return ("ERROR", "PERMISSION")
        if "500" in msg or "502" in msg or "503" in msg:
            return ("DEGRADED", "SERVER_5XX")
        if "invalid" in msg and "key" in msg:
            return ("ERROR", "INVALID_KEY")
        return ("ERROR", "NETWORK")

    def _next_check_at(self, consecutive_failures: int) -> datetime:
        base_seconds = 10
        step = min(max(consecutive_failures, 0), 6)
        delay_seconds = min(300, base_seconds * (2**step))
        return datetime.now(UTC) + timedelta(seconds=delay_seconds)

    def _set_credential_status(
        self,
        key_row: ApiKey,
        *,
        state: str,
        reason_code: str,
        message: str,
        checked_at: datetime | None,
        latency_ms: int | None,
        consecutive_failures: int,
    ) -> None:
        key_row.state = state
        key_row.reason_code = reason_code
        key_row.status_message = message
        key_row.checked_at = checked_at
        key_row.latency_ms = latency_ms
        key_row.consecutive_failures = max(0, int(consecutive_failures))
        key_row.next_check_at = self._next_check_at(key_row.consecutive_failures)

        # Backward compatibility fields for legacy /api/keys response.
        key_row.test_status = state.lower()
        key_row.test_message = message
        key_row.last_tested_at = checked_at

    async def _build_live_config_for_wallet_and_credential(
        self,
        *,
        user_id: str,
        session: AsyncSession,
        wallet: WalletBinding | None,
        key_row: ApiKey | None,
    ) -> Dict[str, Any]:
        if not wallet:
            return {"ready": False, "reason": "wallet_missing"}
        if not key_row:
            return {"ready": False, "reason": "wallet_credential_unbound"}
        if not key_row.enabled:
            return {"ready": False, "reason": "credential_disabled"}

        signer_row = await self._load_wallet_signer(user_id, wallet.wallet_address, session)
        legacy_signer_row = (
            await session.execute(select(ApiKey).where(ApiKey.user_id == user_id, ApiKey.provider == "polymarket_signer"))
        ).scalar_one_or_none()
        if not signer_row and not legacy_signer_row:
            return {"ready": False, "reason": "private_key_missing"}

        api_key = decrypt_value(key_row.key_ciphertext).strip()
        api_secret = decrypt_value(key_row.secret_ciphertext).strip()
        api_passphrase = decrypt_value(key_row.passphrase_ciphertext).strip()

        if signer_row:
            private_key = decrypt_value(signer_row.private_key_ciphertext).strip()
            signature_raw = str(signer_row.signature_type)
        else:
            private_key = decrypt_value(legacy_signer_row.secret_ciphertext).strip()
            signature_raw = decrypt_value(legacy_signer_row.passphrase_ciphertext).strip() or "0"

        signature_type = int(signature_raw) if signature_raw.isdigit() else 0
        funder = wallet.wallet_address

        if not api_key or not api_secret or not api_passphrase or not private_key:
            return {"ready": False, "reason": "credential_incomplete"}

        return {
            "ready": True,
            "config": PolymarketLiveConfig(
                private_key=private_key,
                funder=funder,
                api_key=api_key,
                api_secret=api_secret,
                api_passphrase=api_passphrase,
                signature_type=signature_type,
            ),
            "wallet_address": funder,
            "credential_id": key_row.id,
        }

    async def sync_live_credentials_from_db(self, user_id: str, session: AsyncSession) -> Dict[str, Any]:
        wallet = await self._active_live_wallet(user_id, session)
        if not wallet:
            await self.orchestrator.execution.configure_live_trading(None)
            return {"ready": False, "reason": "wallet_missing"}

        key_row = await self._load_credential(user_id, session, wallet.credential_id)
        if not key_row:
            key_row = await self._load_preferred_credential(user_id, session)
            if key_row:
                wallet.credential_id = key_row.id
                await session.commit()
            else:
                await self.orchestrator.execution.configure_live_trading(None)
                return {"ready": False, "reason": "wallet_credential_unbound"}

        built = await self._build_live_config_for_wallet_and_credential(user_id=user_id, session=session, wallet=wallet, key_row=key_row)
        if not built.get("ready"):
            await self.orchestrator.execution.configure_live_trading(None)
            return {"ready": False, "reason": str(built.get("reason", "credential_incomplete"))}

        await self.orchestrator.execution.configure_live_trading(built["config"])
        return {
            "ready": True,
            "wallet_address": str(built["wallet_address"]),
            "credential_id": str(built["credential_id"]),
        }

    async def test_polymarket_connection(self, user_id: str, session: AsyncSession, credential_id: str | None = None) -> Dict[str, Any]:
        key_row = await self._load_credential(user_id, session, credential_id) if credential_id else None
        if not key_row:
            wallet = await self._active_live_wallet(user_id, session)
            key_row = await self._load_credential(user_id, session, wallet.credential_id if wallet else None)
        if not key_row:
            key_row = await self._load_preferred_credential(user_id, session)
        if not key_row:
            return {
                "status": "MISSING",
                "state": "UNKNOWN",
                "reason_code": "INVALID_KEY",
                "message": "wallet_credential_unbound",
                "checked_at": None,
                "latency_ms": None,
            }

        if not key_row.enabled:
            now = datetime.now(UTC)
            self._set_credential_status(
                key_row,
                state="DISABLED",
                reason_code="PERMISSION",
                message="credential_disabled",
                checked_at=now,
                latency_ms=None,
                consecutive_failures=0,
            )
            await session.commit()
            return {
                "status": "DISABLED",
                "state": "DISABLED",
                "reason_code": "PERMISSION",
                "message": "credential_disabled",
                "checked_at": now.isoformat(),
                "latency_ms": None,
            }

        now = datetime.now(UTC)
        self._set_credential_status(
            key_row,
            state="CHECKING",
            reason_code="",
            message="checking",
            checked_at=now,
            latency_ms=None,
            consecutive_failures=key_row.consecutive_failures,
        )
        await session.commit()

        wallet = await self._active_live_wallet(user_id, session)
        built = await self._build_live_config_for_wallet_and_credential(user_id=user_id, session=session, wallet=wallet, key_row=key_row)
        if not built.get("ready"):
            reason = str(built.get("reason", "credential_incomplete"))
            checked_at = datetime.now(UTC)
            self._set_credential_status(
                key_row,
                state="ERROR",
                reason_code="PERMISSION",
                message=reason,
                checked_at=checked_at,
                latency_ms=None,
                consecutive_failures=key_row.consecutive_failures + 1,
            )
            await session.commit()
            return {
                "status": "ERROR",
                "state": "ERROR",
                "reason_code": "PERMISSION",
                "message": reason,
                "checked_at": checked_at.isoformat(),
                "latency_ms": None,
            }

        started = perf_counter()
        await self.orchestrator.execution.configure_live_trading(built["config"])
        result = await self.orchestrator.execution.test_live_connectivity()
        latency_ms = int((perf_counter() - started) * 1000)
        checked_at = datetime.now(UTC)

        if result.get("ok"):
            self._set_credential_status(
                key_row,
                state="OK",
                reason_code="",
                message="ok",
                checked_at=checked_at,
                latency_ms=latency_ms,
                consecutive_failures=0,
            )
            await session.commit()
            # Restore currently bound config after ad-hoc test.
            await self.sync_live_credentials_from_db(user_id, session)
            return {
                "status": "OK",
                "state": "OK",
                "reason_code": "",
                "message": "ok",
                "checked_at": checked_at.isoformat(),
                "latency_ms": latency_ms,
            }

        message = str(result.get("message", "connectivity_failed"))
        state, reason_code = self._classify_connectivity_error(message)
        self._set_credential_status(
            key_row,
            state=state,
            reason_code=reason_code,
            message=message,
            checked_at=checked_at,
            latency_ms=latency_ms,
            consecutive_failures=key_row.consecutive_failures + 1,
        )
        await session.commit()
        await self.sync_live_credentials_from_db(user_id, session)
        return {
            "status": state,
            "state": state,
            "reason_code": reason_code,
            "message": message,
            "checked_at": checked_at.isoformat(),
            "latency_ms": latency_ms,
        }

    async def place_manual_order(
        self,
        *,
        user_id: str,
        session: AsyncSession,
        environment: str,
        market_id: str,
        bucket_id: str,
        side: str,
        size: float,
        price: float,
        max_slippage: float,
        note: str | None,
    ) -> Dict[str, Any]:
        from trading_engine.models import OrderIntent, Side

        normalized_side = Side.BUY if side.strip().lower() == "buy" else Side.SELL
        intent = OrderIntent(
            market_id=market_id.strip(),
            bucket_id=bucket_id.strip(),
            side=normalized_side,
            price=float(price),
            size=float(size),
        )

        env_value = (environment or "").strip().upper()
        if env_value == "PAPER":
            paper_wallet = await self._active_paper_wallet(user_id, session)
            if not paper_wallet:
                return {"ok": False, "error": "paper_wallet_missing"}
            await self.sync_paper_wallet_from_db(user_id, session)
            result = await self.orchestrator.execution.submit_manual_intent(intent, max_slippage=max_slippage, force_live=False)
            if not result.get("ok"):
                return {"ok": False, "error": str(result.get("error", "place_order_failed")), "details": result.get("details")}

            state = await self.orchestrator.execution.paper_account_state()
            current_balance = state.get("balance_usdc")
            if current_balance is not None:
                paper_wallet.balance_usdc = float(current_balance)
                paper_wallet.pnl = float(current_balance) - float(paper_wallet.initial_usdc)

            order_id = str(result.get("order_id"))
            session.add(
                PaperOrder(
                    id=order_id,
                    user_id=user_id,
                    wallet_id=paper_wallet.id,
                    market_id=intent.market_id,
                    bucket_id=intent.bucket_id,
                    side=normalized_side.value.upper(),
                    size=float(size),
                    price=float(price),
                    status=str(result.get("status", "filled")),
                    note=note or "",
                    paper=True,
                )
            )
            await session.commit()
            return {
                "ok": True,
                "order_id": order_id,
                "status": str(result.get("status", "filled")),
                "wallet_id": paper_wallet.id,
                "wallet_address": paper_wallet.wallet_address,
                "credential_id": "",
                "paper": True,
                "note": note or "",
            }

        if env_value == "REAL":
            sync_result = await self.sync_live_credentials_from_db(user_id, session)
            if not sync_result.get("ready"):
                return {"ok": False, "error": str(sync_result.get("reason", "live_trading_not_ready"))}

            result = await self.orchestrator.execution.submit_manual_intent(intent, max_slippage=max_slippage, force_live=True)
            if not result.get("ok"):
                return {"ok": False, "error": str(result.get("error", "place_order_failed")), "details": result.get("details")}

            return {
                "ok": True,
                "order_id": str(result.get("order_id")),
                "status": str(result.get("status", "acked")),
                "wallet_address": str(sync_result.get("wallet_address", "")),
                "credential_id": str(sync_result.get("credential_id", "")),
                "paper": False,
                "note": note or "",
            }

        return {"ok": False, "error": "unsupported_environment"}

    async def switch_environment(self, *, user_id: str, session: AsyncSession, mode: str) -> Dict[str, Any]:
        mode_value = mode.strip().lower()
        if mode_value == "paper":
            paper = await self.sync_paper_wallet_from_db(user_id, session)
            if not paper.get("ready"):
                raise RuntimeError("paper_wallet_missing")
            await self.force_paper_mode()
            return await self.status_for_user(user_id, session)

        if mode_value == "live":
            sync = await self.sync_live_credentials_from_db(user_id, session)
            if not sync.get("ready"):
                raise RuntimeError(str(sync.get("reason", "live_trading_credentials_missing")))
            await self.configure(
                order_size=self.orchestrator.config.order_size,
                quote_delta=self.orchestrator.config.quote_delta,
                dry_run=False,
            )
            return await self.status_for_user(user_id, session)

        raise RuntimeError("unsupported_mode")


engine_service = EngineService()
