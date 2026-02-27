import clsx from "clsx";
import type { ReactNode } from "react";

type BadgeVariant = "primary" | "secondary" | "warning" | "danger" | "muted";

const styles: Record<BadgeVariant, string> = {
  primary: "bg-primary/20 text-primary border border-primary/30",
  secondary: "bg-secondary/20 text-secondary border border-secondary/30",
  warning: "bg-accent-warning/10 text-accent-warning border border-accent-warning/20",
  danger: "bg-accent-error/10 text-accent-error border border-accent-error/20",
  muted: "bg-border-dark text-text-muted border border-border-dark",
};

export function Badge({
  children,
  variant = "primary",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold", styles[variant], className)}>
      {children}
    </span>
  );
}

