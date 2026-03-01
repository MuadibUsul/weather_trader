"use client";

import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrders, getStrategy } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { Panel } from "@/components/common/Panel";

function gaugeOption(percent: number, color: string) {
  return {
    series: [
      {
        type: "pie",
        radius: ["70%", "90%"],
        silent: true,
        clockwise: false,
        label: { show: false },
        data: [
          { value: percent, itemStyle: { color } },
          { value: 100 - percent, itemStyle: { color: "#30363d" } },
        ],
      },
    ],
    backgroundColor: "transparent",
  };
}

export function RiskDashboard() {
  const environment = useUiStore((s) => s.environment);

  const { data, isLoading } = useQuery({
    queryKey: ["risk-dashboard", environment],
    queryFn: async () => {
      const [strategy, orders] = await Promise.all([
        getStrategy(),
        getOrders({ environment, status: "filled", limit: 200 }),
      ]);
      return { strategy, orders };
    },
    retry: 1,
    refetchInterval: 10000,
  });

  const metrics = useMemo(() => {
    if (!data) {
      return {
        positionUsagePct: 0,
        drawdownPct: 0,
        exposure: 0,
        maxPositionLimit: 1,
        maxDailyLoss: 1,
      };
    }

    const maxPositionLimit = Math.max(1, data.strategy.maxPositionSize * data.strategy.maxOpenPositions);
    const exposure = data.orders.reduce((sum, item) => sum + item.amount, 0);
    const positionUsagePct = Math.min(100, Number(((exposure / maxPositionLimit) * 100).toFixed(1)));

    const realizedLoss = Math.abs(
      data.orders
        .filter((item) => item.pnl < 0)
        .reduce((sum, item) => sum + item.pnl, 0),
    );
    const drawdownPct = Math.min(100, Number(((realizedLoss / Math.max(1, data.strategy.maxDailyLoss)) * 100).toFixed(1)));

    return {
      positionUsagePct,
      drawdownPct,
      exposure: Number(exposure.toFixed(2)),
      maxPositionLimit,
      maxDailyLoss: data.strategy.maxDailyLoss,
    };
  }, [data]);

  return (
    <Panel
      title="风控仪表盘"
      icon={<span className="material-symbols-outlined text-white text-[20px]">shield</span>}
      className="flex-1"
    >
      <div className="p-4 grid grid-cols-2 gap-4 items-center justify-items-center flex-1">
        <div className="flex flex-col items-center gap-2 relative">
          <div className="relative h-24 w-24">
            <ReactECharts option={gaugeOption(metrics.positionUsagePct, "#13ec5b")} style={{ height: 96, width: 96 }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{metrics.positionUsagePct}%</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted uppercase tracking-wide text-center">当日限额占用</span>
        </div>

        <div className="flex flex-col items-center gap-2 relative">
          <div className="relative h-24 w-24">
            <ReactECharts option={gaugeOption(metrics.drawdownPct, "#d29922")} style={{ height: 96, width: 96 }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{metrics.drawdownPct}%</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted uppercase tracking-wide text-center">最大回撤</span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="bg-black/40 rounded p-2 text-[10px] text-text-muted font-mono border border-border-dark">
          {isLoading ? (
            "Loading risk profile..."
          ) : (
            <>
              Exposure: {metrics.exposure} USDC
              <br />
              Max Position: {metrics.maxPositionLimit.toLocaleString()} USDC | Max Daily Loss: {metrics.maxDailyLoss.toLocaleString()} USDC
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
