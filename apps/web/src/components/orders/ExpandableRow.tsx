"use client";

import { useState } from "react";
import { OrderTimeline } from "./OrderTimeline";

type Row = {
  id: string;
  env: "REAL" | "PAPER";
  contract: string;
  side: "买入" | "卖出";
  qty: number;
  avg: number;
  amount: string;
  fee: string;
  pnl: string;
  time: string;
};

export function ExpandableRow({ row, defaultOpen = false }: { row: Row; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <tr
        className={`hover:bg-white/5 transition-colors cursor-pointer group ${open ? "bg-white/5" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-6 py-4 text-white">{row.id}</td>
        <td className="px-6 py-4">
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
        <td className="px-6 py-4 text-white">{row.contract}</td>
        <td className="px-6 py-4 text-center">
          <span className={row.side === "买入" ? "text-primary font-bold" : "text-accent-error font-bold"}>{row.side}</span>
        </td>
        <td className="px-6 py-4 text-right text-white">{row.qty}</td>
        <td className="px-6 py-4 text-right text-white">{row.avg}</td>
        <td className="px-6 py-4 text-right text-text-muted">{row.amount}</td>
        <td className="px-6 py-4 text-right text-text-muted">{row.fee}</td>
        <td className={`px-6 py-4 text-right ${row.pnl.startsWith("+") ? "text-primary" : "text-accent-error"}`}>
          {row.pnl}
        </td>
        <td className="px-6 py-4 text-right text-text-muted">{row.time}</td>
        <td className="px-6 py-4 text-right">
          <span className={`material-symbols-outlined text-text-muted group-hover:text-white transition-colors ${open ? "rotate-180" : ""}`}>
            expand_more
          </span>
        </td>
      </tr>
      {open ? (
        <tr className="bg-[#0f1216]">
          <td className="p-0" colSpan={11}>
            <OrderTimeline />
          </td>
        </tr>
      ) : null}
    </>
  );
}
