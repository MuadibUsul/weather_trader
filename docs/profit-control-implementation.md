# Step0 工程扫描与三阶段计划

## 当前工程扫描结论

- Monorepo:
  - `apps/web`: Next.js 14 + React Query + Zustand + Tailwind + ECharts + Playwright
  - `apps/api`: NestJS + Prisma + WebSocket + Vitest
  - `packages/core`: 执行/风控/账本引擎
  - `packages/shared`: 前后端 DTO
- 现状：
  - 策略→下单→订单→账本链路已存在，但主要落地在 `runtime/*.json`。
  - 缺少策略晋级审批、分配器、盈利归因、统一聚合 API、策略生命周期状态机。
  - 缺少完整的 env 级审批 guardrail（尤其 REAL 准入）。

## Phase 1（数据模型 + 聚合 API）

产出：
- Prisma 新增策略域/信号/成交/PnL/风险/审批/分配/暴露模型。
- `ControlStore` 统一数据源（可持久化到 `runtime/control-store.json`）。
- `/api/dashboard/*`、`/api/market_scan`、`/api/analytics/pnl_attribution`。
- `docs/metrics.md` 指标口径落地。

风险点与解决：
- 风险：本地无 DB 时无法依赖 Prisma 实时写入。
- 方案：短期采用 `ControlStore` 作为运行时主写入，同时保留 Prisma 迁移脚本，后续切换 repository 即可。

## Phase 2（新控制台 UI + 三态 + 降级）

产出：
- Dashboard 五区块组件化：资金仪表、曲线、排行榜、风险结构、健康、TopSignals。
- 统一 loading/empty/error 三态。
- `/orders` 增加盈利归因区块，`/markets` 增加偏离扫描区块。

风险点与解决：
- 风险：接口失败导致白屏。
- 方案：每个区块本地化错误边界与降级提示，不阻塞其他区块渲染。

## Phase 3（晋级审批 + 分配器 + REAL Guardrail）

产出：
- 策略状态机：`dev -> paper_testing -> eligible -> real_requested -> real_approved -> real_small -> real_scaled -> frozen`
- 审批接口与审批记录。
- Dynamic Allocator（规则版）定时调仓。
- REAL 环境切换与自动交易硬校验（无审批/无钱包/无凭据直接阻断）。

风险点与解决：
- 风险：PnL口径与回填口径不一致。
- 方案：统一以 `fills + pnl_snapshots` 为真源，订单页新增归因与一致性核对接口。
