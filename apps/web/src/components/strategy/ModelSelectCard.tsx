"use client";

import { Toggle } from "@/components/common/Toggle";

type StrategyModel = "mean_reversion" | "trend_following";

export function ModelSelectCard({
  enabled,
  model,
  onEnabledChange,
  onModelChange,
}: {
  enabled: boolean;
  model: StrategyModel;
  onEnabledChange: (next: boolean) => void;
  onModelChange: (next: StrategyModel) => void;
}) {
  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border-dark bg-[#1c2128] flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">smart_toy</span>
          自动交易策略
        </h3>
        <Toggle checked={enabled} onChange={onEnabledChange} />
      </div>

      <div className="p-6 flex flex-col gap-6 flex-1">
        <label className="text-sm font-medium text-text-muted">选择模型 (Model)</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onModelChange("mean_reversion")}
            className={`p-4 rounded-lg border transition-all text-center ${
              model === "mean_reversion"
                ? "border-primary bg-primary/5"
                : "border-border-dark bg-[#0d1117] hover:border-text-muted"
            }`}
          >
            <span className="material-symbols-outlined text-3xl mb-2 text-text-muted">ssid_chart</span>
            <div className="font-medium text-white">均值回归</div>
            <div className="text-xs text-text-muted mt-1">Mean Reversion</div>
          </button>
          <button
            onClick={() => onModelChange("trend_following")}
            className={`p-4 rounded-lg border transition-all text-center ${
              model === "trend_following"
                ? "border-primary bg-primary/5"
                : "border-border-dark bg-[#0d1117] hover:border-text-muted"
            }`}
          >
            <span className="material-symbols-outlined text-3xl mb-2 text-text-muted">trending_up</span>
            <div className="font-medium text-white">趋势跟踪</div>
            <div className="text-xs text-text-muted mt-1">Trend Following</div>
          </button>
        </div>
      </div>
    </div>
  );
}
