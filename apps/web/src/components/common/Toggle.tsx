"use client";

import clsx from "clsx";

type ToggleSize = "sm" | "md";

const sizeStyles: Record<ToggleSize, { track: string; knob: string }> = {
  // source: HTML(v3_5) w-9 h-5 + after:h-4 after:w-4
  sm: {
    track:
      "w-9 h-5 rounded-full relative after:h-4 after:w-4 after:top-[2px] after:left-[2px] peer-checked:after:translate-x-full",
    knob: "",
  },
  // source: HTML(v3_5) w-11 h-6 + after:h-5 after:w-5
  md: {
    track:
      "w-11 h-6 rounded-full relative after:h-5 after:w-5 after:top-[2px] after:left-[2px] peer-checked:after:translate-x-full",
    knob: "",
  },
};

export function Toggle({
  checked,
  onChange,
  className,
  size = "sm",
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  size?: ToggleSize;
}) {
  return (
    <label className={clsx("relative inline-flex items-center cursor-pointer", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="sr-only peer"
      />
      <div
        className={clsx(
          "bg-border-dark peer peer-checked:bg-primary after:content-[''] after:absolute after:bg-white after:rounded-full after:transition-all",
          sizeStyles[size].track,
          sizeStyles[size].knob,
        )}
      />
    </label>
  );
}
