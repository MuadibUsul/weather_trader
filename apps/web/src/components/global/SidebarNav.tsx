import Link from "next/link";
import clsx from "clsx";
import { Badge } from "@/components/common/Badge";

type Item = {
  href: string;
  icon: string;
  label: string;
};

const nav: Item[] = [
  { href: "/dashboard", icon: "dashboard", label: "控制台" },
  { href: "/markets", icon: "candlestick_chart", label: "市场全览" },
  { href: "/orders", icon: "history", label: "历史订单" },
  { href: "/strategy", icon: "tune", label: "策略配置" },
  { href: "/settings", icon: "person", label: "个人设置" },
];

export function SidebarNav({ active }: { active: string }) {
  return (
    <aside className="col-span-12 md:col-span-3 lg:col-span-2 flex flex-col gap-4 overflow-y-auto pr-1">
      <nav className="flex flex-col gap-1 p-2 bg-surface-dark rounded-xl border border-border-dark">
        {nav.map((item) => {
          const on = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                on
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-[#21262d] text-text-muted",
              )}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="bg-surface-dark rounded-xl border border-border-dark p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-text-muted text-[20px]">account_balance_wallet</span>
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">活跃钱包</span>
          </div>
          <Badge>已绑定</Badge>
        </div>
        <div>
          <div className="text-2xl font-bold text-white font-mono tracking-tight">$5,432.10</div>
          <div className="text-xs text-text-muted font-mono mt-1">USDC Balance</div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border-dark">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs font-mono text-text-muted truncate">0x71C...aBcd</span>
          <button className="ml-auto text-text-muted hover:text-white">
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-dark rounded-xl border border-border-dark p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-text-muted text-[20px]">key</span>
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">API 凭据</span>
          </div>
          <Badge variant="secondary">OK</Badge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-white">Production_V3_Key</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="material-symbols-outlined text-[12px] text-primary animate-pulse">favorite</span>
            <span className="text-xs text-text-muted">最后心跳: 刚刚</span>
          </div>
        </div>
      </div>

      <div className="bg-black/50 rounded-xl border border-border-dark p-3 flex-1 min-h-[150px]">
        <div className="text-[10px] font-mono text-text-muted mb-2 border-b border-border-dark pb-1">系统消息</div>
        <div className="flex flex-col gap-1 text-[10px] font-mono opacity-80">
          <div className="text-primary">&gt; System initialized.</div>
          <div className="text-text-muted">&gt; Connecting to relayer...</div>
          <div className="text-primary">&gt; Connected (wss://v3.wt.io).</div>
          <div className="text-text-muted">&gt; Syncing orderbook... Done.</div>
        </div>
      </div>
    </aside>
  );
}
