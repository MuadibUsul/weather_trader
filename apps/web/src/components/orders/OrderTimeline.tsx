export function OrderTimeline() {
  const items = [
    ["10:42:05.120", "订单完全成交", "Filled 500 @ 0.64 via Polymarket CLOB.", "primary"],
    ["10:42:04.890", "链上确认", "Block 1928374 confirmed. Gas fee: 0.0004 ETH.", "secondary"],
    ["10:42:04.050", "风控检查通过", "Margin utilized: 12%. Max drawdown check: PASS.", "muted"],
    ["10:42:04.010", "策略生成信号", "Strategy \"Heatwave_Alpha\" triggered BUY signal.", "muted"],
  ] as const;

  return (
    <div className="p-6 border-l-2 border-primary ml-6 my-2 relative">
      <h4 className="text-xs font-bold text-text-muted uppercase mb-4 tracking-wider flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
        生命周期日志
      </h4>
      <div className="space-y-4">
        {items.map(([time, title, desc, tone], idx) => (
          <div key={time} className="flex items-start gap-4 text-xs">
            <div className="min-w-[80px] text-text-muted font-mono">{time}</div>
            <div className="w-6 flex justify-center pt-0.5 relative">
              {idx < items.length - 1 ? <div className="absolute top-2 bottom-[-16px] w-px bg-border-dark" /> : null}
              <div
                className={`h-2 w-2 rounded-full ${
                  tone === "primary"
                    ? "bg-primary ring-4 ring-primary/20"
                    : tone === "secondary"
                      ? "bg-secondary"
                      : "bg-border-dark"
                }`}
              />
            </div>
            <div className="flex-1">
              <span className={tone === "primary" ? "text-white font-bold" : "text-text-main"}>{title}</span>
              <div className="text-text-muted mt-1">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
