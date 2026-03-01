# WeatherTrader Pro V3

## Monorepo

- `apps/web`: Next.js 14 + Tailwind + Zustand + React Query + ECharts + Framer Motion + Playwright
- `apps/api`: NestJS + Prisma + Redis + WebSocket
- `packages/core`: 回测引擎 / 撮合模拟器 / 风控 / 指标
- `packages/shared`: 共享 DTO 类型
- `design`: v3 视觉真相源
- `docs`: 设计与 API 文档

## One-command Start

```bash
npm install
npm run dev
```

## Individual Commands

```bash
npm run dev -w @weather-trader/web
npm run dev -w @weather-trader/api
npm run test -w @weather-trader/core
npm run test -w @weather-trader/web
npm run paper:report
npm run paper:official
```

`npm run paper:report` 会运行天气事件合约 paper 闭环并生成 `runtime/weather-paper-report.json`（含交易指标、校准指标、稳健性分析与图表数据）。
`npm run paper:official` 会使用 Polymarket 官方 weather 已结算市场 + CLOB 历史价格运行同构 paper 回测，并生成 `runtime/weather-paper-official-report.json`，输出实盘准入检查结果（`realEligibility`）。

## Environment Variables

- `PORT` (API, default `3001`)
- `TRADE_PIN` (API, default `123456`)
- `NEXT_PUBLIC_API_BASE_URL` (WEB, default `http://localhost:3001`)
- `EXEC_FEE_RATE` (API, default `0.001`)
- `EXEC_SLIPPAGE_BPS` (API, default `15`)
- `MAX_NOTIONAL_PER_ORDER` (API, default `100000`)
- `MAX_POSITION_PER_SYMBOL` (API, default `100000`)
- `POLYMARKET_MARKETS_LIMIT` (API, default `60`)
- `POLYMARKET_MARKETS_CACHE_SEC` (API, default `8`)
- `POLYMARKET_MARKETS_TIMEOUT_MS` (API, default `1800`)
- `POLYMARKET_ALLOW_SEED_FALLBACK` (API, optional; default `false`, set `true` to allow local seed fallback when exchange unavailable)
- `REAL_EXECUTION_HTTP_ENDPOINT` (API, optional; if set, REAL mode sends order to external gateway)
- `REAL_EXECUTION_HTTP_API_KEY` (API, optional; Bearer token for gateway)
- `REAL_EXECUTION_REQUIRED` (API, optional; default `true` in non-test, set `false` to allow REAL fallback stub)
- `ORDER_STORE_PATH` (API, optional; order/ledger snapshot file path, default `runtime/orders-store.json`)
- `ORDER_PERSISTENCE` (API, optional; set `off` to disable file persistence)
- `SYSTEM_STORE_PATH` (API, optional; system state snapshot path, default `runtime/system-store.json`)
- `SYSTEM_PERSISTENCE` (API, optional; set `off` to disable system state persistence)
- `MARKETS_ENABLE_DB_FALLBACK` (API, optional; default `false`, set `true` to fallback to Prisma markets table when exchange unavailable)
- `MARKETS_CONFIG_PATH` (API, optional; `/markets/integration` runtime config persistence path)

## Markets Scope

- Exchange feed defaults to Polymarket Weather instruments (`/events?tag_slug=weather`) and can be changed at runtime via `/markets/integration`.
