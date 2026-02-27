"""
Startup migrations for lightweight schema evolution.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine


async def run_startup_migrations(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(_run_sync_migrations)


def _run_sync_migrations(sync_conn) -> None:
    inspector = inspect(sync_conn)
    tables = set(inspector.get_table_names())
    if not tables:
        return

    _ensure_column(sync_conn, inspector, "users", "email", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "users", "email_verified", "BOOLEAN DEFAULT 0")
    _ensure_column(sync_conn, inspector, "users", "trade_pin_hash", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "users", "trade_pin_salt", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "users", "trade_pin_updated_at", "TIMESTAMP NULL")
    _ensure_column(sync_conn, inspector, "users", "trade_pin_fail_count", "INTEGER DEFAULT 0")
    _ensure_column(sync_conn, inspector, "users", "trade_pin_locked_until", "TIMESTAMP NULL")
    _ensure_column(sync_conn, inspector, "users", "current_env", "TEXT DEFAULT 'PAPER'")
    _ensure_column(sync_conn, inspector, "wallet_bindings", "note", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "wallet_bindings", "credential_id", "TEXT NULL")
    _ensure_column(sync_conn, inspector, "paper_wallets", "note", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "paper_wallets", "pnl", "FLOAT DEFAULT 0")
    _ensure_column(sync_conn, inspector, "api_keys", "name", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "api_keys", "key_fingerprint", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "api_keys", "enabled", "BOOLEAN DEFAULT 1")
    _ensure_column(sync_conn, inspector, "api_keys", "state", "TEXT DEFAULT 'UNKNOWN'")
    _ensure_column(sync_conn, inspector, "api_keys", "reason_code", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "api_keys", "status_message", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "api_keys", "checked_at", "TIMESTAMP NULL")
    _ensure_column(sync_conn, inspector, "api_keys", "latency_ms", "INTEGER NULL")
    _ensure_column(sync_conn, inspector, "api_keys", "consecutive_failures", "INTEGER DEFAULT 0")
    _ensure_column(sync_conn, inspector, "api_keys", "next_check_at", "TIMESTAMP NULL")
    _ensure_column(sync_conn, inspector, "api_keys", "updated_at", "TIMESTAMP NULL")
    _ensure_column(sync_conn, inspector, "api_keys", "test_status", "TEXT DEFAULT 'unknown'")
    _ensure_column(sync_conn, inspector, "api_keys", "test_message", "TEXT DEFAULT ''")
    _ensure_column(sync_conn, inspector, "api_keys", "last_tested_at", "TIMESTAMP NULL")
    _ensure_paper_orders_table(sync_conn)

    if "users" in tables:
        sync_conn.execute(text("UPDATE users SET email = '' WHERE email IS NULL"))
        sync_conn.execute(text("UPDATE users SET email_verified = 0 WHERE email_verified IS NULL"))
        sync_conn.execute(text("UPDATE users SET trade_pin_hash = '' WHERE trade_pin_hash IS NULL"))
        sync_conn.execute(text("UPDATE users SET trade_pin_salt = '' WHERE trade_pin_salt IS NULL"))
        sync_conn.execute(text("UPDATE users SET trade_pin_fail_count = 0 WHERE trade_pin_fail_count IS NULL"))
        sync_conn.execute(text("UPDATE users SET current_env = 'PAPER' WHERE current_env IS NULL OR TRIM(current_env) = ''"))

    if "wallet_bindings" in tables:
        sync_conn.execute(text("UPDATE wallet_bindings SET note = '' WHERE note IS NULL"))
        _dedupe_wallet_bindings(sync_conn)
        _enforce_single_active_live_wallet(sync_conn)
        _ensure_wallet_ci_unique_index(sync_conn)

    if "paper_wallets" in tables:
        sync_conn.execute(text("UPDATE paper_wallets SET note = '' WHERE note IS NULL"))
        sync_conn.execute(text("UPDATE paper_wallets SET pnl = 0 WHERE pnl IS NULL"))

    if "api_keys" in tables:
        sync_conn.execute(text("UPDATE api_keys SET name = 'default' WHERE name IS NULL OR TRIM(name) = ''"))
        sync_conn.execute(text("UPDATE api_keys SET enabled = 1 WHERE enabled IS NULL"))
        sync_conn.execute(text("UPDATE api_keys SET state = 'UNKNOWN' WHERE state IS NULL OR TRIM(state) = ''"))
        sync_conn.execute(text("UPDATE api_keys SET reason_code = '' WHERE reason_code IS NULL"))
        sync_conn.execute(text("UPDATE api_keys SET status_message = '' WHERE status_message IS NULL"))
        sync_conn.execute(text("UPDATE api_keys SET consecutive_failures = 0 WHERE consecutive_failures IS NULL"))
        sync_conn.execute(text("UPDATE api_keys SET test_status = 'unknown' WHERE test_status IS NULL OR TRIM(test_status) = ''"))
        sync_conn.execute(text("UPDATE api_keys SET test_message = '' WHERE test_message IS NULL"))
        sync_conn.execute(text("UPDATE api_keys SET updated_at = created_at WHERE updated_at IS NULL"))
        _ensure_api_key_name_index(sync_conn)


def _ensure_column(sync_conn, inspector, table: str, column: str, definition: str) -> None:
    if table not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns(table)}
    if column in existing:
        return
    sync_conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


def _dedupe_wallet_bindings(sync_conn) -> None:
    rows = sync_conn.execute(
        text(
            "SELECT id, user_id, wallet_address, created_at "
            "FROM wallet_bindings "
            "ORDER BY created_at DESC, id DESC"
        )
    ).mappings().all()
    keep = set()
    delete_ids: list[str] = []
    for row in rows:
        key = (str(row["user_id"]), str(row["wallet_address"]).lower())
        if key in keep:
            delete_ids.append(str(row["id"]))
            continue
        keep.add(key)
    _delete_ids(sync_conn, "wallet_bindings", delete_ids)


def _enforce_single_active_live_wallet(sync_conn) -> None:
    rows = sync_conn.execute(
        text(
            "SELECT id, user_id, is_active, created_at "
            "FROM wallet_bindings "
            "ORDER BY user_id, created_at DESC, id DESC"
        )
    ).mappings().all()
    active_seen: dict[str, bool] = defaultdict(bool)
    deactivate_ids: list[str] = []
    for row in rows:
        user_id = str(row["user_id"])
        is_active = bool(row["is_active"])
        if not is_active:
            continue
        if active_seen[user_id]:
            deactivate_ids.append(str(row["id"]))
            continue
        active_seen[user_id] = True
    if deactivate_ids:
        for wallet_id in deactivate_ids:
            sync_conn.execute(
                text("UPDATE wallet_bindings SET is_active = 0 WHERE id = :wallet_id"),
                {"wallet_id": wallet_id},
            )


def _ensure_wallet_ci_unique_index(sync_conn) -> None:
    dialect = sync_conn.dialect.name
    if dialect == "sqlite":
        sync_conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_bindings_user_addr_ci "
                "ON wallet_bindings(user_id, wallet_address COLLATE NOCASE)"
            )
        )
        return
    sync_conn.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_bindings_user_addr_ci "
            "ON wallet_bindings(user_id, lower(wallet_address))"
        )
    )


def _ensure_api_key_name_index(sync_conn) -> None:
    dialect = sync_conn.dialect.name
    if dialect == "sqlite":
        sync_conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_user_provider_name_ci "
                "ON api_keys(user_id, provider, name COLLATE NOCASE)"
            )
        )
        return
    sync_conn.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_user_provider_name_ci "
            "ON api_keys(user_id, provider, lower(name))"
        )
    )


def _ensure_paper_orders_table(sync_conn) -> None:
    sync_conn.execute(
        text(
            "CREATE TABLE IF NOT EXISTS paper_orders ("
            "id TEXT PRIMARY KEY,"
            "user_id TEXT NOT NULL,"
            "wallet_id TEXT NULL,"
            "market_id TEXT NOT NULL,"
            "bucket_id TEXT NOT NULL,"
            "side TEXT NOT NULL,"
            "size FLOAT NOT NULL,"
            "price FLOAT NOT NULL,"
            "status TEXT NOT NULL DEFAULT 'filled',"
            "note TEXT NOT NULL DEFAULT '',"
            "paper BOOLEAN NOT NULL DEFAULT 1,"
            "created_at TIMESTAMP NULL,"
            "FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,"
            "FOREIGN KEY(wallet_id) REFERENCES paper_wallets(id) ON DELETE SET NULL"
            ")"
        )
    )
    sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_paper_orders_user_id ON paper_orders(user_id)"))
    sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_paper_orders_market_id ON paper_orders(market_id)"))


def _delete_ids(sync_conn, table: str, ids: Iterable[str]) -> None:
    for row_id in ids:
        sync_conn.execute(text(f"DELETE FROM {table} WHERE id = :row_id"), {"row_id": row_id})
