"use client";

import { useState } from "react";
import { Panel } from "@/components/common/Panel";
import { Button } from "@/components/common/Button";

export function QuickTradePanel() {
  const [side, setSide] = useState<"buy" | "sell">("buy");

  return (
    <Panel
      title="快速交易"
      icon={<span className="material-symbols-outlined text-white text-[20px]">flash_on</span>}
      className="shadow-lg"
    >
      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 bg-black rounded-lg p-1 border border-border-dark">
          <button
            className={`py-1.5 text-sm font-bold rounded ${
              side === "buy" ? "bg-primary text-surface-dark shadow-sm" : "text-text-muted hover:text-white"
            }`}
            onClick={() => setSide("buy")}
          >
            买入 (Long)
          </button>
          <button
            className={`py-1.5 text-sm font-bold rounded ${
              side === "sell" ? "bg-primary text-surface-dark shadow-sm" : "text-text-muted hover:text-white"
            }`}
            onClick={() => setSide("sell")}
          >
            卖出 (Short)
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-muted font-medium">标的资产</label>
          <div className="relative">
            <select className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none">
              <option>NYC &gt; 85°F (Aug 24)</option>
              <option>NYC 75-85°F (Aug 24)</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-2.5 pointer-events-none text-text-muted text-[20px]">
              expand_more
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium">限价 (Odds)</label>
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              type="number"
              defaultValue="0.65"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium">数量 (USDC)</label>
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              placeholder="0.00"
              type="number"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <span className="px-2 py-1 rounded bg-border-dark text-[10px] text-text-muted font-mono">LIMIT</span>
          <span className="px-2 py-1 rounded bg-border-dark text-[10px] text-text-muted font-mono">GTC</span>
        </div>

        <div className="h-px bg-border-dark my-1" />

        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">风控前置检查</span>
          <span className="text-primary font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            通过
          </span>
        </div>

        <Button fullWidth className="py-3 group">
          <span>REAL: 确认下单</span>
          <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </Button>
      </div>
    </Panel>
  );
}
