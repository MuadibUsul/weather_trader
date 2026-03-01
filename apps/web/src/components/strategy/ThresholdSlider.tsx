"use client";

import { Slider } from "@/components/common/Slider";

export function ThresholdSlider({
  threshold,
  updateFrequencySec,
  onThresholdChange,
  onUpdateFrequencyChange,
}: {
  threshold: number;
  updateFrequencySec: number;
  onThresholdChange: (value: number) => void;
  onUpdateFrequencyChange: (value: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <label className="text-sm font-medium text-text-muted">触发阈值 (Trigger Threshold)</label>
        <span className="text-sm font-mono text-primary font-bold">{threshold.toFixed(2)}</span>
      </div>
      <div className="relative w-full h-6 flex items-center">
        <Slider value={threshold} min={0} max={1} step={0.01} onChange={onThresholdChange} />
      </div>
      <div className="flex justify-between text-xs text-text-muted font-mono">
        <span>Conservative (0.8)</span>
        <span>Aggressive (0.5)</span>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-text-muted">更新频率 (Update Frequency)</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="material-symbols-outlined text-text-muted text-[18px]">timer</span>
          </div>
          <select
            value={updateFrequencySec}
            onChange={(e) => onUpdateFrequencyChange(Number(e.target.value))}
            className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg pl-10 pr-10 py-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none"
          >
            <option value={1}>1 秒 (High Frequency)</option>
            <option value={5}>5 秒 (Standard)</option>
            <option value={15}>15 秒 (Low Latency)</option>
            <option value={60}>60 秒 (Minute)</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="material-symbols-outlined text-text-muted text-[20px]">expand_more</span>
          </div>
        </div>
      </div>
    </div>
  );
}
