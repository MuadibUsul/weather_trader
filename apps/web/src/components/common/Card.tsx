import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "bg-surface-dark rounded-xl border border-border-dark shadow-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

