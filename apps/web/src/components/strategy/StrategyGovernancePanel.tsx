"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveStrategyReal, listStrategies, listStrategyApprovals, rejectStrategyReal, requestStrategyReal } from "@/lib/api";
import { Button } from "../common/Button";

export function StrategyGovernancePanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["strategies"],
    queryFn: listStrategies,
    refetchInterval: 10_000,
    retry: 1,
  });
  const [selectedId, setSelectedId] = useState<string>("");

  const selected = useMemo(() => data?.find((item) => item.id === selectedId) ?? data?.[0], [data, selectedId]);
  const { data: approvals } = useQuery({
    queryKey: ["strategy-approvals", selected?.id],
    queryFn: () => (selected ? listStrategyApprovals(selected.id) : Promise.resolve([])),
    enabled: Boolean(selected?.id),
    retry: 1,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["strategies"] });
    await queryClient.invalidateQueries({ queryKey: ["strategy-leaderboard"] });
    await queryClient.invalidateQueries({ queryKey: ["env-status"] });
  };

  const requestMutation = useMutation({
    mutationFn: (strategyId: string) => requestStrategyReal(strategyId, { reason: "paper绩效达标申请real" }),
    onSuccess: refresh,
  });

  const approveMutation = useMutation({
    mutationFn: (strategyId: string) =>
      approveStrategyReal(strategyId, {
        riskLimits: {
          maxDailyLoss: 1000,
          maxPositionSize: 5000,
          maxOpenPositions: 3,
          maxSlippageBps: 80,
        },
        initialAllocationPct: 10,
      }),
    onSuccess: refresh,
  });

  const rejectMutation = useMutation({
    mutationFn: (strategyId: string) => rejectStrategyReal(strategyId, { reason: "risk review reject" }),
    onSuccess: refresh,
  });

  if (isLoading) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-xs text-text-muted">审批信息加载中...</div>;
  }
  if (isError || !data) {
    return <div className="rounded-xl border border-accent-error/30 bg-accent-error/10 p-4 text-xs text-accent-error">审批信息加载失败</div>;
  }
  if (data.length === 0) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-xs text-text-muted">暂无策略</div>;
  }

  return (
    <div className="rounded-xl border border-border-dark bg-surface-dark p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Paper→Real 晋级审批</h3>
        <select
          className="h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
          value={selected?.id}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {data.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="rounded border border-border-dark bg-background-dark p-2">
              <div className="text-text-muted">状态</div>
              <div className="text-white font-semibold mt-1">{selected.status}</div>
            </div>
            <div className="rounded border border-border-dark bg-background-dark p-2">
              <div className="text-text-muted">版本</div>
              <div className="text-white font-semibold mt-1">v{selected.version}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => requestMutation.mutate(selected.id)} disabled={requestMutation.isPending}>
              申请REAL
            </Button>
            <Button size="sm" variant="secondary" onClick={() => approveMutation.mutate(selected.id)} disabled={approveMutation.isPending}>
              审批通过
            </Button>
            <Button size="sm" variant="ghost" onClick={() => rejectMutation.mutate(selected.id)} disabled={rejectMutation.isPending}>
              驳回
            </Button>
          </div>

          <div className="mt-3 rounded border border-border-dark bg-background-dark p-2">
            <div className="text-xs text-text-muted mb-2">审批历史</div>
            {!approvals || approvals.length === 0 ? (
              <div className="text-xs text-text-muted">暂无审批记录</div>
            ) : (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {approvals.map((row) => (
                  <div key={row.id} className="text-xs flex items-center justify-between">
                    <span className="text-white">{row.status}</span>
                    <span className="text-text-muted">{new Date(row.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
