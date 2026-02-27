import { Button } from "@/components/common/Button";

export function TradeDrawer() {
  return (
    <aside className="w-drawer bg-surface-dark border-l border-border-dark hidden lg:flex flex-col shrink-0 z-30 shadow-2xl">
      <div className="p-4 border-b border-border-dark bg-[#1c2128] flex justify-between items-center">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-white text-[20px]">shopping_cart_checkout</span>
          快速下单预览
        </h2>
        <button className="text-text-muted hover:text-white">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-black/30 rounded-lg p-3 border border-border-dark">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">SELECTED</span>
            <span className="text-xs text-text-muted font-mono">ID: #NYC_GT85</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">NYC &gt; 85°F</h3>
          <div className="text-xs text-text-muted mb-3">Exp: 24 Aug 2024</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-surface-dark p-2 rounded border border-border-dark/50">
              <div className="text-text-muted">Best Bid</div>
              <div className="text-primary font-mono font-bold">0.64</div>
            </div>
            <div className="bg-surface-dark p-2 rounded border border-border-dark/50">
              <div className="text-text-muted">Best Ask</div>
              <div className="text-accent-error font-mono font-bold">0.66</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 bg-black rounded-lg p-1 border border-border-dark">
          <button className="py-1.5 text-sm font-bold rounded bg-primary text-surface-dark shadow-sm">买入 (Long)</button>
          <button className="py-1.5 text-sm font-bold rounded text-text-muted hover:text-white transition-colors">
            卖出 (Short)
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium flex justify-between">
              <span>限价 (Odds)</span>
              <span className="text-primary cursor-pointer hover:underline">Use Market</span>
            </label>
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              type="number"
              defaultValue="0.65"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium flex justify-between">
              <span>数量 (USDC)</span>
              <span className="text-text-muted">Max: 5432</span>
            </label>
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              placeholder="0.00"
              type="number"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {"25% 50% 75% MAX".split(" ").map((n) => (
            <button
              key={n}
              className="bg-surface-dark hover:bg-border-dark border border-border-dark text-[10px] py-1 rounded text-text-muted transition-colors"
            >
              {n}
            </button>
          ))}
        </div>

        <div className="bg-surface-dark rounded-lg p-3 border border-border-dark text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-text-muted">预计回报</span>
            <span className="text-primary font-bold">+53.8%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">费用 (Est.)</span>
            <span className="text-white">0.05 USDC</span>
          </div>
          <div className="h-px bg-border-dark my-1" />
          <div className="flex justify-between items-center">
            <span className="text-text-muted">风控检查</span>
            <span className="text-primary font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">check_circle</span>
              Pass
            </span>
          </div>
        </div>

        <Button fullWidth className="mt-auto py-3 group shadow-lg shadow-primary/20">
          <span>确认下单</span>
          <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </Button>
      </div>
    </aside>
  );
}
