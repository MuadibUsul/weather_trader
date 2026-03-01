import clsx from "clsx";
import type { Market } from "@/lib/api";

function toDateBadge(endDate?: string): { month: string; day: string } {
  if (!endDate) {
    return { month: "--", day: "--" };
  }
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) {
    return { month: "--", day: "--" };
  }
  return {
    month: `${date.getMonth() + 1}月`,
    day: String(date.getDate()),
  };
}

function toSignalStrength(change24h: number): "强" | "中" | "弱" {
  const value = Math.abs(change24h);
  if (value >= 5) return "强";
  if (value >= 1.5) return "中";
  return "弱";
}

export function MarketCard({ market, onPick }: { market: Market; onPick?: (marketId: string) => void }) {
  const badge = toDateBadge(market.endDate);
  const isUp = market.change24h >= 0;
  const signalStrength = toSignalStrength(market.change24h);

  return (
    <button
      type="button"
      onClick={() => onPick?.(market.id)}
      className={clsx(
        "group relative h-full min-h-[232px] rounded-2xl border bg-surface-dark p-4 text-left transition-all",
        market.live
          ? "border-primary/45 hover:border-primary shadow-lg shadow-primary/5"
          : "border-border-dark hover:border-text-muted/80",
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="w-14 shrink-0 rounded-xl border border-border-dark bg-surface-2 px-1.5 py-2">
          <span className="block text-center text-[11px] font-bold text-text-muted">{badge.month}</span>
          <span className="block text-center text-2xl font-black leading-none text-white">{badge.day}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="min-h-[44px] text-base font-bold leading-snug text-white">
            <span
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {market.title}
            </span>
          </h3>
          <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
            <span className="material-symbols-outlined text-[14px]">location_on</span>
            <span className="truncate">{market.location}</span>
          </div>
        </div>

        <div
          className={clsx(
            "mt-0.5 flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5",
            market.live ? "border-primary/35 bg-primary/10" : "border-border-dark bg-surface-2",
          )}
        >
          {market.live ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-text-muted/60" />
          )}
          <span className={clsx("text-[10px] font-bold", market.live ? "text-primary" : "text-text-muted")}>
            {market.live ? "进行中" : "待触发"}
          </span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-[10px] uppercase text-text-muted">当前赔率 (Odds)</div>
          <div className={clsx("font-mono text-3xl font-bold", isUp ? "text-primary" : "text-white")}>{market.odds.toFixed(2)}</div>
        </div>

        <div>
          <div className="mb-1 text-[10px] uppercase text-text-muted">24H 变化</div>
          <div className={clsx("flex items-center font-mono text-base font-bold", isUp ? "text-primary" : "text-accent-error")}>
            <span className="material-symbols-outlined text-[18px]">{isUp ? "arrow_drop_up" : "arrow_drop_down"}</span>
            {market.change24h > 0 ? "+" : ""}
            {market.change24h.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between border-t border-border-dark pt-3">
        <div>
          <div className="mb-1 text-[10px] uppercase text-text-muted">未平仓量 (OI)</div>
          <div className="font-mono text-sm font-semibold text-white">${market.oi.toLocaleString()}</div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="text-[10px] uppercase text-text-muted">信号强度</div>
          <div
            className={clsx(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              signalStrength === "强"
                ? "border-primary/40 bg-primary/10 text-primary"
                : signalStrength === "中"
                  ? "border-accent-warning/40 bg-accent-warning/10 text-accent-warning"
                  : "border-border-dark bg-surface-2 text-text-muted",
            )}
          >
            {signalStrength}
          </div>
        </div>
      </div>
    </button>
  );
}
