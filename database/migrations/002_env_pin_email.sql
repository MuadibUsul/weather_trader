-- 002_env_pin_email.sql
-- Up
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trade_pin_hash VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trade_pin_salt VARCHAR(128) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trade_pin_updated_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trade_pin_fail_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trade_pin_locked_until TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_env VARCHAR(16) NOT NULL DEFAULT 'PAPER';

ALTER TABLE paper_wallets ADD COLUMN IF NOT EXISTS pnl DOUBLE PRECISION NOT NULL DEFAULT 0;

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
CREATE INDEX IF NOT EXISTS idx_paper_orders_user ON paper_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_paper_orders_market ON paper_orders (market_id);

-- Down (PostgreSQL)
-- DROP INDEX IF EXISTS idx_paper_orders_market;
-- DROP INDEX IF EXISTS idx_paper_orders_user;
-- DROP TABLE IF EXISTS paper_orders;
-- ALTER TABLE paper_wallets DROP COLUMN IF EXISTS pnl;
-- ALTER TABLE users DROP COLUMN IF EXISTS current_env;
-- ALTER TABLE users DROP COLUMN IF EXISTS trade_pin_locked_until;
-- ALTER TABLE users DROP COLUMN IF EXISTS trade_pin_fail_count;
-- ALTER TABLE users DROP COLUMN IF EXISTS trade_pin_updated_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS trade_pin_salt;
-- ALTER TABLE users DROP COLUMN IF EXISTS trade_pin_hash;
-- ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
-- ALTER TABLE users DROP COLUMN IF EXISTS email;
--
-- Note: SQLite does not support DROP COLUMN in old versions.
-- For SQLite rollback, rebuild affected tables via create-copy-drop-rename.
