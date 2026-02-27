"use client";

import clsx from "clsx";

export function Toggle({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label className={clsx("relative inline-flex items-center cursor-pointer", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-border-dark rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:bg-white after:rounded-full after:transition-all" />
    </label>
  );
}
