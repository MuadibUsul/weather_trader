@echo off
set NEXT_PUBLIC_API_BASE_URL=http://localhost:3101
npm run dev -w @weather-trader/web -- --port 3000 > runtime\web-3000.log 2>&1
