import clsx from "clsx";
import type { ReactNode } from "react";

export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  headerClassName,
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <section className={clsx("bg-surface-dark rounded-xl border border-border-dark overflow-hidden", className)}>
      <div
        className={clsx(
          "p-4 border-b border-border-dark bg-[#1c2128] flex items-center justify-between",
          headerClassName,
        )}
      >
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

