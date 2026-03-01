"use client";

import { useEffect } from "react";
import { Toggle } from "@/components/common/Toggle";
import { useUiStore } from "@/store/ui-store";

const accentStyleMap = {
  primary: {
    primary: "#13ec5b",
    primaryDark: "#0ea641",
  },
  surface: {
    primary: "#58a6ff",
    primaryDark: "#1f6feb",
  },
  dark: {
    primary: "#d29922",
    primaryDark: "#a37114",
  },
} as const;

export function PreferencePanel() {
  const preferences = useUiStore((s) => s.preferences);
  const updatePreferences = useUiStore((s) => s.updatePreferences);

  useEffect(() => {
    const theme = accentStyleMap[preferences.themeAccent];
    document.documentElement.style.setProperty("--wt-color-primary", theme.primary);
    document.documentElement.style.setProperty("--wt-color-primary-dark", theme.primaryDark);
  }, [preferences.themeAccent]);

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-text-muted text-[20px]">tune</span>
        首选项
      </h3>

      <div className="space-y-4">
        <div className="space-y-3">
          <label className="text-xs text-text-muted font-bold uppercase">通知设置</label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-main">邮件通知 (成交/风控)</span>
            <Toggle
              checked={preferences.emailNotice}
              onChange={(checked) => updatePreferences({ emailNotice: checked })}
              size="sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-main">系统弹窗提醒</span>
            <Toggle
              checked={preferences.popupNotice}
              onChange={(checked) => updatePreferences({ popupNotice: checked })}
              size="sm"
            />
          </div>
        </div>

        <div className="h-px bg-border-dark" />

        <div className="space-y-2">
          <label className="text-xs text-text-muted font-bold uppercase">主题微调</label>
          <div className="flex items-center gap-2">
            <button
              className={`h-8 w-8 rounded border ${preferences.themeAccent === "primary" ? "border-primary" : "border-border-dark"} bg-background-dark`}
              onClick={() => updatePreferences({ themeAccent: "primary" })}
              aria-label="Primary Accent"
            />
            <button
              className={`h-8 w-8 rounded border ${preferences.themeAccent === "surface" ? "border-primary" : "border-border-dark"} bg-surface-dark`}
              onClick={() => updatePreferences({ themeAccent: "surface" })}
              aria-label="Surface Accent"
            />
            <button
              className={`h-8 w-8 rounded border ${preferences.themeAccent === "dark" ? "border-primary" : "border-border-dark"} bg-gray-950`}
              onClick={() => updatePreferences({ themeAccent: "dark" })}
              aria-label="Dark Accent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
