"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useQuery } from "@tanstack/react-query";
import { getEquityCurve } from "@/lib/api";

type Props = {
  range: "1D" | "7D" | "30D" | "ALL";
};

export function EquityChart({ range }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["equity-curve", range],
    queryFn: () => getEquityCurve({ range, compare: "real" }),
    refetchInterval: 10_000,
    retry: 1,
  });

  const option = useMemo(() => {
    const rows = data ?? [];
    return {
      grid: { left: 32, right: 16, top: 16, bottom: 24 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: rows.map((item) => item.ts.slice(5, 16)),
        axisLabel: { color: "#8b949e", fontSize: 10 },
        axisLine: { lineStyle: { color: "#30363d" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#8b949e", fontSize: 10 },
        splitLine: { lineStyle: { color: "#21262d" } },
      },
      series: [
        {
          name: "PAPER",
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: { color: "#58a6ff", width: 2 },
          data: rows.map((item) => item.paperEquity ?? null),
        },
        {
          name: "REAL",
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: { color: "#13ec5b", width: 2 },
          data: rows.map((item) => item.realEquity ?? null),
        },
      ],
    };
  }, [data]);

  if (isLoading) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">资金曲线加载中...</div>;
  }
  if (isError) {
    return <div className="rounded-xl border border-accent-error/30 bg-accent-error/10 p-4 text-sm text-accent-error">资金曲线加载失败</div>;
  }
  if (!data || data.length === 0) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">暂无资金曲线数据</div>;
  }

  return (
    <section className="rounded-xl border border-border-dark bg-surface-dark p-4">
      <h3 className="text-white text-sm font-bold mb-2">资金曲线 (Paper vs Real)</h3>
      <ReactECharts option={option} style={{ height: 220 }} notMerge lazyUpdate />
    </section>
  );
}
