"use client";

import { KeyboardEvent, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type Props = {
  length?: number;
  onComplete?: (value: string) => void;
  error?: boolean;
};

export function PinInput({ length = 6, onComplete, error = false }: Props) {
  const [values, setValues] = useState<string[]>(Array.from({ length }, () => ""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const isComplete = useMemo(() => values.every((v) => v.length === 1), [values]);

  function update(index: number, next: string) {
    const digit = next.replace(/\D/g, "").slice(-1);
    const clone = [...values];
    clone[index] = digit;
    setValues(clone);

    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }

    const joined = clone.join("");
    if (joined.length === length && clone.every((v) => v.length === 1)) {
      onComplete?.(joined);
    }
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <div className={clsx("flex justify-center gap-3", error && "animate-shake")}>
      {values.map((value, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={value}
          onChange={(e) => update(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(index, e)}
          maxLength={1}
          inputMode="numeric"
          autoFocus={index === 0}
          className={clsx(
            "w-pin-cell h-pin-cell text-center text-xl font-bold bg-[#0D1117] border rounded-lg text-white outline-none transition-all",
            value || index === values.findIndex((v) => v === "")
              ? "border-primary ring-1 ring-primary shadow-neon"
              : "border-border-dark",
            error && "border-accent-error ring-accent-error",
          )}
        />
      ))}
      <input type="hidden" value={values.join("")} data-complete={isComplete} readOnly />
    </div>
  );
}
