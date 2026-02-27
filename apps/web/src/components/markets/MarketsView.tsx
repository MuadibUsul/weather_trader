"use client";

import { useQuery } from "@tanstack/react-query";
import { getMarkets, Market } from "@/lib/api";
import { StatsCard } from "./StatsCard";
import { MarketGrid } from "./MarketGrid";

const fallbackMarkets: Market[] = [
  { id: "NYC_GT_85", title: "NYC > 85°F", location: "New York", odds: 0.65, change24h: 12.5, oi: 452190, live: true },
  { id: "NYC_75_85", title: "NYC 75-85°F", location: "New York", odds: 0.32, change24h: -5.2, oi: 128400, live: false },
  { id: "NYC_LT_75", title: "NYC < 75°F", location: "New York", odds: 0.03, change24h: 0, oi: 12050, live: false },
  { id: "CHI_GT_80", title: "CHI > 80°F", location: "Chicago", odds: 0.48, change24h: 2.1, oi: 88200, live: false },
  { id: "LA_GT_90", title: "LA > 90°F", location: "Los Angeles", odds: 0.12, change24h: -8.4, oi: 32100, live: false },
  { id: "LND_LT_15", title: "LND < 15°C", location: "London", odds: 0.55, change24h: 1.2, oi: 65300, live: false },
];

export function MarketsView() {
  const { data } = useQuery({ queryKey: ["markets"], queryFn: getMarkets, retry: 1 });
  const markets = data?.length ? data : fallbackMarkets;

  return (
    <>
      <div className="p-4 border-b border-border-dark bg-surface-dark/50 flex items-center gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-muted text-[18px]">search</span>
          <input
            className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg pl-9 pr-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-text-muted/50"
            placeholder="搜索合约 (例如: NYC, >85F)..."
            type="text"
          />
        </div>
        <div className="h-6 w-px bg-border-dark" />
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button className="px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/30 transition-colors whitespace-nowrap">
            全部地区
          </button>
          {"NYC CHI LA LND".split(" ").map((region) => (
            <button
              key={region}
              className="px-3 py-1.5 rounded-full bg-surface-dark border border-border-dark text-text-muted hover:text-white hover:border-text-muted text-xs font-medium transition-colors whitespace-nowrap"
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatsCard title="市场总持仓量 (OI)" value="$12.4M" hint="+5.2% (24H)" icon="trending_up" tone="primary" />
          <StatsCard title="最热交易地区" value="NYC (纽约)" hint="高波动预警" icon="local_fire_department" tone="warning" />
          <StatsCard title="主要情绪指标" value="65% 看涨" hint="35% 看跌" icon="analytics" tone="muted" />
          <StatsCard title="活跃合约数" value="84 / 120" hint="新增 3 个 (今日)" icon="view_comfy" tone="muted" />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">view_comfy</span>
            所有合约列表
          </h2>
          <span className="text-xs text-text-muted">最后更新: 刚刚</span>
        </div>

        <MarketGrid markets={markets} />
      </div>

      <div className="bg-surface-dark border-t border-border-dark h-12 flex items-center px-4 z-10">
        <div className="flex items-center gap-4 w-full">
          <span className="text-[10px] font-bold text-text-muted uppercase whitespace-nowrap">Global Heatmap</span>
          <div className="flex-1 h-2 bg-[#21262d] rounded-full overflow-hidden flex">
            <div className="h-full bg-heat-hot w-[15%]" />
            <div className="h-full bg-heat-warm w-[25%]" />
            <div className="h-full bg-heat-cool w-[40%]" />
            <div className="h-full bg-heat-cold w-[20%]" />
          </div>
          <span className="text-[10px] font-mono text-text-muted whitespace-nowrap">Vol: 1.2M USDC (24h)</span>
        </div>
      </div>
    </>
  );
}
