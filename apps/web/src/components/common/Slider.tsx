"use client";

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange?.(Number(e.currentTarget.value))}
      className="w-full h-2 bg-border-dark rounded-lg appearance-none cursor-pointer"
    />
  );
}
