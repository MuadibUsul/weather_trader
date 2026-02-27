-- 中文说明：数据库结构与迁移脚本。

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL DEFAULT '',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    trade_pin_hash VARCHAR(255) NOT NULL DEFAULT '',
    trade_pin_salt VARCHAR(128) NOT NULL DEFAULT '',
    trade_pin_updated_at TIMESTAMPTZ NULL,
    trade_pin_fail_count INTEGER NOT NULL DEFAULT 0,
    trade_pin_locked_until TIMESTAMPTZ NULL,
    current_env VARCHAR(16) NOT NULL DEFAULT 'PAPER',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_bindings (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(128) NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 137,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    key_ciphertext TEXT NOT NULL,
    secret_ciphertext TEXT NOT NULL,
    passphrase_ciphertext TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_wallets (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(128) NOT NULL,
    note VARCHAR(128) NOT NULL DEFAULT '',
    initial_usdc DOUBLE PRECISION NOT NULL DEFAULT 1000,
    balance_usdc DOUBLE PRECISION NOT NULL DEFAULT 1000,
    pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_orders (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id VARCHAR(36) NULL REFERENCES paper_wallets(id) ON DELETE SET NULL,
    market_id VARCHAR(128) NOT NULL,
    bucket_id VARCHAR(128) NOT NULL,
    side VARCHAR(8) NOT NULL,
    size DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'filled',
    note VARCHAR(255) NOT NULL DEFAULT '',
    paper BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_metadata (
    id VARCHAR(36) PRIMARY KEY,
    market_id VARCHAR(128) UNIQUE NOT NULL,
    city VARCHAR(128) NOT NULL,
    station VARCHAR(64) NOT NULL,
    resolution_url TEXT NOT NULL,
    settlement_ts TIMESTAMPTZ NOT NULL,
    bucket_definitions JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS weather_cache (
    id VARCHAR(36) PRIMARY KEY,
    market_id VARCHAR(128) NOT NULL,
    station VARCHAR(64) NOT NULL,
    market_date TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_configs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    config_json JSONB NOT NULL,
    is_running BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    market_id VARCHAR(128) NOT NULL,
    bucket_id VARCHAR(128) NOT NULL,
    side VARCHAR(8) NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    size DOUBLE PRECISION NOT NULL,
    filled_size DOUBLE PRECISION NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL,
    correlation_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    market_id VARCHAR(128) NOT NULL,
    bucket_id VARCHAR(128) NOT NULL,
    side VARCHAR(8) NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    size DOUBLE PRECISION NOT NULL,
    pnl_realized DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_events (
    id VARCHAR(36) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    message TEXT NOT NULL,
    metadata_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_history (
    id VARCHAR(36) PRIMARY KEY,
    ts TIMESTAMPTZ DEFAULT NOW(),
    realized_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
    unrealized_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
    gross_exposure DOUBLE PRECISION NOT NULL DEFAULT 0,
    net_exposure DOUBLE PRECISION NOT NULL DEFAULT 0,
    sharpe_rolling DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_logs (
    id VARCHAR(36) PRIMARY KEY,
    level VARCHAR(16) NOT NULL,
    service VARCHAR(64) NOT NULL,
    correlation_id VARCHAR(64),
    message TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_market ON orders (market_id);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades (market_id);
CREATE INDEX IF NOT EXISTS idx_weather_market ON weather_cache (market_id);
CREATE INDEX IF NOT EXISTS idx_perf_ts ON performance_history (ts);
CREATE INDEX IF NOT EXISTS idx_paper_orders_user ON paper_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_paper_orders_market ON paper_orders (market_id);
