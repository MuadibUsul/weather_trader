"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/common/Button";
import { ApiError, createOrder, getMarkets, getOrderQuote, previewOrder } from "@/lib/api";
import { buildMarketCatalog, resolveMarketItem } from "@/lib/market-catalog";
import { useUiStore } from "@/store/ui-store";

function parseNumber(input: string, fallback: number) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function mapError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "下单失败";
  }
  if (error.code === "market_not_found") {
    return "合约不存在或已下线，请刷新行情列表";
  }
  if (error.code === "exchange_markets_unavailable") {
    return "交易所行情暂不可用，无法预检";
  }
  if (error.code === "real_gateway_not_configured") {
    return "REAL 交易网关未配置，已禁止真实下单";
  }
  return error.code;
}

function mapRiskReason(reason?: string) {
  switch (reason) {
    case "single_market_limit_hit":
      return "触发单市场风险上限";
    case "portfolio_exposure_limit_hit":
      return "触发组合敞口上限";
    case "daily_loss_limit_hit":
      return "触发当日最大亏损限制";
    case "slippage_limit_hit":
      return "触发滑点保护阈值";
    case "strategy_frozen_by_consecutive_losses":
      return "策略因连续亏损被冻结";
    case "insufficient_balance":
      return "可用余额不足";
    default:
      return reason ?? "未知风控结果";
  }
}

