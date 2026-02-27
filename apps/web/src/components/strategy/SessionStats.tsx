export function SessionStats() {
  const stats = [
    ["今日触发次数", "124", "text-white"],
    ["自动交易累计 PnL", "+4.2%", "text-primary"],
    ["风控拦截", "2", "text-accent-warning"],
    ["运行时间", "04:12:33", "text-white"],
  ] as const;

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-5 mt-auto">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary">monitoring</span>
        <h3 className="text-sm font-bold text-white">策略执行统计 (Session Stats)</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map(([label, value, tone]) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
            <div className={`text-2xl font-mono font-bold ${tone}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
