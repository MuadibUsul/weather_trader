"use client";

import { Badge } from "@/components/common/Badge";
import { useUiStore } from "@/store/ui-store";

export function ProfileCard() {
  const environment = useUiStore((s) => s.environment);
  const profile = useUiStore((s) => s.profiles[s.environment]);

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
          个人资料
        </h3>
        <Badge>已认证</Badge>
      </div>

      <div className="flex flex-col items-center py-3">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-info p-[2px] mb-2.5">
          <div className="h-full w-full rounded-full bg-background-dark flex items-center justify-center">
            <span className="text-xl font-bold text-white">WT</span>
          </div>
        </div>
        <h4 className="text-base font-bold text-white">WeatherTrader_User</h4>
        <p className="text-xs text-text-muted">Pro Plan Member</p>
      </div>

      <div className="space-y-3 mt-2">
        <div className="space-y-1">
          <label className="text-xs text-text-muted font-medium">绑定邮箱</label>
          <div className="flex items-center justify-between bg-black/30 px-3 h-9 rounded border border-border-dark">
            <span className="text-sm text-text-main">trader***@example.com</span>
            <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-muted font-medium">当前模式钱包地址</label>
          <div className="flex items-center justify-between bg-black/30 px-3 h-9 rounded border border-border-dark">
            <span className="text-sm font-mono text-text-main truncate w-40">{profile.wallet.address}</span>
            <span className="text-[10px] text-text-muted">{environment}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
