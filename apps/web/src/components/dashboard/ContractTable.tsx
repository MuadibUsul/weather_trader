"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { resolveLocalizedMarketDisplay } from "@weather-trader/shared";
import { getMarkets } from "@/lib/api";
import { buildMarketCatalog } from "@/lib/market-catalog";
import { useUiStore } from "@/store/ui-store";
import { Button } from "@/components/common/Button";
import { Panel } from "@/components/common/Panel";
import { Table } from "@/components/common/Table";

type ContractRow = {
  name: string;
  exp: string;
  odds: number;
  change: number;
  marketId: string;
  live: boolean;
};

export function ContractTable() {
  const setTradeIntent = useUiStore((s) => s.setTradeIntent);

  const [showPositiveOnly, setShowPositiveOnly] = useState(false);
  const [message, setMessage] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
    retry: 1,
    staleTime: 4000,
    refetchInterval: 8000,
  });

  const rows = useMemo<ContractRow[]>(() => {
    const source = data ?? [];
    const catalog = buildMarketCatalog(source);
    const expById = new Map(catalog.map((item) => [item.id, item.exp]));

    return [...source]
      .sort((a, b) => {
        const liveRank = Number(b.live) - Number(a.live);
        if (liveRank !== 0) {
          return liveRank;
        }
        return Math.abs(b.change24h) - Math.abs(a.change24h);
      })
      .slice(0, 6)
      .map((item) => ({
        name: resolveLocalizedMarketDisplay({
          id: item.id,
          title: item.title,
          location: item.location,
        }).title,
        exp: expById.get(item.id) ?? "--",
        odds: item.odds,
        change: item.change24h,
        marketId: item.id,
        live: item.live,
      }));
  }, [data]);

  const visibleRows = showPositiveOnly ? rows.filter((item) => item.change >= 0) : rows;

  return (
    <Panel
      title="交易所实时合约"
      icon={<span className="material-symbols-outlined text-primary text-[20px]">water_drop</span>}
      className="flex-1"
      actions={
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded hover:bg-border-dark text-text-muted"
            onClick={async () => {
              const result = await refetch();
              if (result.error) {
                setMessage("合约刷新失败，请稍后重试");
                return;
              }
              setMessage(`合约已刷新（${new Date().toLocaleTimeString()}）`);
            }}
            title="刷新合约"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
          <button
            className={`p-1.5 rounded transition-colors ${showPositiveOnly ? "bg-primary/15 text-primary" : "hover:bg-border-dark text-text-muted"}`}
            onClick={() => {
              setShowPositiveOnly((prev) => !prev);
              setMessage(showPositiveOnly ? "已展示全部合约" : "仅展示 24H 正向变化合约");
            }}
            title="筛选"
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
          </button>
        </div>
      }
    >
      {message ? <div className="px-4 pt-2 text-[11px] text-text-muted">{message}</div> : null}

      <Table
        className="flex-1"
        head={
          <tr>
            <th className="px-4 py-3 font-medium border-b border-border-dark">合约名称</th>
            <th className="px-4 py-3 font-medium border-b border-border-dark text-right">当前赔率</th>
            <th className="px-4 py-3 font-medium border-b border-border-dark text-right">24H 变化</th>
            <th className="px-4 py-3 font-medium border-b border-border-dark text-right">概率趋势</th>
            <th className="px-4 py-3 font-medium border-b border-border-dark text-right">操作</th>
          </tr>
        }
        body={
          isLoading || isFetching ? (
            <tr>
              <td className="px-4 py-8 text-center text-text-muted" colSpan={5}>
                加载中...
              </td>
            </tr>
          ) : visibleRows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-text-muted" colSpan={5}>
                暂无可用合约
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => {
              const tone = row.change > 0 ? "up" : row.change < 0 ? "down" : "flat";
              const changeToneClass =
                tone === "up" ? "text-primary" : tone === "down" ? "text-accent-error" : "text-text-muted";
              return (
                <tr key={row.marketId} className="hover:bg-white/5 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-white font-medium flex items-center gap-2">
                        {row.name}
                        {row.live ? <span className="text-[10px] text-primary font-bold">LIVE</span> : null}
                      </span>
                      <span className="text-xs text-text-muted">Exp: {row.exp}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white font-bold">{row.odds.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${changeToneClass}`}>
                    {row.change > 0 ? `+${row.change.toFixed(2)}%` : `${row.change.toFixed(2)}%`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center h-full">
                      <div
                        className={`w-16 h-6 rounded-sm border-b ${
                          tone === "up"
                            ? "bg-gradient-to-r from-transparent via-primary/20 to-primary/50 border-primary"
                            : tone === "down"
                              ? "bg-gradient-to-r from-transparent via-accent-error/20 to-accent-error/50 border-accent-error"
                              : "bg-gradient-to-r from-transparent via-text-muted/10 to-text-muted/20 border-text-muted"
                        }`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="primary"
                      className="px-3 py-1 rounded text-xs"
                      onClick={() => {
                        setTradeIntent({ marketId: row.marketId, source: "dashboard" });
                        setMessage(`已将 ${row.name} 填入快速交易面板`);
                        document.getElementById("quick-trade-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                    >
                      TRADE
                    </Button>
                  </td>
                </tr>
              );
            })
          )
        }
      />
    </Panel>
  );
}
