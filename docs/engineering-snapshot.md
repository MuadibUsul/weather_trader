# 工程状态快照（WeatherTrader）

更新时间：2026-03-01 00:55 +08:00

## 1. 当前重构阶段

后端先行，已完成执行入口收敛与关键链路统一：

- `ExecutionApplicationService` 成为统一交易应用层入口
- `OrdersService` 变为 API 薄适配层
- `StrategyService` 自动交易下单改走统一执行入口
- 已接入 `REAL` 双通道路由（gateway/direct）
- 已补 `cancel/list-open/list-events` 全路径

## 2. 统一执行与模式切换

- 统一接口：submit/cancel/list/listOpen/listEvents/quote/preview
- Paper/Real 共用：风控、状态机、账本、事件格式
- 唯一差异：真实下单通道

REAL 路由：

- `REAL_EXECUTION_ROUTE=gateway|direct`
- 健康查询：`GET /orders/execution-health`

## 3. 持久化状态

主路径：Postgres（可回退 JSON）

- Prisma 模型：`ExecOrder`, `ExecOrderEvent`, `ExecFill`, `ExecSettlement`, `ExecLedgerSnapshot`, `ExecEngineState`
- 恢复顺序：DB -> JSON
- 写入顺序：DB 主写（可选 JSON 镜像）

说明：当前实现为“事件+投影统一持久化”的可恢复版本，满足重启恢复 open order / ledger / lifecycle。

## 4. Paper 研究能力

`POST /backtest/weather-paper` 已支持双模型入口：

- `paperModel=deterministic_l2|stochastic_impact|both`
- `seed` 控制随机模型可复现
- 输出新增：
  - `modelVariant`
  - `variants`
  - `sensitivityDelta`

## 5. 已完成的关键 API

- `GET /orders`
- `GET /orders/open`
- `GET /orders/:orderId/events`
- `POST /orders`
- `POST /orders/:orderId/cancel`
- `GET /orders/execution-health`
- `POST /backtest/weather-paper`

## 6. 本轮验证结果

已实际通过：

- `npm run typecheck -w @weather-trader/core`
- `npm run typecheck -w @weather-trader/shared`
- `npm run typecheck -w @weather-trader/api`
- `npm run typecheck -w @weather-trader/web`
- `npm run test -w @weather-trader/api`
- `npm run build -w @weather-trader/api`

## 7. 当前剩余项（下一阶段）

- 把 `GET /orders/open` 升级为分页元数据结构（`items/page/pageSize/total`）并同步前端
- DB 写入策略从“全量重建”优化到“增量事件追加 + 投影更新”
- 已删除无引用 legacy 核心引擎目录 `packages/core/src/trading/*`，后续继续做 API/页面层死路由扫描
- 增加 REAL 双通道契约测试与重启恢复回放测试
