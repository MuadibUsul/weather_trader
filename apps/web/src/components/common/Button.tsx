import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-primary hover:bg-primary-dark text-surface-dark font-bold shadow-sm hover:shadow-neon transition-all",
  secondary:
    "bg-border-dark hover:bg-white text-white hover:text-surface-dark font-bold transition-all",
  ghost: "bg-transparent hover:bg-white/5 text-text-muted hover:text-white transition-colors",
  danger:
    "bg-accent-error/10 border border-accent-error/30 text-accent-error hover:bg-accent-error/20 transition-colors",
};

export function Button({ variant = "primary", fullWidth, className, ...props }: Props) {
  return (
    <button
      className={clsx(
        "px-3 py-2 rounded-lg text-sm inline-flex items-center justify-center gap-2",
        styles[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
