"use client";

import { useState } from "react";
import { Stepper } from "@/components/common/Stepper";

export function RiskForm() {
  const [positions, setPositions] = useState(3);

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border-dark bg-[#1c2128]">
        <h3 className="font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-warning">security</span>
          全局风控限额
        </h3>
      </div>

      <div className="p-6 flex flex-col gap-6 flex-1">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">每日最大止损 (USDC)</label>
          <div className="relative group">
            <span className="absolute left-3 top-2.5 text-text-muted">$</span>
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg pl-7 pr-3 py-2.5 focus:border-accent-warning focus:ring-1 focus:ring-accent-warning outline-none font-mono group-hover:border-text-muted transition-colors"
              type="number"
              defaultValue={1000}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">单笔最大头寸 (Max Position Size)</label>
          <div className="relative group">
            <span className="absolute left-3 top-2.5 text-text-muted font-mono">USDC</span>
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg pl-14 pr-3 py-2.5 focus:border-accent-warning focus:ring-1 focus:ring-accent-warning outline-none font-mono group-hover:border-text-muted transition-colors"
              type="number"
              defaultValue={5000}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">最大同时持仓数</label>
          <Stepper value={positions} onChange={setPositions} min={1} max={8} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-text-muted">滑点保护 (Slippage Protection)</label>
            <span className="text-xs text-accent-warning bg-accent-warning/10 px-2 py-0.5 rounded border border-accent-warning/20">
              Recommended: 50 bps
            </span>
          </div>
          <div className="relative group">
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:border-accent-warning focus:ring-1 focus:ring-accent-warning outline-none font-mono group-hover:border-text-muted transition-colors"
              type="number"
              defaultValue={50}
            />
            <span className="absolute right-3 top-2.5 text-text-muted font-mono text-xs pt-0.5">bps</span>
          </div>
        </div>
      </div>
    </div>
  );
}
