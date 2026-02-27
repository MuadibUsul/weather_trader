"""
Wallet management APIs.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from eth_account import Account
from eth_account.messages import encode_defunct

from ..auth import get_current_user
from ..db import get_db
from ..models import ApiKey, PaperWallet, User, WalletBinding, WalletSigner
from ..schemas import (
    PaperWalletCreateRequest,
    WalletActivateRequest,
    WalletBindRequest,
    WalletCredentialBindRequest,
    WalletPrivateKeyRequest,
)
from ..services.audit import record_audit_event
from ..services.crypto import encrypt_value
from ..services.engine_service import engine_service

router = APIRouter(prefix="/api/wallet", tags=["wallet"])
logger = logging.getLogger(__name__)

_CHALLENGE_TTL_SECONDS = 300
_wallet_bind_challenges: dict[str, tuple[str, datetime]] = {}
_wallet_bind_challenge_lock = Lock()


def _normalize_note(note: str | None) -> str:
    return (note or "").strip()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _make_wallet_bind_challenge(user_id: str) -> str:
    nonce = secrets.token_hex(16)
    issued_at = _now_utc().isoformat()
    return (
        "Weather Trader Wallet Binding Challenge\n"
        f"User: {user_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}\n"
        "Purpose: Verify wallet ownership for binding."
    )


def _store_wallet_bind_challenge(user_id: str, challenge: str, expires_at: datetime) -> None:
    with _wallet_bind_challenge_lock:
        _wallet_bind_challenges[user_id] = (challenge, expires_at)


def _consume_wallet_bind_challenge(user_id: str) -> tuple[str, datetime] | None:
    with _wallet_bind_challenge_lock:
        return _wallet_bind_challenges.pop(user_id, None)


def _peek_wallet_bind_challenge(user_id: str) -> tuple[str, datetime] | None:
    with _wallet_bind_challenge_lock:
        return _wallet_bind_challenges.get(user_id)


async def _deactivate_live_wallets(user_id: str, session: AsyncSession) -> None:
    rows = (
        await session.execute(select(WalletBinding).where(WalletBinding.user_id == user_id, WalletBinding.is_active == True))
    ).scalars().all()
    for row in rows:
        row.is_active = False


async def _deactivate_paper_wallets(user_id: str, session: AsyncSession) -> None:
    rows = (
        await session.execute(select(PaperWallet).where(PaperWallet.user_id == user_id, PaperWallet.is_active == True))
    ).scalars().all()
    for row in rows:
        row.is_active = False


@router.post("/challenge")
async def create_wallet_bind_challenge(user: User = Depends(get_current_user)):
    challenge = _make_wallet_bind_challenge(user.id)
    expires_at = _now_utc() + timedelta(seconds=_CHALLENGE_TTL_SECONDS)
    _store_wallet_bind_challenge(user.id, challenge, expires_at)
    return {
        "status": "ok",
        "challenge_message": challenge,
        "expires_at": expires_at.isoformat(),
        "ttl_seconds": _CHALLENGE_TTL_SECONDS,
    }


@router.post("/bind")
async def bind_wallet(payload: WalletBindRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    challenge_message = (payload.challenge_message or "").strip()
    signature = (payload.signature or "").strip()
    if not challenge_message or not signature:
        raise HTTPException(status_code=400, detail="wallet_signature_required")

    cached = _peek_wallet_bind_challenge(user.id)
    if not cached:
        raise HTTPException(status_code=400, detail="wallet_challenge_missing")

    expected_challenge, expires_at = cached
    if expected_challenge != challenge_message:
        raise HTTPException(status_code=400, detail="wallet_challenge_mismatch")
    if _now_utc() > expires_at:
        _consume_wallet_bind_challenge(user.id)
        raise HTTPException(status_code=400, detail="wallet_challenge_expired")

    try:
        recovered_address = Account.recover_message(encode_defunct(text=challenge_message), signature=signature)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="wallet_signature_invalid") from exc
    if recovered_address.lower() != payload.wallet_address.lower():
        raise HTTPException(status_code=400, detail="wallet_signature_mismatch")

    _consume_wallet_bind_challenge(user.id)

    note = _normalize_note(payload.note)
    await _deactivate_live_wallets(user.id, session)

    existing = (
        await session.execute(
            select(WalletBinding).where(
                WalletBinding.user_id == user.id,
                func.lower(WalletBinding.wallet_address) == payload.wallet_address.lower(),
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.chain_id = payload.chain_id
        existing.is_active = True
        if note:
            existing.note = note
        elif not _normalize_note(existing.note):
            raise HTTPException(status_code=400, detail="wallet_note_required")
        record = existing
    else:
        if not note:
            raise HTTPException(status_code=400, detail="wallet_note_required")
        record = WalletBinding(
            user_id=user.id,
            wallet_address=payload.wallet_address,
            note=note,
            chain_id=payload.chain_id,
            is_active=True,
        )
        session.add(record)

    await session.commit()
    await engine_service.sync_live_credentials_from_db(user.id, session)
    await record_audit_event(
        user_id=user.id,
        action="bind_wallet",
        success=True,
        payload={"wallet_address": record.wallet_address, "chain_id": record.chain_id, "note": record.note},
    )
    return {
        "status": "ok",
        "wallet_address": record.wallet_address,
        "note": record.note,
        "chain_id": record.chain_id,
    }


@router.post("/private-key")
async def bind_private_key(payload: WalletPrivateKeyRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    private_key = payload.private_key.strip()
    if not private_key.startswith("0x"):
        private_key = f"0x{private_key}"

    try:
        account = Account.from_key(private_key)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid_private_key") from exc
    wallet_address = account.address
    note = _normalize_note(payload.note)

    await _deactivate_live_wallets(user.id, session)
    binding = (
        await session.execute(
            select(WalletBinding).where(
                WalletBinding.user_id == user.id,
                func.lower(WalletBinding.wallet_address) == wallet_address.lower(),
            )
        )
    ).scalar_one_or_none()
    if binding:
        binding.is_active = True
        binding.chain_id = 137
        if note:
            binding.note = note
        elif not _normalize_note(binding.note):
            raise HTTPException(status_code=400, detail="wallet_note_required")
    else:
        if not note:
            raise HTTPException(status_code=400, detail="wallet_note_required")
        binding = WalletBinding(user_id=user.id, wallet_address=wallet_address, note=note, chain_id=137, is_active=True)
        session.add(binding)

    signer = (
        await session.execute(
            select(WalletSigner).where(
                WalletSigner.user_id == user.id,
                func.lower(WalletSigner.wallet_address) == wallet_address.lower(),
            )
        )
    ).scalar_one_or_none()
    if signer:
        signer.private_key_ciphertext = encrypt_value(private_key)
        signer.signature_type = 0
    else:
        session.add(
            WalletSigner(
                user_id=user.id,
                wallet_address=wallet_address,
                private_key_ciphertext=encrypt_value(private_key),
                signature_type=0,
            )
        )

    await session.commit()
    await engine_service.sync_live_credentials_from_db(user.id, session)
    await record_audit_event(
        user_id=user.id,
        action="bind_wallet_private_key",
        success=True,
        payload={"wallet_address": wallet_address, "note": binding.note},
    )
    return {
        "status": "ok",
        "wallet_address": wallet_address,
        "note": binding.note,
        "chain_id": 137,
    }


@router.post("/disconnect")
async def disconnect_wallet(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    await _deactivate_live_wallets(user.id, session)
    user.current_env = "PAPER"
    await session.commit()
    await engine_service.sync_live_credentials_from_db(user.id, session)
    await engine_service.force_paper_mode()
    await engine_service.sync_paper_wallet_from_db(user.id, session)
    await record_audit_event(user_id=user.id, action="unbind_wallet", success=True, payload={"mode": "PAPER"})
    return {"status": "ok", "disconnected": True, "paper_mode": True}


@router.get("")
async def get_wallet(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    record = (
        await session.execute(select(WalletBinding).where(WalletBinding.user_id == user.id, WalletBinding.is_active == True))
    ).scalar_one_or_none()
    if not record:
        return {"wallet_address": None, "note": "", "chain_id": 137, "credential_id": None, "credential_name": ""}
    credential = (
        await session.execute(
            select(ApiKey).where(
                ApiKey.id == record.credential_id,
                ApiKey.user_id == user.id,
                ApiKey.provider == "polymarket",
            )
        )
    ).scalar_one_or_none()
    return {
        "wallet_address": record.wallet_address,
        "note": record.note,
        "chain_id": record.chain_id,
        "credential_id": credential.id if credential else None,
        "credential_name": credential.name if credential else "",
    }


@router.get("/live")
async def list_live_wallets(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    rows = (
        await session.execute(select(WalletBinding).where(WalletBinding.user_id == user.id).order_by(WalletBinding.created_at.desc()))
    ).scalars().all()
    signers = (await session.execute(select(WalletSigner.wallet_address).where(WalletSigner.user_id == user.id))).scalars().all()
    signer_set = {addr.lower() for addr in signers}
    creds = (
        await session.execute(select(ApiKey.id, ApiKey.name).where(ApiKey.user_id == user.id, ApiKey.provider == "polymarket"))
    ).all()
    cred_map = {str(k): str(v) for k, v in creds}

    dedup: dict[str, WalletBinding] = {}
    for row in rows:
        key = row.wallet_address.lower()
        if key not in dedup:
            dedup[key] = row

    return [
        {
            "wallet_id": w.id,
            "wallet_address": w.wallet_address,
            "note": w.note,
            "chain_id": w.chain_id,
            "is_active": w.is_active,
            "has_private_key": w.wallet_address.lower() in signer_set,
            "credential_id": w.credential_id,
            "credential_name": cred_map.get(str(w.credential_id), "") if w.credential_id else "",
            "created_at": w.created_at.isoformat(),
        }
        for w in dedup.values()
    ]


@router.post("/live/bind-credential")
async def bind_live_wallet_credential(
    payload: WalletCredentialBindRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    wallet = (
        await session.execute(select(WalletBinding).where(WalletBinding.id == payload.wallet_id, WalletBinding.user_id == user.id))
    ).scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=404, detail="wallet_not_found")

    credential = None
    if payload.credential_id:
        credential = (
            await session.execute(
                select(ApiKey).where(
                    ApiKey.id == payload.credential_id,
                    ApiKey.user_id == user.id,
                    ApiKey.provider == "polymarket",
                )
            )
        ).scalar_one_or_none()
        if not credential:
            raise HTTPException(status_code=404, detail="credential_not_found")

    wallet.credential_id = credential.id if credential else None
    await session.commit()

    if wallet.is_active:
        await engine_service.sync_live_credentials_from_db(user.id, session)

    logger.info(
        "wallet_action",
        extra={
            "action": "bind_credential",
            "user_id": user.id,
            "wallet_id": wallet.id,
            "wallet_address": wallet.wallet_address,
            "credential_id": credential.id if credential else None,
        },
    )
    await record_audit_event(
        user_id=user.id,
        action="bind_wallet_credential",
        success=True,
        payload={"wallet_id": wallet.id, "credential_id": credential.id if credential else None},
    )

    return {
        "status": "ok",
        "wallet_id": wallet.id,
        "wallet_address": wallet.wallet_address,
        "credential_id": credential.id if credential else None,
        "credential_name": credential.name if credential else "",
    }


@router.post("/live/activate")
async def activate_live_wallet(payload: WalletActivateRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    target = (
        await session.execute(select(WalletBinding).where(WalletBinding.id == payload.wallet_id, WalletBinding.user_id == user.id))
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="wallet_not_found")

    await _deactivate_live_wallets(user.id, session)
    target.is_active = True
    await session.commit()
    await engine_service.sync_live_credentials_from_db(user.id, session)
    return {
        "status": "ok",
        "wallet_id": target.id,
        "wallet_address": target.wallet_address,
        "note": target.note,
    }


@router.delete("/live/{wallet_id}")
async def delete_live_wallet(wallet_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    target = (
        await session.execute(select(WalletBinding).where(WalletBinding.id == wallet_id, WalletBinding.user_id == user.id))
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="wallet_not_found")

    was_active = bool(target.is_active)
    signer = (
        await session.execute(
            select(WalletSigner).where(
                WalletSigner.user_id == user.id,
                func.lower(WalletSigner.wallet_address) == target.wallet_address.lower(),
            )
        )
    ).scalar_one_or_none()
    if signer:
        await session.delete(signer)
    await session.delete(target)
    await session.commit()

    if was_active:
        await engine_service.sync_live_credentials_from_db(user.id, session)
    return {"status": "ok", "wallet_id": wallet_id, "deleted": True}


@router.get("/paper")
async def list_paper_wallets(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    await engine_service.persist_active_paper_wallet_balance(user.id, session)
    rows = (
        await session.execute(select(PaperWallet).where(PaperWallet.user_id == user.id).order_by(PaperWallet.created_at.desc()))
    ).scalars().all()
    return [
        {
            "wallet_id": r.id,
            "wallet_address": r.wallet_address,
            "note": r.note,
            "initial_usdc": r.initial_usdc,
            "balance_usdc": r.balance_usdc,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/paper/create")
async def create_paper_wallet(payload: PaperWalletCreateRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    note = _normalize_note(payload.note)
    if not note:
        raise HTTPException(status_code=400, detail="paper_wallet_note_required")

    await _deactivate_paper_wallets(user.id, session)
    account = Account.create()
    record = PaperWallet(
        user_id=user.id,
        wallet_address=account.address,
        note=note,
        initial_usdc=float(payload.initial_usdc),
        balance_usdc=float(payload.initial_usdc),
        is_active=True,
    )
    session.add(record)
    await session.commit()
    user.current_env = "PAPER"
    await session.commit()
    await engine_service.force_paper_mode()
    await engine_service.sync_paper_wallet_from_db(user.id, session)
    await record_audit_event(
        user_id=user.id,
        action="create_paper_wallet",
        success=True,
        payload={"wallet_id": record.id, "wallet_address": record.wallet_address, "initial_usdc": record.initial_usdc},
    )
    return {
        "status": "ok",
        "wallet_id": record.id,
        "wallet_address": record.wallet_address,
        "note": record.note,
        "initial_usdc": record.initial_usdc,
        "balance_usdc": record.balance_usdc,
        "is_active": record.is_active,
    }


@router.post("/paper/activate")
async def activate_paper_wallet(payload: WalletActivateRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    target = (
        await session.execute(select(PaperWallet).where(PaperWallet.id == payload.wallet_id, PaperWallet.user_id == user.id))
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="wallet_not_found")

    await _deactivate_paper_wallets(user.id, session)
    target.is_active = True
    user.current_env = "PAPER"
    await session.commit()
    await engine_service.force_paper_mode()
    await engine_service.sync_paper_wallet_from_db(user.id, session)
    await record_audit_event(
        user_id=user.id,
        action="activate_paper_wallet",
        success=True,
        payload={"wallet_id": target.id, "wallet_address": target.wallet_address},
    )
    return {
        "status": "ok",
        "wallet_id": target.id,
        "wallet_address": target.wallet_address,
        "note": target.note,
        "balance_usdc": target.balance_usdc,
    }


@router.delete("/paper/{wallet_id}")
async def delete_paper_wallet(wallet_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    target = (
        await session.execute(select(PaperWallet).where(PaperWallet.id == wallet_id, PaperWallet.user_id == user.id))
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="wallet_not_found")

    was_active = bool(target.is_active)
    await session.delete(target)
    await session.flush()

    if was_active:
        fallback = (
            await session.execute(select(PaperWallet).where(PaperWallet.user_id == user.id).order_by(PaperWallet.created_at.desc()))
        ).scalars().first()
        if fallback:
            fallback.is_active = True

    await session.commit()
    await engine_service.sync_paper_wallet_from_db(user.id, session)
    return {"status": "ok", "wallet_id": wallet_id, "deleted": True}
