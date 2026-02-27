# WeatherTrader Pro V3

## Monorepo

- `apps/web`: Next.js 14 + Tailwind + Zustand + React Query + ECharts + Framer Motion + Playwright
- `apps/api`: NestJS + Prisma + Redis + WebSocket
- `packages/core`: 回测引擎/撮合模拟器/风控/指标
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
```
