"use client";

import { useState } from "react";
import { Toggle } from "@/components/common/Toggle";

export function SecurityCard() {
  const [mfa, setMfa] = useState(true);

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">security</span>
          安全管理
        </h3>
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-secondary/10 border border-secondary/20">
          <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-xs text-secondary font-medium">账户安全评分: 高</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-black/20 rounded-lg p-4 border border-border-dark">
          <h4 className="text-sm font-bold text-white mb-3">Trade PIN 设置</h4>
          <p className="text-xs text-text-muted mb-4">Trade PIN 用于关键交易操作前的二次验证。</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-muted">当前 PIN 状态</label>
              <div className="text-sm text-primary font-mono mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                已设置
              </div>
            </div>
            <div>
              <label className="text-xs text-text-muted">重置 PIN</label>
              <div className="flex gap-2 mt-1">
                <input
                  className="flex-1 bg-[#0d1117] border border-border-dark text-white text-sm rounded px-3 py-2 outline-none focus:border-primary font-mono tracking-widest"
                  maxLength={6}
                  placeholder="输入新 PIN"
                  type="password"
                />
                <button className="px-4 py-2 bg-border-dark hover:bg-white hover:text-surface-dark text-white text-xs font-bold rounded transition-colors">
                  更新
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/20 rounded-lg p-4 border border-border-dark flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white mb-2">多因子认证 (MFA)</h4>
            <p className="text-xs text-text-muted mb-4">推荐使用 Google Authenticator 或 Authy 进行登录保护。</p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white font-medium">MFA 状态</span>
              <Toggle checked={mfa} onChange={setMfa} />
            </div>
          </div>
          <div className="bg-accent-warning/10 border border-accent-warning/20 p-3 rounded">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-accent-warning text-[16px] mt-0.5">warning</span>
              <p className="text-[10px] text-accent-warning leading-tight">
                关闭 MFA 将降低账户安全性，并可能导致提现延迟 24 小时。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
