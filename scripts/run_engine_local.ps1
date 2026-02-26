$env:DATABASE_URL = 'sqlite+aiosqlite:///./weather_trader.db'
$env:DRY_RUN = 'true'
python -m trading_engine.main --dry-run
