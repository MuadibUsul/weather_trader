"use client";

import { useState } from "react";
import { Toggle } from "@/components/common/Toggle";

export function PreferencePanel() {
  const [emailNotice, setEmailNotice] = useState(true);
  const [popupNotice, setPopupNotice] = useState(true);

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-5">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-text-muted text-[20px]">tune</span>
        首选项
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-main">界面语言</span>
          <select className="bg-[#0d1117] border border-border-dark text-white text-xs rounded px-2 py-1 outline-none focus:border-primary">
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </select>
        </div>

        <div className="h-px bg-border-dark" />

        <div className="space-y-3">
          <label className="text-xs text-text-muted font-bold uppercase">通知设置</label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-main">邮件通知 (成交/爆仓)</span>
            <Toggle checked={emailNotice} onChange={setEmailNotice} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-main">系统弹窗提醒</span>
            <Toggle checked={popupNotice} onChange={setPopupNotice} />
          </div>
        </div>

        <div className="h-px bg-border-dark" />

        <div className="space-y-2">
          <label className="text-xs text-text-muted font-bold uppercase">主题微调</label>
          <div className="grid grid-cols-3 gap-2">
            <button className="h-8 rounded bg-[#0d1117] border-2 border-primary" />
            <button className="h-8 rounded bg-[#161b22] border border-border-dark hover:border-text-muted" />
            <button className="h-8 rounded bg-[#010409] border border-border-dark hover:border-text-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
