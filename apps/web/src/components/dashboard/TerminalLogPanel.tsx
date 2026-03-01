"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TerminalLog } from "@/components/common/TerminalLog";
import { getAuditLogs } from "@/lib/api";

function shortTs(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function TerminalLogPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", 20],
    queryFn: () => getAuditLogs(20),
    refetchInterval: 5000,
    retry: 1,
  });

  const lines = useMemo(() => {
    if (isLoading) {
      return [{ time: "--:--:--", text: "Loading system logs..." }];
    }

    if (!data?.length) {
      return [{ time: shortTs(new Date().toISOString()), text: "System initialized." }];
    }

    return data.slice(0, 12).map((item) => ({
      time: shortTs(item.ts),
      text: `${item.action}: ${item.detail}`,
      tone: item.status === "FAILED" ? ("warning" as const) : item.action.includes("UPDATE") ? ("success" as const) : ("normal" as const),
    }));
  }, [data, isLoading]);

  return <TerminalLog lines={lines} className="h-full" />;
}
