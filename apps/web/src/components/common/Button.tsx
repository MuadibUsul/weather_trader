import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-primary hover:bg-primary-dark text-surface-dark font-bold shadow-sm hover:shadow-neon transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-primary disabled:hover:shadow-sm",
  secondary:
    "bg-border-dark hover:bg-white text-white hover:text-surface-dark font-bold transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-border-dark disabled:hover:text-white",
  ghost:
    "bg-transparent hover:bg-white/5 text-text-muted hover:text-white transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-muted",
  danger:
    "bg-accent-error/10 border border-accent-error/30 text-accent-error hover:bg-accent-error/20 transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-accent-error/10",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs rounded",
  md: "h-8 px-3 text-sm rounded-lg",
  lg: "h-9 px-3.5 text-sm rounded-lg",
};

export function Button({ variant = "primary", size = "md", fullWidth, className, ...props }: Props) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap",
        styles[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
