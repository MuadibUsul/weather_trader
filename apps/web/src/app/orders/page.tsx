"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { cancelOrder, getExecutionHealth, getOpenOrders, getOrders, getPnlAttribution } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

function downloadCsv(rows: ReturnType<typeof normalizeForCsv>) {
  const header = "id,environment,strategyId,walletId,contractName,marketId,side,quantity,price,amount,fee,pnl,createdAt";
  const lines = rows.map((row) =>
    [
      row.id,
      row.environment,
      row.strategyId ?? "",
      row.walletId ?? "",
      row.contractName ?? "",
      row.marketId,
      row.side,
      row.quantity,
      row.price,
      row.amount,
      row.fee,
      row.pnl,
      row.createdAt,
    ].join(","),
  );
  const content = [header, ...lines].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeForCsv(
  rows: Array<{
    id: string;
    strategyId?: string;
    walletId?: string;
    contractName?: string;
    environment: "REAL" | "PAPER";
    marketId: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    amount: number;
    fee: number;
    pnl: number;
    createdAt: string;
  }>,
) {
  return rows;
}

function OrdersWorkspace() {
  const PAGE_SIZE = 10;
  const environment = useUiStore((s) => s.environment);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "filled" | "open" | "cancelled">("all");
  const [groupBy, setGroupBy] = useState<"strategy" | "city" | "date">("strategy");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [environment, statusFilter]);

  const query = useMemo(
    () => ({
      environment,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: PAGE_SIZE,
      page,
    }),
    [environment, statusFilter, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["orders", query],
    queryFn: () => getOrders(query),
    retry: 1,
  });

  const rows = data ?? [];
  const hasNextPage = rows.length === PAGE_SIZE;

  const { data: openOrders } = useQuery({
    queryKey: ["orders-open", environment],
    queryFn: () => getOpenOrders({ environment, limit: 200 }),
    retry: 1,
  });
  const { data: executionHealth } = useQuery({
    queryKey: ["orders-execution-health"],
    queryFn: () => getExecutionHealth(),
    retry: 1,
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId, { reason: "ui_manual_cancel" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["orders-open"] }),
      ]);
    },
  });

  const { data: attribution, isLoading: attributionLoading, isError: attributionError } = useQuery({
    queryKey: ["orders-attribution", environment, groupBy],
    queryFn: () =>
      getPnlAttribution({
        env: environment,
        range: "7D",
        group_by: groupBy,
      }),
    retry: 1,
  });

  return (
    <section className="h-full overflow-y-auto pb-4">
      <div className="w-full">
        <section className="flex flex-col min-h-[620px] bg-surface-dark rounded-xl border border-border-dark shadow-xl overflow-hidden">
          <div className="p-3 border-b border-border-dark bg-surface-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="pl-8 pr-4 h-8 bg-background-dark/50 border border-border-dark rounded-lg text-xs text-white appearance-none focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer [color-scheme:dark]"
                >
                  <option value="all" className="bg-surface-2 text-white">
                    Status: All
                  </option>
                  <option value="filled" className="bg-surface-2 text-white">
                    Filled
                  </option>
                  <option value="cancelled" className="bg-surface-2 text-white">
                    Cancelled
                  </option>
                  <option value="open" className="bg-surface-2 text-white">
                    Open
                  </option>
                </select>
                <span className="material-symbols-outlined absolute left-2 top-1.5 text-text-muted text-[16px]">filter_alt</span>
              </div>
            </div>

            <div className="text-xs text-text-muted">
              Open Orders: <span className="text-white font-bold">{openOrders?.length ?? 0}</span>
            </div>

            <div className="text-xs text-text-muted flex items-center gap-2">
              <span>Execution:</span>
              <span className={`font-bold ${executionHealth?.route.ready ? "text-primary" : "text-accent-warning"}`}>
                {executionHealth?.route.resolved ?? "unknown"}
              </span>
              <span className="text-text-muted/80">|</span>
              <span>
                Store: <span className="text-white">{executionHealth?.persistence.backend ?? "-"}</span>
              </span>
            </div>

            <button
              className="flex items-center gap-2 px-3 h-8 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-lg text-xs font-bold transition-all"
              onClick={() => downloadCsv(normalizeForCsv(rows))}
              disabled={rows.length === 0}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export CSV
            </button>
          </div>

          <OrdersTable
            filter={environment}
            rows={rows}
            isLoading={isLoading}
            onCancelOrder={(orderId) => cancelMutation.mutate(orderId)}
            cancelingOrderId={cancelMutation.isPending ? cancelMutation.variables ?? null : null}
          />

          <div className="p-3 border-t border-border-dark bg-surface-2 flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-7 px-2 rounded border border-border-dark disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/60"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <span>
                Page {page} · {PAGE_SIZE}/page
              </span>
              <button
                type="button"
                className="h-7 px-2 rounded border border-border-dark disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/60"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!hasNextPage}
              >
                Next
              </button>
            </div>
            <span>Source: /orders</span>
          </div>
        </section>

        <section className="mt-4 bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
          <div className="p-3 border-b border-border-dark bg-surface-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">PnL Attribution (7D)</h3>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              className="h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            >
              <option value="strategy">By Strategy</option>
              <option value="city">By City</option>
              <option value="date">By Date</option>
            </select>
          </div>
          {attributionLoading ? (
            <div className="p-4 text-xs text-text-muted">Loading attribution...</div>
          ) : attributionError ? (
            <div className="p-4 text-xs text-accent-error">Failed to load attribution</div>
          ) : !attribution || attribution.length === 0 ? (
            <div className="p-4 text-xs text-text-muted">No attribution data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border-dark">
                    <th className="px-4 py-2 text-left">Dimension</th>
                    <th className="px-4 py-2 text-right">PnL</th>
                    <th className="px-4 py-2 text-right">Win Rate</th>
                    <th className="px-4 py-2 text-right">Fees</th>
                    <th className="px-4 py-2 text-right">Slippage</th>
                    <th className="px-4 py-2 text-right">Reject Loss</th>
                    <th className="px-4 py-2 text-right">Fill Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.map((row) => (
                    <tr key={row.key} className="border-b border-border-dark/60">
                      <td className="px-4 py-2 text-white">{row.key}</td>
                      <td className={`px-4 py-2 text-right ${row.realizedPnl >= 0 ? "text-primary" : "text-accent-error"}`}>
                        {row.realizedPnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-white">{row.winRate.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-white">{row.fees.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-white">{row.slippageLoss.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-white">{row.rejectLoss.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-white">{row.fillRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export default function OrdersPage() {
  return (
    <PageTransition>
      <AppShell activeRoute="/orders" main={<OrdersWorkspace />} />
    </PageTransition>
  );
}
