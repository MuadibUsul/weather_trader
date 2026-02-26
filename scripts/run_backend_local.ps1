$env:DATABASE_URL = 'sqlite+aiosqlite:///./weather_trader.db'
$env:APP_ENV = 'development'
$env:LOG_LEVEL = 'INFO'
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
