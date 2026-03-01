"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { resolveLocalizedMarketDisplay } from "@weather-trader/shared";
import { ApiError, getMarketScan, getMarkets, type Market } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { MarketGrid } from "./MarketGrid";
import { StatsCard } from "./StatsCard";

const PAGE_SIZE = 6;

type PageItem = number | "ellipsis";

function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }

  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);

  if (current <= 3) {
    start = 2;
    end = 4;
  } else if (current >= total - 2) {
    start = total - 3;
    end = total - 1;
  }

  const items: PageItem[] = [1];
  if (start > 2) {
    items.push("ellipsis");
  }
  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }
  if (end < total - 1) {
    items.push("ellipsis");
  }
  items.push(total);

  return items;
}

export function MarketsView() {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("ALL");
  const [page, setPage] = useState(1);

  const environment = useUiStore((s) => s.environment);
  const setTradeIntent = useUiStore((s) => s.setTradeIntent);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
    retry: 0,
    staleTime: 8000,
    refetchInterval: 8000,
  });

  const markets = useMemo(() => {
    const source = data ?? [];
    return source.map((market) => {
      const localized = resolveLocalizedMarketDisplay({
        id: market.id,
        title: market.title,
        location: market.location,
      });
      return {
        ...market,
        title: localized.title,
        location: localized.location,
      };
    });
  }, [data]);

  const { data: scanRows, isLoading: scanLoading, isError: scanError } = useQuery({
    queryKey: ["market-scan", environment, region, search],
    queryFn: () =>
      getMarketScan({
        env: environment,
        city: region === "ALL" ? undefined : region,
        filters: search.trim() ? search.trim() : undefined,
        sort: "deviation",
      }),
    refetchInterval: 10_000,
    retry: 1,
  });

  const regions = useMemo(() => ["ALL", ...Array.from(new Set(markets.map((m) => m.location)))], [markets]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return markets.filter((market) => {
      if (region !== "ALL" && market.location !== region) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return `${market.title} ${market.id} ${market.location}`.toLowerCase().includes(keyword);
    });
  }, [markets, region, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, region, markets.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedMarkets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const pageItems = useMemo(() => buildPageItems(page, totalPages), [page, totalPages]);

  const oiTotal = filtered.reduce((sum, item) => sum + item.oi, 0);
  const strongest = filtered.reduce<Market | null>((best, item) => {
    if (!best || item.change24h > best.change24h) {
      return item;
    }
    return best;
  }, null);
  const bullishCount = filtered.filter((m) => m.change24h >= 0).length;

  return (
    <>
      <div className="flex shrink-0 items-center gap-3.5 border-b border-border-dark bg-surface-dark/50 p-3.5">
        <div className="relative max-w-md flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-text-muted">search</span>
          <input
            className="w-full rounded-lg border border-border-dark bg-[#0d1117] py-2 pl-9 pr-4 text-sm text-white outline-none transition-all placeholder:text-text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="搜索合约（例如：NYC、>29.4°C）..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="h-6 w-px bg-border-dark" />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {regions.map((item) => (
            <button
              key={item}
              onClick={() => setRegion(item)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                region === item
                  ? "border-primary/30 bg-primary/20 font-bold text-primary"
                  : "border-border-dark bg-surface-dark text-text-muted hover:border-text-muted hover:text-white"
              }`}
            >
              {item === "ALL" ? "全部地区" : item}
            </button>
          ))}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-3.5">
        {isError ? (
          <div className="mb-4 rounded-lg border border-accent-error/40 bg-accent-error/10 px-3 py-2 text-xs text-accent-error">
            交易所实时合约拉取失败：{error instanceof ApiError ? error.code : "exchange_markets_unavailable"}
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-1 gap-3.5 md:grid-cols-4">
          <StatsCard title="市场总持仓量 (OI)" value={`$${oiTotal.toLocaleString()}`} hint={`${filtered.length} 个合约`} icon="trending_up" tone="primary" />
          <StatsCard title="最热交易标的" value={strongest?.title ?? "-"} hint={`${strongest?.change24h.toFixed(1) ?? "0.0"}% (24H)`} icon="local_fire_department" tone="warning" />
          <StatsCard title="主要情绪指标" value={`${bullishCount}/${filtered.length || 1} 看涨`} hint="其余看跌/震荡" icon="analytics" tone="muted" />
          <StatsCard title="活跃合约数" value={`${filtered.filter((m) => m.live).length} 进行中`} hint={`总数 ${filtered.length}`} icon="view_comfy" tone="muted" />
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <span className="material-symbols-outlined text-[18px] text-primary">view_comfy</span>
            所有合约列表
          </h2>
          <span className="text-xs text-text-muted">点击卡片可同步到右侧下单面板</span>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-xs text-text-muted">正在加载实时合约...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-xs text-text-muted">暂无可用实时合约。</div>
        ) : (
          <>
            <MarketGrid markets={pagedMarkets} onPick={(marketId) => setTradeIntent({ marketId, source: "markets" })} />
            {totalPages > 1 ? (
              <div className="mt-2 flex flex-col items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-border-dark bg-surface-dark px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="上一页"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>

                  {pageItems.map((item, idx) =>
                    item === "ellipsis" ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-text-muted">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        className={`h-8 min-w-[2rem] rounded-full px-2 text-xs font-semibold transition-colors ${
                          page === item
                            ? "bg-primary text-surface-dark"
                            : "text-text-muted hover:bg-surface-2 hover:text-white"
                        }`}
                      >
                        {item}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="下一页"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
                <div className="text-[11px] text-text-muted">
                  第 {page} 页 / 共 {totalPages} 页
                </div>
              </div>
            ) : null}
          </>
        )}

        <section className="mt-5 rounded-xl border border-border-dark bg-surface-dark p-3">
          <h3 className="mb-2 text-sm font-bold text-white">市场扫描器（偏离排行）</h3>
          {scanLoading ? (
            <div className="py-3 text-xs text-text-muted">扫描中...</div>
          ) : scanError ? (
            <div className="py-3 text-xs text-accent-error">扫描失败，已降级展示本地列表。</div>
          ) : !scanRows || scanRows.length === 0 ? (
            <div className="py-3 text-xs text-text-muted">暂无扫描结果</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-dark text-text-muted">
                    <th className="py-2 text-left">标的</th>
                    <th className="py-2 text-right">模型概率</th>
                    <th className="py-2 text-right">市场隐含</th>
                    <th className="py-2 text-right">偏离</th>
                    <th className="py-2 text-right">流动性</th>
                    <th className="py-2 text-right">预计滑点</th>
                  </tr>
                </thead>
                <tbody>
                  {scanRows.slice(0, 12).map((item) => (
                    <tr key={item.marketId} className="border-b border-border-dark/60">
                      <td className="py-2 text-white">{item.title}</td>
                      <td className="py-2 text-right text-white">{item.modelProb.toFixed(3)}</td>
                      <td className="py-2 text-right text-white">{item.marketImpliedProb.toFixed(3)}</td>
                      <td className={`py-2 text-right ${item.deviation >= 0 ? "text-primary" : "text-accent-error"}`}>
                        {item.deviation >= 0 ? "+" : ""}
                        {item.deviation.toFixed(4)}
                      </td>
                      <td className="py-2 text-right text-white">{item.liquidityScore.toFixed(1)}</td>
                      <td className="py-2 text-right text-white">{item.estimatedSlippageBps.toFixed(1)}bps</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="z-10 flex h-12 items-center border-t border-border-dark bg-surface-dark px-4">
        <div className="flex w-full items-center gap-4">
          <span className="whitespace-nowrap text-[10px] font-bold uppercase text-text-muted">全局热力图</span>
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[#21262d]">
            <div className="h-full w-[15%] bg-heat-hot" />
            <div className="h-full w-[25%] bg-heat-warm" />
            <div className="h-full w-[40%] bg-heat-cool" />
            <div className="h-full w-[20%] bg-heat-cold" />
          </div>
          <span className="whitespace-nowrap font-mono text-[10px] text-text-muted">成交量: {(oiTotal / 10).toFixed(0)} USDC（24小时）</span>
        </div>
      </div>
    </>
  );
}
