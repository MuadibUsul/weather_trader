"use client";

import { useQuery } from "@tanstack/react-query";
import { getHealthPanel } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

type Props = {
  range: "1D" | "7D" | "30D" | "ALL";
};

export function HealthPanel({ range }: Props) {
  const env = useUiStore((s) => s.environment);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health-panel", env, range],
    queryFn: () => getHealthPanel({ env, range }),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">策略健康加载中...</div>;
  }
  if (isError || !data) {
    return <div className="rounded-xl border border-accent-error/30 bg-accent-error/10 p-4 text-sm text-accent-error">策略健康加载失败</div>;
  }

  return (
    <section className="rounded-xl border border-border-dark bg-surface-dark p-4">
      <h3 className="text-white text-sm font-bold mb-3">策略健康状态</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">最近50信号胜率</div>
          <div className="text-xl text-white font-bold mt-1">{data.signalWinRate50.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">信号延迟 P95</div>
          <div className="text-xl text-white font-bold mt-1">{data.signalLatencyMsP95.toFixed(0)}ms</div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">平均滑点</div>
          <div className="text-xl text-white font-bold mt-1">{data.avgSlippageBps.toFixed(2)}bps</div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">拒单率</div>
          <div className="text-xl text-white font-bold mt-1">{data.orderRejectRate.toFixed(2)}%</div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">API 错误率</div>
          <div className="text-xl text-white font-bold mt-1">{data.apiErrorRate.toFixed(2)}%</div>
        </div>
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="text-xs text-text-muted">API 超时率</div>
          <div className="text-xl text-white font-bold mt-1">{data.apiTimeoutRate.toFixed(2)}%</div>
        </div>
      </div>
    </section>
  );
}
