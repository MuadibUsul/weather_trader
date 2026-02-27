import clsx from "clsx";

export function StatsCard({
  title,
  value,
  hint,
  icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  hint: string;
  icon: string;
  tone?: "primary" | "warning" | "muted";
}) {
  return (
    <div
      className={clsx(
        "bg-surface-dark border border-border-dark rounded-xl p-4 flex flex-col justify-between transition-colors cursor-pointer group relative overflow-hidden",
        tone === "primary" && "hover:border-primary/50",
        tone === "warning" && "hover:border-accent-warning/50",
        tone === "muted" && "hover:border-text-main/50",
      )}
    >
      <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
        <span
          className={clsx(
            "material-symbols-outlined text-6xl",
            tone === "primary" && "text-primary",
            tone === "warning" && "text-accent-warning",
            tone === "muted" && "text-text-muted",
          )}
        >
          {icon}
        </span>
      </div>
      <div className="text-xs text-text-muted font-medium uppercase tracking-wide z-10">{title}</div>
      <div className="text-2xl font-bold text-white font-mono mt-1 z-10">{value}</div>
      <div className="flex items-center gap-1 mt-2 text-xs font-medium z-10 text-text-muted">{hint}</div>
    </div>
  );
}
