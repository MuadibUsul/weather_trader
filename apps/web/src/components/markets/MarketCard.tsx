import clsx from "clsx";
import { Market } from "@/lib/api";

export function MarketCard({ market }: { market: Market }) {
  return (
    <div
      className={clsx(
        "bg-surface-dark border rounded-xl p-4 transition-all cursor-pointer relative group",
        market.live ? "border-primary/40 hover:border-primary shadow-lg shadow-primary/5" : "border-border-dark hover:border-text-muted",
      )}
    >
      {market.live ? (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[10px] font-bold text-primary uppercase">Live</span>
        </div>
      ) : null}

      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-[#21262d] border border-border-dark">
          <span className="text-xs font-bold text-white block text-center">AUG</span>
          <span className="text-lg font-bold text-white block text-center leading-none">24</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-white">{market.title}</h3>
          <div className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
            <span className="material-symbols-outlined text-[12px]">location_on</span>
            {market.location}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[10px] text-text-muted uppercase mb-1">当前赔率 (Odds)</div>
          <div className={clsx("text-2xl font-mono font-bold", market.change24h >= 0 ? "text-primary" : "text-white")}>
            {market.odds.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-muted uppercase mb-1">24H 变化</div>
          <div
            className={clsx(
              "text-sm font-mono font-bold flex items-center",
              market.change24h >= 0 ? "text-primary" : "text-accent-error",
            )}
          >
            <span className="material-symbols-outlined text-[14px]">
              {market.change24h >= 0 ? "arrow_drop_up" : "arrow_drop_down"}
            </span>
            {market.change24h > 0 ? "+" : ""}
            {market.change24h.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between border-t border-border-dark pt-3">
        <div>
          <div className="text-[10px] text-text-muted uppercase mb-1">未平仓 (OI)</div>
          <div className="text-xs font-mono text-white">${market.oi.toLocaleString()}</div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[10px] text-text-muted uppercase mb-1 text-right">信号强度</div>
          <div className="flex gap-0.5">
            {new Array(5).fill(null).map((_, idx) => (
              <div
                key={idx}
                className={clsx(
                  "w-1.5 h-3 rounded-sm",
                  idx < (market.change24h > 0 ? 3 : 2) ? "bg-secondary" : "bg-secondary/30",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
