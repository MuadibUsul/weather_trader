import clsx from "clsx";
import type { ReactNode } from "react";

export function Table({
  head,
  body,
  className,
}: {
  head: ReactNode;
  body: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("overflow-auto", className)}>
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-dark sticky top-0 z-10 text-xs text-text-muted font-medium uppercase tracking-wider">
          {head}
        </thead>
        <tbody className="divide-y divide-border-dark text-sm">{body}</tbody>
      </table>
    </div>
  );
}

