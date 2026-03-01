"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/lib/api";

const LATEST_LIMIT = 5;

function formatTs(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function AuditTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", LATEST_LIMIT],
    queryFn: () => getAuditLogs(LATEST_LIMIT),
    retry: 1,
    refetchInterval: 5000,
  });

  const logs = data ?? [];

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-4 flex-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-text-muted text-[20px]">history_edu</span>
          审计日志
        </h3>
        <span className="text-xs text-text-muted">仅展示最新 5 条</span>
      </div>

      <div className="overflow-hidden border border-border-dark rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1c2128] text-xs text-text-muted font-medium uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 border-b border-border-dark">时间戳</th>
              <th className="px-4 py-3 border-b border-border-dark">活动类型</th>
              <th className="px-4 py-3 border-b border-border-dark">环境</th>
              <th className="px-4 py-3 border-b border-border-dark">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark text-sm bg-black/20">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted text-sm">
                  加载中...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted text-sm">
                  暂无审计记录
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">{formatTs(log.ts)}</td>
                  <td className="px-4 py-3 text-white">{log.action}</td>
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">{log.environment}</td>
                  <td className="px-4 py-3">
                    <span className={`${log.status === "SUCCESS" ? "text-primary" : "text-accent-error"} text-xs font-bold`}>
                      {log.status === "SUCCESS" ? "成功" : "失败"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
