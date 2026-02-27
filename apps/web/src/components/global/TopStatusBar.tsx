"use client";

import { useUiStore } from "@/store/ui-store";

export function TopStatusBar() {
  const environment = useUiStore((s) => s.environment);
  const openModal = useUiStore((s) => s.openModal);

  return (
    <header className="h-topbar border-b border-border-dark bg-surface-dark px-6 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-white">
          <span className="material-symbols-outlined text-primary neon-text">thunderstorm</span>
          <h1 className="text-lg font-bold tracking-tight">
            Weather Trader <span className="text-text-muted font-normal text-xs ml-1">PRO V3</span>
          </h1>
        </div>
        <div className="h-6 w-px bg-border-dark mx-2" />
        <button
          className="flex items-center gap-3 bg-[#1c2128] px-3 py-1.5 rounded-full border border-border-dark hover:border-primary/50 transition-colors"
          onClick={openModal}
        >
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </div>
          <span className="text-xs font-bold text-primary tracking-wider">
            {environment} EXECUTION
          </span>
        </button>
      </div>

      <div className="hidden md:flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <span className="material-symbols-outlined text-[16px] text-primary">router</span>
          <span>Polymarket Gateway:</span>
          <span className="text-primary font-bold">112ms</span>
        </div>
        <div className="h-4 w-px bg-border-dark" />
        <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <span className="material-symbols-outlined text-[16px] text-accent-warning">cloud_queue</span>
          <span>Oracle Delay:</span>
          <span className="text-accent-warning font-bold">~2s</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="material-symbols-outlined text-primary text-[18px]">lock</span>
          <span className="text-xs font-bold text-primary">Trade PIN: 已设置</span>
        </div>
        <button className="relative p-2 text-text-muted hover:text-white transition-colors">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent-error border border-surface-dark" />
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-blue-500 p-[1px]">
          <div className="h-full w-full rounded-full bg-surface-dark flex items-center justify-center">
            <span className="text-xs font-bold text-white">WT</span>
          </div>
        </div>
      </div>
    </header>
  );
}
