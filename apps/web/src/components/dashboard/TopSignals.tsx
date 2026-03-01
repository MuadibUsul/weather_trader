"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createOrder, getTopSignals } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { Button } from "../common/Button";

export function TopSignals() {
  const env = useUiStore((s) => s.environment);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["top-signals", env],
    queryFn: () => getTopSignals({ env, limit: 10 }),
    refetchInterval: 8_000,
  });

  const orderMutation = useMutation({
    mutationFn: (payload: { marketId: string; side: "buy" | "sell"; quantity: number; price: number; strategyId: string }) =>
      createOrder({
        marketId: payload.marketId,
        side: payload.side,
        quantity: payload.quantity,
        price: payload.price,
        environment: env,
        strategyId: payload.strategyId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["top-signals"] }),
      ]);
    },
  });

  if (isLoading) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">推荐信号加载中...</div>;
  }
  if (isError || !data) {
    return <div className="rounded-xl border border-accent-error/30 bg-accent-error/10 p-4 text-sm text-accent-error">推荐信号加载失败</div>;
  }
  if (data.length === 0) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">暂无可执行信号</div>;
  }

  return (
    <section className="rounded-xl border border-border-dark bg-surface-dark p-4">
      <h3 className="text-white text-sm font-bold mb-3">当前最佳信号 Top10</h3>
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {data.map((item) => {
          const side = item.side === "long" ? "buy" : "sell";
          return (
            <div key={item.signalId} className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white font-semibold truncate">{item.marketId}</div>
                  <div className="text-xs text-text-muted mt-1">
                    edge {item.edge.toFixed(4)} / conf {item.confidence.toFixed(2)} / liquidity {item.liquidityScore.toFixed(1)}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    orderMutation.mutate({
                      marketId: item.marketId,
                      side,
                      quantity: item.recommendedSize,
                      price: item.marketProb,
                      strategyId: item.strategyId,
                    })
                  }
                  disabled={orderMutation.isPending}
                >
                  一键下单
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
