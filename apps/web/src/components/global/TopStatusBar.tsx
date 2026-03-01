"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

function shortTs(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function TopStatusBar() {
  const profile = useUiStore((s) => s.profiles[s.environment]);
  const environment = useUiStore((s) => s.environment);
  const runtime = useUiStore((s) => s.runtime);
  const openModal = useUiStore((s) => s.openModal);

  const [noticeOpen, setNoticeOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["topbar-audit"],
    queryFn: () => getAuditLogs(5),
    refetchInterval: 10_000,
    retry: 1,
  });

  const notices = data ?? [];

  return (
    <header className="h-topbar border-b border-border-dark bg-surface-dark px-3 lg:px-4 flex items-center justify-between shrink-0 z-20 gap-3 relative">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 text-white shrink-0">
          <span className="material-symbols-outlined text-primary neon-text">thunderstorm</span>
          <h1 className="text-base lg:text-lg font-bold tracking-tight">
            Weather Trader <span className="text-text-muted font-normal text-xs ml-1">PRO V3</span>
          </h1>
        </div>

        <div className="hidden lg:block h-5 w-px bg-border-dark" />

        <button
          className={`hidden sm:flex items-center gap-2 h-9 px-3 rounded-full border transition-colors min-w-0 ${
            environment === "REAL"
              ? "bg-accent-warning/10 border-accent-warning/60 hover:border-accent-warning text-accent-warning"
              : "bg-surface-2 border-border-dark hover:border-primary/50"
          }`}
          onClick={openModal}
        >
          <div className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </div>
          <span className={`text-[11px] font-bold tracking-wider ${environment === "REAL" ? "text-accent-warning" : "text-primary"}`}>
            {profile.executionLabel}
          </span>
          <span className="hidden xl:inline text-[11px] text-text-muted">
            {profile.wallet.isSimulated ? "模拟钱包/模拟资产" : "真实钱包/真实资产"}
          </span>
        </button>
      </div>

      <div className="hidden 2xl:flex items-center gap-5 text-xs font-mono text-text-muted">
        <div className="flex items-center gap-2">
          <span
            className={`material-symbols-outlined text-[16px] ${
              runtime.polymarketGateway.status === "down"
                ? "text-accent-error"
                : runtime.polymarketGateway.status === "degraded"
                  ? "text-accent-warning"
                  : "text-primary"
            }`}
          >
            router
          </span>
          <span>Polymarket Gateway:</span>
          <span
            className={`font-bold ${
              runtime.polymarketGateway.status === "down"
                ? "text-accent-error"
                : runtime.polymarketGateway.status === "degraded"
                  ? "text-accent-warning"
                  : "text-primary"
            }`}
          >
            {runtime.polymarketGateway.latencyMs === null ? "offline" : `${runtime.polymarketGateway.latencyMs}ms`}
          </span>
        </div>
        <div className="h-4 w-px bg-border-dark" />
        <div className="flex items-center gap-2">
          <span
            className={`material-symbols-outlined text-[16px] ${
              runtime.oracle.status === "down"
                ? "text-accent-error"
                : runtime.oracle.status === "stale"
                  ? "text-accent-warning"
                  : "text-primary"
            }`}
          >
            cloud_queue
          </span>
          <span>Oracle Delay:</span>
          <span
            className={`font-bold ${
              runtime.oracle.status === "down"
                ? "text-accent-error"
                : runtime.oracle.status === "stale"
                  ? "text-accent-warning"
                  : "text-primary"
            }`}
          >
            {runtime.oracle.delaySec === null ? "offline" : `~${runtime.oracle.delaySec}s`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          className="relative p-1 text-text-muted hover:text-white transition-colors"
          onClick={() => {
            setNoticeOpen((prev) => !prev);
            setUserMenuOpen(false);
          }}
          title="系统通知"
        >
          <span className="material-symbols-outlined text-[18px]">notifications</span>
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent-error border border-surface-dark" />
        </button>

        <button
          type="button"
          onClick={() => {
            setUserMenuOpen((prev) => !prev);
            setNoticeOpen(false);
          }}
          title="账户菜单"
          className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-info p-[1px] hover:scale-105 transition-transform"
        >
          <div className="h-full w-full rounded-full bg-surface-dark flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">WT</span>
          </div>
        </button>
      </div>

      {noticeOpen ? (
        <div className="absolute right-3 top-12 w-80 rounded-xl border border-border-dark bg-surface-dark shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-white">最新系统通知</h4>
            <button className="text-[11px] text-text-muted hover:text-white" onClick={() => setNoticeOpen(false)}>
              关闭
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {notices.length === 0 ? (
              <div className="text-xs text-text-muted">暂无通知</div>
            ) : (
              notices.map((item) => (
                <div key={item.id} className="rounded-lg border border-border-dark bg-black/20 p-2">
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>{item.action}</span>
                    <span>{shortTs(item.ts)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-white">{item.detail}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {userMenuOpen ? (
        <div className="absolute right-3 top-12 w-52 rounded-xl border border-border-dark bg-surface-dark shadow-xl p-2">
          <div className="px-2 py-2 border-b border-border-dark">
            <div className="text-xs font-bold text-white">WT 账户</div>
            <div className="text-[11px] text-text-muted">{profile.wallet.isSimulated ? "PAPER 模式" : "REAL 模式"}</div>
          </div>
          <div className="pt-2 px-2 pb-1 text-[11px] text-text-muted space-y-1">
            <div className="flex items-center justify-between">
              <span>钱包</span>
              <span className="text-white">{profile.wallet.connected ? "已连接" : "未连接"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>资产单位</span>
              <span className="text-white font-mono">{profile.wallet.unit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>凭据</span>
              <span className={profile.credential.healthy ? "text-primary" : "text-accent-error"}>
                {profile.credential.healthy ? "健康" : "异常"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

