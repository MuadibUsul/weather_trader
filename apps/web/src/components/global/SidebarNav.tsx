"use client";

import clsx from "clsx";
import Link from "next/link";

type Item = {
  href: string;
  icon: string;
  label: string;
};

const navMain: Item[] = [
  { href: "/dashboard", icon: "dashboard", label: "控制台" },
  { href: "/markets", icon: "candlestick_chart", label: "市场全览" },
  { href: "/orders", icon: "history", label: "历史订单" },
  { href: "/strategy", icon: "tune", label: "策略配置" },
  { href: "/settings", icon: "person", label: "个人设置" },
];

const navAsset: Item[] = [
  { href: "/wallet", icon: "account_balance_wallet", label: "钱包管理" },
  { href: "/credentials", icon: "key", label: "API 凭据" },
];

export function SidebarNav({ active }: { active: string }) {
  return (
    <aside className="col-span-12 md:col-span-3 lg:col-span-2 relative z-10 pointer-events-auto flex flex-col gap-3 overflow-y-auto pr-1 min-w-0">
      <nav className="flex flex-col gap-1 p-2 bg-surface-dark rounded-xl border border-border-dark">
        {navMain.map((item) => {
          const on = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                on ? "bg-primary/10 text-primary font-medium" : "hover:bg-[#21262d] text-text-muted",
              )}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}

        <div className="h-px bg-border-dark my-1" />
        <span className="px-3 pt-1 text-[10px] uppercase tracking-wider text-text-muted">资产与凭据</span>

        {navAsset.map((item) => {
          const on = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                on ? "bg-primary/10 text-primary font-medium" : "hover:bg-[#21262d] text-text-muted",
              )}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
