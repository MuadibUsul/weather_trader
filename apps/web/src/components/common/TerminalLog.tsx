import clsx from "clsx";

export function TerminalLog({
  lines,
  className,
}: {
  lines: { time: string; text: string; tone?: "normal" | "success" | "warning" }[];
  className?: string;
}) {
  return (
    <div className={clsx("bg-black rounded-xl border border-border-dark flex flex-col overflow-hidden p-3 font-mono text-xs", className)}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-text-muted uppercase font-bold text-[10px]">Terminal Log</span>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-border-dark" />
          <div className="w-2 h-2 rounded-full bg-border-dark" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 text-text-main/80">
        {lines.map((line) => (
          <div key={`${line.time}-${line.text}`} className="flex gap-2">
            <span className="text-text-muted">[{line.time}]</span>
            <span
              className={clsx(
                line.tone === "success" && "text-secondary",
                line.tone === "warning" && "text-accent-warning",
              )}
            >
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
