"""后端鉴权模块的基础功能测试。"""

from jose import jwt

from backend.app.auth import create_access_token, hash_password, verify_password
from backend.app.config import get_settings


def test_hash_password_and_verify_roundtrip() -> None:
    raw = "s3cure-pass"
    hashed = hash_password(raw)

    assert hashed != raw
    assert "$" in hashed
    assert verify_password(raw, hashed) is True
    assert verify_password("wrong-pass", hashed) is False


def test_create_access_token_contains_subject() -> None:
    token = create_access_token("alice")
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

    assert payload["sub"] == "alice"
    assert "exp" in payload
