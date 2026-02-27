"""Trade PIN and email verification helpers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import random
import re
import smtplib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from threading import Lock
from typing import Literal

from ..config import get_settings
from ..models import User

PIN_PATTERN = re.compile(r"^\d{6}$")
PIN_FAIL_LIMIT = 5
PIN_LOCK_SECONDS = 300
CODE_TTL_SECONDS = 600


@dataclass(slots=True)
class PinVerifyResult:
    ok: bool
    reason: str
    remaining_attempts: int
    locked_until: datetime | None = None


_code_lock = Lock()
_verification_codes: dict[tuple[str, str], tuple[str, datetime]] = {}


def _now() -> datetime:
    return datetime.now(UTC)


def validate_trade_pin_format(pin: str) -> bool:
    return bool(PIN_PATTERN.match((pin or "").strip()))


def _hash_trade_pin(pin: str, salt: str | None = None) -> tuple[str, str]:
    salt_value = salt or base64.urlsafe_b64encode(os.urandom(16)).decode("utf-8")
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        salt_value.encode("utf-8"),
        200000,
    )
    return base64.urlsafe_b64encode(digest).decode("utf-8"), salt_value


def set_trade_pin(user: User, pin: str) -> None:
    pin_value = (pin or "").strip()
    if not validate_trade_pin_format(pin_value):
        raise ValueError("trade_pin_invalid")
    pin_hash, salt = _hash_trade_pin(pin_value)
    user.trade_pin_hash = pin_hash
    user.trade_pin_salt = salt
    user.trade_pin_updated_at = _now()
    user.trade_pin_fail_count = 0
    user.trade_pin_locked_until = None


def verify_trade_pin(user: User, pin: str) -> PinVerifyResult:
    now = _now()
    if user.trade_pin_locked_until and user.trade_pin_locked_until > now:
        return PinVerifyResult(
            ok=False,
            reason="trade_pin_locked",
            remaining_attempts=0,
            locked_until=user.trade_pin_locked_until,
        )

    if not user.trade_pin_hash or not user.trade_pin_salt:
        return PinVerifyResult(ok=False, reason="trade_pin_not_set", remaining_attempts=PIN_FAIL_LIMIT)

    pin_hash, _ = _hash_trade_pin((pin or "").strip(), user.trade_pin_salt)
    if hmac.compare_digest(pin_hash, user.trade_pin_hash):
        user.trade_pin_fail_count = 0
        user.trade_pin_locked_until = None
        return PinVerifyResult(ok=True, reason="ok", remaining_attempts=PIN_FAIL_LIMIT)

    fail_count = int(user.trade_pin_fail_count or 0) + 1
    if fail_count >= PIN_FAIL_LIMIT:
        lock_until = now + timedelta(seconds=PIN_LOCK_SECONDS)
        user.trade_pin_fail_count = 0
        user.trade_pin_locked_until = lock_until
        return PinVerifyResult(ok=False, reason="trade_pin_locked", remaining_attempts=0, locked_until=lock_until)

    user.trade_pin_fail_count = fail_count
    remaining = max(0, PIN_FAIL_LIMIT - fail_count)
    return PinVerifyResult(ok=False, reason="trade_pin_invalid", remaining_attempts=remaining)


def create_email_code(email: str, purpose: Literal["bind", "trade_pin_reset", "password_reset"]) -> tuple[str, datetime]:
    code = f"{random.randint(0, 999999):06d}"
    expires_at = _now() + timedelta(seconds=CODE_TTL_SECONDS)
    key = (purpose, email.strip().lower())
    with _code_lock:
        _verification_codes[key] = (code, expires_at)
    return code, expires_at


def verify_email_code(email: str, purpose: Literal["bind", "trade_pin_reset", "password_reset"], code: str) -> bool:
    key = (purpose, email.strip().lower())
    with _code_lock:
        cached = _verification_codes.get(key)
        if not cached:
            return False
        expected, expires_at = cached
        if _now() > expires_at:
            _verification_codes.pop(key, None)
            return False
        if (code or "").strip() != expected:
            return False
        _verification_codes.pop(key, None)
        return True


def _build_email(subject: str, body: str, to_email: str) -> EmailMessage:
    settings = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or "noreply@weather-trader.local"
    msg["To"] = to_email
    msg.set_content(body)
    return msg


def send_email_code(
    *,
    to_email: str,
    purpose: Literal["bind", "trade_pin_reset", "password_reset"],
    code: str,
    expires_at: datetime,
) -> dict[str, object]:
    settings = get_settings()
    subject_map = {
        "bind": "Weather Trader - Verify Email",
        "trade_pin_reset": "Weather Trader - Reset Trade PIN",
        "password_reset": "Weather Trader - Reset Login Password",
    }
    subject = subject_map[purpose]
    body = (
        f"Verification code: {code}\n"
        f"Purpose: {purpose}\n"
        f"Expires at: {expires_at.isoformat()}\n"
    )

    if not settings.smtp_host:
        # TODO: replace with real provider integration (SES/SendGrid/SMTP relay).
        return {"sent": False, "channel": "stub", "message": "email_provider_not_configured"}

    try:
        message = _build_email(subject, body, to_email)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        return {"sent": True, "channel": "smtp", "message": "ok"}
    except Exception as exc:
        return {"sent": False, "channel": "smtp", "message": str(exc)}
