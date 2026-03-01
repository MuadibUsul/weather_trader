# Metrics 口径定义（WeatherTrader PRO V3）

## 1. 资金口径

- `Equity = 初始资金 + realized_pnl + unrealized_pnl - fees`
- 初始资金按环境区分：
  - `PAPER_INITIAL_CAPITAL`（默认 `100000`）
  - `REAL_INITIAL_CAPITAL`（默认 `5000`）

## 2. 收益与风险

- `WinRate`：以“已关闭交易（pnl已结算）”为单位，`盈利笔数 / 总笔数`
- `ProfitFactor`：`盈利总额 / 亏损总额绝对值`
- `MaxDrawdown`：
  - 全量窗口：全部资金点序列
  - 7D 窗口：过去 7 天资金点
  - 30D 窗口：过去 30 天资金点
- `Sharpe`：
  - 收益频率：按快照序列逐点收益率
  - 无风险收益：默认 `0`（可扩展）
  - 年化系数：`sqrt(365)`

## 3. 环境隔离

- 所有指标按 `env` 维度独立计算（`PAPER` 与 `REAL` 不混算）。
- Dashboard 查询必须显式传 `env`。

## 4. 实现位置

- 公式实现：`apps/api/src/modules/analytics/metrics.ts`
- 聚合实现：`apps/api/src/modules/control/control.dashboard.service.ts`

## 5. 校验与测试

- 公式测试：`apps/api/src/modules/analytics/metrics.spec.ts`
- 状态机/隔离相关测试：
  - `apps/api/src/modules/control/control.governance.spec.ts`
  - `apps/api/src/modules/system/system.service.spec.ts`
