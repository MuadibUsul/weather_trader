"use client";

import { Button } from "./Button";

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <Button
        variant="ghost"
        className="w-8 h-8 rounded-lg bg-[#0d1117] border border-border-dark text-white hover:border-primary hover:text-primary"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <span className="material-symbols-outlined text-[18px]">remove</span>
      </Button>
      <span className="flex-1 text-center font-mono text-xl font-bold text-white">{value}</span>
      <Button
        variant="ghost"
        className="w-8 h-8 rounded-lg bg-[#0d1117] border border-border-dark text-white hover:border-primary hover:text-primary"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
      </Button>
    </div>
  );
}
