const logs = [
  ["2024-05-20 10:42:05", "API Key 修改", "192.168.1.1", "成功"],
  ["2024-05-20 09:15:00", "WEB 登录", "192.168.1.1", "成功"],
  ["2024-05-19 22:30:11", "提现 (USDC)", "192.168.1.1", "成功"],
  ["2024-05-19 14:20:00", "PIN 验证失败", "203.0.113.42", "失败"],
] as const;

export function AuditTable() {
  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-5 flex-1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-text-muted text-[20px]">history_edu</span>
          审计日志
        </h3>
        <button className="text-xs text-primary hover:underline">查看全部</button>
      </div>
      <div className="overflow-hidden border border-border-dark rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1c2128] text-xs text-text-muted font-medium uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 border-b border-border-dark">时间戳</th>
              <th className="px-4 py-3 border-b border-border-dark">活动类型</th>
              <th className="px-4 py-3 border-b border-border-dark">IP 地址</th>
              <th className="px-4 py-3 border-b border-border-dark">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark text-sm bg-black/20">
            {logs.map((log) => (
              <tr key={`${log[0]}-${log[1]}`} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-text-muted font-mono text-xs">{log[0]}</td>
                <td className="px-4 py-3 text-white">{log[1]}</td>
                <td className="px-4 py-3 text-text-muted font-mono text-xs">{log[2]}</td>
                <td className="px-4 py-3">
                  <span className={`${log[3] === "成功" ? "text-primary" : "text-accent-error"} text-xs font-bold`}>
                    {log[3]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
