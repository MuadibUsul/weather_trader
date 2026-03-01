"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/common/Button";
import { Panel } from "@/components/common/Panel";
import { ApiError, createOrder, getMarkets } from "@/lib/api";
import { buildMarketCatalog, resolveMarketItem } from "@/lib/market-catalog";
import { useUiStore } from "@/store/ui-store";

function toNumber(input: string, fallback: number) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function mapOrderError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "下单失败，请稍后重试";
  }

  switch (error.code) {
    case "environment_mismatch_with_global_mode":
      return "全局模式已变化，请刷新后重试";
    case "wallet_not_connected":
      return "当前模式钱包未连接";
    case "credential_unhealthy":
      return "当前模式 API 凭据异常";
    case "insufficient_balance":
      return "余额不足，无法下单";
    case "real_gateway_not_configured":
      return "REAL 交易网关未配置，已禁止真实下单";
    default:
      return `下单失败：${error.code}`;
  }
}

export function QuickTradePanel() {
  const queryClient = useQueryClient();

  const tradeIntent = useUiStore((s) => s.tradeIntent);
  const clearTradeIntent = useUiStore((s) => s.clearTradeIntent);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [marketId, setMarketId] = useState("");
  const [price, setPrice] = useState(0.5);
  const [quantity, setQuantity] = useState(100);
  const [message, setMessage] = useState("");

  const environment = useUiStore((s) => s.environment);
  const profile = useUiStore((s) => s.profiles[s.environment]);
  const isReal = environment === "REAL";

  const { data: marketsData, isLoading: marketsLoading, isError: marketsError } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
    retry: 1,
    staleTime: 4000,
    refetchInterval: 8000,
  });

  const marketSource = useMemo(() => marketsData ?? [], [marketsData]);
  const marketCatalog = useMemo(() => buildMarketCatalog(marketSource), [marketSource]);

  const currentMarket = useMemo(() => resolveMarketItem(marketCatalog, marketId) ?? marketCatalog[0], [marketCatalog, marketId]);

  useEffect(() => {
    if (!marketCatalog.length) {
      return;
    }

    if (!marketId || !resolveMarketItem(marketCatalog, marketId)) {
      const first = marketCatalog[0];
      setMarketId(first.id);
      setPrice(side === "buy" ? first.ask : first.bid);
    }
  }, [marketCatalog, marketId, side]);

  useEffect(() => {
    if (!tradeIntent || tradeIntent.source !== "dashboard") {
      return;
    }

    const item = resolveMarketItem(marketCatalog, tradeIntent.marketId);
    if (item) {
      setMarketId(item.id);
      setPrice(side === "buy" ? item.ask : item.bid);
      setMessage(`已切换到 ${item.title}`);
    }

    clearTradeIntent();
  }, [tradeIntent, clearTradeIntent, marketCatalog, side]);

  const orderMutation = useMutation({
    mutationFn: () =>
      createOrder({
        marketId: currentMarket?.id ?? marketId,
        side,
        quantity,
        price,
        environment,
      }),
    onSuccess: async (order) => {
      setMessage(`下单成功：${order.id}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["system-state"] }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ]);
    },
    onError: (error) => {
      setMessage(mapOrderError(error));
    },
  });

  function submit() {
    if (!currentMarket) {
      setMessage("暂无可交易合约");
      return;
    }

    if (quantity <= 0 || price <= 0 || price > 1) {
      setMessage("请输入有效价格与数量");
      return;
    }

    setMessage("");
    orderMutation.mutate();
  }

  return (
    <Panel
      title="快速交易"
      icon={<span className="material-symbols-outlined text-white text-[20px]">flash_on</span>}
      className="shadow-lg"
    >
      <div id="quick-trade-panel" className="p-3.5 flex flex-col gap-3">
        <div className="grid grid-cols-2 bg-black rounded-lg p-1 border border-border-dark">
          <button
            className={`h-7.5 text-xs font-bold rounded ${
              side === "buy" ? "bg-primary text-surface-dark shadow-sm" : "text-text-muted hover:text-white"
            }`}
            onClick={() => {
              setSide("buy");
              if (currentMarket) {
                setPrice(currentMarket.ask);
              }
            }}
          >
            买入 (Long)
          </button>
          <button
            className={`h-7.5 text-xs font-bold rounded ${
              side === "sell" ? "bg-primary text-surface-dark shadow-sm" : "text-text-muted hover:text-white"
            }`}
            onClick={() => {
              setSide("sell");
              if (currentMarket) {
                setPrice(currentMarket.bid);
              }
            }}
          >
            卖出 (Short)
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-muted font-medium">标的资产</label>
          <div className="relative">
            <select
              value={currentMarket?.id ?? ""}
              onChange={(e) => {
                const item = resolveMarketItem(marketCatalog, e.target.value);
                if (!item) {
                  return;
                }
                setMarketId(item.id);
                setPrice(side === "buy" ? item.ask : item.bid);
              }}
              className="w-full h-8.5 bg-background-dark border border-border-dark text-white text-sm rounded-lg px-3 appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              disabled={!marketCatalog.length}
            >
              {marketCatalog.length === 0 ? (
                <option value="">{marketsLoading ? "实时合约加载中..." : "无可用实时合约"}</option>
              ) : null}
              {marketCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1.5 pointer-events-none text-text-muted text-[20px]">
              expand_more
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium">限价 (Odds)</label>
            <input
              className="w-full h-8.5 bg-background-dark border border-border-dark text-white text-sm rounded-lg px-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              type="number"
              value={price}
              onChange={(e) => setPrice(toNumber(e.target.value, price))}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium">数量 ({profile.wallet.unit})</label>
            <input
              className="w-full h-8.5 bg-background-dark border border-border-dark text-white text-sm rounded-lg px-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              value={quantity}
              onChange={(e) => setQuantity(toNumber(e.target.value, quantity))}
              type="number"
              min={0}
              step={1}
            />
          </div>
        </div>

        <div className="flex gap-1.5">
          <span className="px-2 py-1 rounded bg-border-dark text-[10px] text-text-muted font-mono">LIMIT</span>
          <span className="px-2 py-1 rounded bg-border-dark text-[10px] text-text-muted font-mono">GTC</span>
          {currentMarket ? <span className="px-2 py-1 rounded bg-border-dark text-[10px] text-text-muted font-mono">{currentMarket.exp}</span> : null}
        </div>

        <div className="h-px bg-border-dark" />

        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">执行环境</span>
          <span className="text-primary font-bold flex items-center gap-1 text-[11px]">
            <span className="material-symbols-outlined text-[13px]">account_balance_wallet</span>
            {profile.wallet.label}
          </span>
        </div>

        <div
          className={clsx(
            "rounded-lg border px-3 py-2 text-[11px] leading-relaxed",
            isReal
              ? "border-accent-warning/30 bg-accent-warning/10 text-accent-warning"
              : "border-secondary/30 bg-secondary/10 text-secondary",
          )}
        >
          {isReal ? "REAL 模式会提交真实订单并消耗真实资产。" : "PAPER 模式仅提交模拟订单，用于策略验证。"}
        </div>

        {message ? <div className="text-[11px] text-text-muted">{message}</div> : null}
        {marketsError ? <div className="text-[11px] text-accent-error">实时合约加载失败，暂时无法下单。</div> : null}

        <Button
          fullWidth
          onClick={submit}
          disabled={orderMutation.isPending || !currentMarket}
          className={clsx("group", !isReal && "bg-secondary hover:bg-secondary/80 text-white")}
        >
          <span>{orderMutation.isPending ? "提交中..." : isReal ? "REAL: 提交真实订单" : "PAPER: 提交模拟订单"}</span>
          <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </Button>
      </div>
    </Panel>
  );
}
