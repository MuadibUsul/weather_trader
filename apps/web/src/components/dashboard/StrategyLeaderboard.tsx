"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestStrategyReal, getStrategyLeaderboard } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { Button } from "../common/Button";

type Props = {
  range: "1D" | "7D" | "30D" | "ALL";
};

type SortKey = "return7d" | "winRate" | "profitFactor" | "maxDrawdown";

export function StrategyLeaderboard({ range }: Props) {
  const env = useUiStore((s) => s.environment);
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortKey>("return7d");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["strategy-leaderboard", env, range],
    queryFn: () => getStrategyLeaderboard({ env, range }),
    refetchInterval: 10_000,
  });

  const requestMutation = useMutation({
    mutationFn: (strategyId: string) => requestStrategyReal(strategyId, { reason: "paper绩效达标，申请REAL上线" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["strategy-leaderboard"] });
      await queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => {
      if (sortBy === "maxDrawdown") return a.maxDrawdown - b.maxDrawdown;
      return b[sortBy] - a[sortBy];
    });
    return list;
  }, [data, sortBy]);

  if (isLoading) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">策略排行榜加载中...</div>;
  }
  if (isError) {
    return <div className="rounded-xl border border-accent-error/30 bg-accent-error/10 p-4 text-sm text-accent-error">策略排行榜加载失败</div>;
  }
  if (!rows.length) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">暂无策略数据</div>;
  }

  return (
    <section className="rounded-xl border border-border-dark bg-surface-dark p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-bold">策略表现排行榜</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">排序</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-8 rounded-md border border-border-dark bg-background-dark px-2 text-white"
          >
            <option value="return7d">7日收益</option>
            <option value="winRate">胜率</option>
            <option value="profitFactor">盈亏比</option>
            <option value="maxDrawdown">最大回撤</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted border-b border-border-dark">
              <th className="py-2 text-left">策略</th>
              <th className="py-2 text-left">状态</th>
              <th className="py-2 text-right">7日收益</th>
              <th className="py-2 text-right">胜率</th>
              <th className="py-2 text-right">盈亏比</th>
              <th className="py-2 text-right">回撤</th>
              <th className="py-2 text-right">资金占用</th>
              <th className="py-2 text-right">等级</th>
              <th className="py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.strategyId} className="border-b border-border-dark/70">
                <td className="py-2 text-white">{row.strategyName}</td>
                <td className="py-2 text-text-muted">{row.status}</td>
                <td className={`py-2 text-right ${row.return7d >= 0 ? "text-primary" : "text-accent-error"}`}>{row.return7d.toFixed(2)}</td>
                <td className="py-2 text-right text-white">{row.winRate.toFixed(1)}%</td>
                <td className="py-2 text-right text-white">{Number.isFinite(row.profitFactor) ? row.profitFactor.toFixed(2) : "∞"}</td>
                <td className="py-2 text-right text-white">{row.maxDrawdown.toFixed(2)}%</td>
                <td className="py-2 text-right text-white">{row.capitalUsage.toFixed(2)}</td>
                <td className={`py-2 text-right ${row.grade === "A" ? "text-primary" : row.grade === "B" ? "text-accent-warning" : "text-text-muted"}`}>
                  {row.grade}
                </td>
                <td className="py-2 text-right">
                  {row.canRequestReal ? (
                    <Button
                      size="sm"
                      onClick={() => requestMutation.mutate(row.strategyId)}
                      disabled={requestMutation.isPending}
                    >
                      申请REAL运行
                    </Button>
                  ) : (
                    <span className="text-xs text-text-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
