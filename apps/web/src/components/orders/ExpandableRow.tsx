"use client";

import { useState } from "react";
import { OrderTimeline } from "./OrderTimeline";

export type OrderRow = {
  id: string;
  rawId: string;
  env: "REAL" | "PAPER";
  strategy: string;
  wallet: string;
  contract: string;
  side: "buy" | "sell";
  qty: number;
  avg: number;
  amount: number;
  fee: number;
  pnl: number;
  status: "filled" | "open" | "cancelled";
  time: string;
};

function formatMoney(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

export function ExpandableRow({
  row,
  defaultOpen = false,
  onCancelOrder,
  canceling,
}: {
  row: OrderRow;
  defaultOpen?: boolean;
  onCancelOrder?: (orderId: string) => void;
  canceling?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <tr
        className={`hover:bg-white/5 transition-colors cursor-pointer group ${open ? "bg-white/5" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 py-2.5 text-white" title={row.rawId}>
          <span className="block truncate">{row.id}</span>
        </td>
        <td className="px-3 py-2.5">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              row.env === "REAL"
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-secondary/20 text-text-muted border-secondary/30"
            }`}
          >
            {row.env}
          </span>
        </td>
        <td className="px-3 py-2.5 text-white" title={row.strategy}>
          <span className="block truncate">{row.strategy}</span>
        </td>
        <td className="px-3 py-2.5 text-white" title={row.wallet}>
          <span className="block truncate">{row.wallet}</span>
        </td>
        <td className="px-3 py-2.5 text-white" title={row.contract}>
          <span className="block truncate">{row.contract}</span>
        </td>
        <td className="px-3 py-2.5 text-center">
          <span className={row.side === "buy" ? "text-primary font-bold" : "text-accent-error font-bold"}>
            {row.side === "buy" ? "\u4E70\u5165" : "\u5356\u51FA"}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right text-white whitespace-nowrap">{row.qty.toLocaleString()}</td>
        <td className="px-3 py-2.5 text-right text-white font-mono whitespace-nowrap">{row.avg.toFixed(2)}</td>
        <td className="px-3 py-2.5 text-right text-text-muted font-mono whitespace-nowrap">{formatMoney(row.amount)}</td>
        <td className="px-3 py-2.5 text-right text-text-muted font-mono whitespace-nowrap">{formatMoney(row.fee)}</td>
        <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${row.pnl >= 0 ? "text-primary" : "text-accent-error"}`}>
          {formatMoney(row.pnl)}
        </td>
        <td className="px-3 py-2.5 text-right text-text-muted font-mono whitespace-nowrap">{row.time}</td>
        <td className="px-3 py-2.5 text-right">
          <span
            className={`material-symbols-outlined text-text-muted group-hover:text-white transition-colors ${
              open ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </td>
      </tr>
      {open ? (
        <tr className="bg-[#0f1216]">
          <td className="p-0" colSpan={13}>
            <div className="px-6 pt-4 flex items-center justify-between">
              <div className="text-[11px] text-text-muted">Order Status: {row.status.toUpperCase()}</div>
              {row.status === "open" && onCancelOrder ? (
                <button
                  type="button"
                  className="h-7 px-3 rounded border border-accent-error/50 text-accent-error text-[11px] font-bold hover:bg-accent-error/10 disabled:opacity-50"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCancelOrder(row.rawId);
                  }}
                  disabled={Boolean(canceling)}
                >
                  {canceling ? "Cancelling..." : "Cancel Order"}
                </button>
              ) : null}
            </div>
            <OrderTimeline orderId={row.rawId} environment={row.env} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
