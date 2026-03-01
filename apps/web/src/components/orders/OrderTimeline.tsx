"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrderLifecycleEvents, type OrderLifecycleEvent } from "@/lib/api";

function toClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(
    date.getSeconds(),
  ).padStart(2, "0")}.${ms}`;
}

function eventTone(type: string): "primary" | "secondary" | "muted" | "error" {
  if (type === "OrderFilled") {
    return "primary";
  }
  if (type === "OrderRejected" || type === "OrderCanceled") {
    return "error";
  }
  if (type === "OrderPartiallyFilled" || type === "OrderAccepted") {
    return "secondary";
  }
  return "muted";
}

function eventTitle(type: string): string {
  switch (type) {
    case "OrderRequested":
      return "订单请求创建";
    case "OrderAccepted":
      return "风控通过并接单";
    case "OrderPartiallyFilled":
      return "订单部分成交";
    case "OrderFilled":
      return "订单完全成交";
    case "OrderCanceled":
      return "订单取消";
    case "OrderRejected":
      return "订单拒绝";
    default:
      return type;
  }
}

function describe(event: OrderLifecycleEvent) {
  if (event.detail && event.detail.trim().length > 0) {
    return event.detail;
  }
  if (event.fill) {
    return `price=${event.fill.price.toFixed(4)} qty=${event.fill.quantity.toFixed(4)} fee=${event.fill.fee.toFixed(4)}`;
  }
  if (event.reason) {
    return event.reason;
  }
  return "No detail";
}

export function OrderTimeline({ orderId, environment }: { orderId: string; environment: "REAL" | "PAPER" }) {
  const query = useQuery({
    queryKey: ["order-lifecycle", orderId],
    queryFn: () => getOrderLifecycleEvents(orderId, 50),
  });

  const items = useMemo(() => query.data ?? [], [query.data]);

  return (
    <div className="p-6 border-l-2 border-primary ml-6 my-2 relative">
      <h4 className="text-xs font-bold text-text-muted uppercase mb-4 tracking-wider flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
        生命周期日志 ({environment})
      </h4>
      {query.isLoading ? <div className="text-xs text-text-muted">Loading lifecycle events...</div> : null}
      {query.isError ? <div className="text-xs text-accent-error">Failed to load lifecycle events.</div> : null}
      {!query.isLoading && !query.isError && items.length === 0 ? (
        <div className="text-xs text-text-muted">No lifecycle events recorded for this order.</div>
      ) : null}
      {!query.isLoading && !query.isError && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item, idx) => {
            const tone = eventTone(item.type);
            return (
              <div key={item.eventId} className="flex items-start gap-4 text-xs">
                <div className="min-w-[96px] text-text-muted font-mono">{toClock(item.at)}</div>
                <div className="w-6 flex justify-center pt-0.5 relative">
                  {idx < items.length - 1 ? <div className="absolute top-2 bottom-[-16px] w-px bg-border-dark" /> : null}
                  <div
                    className={`h-2 w-2 rounded-full ${
                      tone === "primary"
                        ? "bg-primary ring-4 ring-primary/20"
                        : tone === "secondary"
                          ? "bg-secondary"
                          : tone === "error"
                            ? "bg-accent-error ring-4 ring-accent-error/20"
                            : "bg-border-dark"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <span className={tone === "primary" ? "text-white font-bold" : "text-text-main"}>
                    {eventTitle(item.type)}
                  </span>
                  <div className="text-text-muted mt-1">{describe(item)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
