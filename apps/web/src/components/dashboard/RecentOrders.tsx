"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrders } from "@/lib/api";
import { Panel } from "@/components/common/Panel";

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function RecentOrders() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders", { limit: 5 }],
    queryFn: () => getOrders({ limit: 5 }),
    retry: 1,
  });

  const orders = data ?? [];

  return (
    <Panel title="最近订单" className="h-full" headerClassName="px-4 py-2">
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <tbody className="text-xs font-mono">
            {isLoading ? (
              <tr>
                <td className="p-3 text-text-muted" colSpan={5}>
                  加载中...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td className="p-3 text-text-muted" colSpan={5}>
                  暂无订单
                </td>
              </tr>
            ) : (
              orders.map((item) => (
                <tr key={item.id} className="border-b border-border-dark/50">
                  <td className={`p-2 ${item.side === "buy" ? "text-primary" : "text-accent-error"}`}>
                    {item.side === "buy" ? "BUY" : "SELL"}
                  </td>
                  <td className="p-2 text-white">{item.marketId}</td>
                  <td className="p-2 text-right">{item.quantity} qty</td>
                  <td className="p-2 text-right">@{item.price.toFixed(2)}</td>
                  <td className="p-2 text-right text-text-muted">{formatTime(item.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
