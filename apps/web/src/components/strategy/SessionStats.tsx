"use client";

import type { StrategyRuntimeStatusDto } from "@weather-trader/shared";
import { MARKET_TITLE_MAP } from "@/lib/market-catalog";

const SIDE_LABEL: Record<"buy" | "sell", string> = {
  buy: "买入",
  sell: "卖出",
};

const REASON_LABEL: Record<string, string> = {
  trend_up_breakout: "趋势突破(向上)",
  trend_down_breakout: "趋势突破(向下)",
  mean_reversion_overheat: "均值回归(过热)",
  mean_reversion_oversold: "均值回归(超跌)",
};

const ERROR_LABEL: Record<string, string> = {
  daily_loss_limit_reached: "达到当日亏损上限",
  max_position_exceeded: "超出单市场仓位上限",
  max_notional_exceeded: "超出单笔名义价值上限",
  max_drawdown_exceeded: "超过最大回撤限制",
  insufficient_balance: "可用余额不足",
  insufficient_liquidity: "流动性不足",
  price_not_reached_or_no_liquidity: "价格未触达或流动性不足",
  auto_trade_not_enabled: "自动交易未开启",
  risk_rejected: "风控拒绝下单",
  strategy_cycle_error: "策略循环执行异常",
};

const ENV_LABEL: Record<"REAL" | "PAPER", string> = {
  REAL: "REAL",
  PAPER: "PAPER",
};

function formatDuration(startedAt: string | null, running: boolean, stoppedAt: string | null): string {
  if (!startedAt) {
    return "00:00:00";
  }

  const startMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) {
    return "00:00:00";
  }

  const endMs = running || !stoppedAt ? Date.now() : new Date(stoppedAt).getTime();
  const diff = Math.max(0, endMs - startMs);
  const sec = Math.floor(diff / 1000);
  const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function humanizeError(raw: string): string {
  const [code, detail] = raw.split(":", 2);
  const base = ERROR_LABEL[code] ?? code.replaceAll("_", " ");
  return detail ? `${base} (${detail})` : base;
}

function formatLastSignal(runtime: StrategyRuntimeStatusDto | undefined): string | null {
  const signal = runtime?.lastSignal;
  if (!signal) {
    return null;
  }

  const market = MARKET_TITLE_MAP[signal.marketId] ?? signal.marketId;
  const side = SIDE_LABEL[signal.side] ?? signal.side.toUpperCase();
  const reason = REASON_LABEL[signal.reason] ?? signal.reason.replaceAll("_", " ");
  return `${market} / ${side} / ${reason}`;
}

export function SessionStats({
  runtime,
  isLoading,
}: {
  runtime: StrategyRuntimeStatusDto | undefined;
  isLoading?: boolean;
}) {
  const stats = [
    ["运行状态", runtime?.running ? "运行中" : "已停止", runtime?.running ? "text-primary" : "text-text-main"],
    ["触发信号数", String(runtime?.signals ?? 0), "text-white"],
    [
      "自动交易累计 PnL",
      `${(runtime?.sessionPnl ?? 0) >= 0 ? "+" : ""}${(runtime?.sessionPnl ?? 0).toFixed(2)}`,
      (runtime?.sessionPnl ?? 0) >= 0 ? "text-primary" : "text-accent-error",
    ],
    ["运行时长", formatDuration(runtime?.startedAt ?? null, Boolean(runtime?.running), runtime?.stoppedAt ?? null), "text-white"],
  ] as const;

  const lastSignal = formatLastSignal(runtime);
  const lastError = runtime?.lastError ? humanizeError(runtime.lastError) : null;

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-5 mt-auto">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary">monitoring</span>
        <h3 className="text-sm font-bold text-white">策略执行统计 (Session Stats)</h3>
      </div>
      {isLoading ? (
        <div className="text-xs text-text-muted">运行状态加载中...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(([label, value, tone]) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
                <div className={`text-2xl font-mono font-bold ${tone}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-text-muted flex flex-wrap items-center gap-4">
            <span>Tick: {runtime?.ticks ?? 0}</span>
            <span>已执行订单: {runtime?.executedOrders ?? 0}</span>
            <span>拒绝订单: {runtime?.rejectedOrders ?? 0}</span>
            <span>环境: {(runtime?.environment && ENV_LABEL[runtime.environment]) ?? "--"}</span>
            {lastSignal ? <span>最近信号: {lastSignal}</span> : null}
            {lastError ? <span className="text-accent-warning">最近错误: {lastError}</span> : null}
          </div>
        </>
      )}
    </div>
  );
}
