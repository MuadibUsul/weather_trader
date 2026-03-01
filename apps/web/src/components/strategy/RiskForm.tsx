"use client";

import { Stepper } from "@/components/common/Stepper";

const riskPresets = [
  {
    id: "strict",
    label: "Strict",
    patch: {
      maxDailyLoss: 500,
      maxPositionSize: 2500,
      maxOpenPositions: 2,
      slippageBps: 20,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    patch: {
      maxDailyLoss: 1000,
      maxPositionSize: 5000,
      maxOpenPositions: 3,
      slippageBps: 50,
    },
  },
  {
    id: "flex",
    label: "Flexible",
    patch: {
      maxDailyLoss: 2000,
      maxPositionSize: 9000,
      maxOpenPositions: 5,
      slippageBps: 90,
    },
  },
] as const;

export function RiskForm({
  maxDailyLoss,
  maxPositionSize,
  maxOpenPositions,
  slippageBps,
  onChange,
}: {
  maxDailyLoss: number;
  maxPositionSize: number;
  maxOpenPositions: number;
  slippageBps: number;
  onChange: (
    patch: Partial<{
      maxDailyLoss: number;
      maxPositionSize: number;
      maxOpenPositions: number;
      slippageBps: number;
    }>,
  ) => void;
}) {
  const marketCap = Math.max(0, maxPositionSize);
  const portfolioCap = Math.max(0, marketCap * maxOpenPositions);
  const riskRatioPct = portfolioCap <= 0 ? 0 : Math.min(100, Number(((maxDailyLoss / portfolioCap) * 100).toFixed(1)));

  const activePresetId = riskPresets.find(
    (item) =>
      item.patch.maxDailyLoss === maxDailyLoss &&
      item.patch.maxPositionSize === maxPositionSize &&
      item.patch.maxOpenPositions === maxOpenPositions &&
      item.patch.slippageBps === slippageBps,
  )?.id;

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border-dark bg-[#1c2128]">
        <h3 className="font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-warning">shield</span>
          Risk Limits
        </h3>
        <p className="text-xs text-text-muted mt-1">Keep only the core limits used by execution and pre-trade checks.</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-text-muted">Preset</span>
          <div className="inline-flex rounded-lg border border-border-dark overflow-hidden">
            {riskPresets.map((preset) => {
              const active = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange(preset.patch)}
                  className={`h-8 px-3 text-xs transition-colors ${
                    active ? "bg-primary/15 text-primary" : "text-text-muted hover:text-white hover:bg-white/5"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-text-muted">Daily Loss Limit (USDC)</span>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-text-muted">$</span>
              <input
                className="w-full h-9 rounded-lg border border-border-dark bg-background-dark pl-7 pr-3 text-sm text-white outline-none focus:border-accent-warning"
                type="number"
                value={maxDailyLoss}
                onChange={(e) => onChange({ maxDailyLoss: Number(e.target.value) })}
              />
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-text-muted">Max Position Per Market (USDC)</span>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-text-muted">USDC</span>
              <input
                className="w-full h-9 rounded-lg border border-border-dark bg-background-dark pl-14 pr-3 text-sm text-white outline-none focus:border-accent-warning"
                type="number"
                value={maxPositionSize}
                onChange={(e) => onChange({ maxPositionSize: Number(e.target.value) })}
              />
            </div>
          </label>

          <div className="space-y-1">
            <span className="text-xs text-text-muted">Max Open Events</span>
            <div className="rounded-lg border border-border-dark bg-background-dark px-2 py-1.5">
              <Stepper value={maxOpenPositions} onChange={(next) => onChange({ maxOpenPositions: next })} min={1} max={12} />
            </div>
          </div>

          <label className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Slippage Limit (bps)</span>
              <span className="text-[10px] text-accent-warning">20-80 suggested</span>
            </div>
            <div className="relative">
              <input
                className="w-full h-9 rounded-lg border border-border-dark bg-background-dark px-3 pr-10 text-sm text-white outline-none focus:border-accent-warning"
                type="number"
                value={slippageBps}
                onChange={(e) => onChange({ slippageBps: Number(e.target.value) })}
              />
              <span className="absolute right-3 top-2.5 text-xs text-text-muted">bps</span>
            </div>
          </label>
        </div>

        <div className="rounded-lg border border-border-dark bg-black/20 px-3 py-2 text-xs text-text-muted flex flex-wrap gap-x-5 gap-y-1">
          <span>Market Cap: {marketCap.toLocaleString()} USDC</span>
          <span>Portfolio Cap: {portfolioCap.toLocaleString()} USDC</span>
          <span>Daily Loss Ratio: {riskRatioPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}