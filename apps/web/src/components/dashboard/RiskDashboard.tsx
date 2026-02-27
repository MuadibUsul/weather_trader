"use client";

import ReactECharts from "echarts-for-react";
import { Panel } from "@/components/common/Panel";

function gaugeOption(percent: number, color: string) {
  return {
    series: [
      {
        type: "pie",
        radius: ["70%", "90%"],
        silent: true,
        clockwise: false,
        label: { show: false },
        data: [
          { value: percent, itemStyle: { color } },
          { value: 100 - percent, itemStyle: { color: "#30363d" } },
        ],
      },
    ],
    backgroundColor: "transparent",
  };
}

export function RiskDashboard() {
  return (
    <Panel
      title="风控仪表盘"
      icon={<span className="material-symbols-outlined text-white text-[20px]">shield</span>}
      className="flex-1"
    >
      <div className="p-4 grid grid-cols-2 gap-4 items-center justify-items-center flex-1">
        <div className="flex flex-col items-center gap-2 relative">
          <div className="relative h-24 w-24">
            <ReactECharts option={gaugeOption(45, "#13ec5b")} style={{ height: 96, width: 96 }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">45%</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted uppercase tracking-wide text-center">当日限额占用</span>
        </div>

        <div className="flex flex-col items-center gap-2 relative">
          <div className="relative h-24 w-24">
            <ReactECharts option={gaugeOption(12, "#d29922")} style={{ height: 96, width: 96 }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">12%</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted uppercase tracking-wide text-center">最大回撤</span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="bg-black/40 rounded p-2 text-[10px] text-text-muted font-mono border border-border-dark">
          Max Position: 10,000 USDC
          <br />
          Stop Loss: AUTO-ON
        </div>
      </div>
    </Panel>
  );
}