export function TradeDrawer() {
  const queryClient = useQueryClient();

  const environment = useUiStore((s) => s.environment);
  const profile = useUiStore((s) => s.profiles[s.environment]);
  const tradeIntent = useUiStore((s) => s.tradeIntent);
  const clearTradeIntent = useUiStore((s) => s.clearTradeIntent);

  const [selectedId, setSelectedId] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState(0.5);
  const [quantity, setQuantity] = useState(50);
  const [message, setMessage] = useState("");

  const { data: marketsData, isLoading: marketsLoading, isError: marketsError } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
    retry: 1,
    staleTime: 4000,
    refetchInterval: 8000,
  });

  const marketSource = useMemo(() => marketsData ?? [], [marketsData]);
  const marketCatalog = useMemo(() => buildMarketCatalog(marketSource), [marketSource]);

  const selected = useMemo(() => resolveMarketItem(marketCatalog, selectedId) ?? marketCatalog[0], [marketCatalog, selectedId]);
  const selectedMarketId = selected?.id ?? selectedId;

  const { data: quote } = useQuery({
    queryKey: ["order-quote", environment, selectedMarketId],
    queryFn: () => getOrderQuote({ marketId: selectedMarketId, environment }),
    enabled: Boolean(selectedMarketId),
    staleTime: 1200,
    refetchInterval: 3000,
    retry: 1,
  });

  const bestBid = quote?.bestBid ?? selected?.bid ?? 0;
  const bestAsk = quote?.bestAsk ?? selected?.ask ?? 0;

  useEffect(() => {
    if (!marketCatalog.length) {
      return;
    }

    if (!selectedId || !resolveMarketItem(marketCatalog, selectedId)) {
      const first = marketCatalog[0];
      setSelectedId(first.id);
      setPrice(side === "buy" ? bestAsk : bestBid);
    }
  }, [marketCatalog, selectedId, side, bestAsk, bestBid]);

  useEffect(() => {
    if (!tradeIntent || tradeIntent.source !== "markets") {
      return;
    }

    const market = resolveMarketItem(marketCatalog, tradeIntent.marketId);
    if (market) {
      setSelectedId(market.id);
      setPrice(side === "buy" ? bestAsk : bestBid);
      setMessage(`已选中 ${market.title}`);
    }

    clearTradeIntent();
  }, [tradeIntent, clearTradeIntent, marketCatalog, side, bestAsk, bestBid]);

  const { data: preview, isFetching: previewLoading, isError: previewError, error: previewRawError } = useQuery({
    queryKey: ["order-preview", environment, selectedMarketId, side, price, quantity],
    queryFn: () =>
      previewOrder({
        marketId: selectedMarketId,
        side,
        quantity,
        price,
        environment,
      }),
    enabled: Boolean(selectedMarketId) && quantity > 0 && price > 0,
    retry: 0,
    staleTime: 800,
  });
  const previewErrorText = previewError ? mapError(previewRawError) : "";

  const orderMutation = useMutation({
    mutationFn: () =>
      createOrder({
        marketId: selected?.id ?? selectedId,
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
      setMessage(`下单失败：${mapError(error)}`);
    },
  });

  return (
    <aside className="w-drawer bg-surface-dark border-l border-border-dark hidden lg:flex flex-col shrink-0 z-30 shadow-2xl">
      <div className="p-4 border-b border-border-dark bg-[#1c2128] flex justify-between items-center">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-white text-[20px]">shopping_cart_checkout</span>
          快速下单预览
        </h2>
        <span className="text-[11px] text-text-muted">{environment}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
        <div className="bg-black/30 rounded-lg p-3 border border-border-dark">
          <div className="mb-2">
            <label className="text-xs text-text-muted">合约</label>
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const next = resolveMarketItem(marketCatalog, e.target.value);
                if (!next) {
                  return;
                }
                setSelectedId(next.id);
                setPrice(side === "buy" ? bestAsk : bestBid);
              }}
              className="w-full mt-1 h-8.5 rounded-lg bg-background-dark border border-border-dark text-sm text-white px-3"
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
          </div>

          <h3 className="text-base font-bold text-white mb-1">{selected?.title ?? "--"}</h3>
          <div className="text-xs text-text-muted mb-3">Exp: {selected?.exp ?? "--"}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-surface-dark p-2 rounded border border-border-dark/50">
              <div className="text-text-muted">Best Bid</div>
              <div className="text-primary font-mono font-bold">{bestBid.toFixed(2)}</div>
            </div>
            <div className="bg-surface-dark p-2 rounded border border-border-dark/50">
              <div className="text-text-muted">Best Ask</div>
              <div className="text-accent-error font-mono font-bold">{bestAsk.toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-text-muted">
            报价源: {quote?.source ?? (selected ? "LOCAL" : "--")} {quote?.spreadBps !== undefined ? `| Spread ${quote.spreadBps.toFixed(2)} bps` : ""}
          </div>
        </div>

        <div className="grid grid-cols-2 bg-black rounded-lg p-1 border border-border-dark">
          <button
            onClick={() => {
              setSide("buy");
              setPrice(bestAsk);
            }}
            className={`py-1.5 text-sm font-bold rounded ${side === "buy" ? "bg-primary text-surface-dark shadow-sm" : "text-text-muted hover:text-white"}`}
          >
            买入 (Long)
          </button>
          <button
            onClick={() => {
              setSide("sell");
              setPrice(bestBid);
            }}
            className={`py-1.5 text-sm font-bold rounded ${side === "sell" ? "bg-primary text-surface-dark shadow-sm" : "text-text-muted hover:text-white"}`}
          >
            卖出 (Short)
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium flex justify-between">
              <span>限价 (Odds)</span>
              <span
                className="text-primary cursor-pointer hover:underline"
                onClick={() => {
                  setPrice(side === "buy" ? bestAsk : bestBid);
                }}
              >
                使用盘口
              </span>
            </label>
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              type="number"
              value={price}
              onChange={(e) => setPrice(parseNumber(e.target.value, price))}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted font-medium flex justify-between">
              <span>数量 ({profile.wallet.unit})</span>
              <span className="text-text-muted">Max: {profile.wallet.balance.toLocaleString()}</span>
            </label>
            <input
              className="w-full bg-[#0d1117] border border-border-dark text-white text-sm rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              value={quantity}
              onChange={(e) => setQuantity(parseNumber(e.target.value, quantity))}
              type="number"
              min={0}
              step={1}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <button
              key={ratio}
              onClick={() => setQuantity(Number((profile.wallet.balance * ratio).toFixed(2)))}
              className="bg-surface-dark hover:bg-border-dark border border-border-dark text-[10px] py-1 rounded text-text-muted transition-colors"
            >
              {ratio === 1 ? "MAX" : `${ratio * 100}%`}
            </button>
          ))}
        </div>

        <div className="bg-surface-dark rounded-lg p-3 border border-border-dark text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-text-muted">名义价值</span>
            <span className="text-white font-mono">${(preview?.notional ?? quantity * price).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">费用 (Est.)</span>
            <span className="text-white">{(preview?.estimatedFee ?? quantity * price * 0.001).toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">预计滑点</span>
            <span className="text-white">{(preview?.estimatedSlippageBps ?? 0).toFixed(2)} bps</span>
          </div>
          <div className="h-px bg-border-dark my-1" />
          <div className="flex justify-between items-center">
            <span className="text-text-muted">风控检查</span>
            <span
              className={`font-bold flex items-center gap-1 ${
                previewError || preview?.risk.pass === false ? "text-accent-error" : "text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">{preview?.risk.pass === false ? "error" : "check_circle"}</span>
              {previewLoading ? "Checking" : previewError || preview?.risk.pass === false ? "Reject" : "Pass"}
            </span>
          </div>
          {previewError ? <div className="text-[11px] text-accent-error">{previewErrorText}</div> : null}
          {preview?.risk.pass === false ? (
            <div className="text-[11px] text-accent-error">{mapRiskReason(preview.risk.reason)}</div>
          ) : null}
        </div>

        {message ? <div className="text-[11px] text-text-muted">{message}</div> : null}
        {marketsError ? <div className="text-[11px] text-accent-error">实时合约加载失败，暂时无法下单。</div> : null}

        <Button
          fullWidth
          onClick={() => {
            if (previewError) {
              setMessage(`预检失败：${previewErrorText}`);
              return;
            }
            if (preview && !preview.risk.pass) {
              setMessage(`风控拒绝：${mapRiskReason(preview.risk.reason)}`);
              return;
            }
            orderMutation.mutate();
          }}
          disabled={
            orderMutation.isPending ||
            quantity <= 0 ||
            price <= 0 ||
            !selected ||
            previewError ||
            preview?.risk.pass === false
          }
          className="mt-auto group shadow-lg shadow-primary/20"
        >
          <span>{orderMutation.isPending ? "提交中..." : "确认下单"}</span>
          <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </Button>
      </div>
    </aside>
  );
}
