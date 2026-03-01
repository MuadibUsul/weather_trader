"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

type Props = {
  range: "1D" | "7D" | "30D" | "ALL";
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

export function DashboardSummary({ range }: Props) {
  const env = useUiStore((s) => s.environment);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-summary", env, range],
    queryFn: () => getDashboardSummary({ env, range }),
    refetchInterval: 10_000,
    retry: 1,
  });

  if (isLoading) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">资金仪表加载中...</div>;
  }
  if (isError || !data) {
    return <div className="rounded-xl border border-accent-error/30 bg-accent-error/10 p-4 text-sm text-accent-error">资金仪表加载失败</div>;
  }

  return (
    <section className="rounded-xl border border-border-dark bg-surface-dark p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-sm font-bold">资金增长仪表</h3>
        <div
          className={`text-xs px-2 py-1 rounded-full border ${
            data.riskStatus === "danger"
              ? "border-accent-error text-accent-error"
              : data.riskStatus === "watch"
                ? "border-accent-warning text-accent-warning"
                : "border-primary text-primary"
          }`}
        >
          风险: {data.riskStatus === "danger" ? "高" : data.riskStatus === "watch" ? "中" : "低"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">总资金</div>
          <div className="text-xl text-white font-bold mt-1">{formatMoney(data.totalEquity)}</div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">可用资金</div>
          <div className="text-xl text-white font-bold mt-1">{formatMoney(data.availableCash)}</div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">在场资金</div>
          <div className="text-xl text-white font-bold mt-1">{formatMoney(data.deployedCapital)}</div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">7日收益</div>
          <div className={`text-xl font-bold mt-1 ${data.pnl7d >= 0 ? "text-primary" : "text-accent-error"}`}>
            {data.pnl7d >= 0 ? "+" : ""}
            {formatMoney(data.pnl7d)}
          </div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">Sharpe / 胜率 / 盈亏比</div>
          <div className="text-sm text-white font-mono mt-2">
            {data.sharpe.toFixed(2)} / {data.winRate.toFixed(1)}% /{" "}
            {Number.isFinite(data.profitFactor) ? data.profitFactor.toFixed(2) : "∞"}
          </div>
          <div className="text-xs text-text-muted mt-1">最大回撤 {data.maxDrawdown.toFixed(2)}%</div>
        </div>
      </div>
    </section>
  );
}
