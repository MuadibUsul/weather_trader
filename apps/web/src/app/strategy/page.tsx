"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StrategyConfigDto } from "@weather-trader/shared";
import { Button } from "@/components/common/Button";
import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { ModelSelectCard } from "@/components/strategy/ModelSelectCard";
import { RiskForm } from "@/components/strategy/RiskForm";
import { SessionStats } from "@/components/strategy/SessionStats";
import { ThresholdSlider } from "@/components/strategy/ThresholdSlider";
import {
  ApiError,
  getStrategy,
  getStrategyRuntime,
  listStrategies,
  startStrategy,
  stopStrategy,
  updateStrategy,
} from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

function mapStartError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "操作失败，请稍后重试";
  }
  switch (error.code) {
    case "auto_trade_not_enabled":
      return "自动交易开关未开启，系统已阻止启动。";
    case "wallet_not_available_in_environment":
      return "所选钱包不属于当前环境，请重新选择。";
    case "wallet_not_connected":
      return "钱包未连接，请先在“钱包管理”完成绑定。";
    case "credential_unhealthy":
      return "API 凭据不可用，请先在“API 凭据”页完成配置。";
    case "strategy_real_not_approved":
      return "该策略尚未通过 REAL 审批，不能在 REAL 自动交易。";
    default:
      return `操作失败：${error.code}`;
  }
}

function StrategyWorkspace() {
  const queryClient = useQueryClient();
  const environment = useUiStore((s) => s.environment);
  const profiles = useUiStore((s) => s.profiles);
  const currentWallet = profiles[environment].wallet;

  const { data, isLoading } = useQuery({
    queryKey: ["strategy"],
    queryFn: getStrategy,
    retry: 1,
  });
  const { data: runtime, isLoading: runtimeLoading } = useQuery({
    queryKey: ["strategy-runtime"],
    queryFn: getStrategyRuntime,
    refetchInterval: 2000,
    retry: 1,
  });
  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ["strategies"],
    queryFn: listStrategies,
    retry: 1,
  });

  const [draft, setDraft] = useState<StrategyConfigDto | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState("");
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    if (data) {
      setDraft(data);
      setStatus("idle");
      setStatusText("");
      setSelectedStrategyId((prev) => prev || data.strategyId || "");
    }
  }, [data]);

  useEffect(() => {
    if (!strategies || strategies.length === 0) {
      return;
    }
    setSelectedStrategyId((prev) => {
      if (prev && strategies.some((item) => item.id === prev)) {
        return prev;
      }
      if (data?.strategyId && strategies.some((item) => item.id === data.strategyId)) {
        return data.strategyId;
      }
      return strategies[0].id;
    });
  }, [data?.strategyId, strategies]);

  useEffect(() => {
    setSelectedWalletId(currentWallet.address);
  }, [currentWallet.address]);

  const dirty = useMemo(() => {
    if (!data || !draft) {
      return false;
    }
    return JSON.stringify(data) !== JSON.stringify(draft);
  }, [data, draft]);

  const saveMutation = useMutation({
    mutationFn: (payload: StrategyConfigDto) => updateStrategy(payload),
    onSuccess: async (next) => {
      setDraft(next);
      setStatus("saved");
      setStatusText("配置已保存");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["strategy"] }),
        queryClient.invalidateQueries({ queryKey: ["strategy-runtime"] }),
      ]);
    },
    onError: (error) => {
      setStatus("error");
      setStatusText(mapStartError(error));
    },
  });

  const startMutation = useMutation({
    mutationFn: startStrategy,
    onSuccess: async () => {
      setStatus("saved");
      setStatusText("策略已启动");
      await queryClient.invalidateQueries({ queryKey: ["strategy-runtime"] });
    },
    onError: (error) => {
      setStatus("error");
      setStatusText(mapStartError(error));
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopStrategy,
    onSuccess: async () => {
      setStatus("idle");
      setStatusText("策略已停止");
      await queryClient.invalidateQueries({ queryKey: ["strategy-runtime"] });
    },
    onError: (error) => {
      setStatus("error");
      setStatusText(mapStartError(error));
    },
  });

  if (isLoading || !draft) {
    return <section className="h-full flex items-center justify-center text-text-muted">策略配置加载中...</section>;
  }

  function updateDraft(patch: Partial<StrategyConfigDto>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setStatus("idle");
  }

  function reset() {
    if (!data) {
      return;
    }
    setDraft(data);
    setStatus("idle");
  }

  async function save(): Promise<boolean> {
    if (!draft) {
      return false;
    }
    try {
      await saveMutation.mutateAsync(draft);
      return true;
    } catch {
      return false;
    }
  }

  async function startRunner() {
    if (!draft) {
      return;
    }
    if (!selectedStrategyId || !selectedWalletId) {
      setStatus("error");
      setStatusText("请先选择策略和钱包");
      return;
    }

    const shouldPatchStrategyId = draft.strategyId !== selectedStrategyId;
    const shouldEnableAutoTrade = !draft.autoTradeEnabled;
    const effectiveDraft =
      shouldPatchStrategyId || shouldEnableAutoTrade
        ? { ...draft, strategyId: selectedStrategyId, autoTradeEnabled: true }
        : draft;
    if (shouldPatchStrategyId) {
      setDraft(effectiveDraft);
    }
    if (shouldEnableAutoTrade) {
      setDraft(effectiveDraft);
    }

    if (dirty || shouldPatchStrategyId || shouldEnableAutoTrade) {
      try {
        await saveMutation.mutateAsync(effectiveDraft);
      } catch {
        setStatus("error");
        setStatusText("保存策略配置失败，请重试");
        return;
      }
    }

    try {
      await startMutation.mutateAsync({
        strategyId: selectedStrategyId,
        walletId: selectedWalletId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus("error");
        setStatusText(mapStartError(error));
      }
    }
  }

  async function stopRunner() {
    await stopMutation.mutateAsync();
  }

  const canStart =
    Boolean(selectedStrategyId) &&
    Boolean(selectedWalletId) &&
    !saveMutation.isPending &&
    !startMutation.isPending &&
    !stopMutation.isPending;

  return (
    <section className="h-full overflow-y-auto pb-4">
      <div className="w-full max-w-[1240px] mx-auto space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border-dark">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">settings_applications</span>
            策略与风控配置
          </h2>
          <div className="flex gap-3">
            <Button
              variant={runtime?.running ? "ghost" : "primary"}
              onClick={runtime?.running ? stopRunner : startRunner}
              disabled={runtime?.running ? saveMutation.isPending || startMutation.isPending || stopMutation.isPending : !canStart}
            >
              <span className="material-symbols-outlined text-[18px]">
                {runtime?.running ? "pause_circle" : "play_circle"}
              </span>
              {runtime?.running ? "停止策略" : "启动策略"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={!dirty || saveMutation.isPending}>
              重置默认
            </Button>
            <Button onClick={() => void save()} disabled={!dirty || saveMutation.isPending}>
              <span className="material-symbols-outlined text-[18px]">save</span>
              {saveMutation.isPending ? "保存中..." : "保存并重载"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border-dark bg-surface-dark p-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-text-muted">启动策略</label>
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border-dark bg-background-dark px-3 text-sm text-white outline-none focus:border-primary"
              disabled={Boolean(runtime?.running) || strategiesLoading}
            >
              {(strategies ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.id})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">交易钱包</label>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border-dark bg-background-dark px-3 font-mono text-sm text-white outline-none focus:border-primary"
              disabled={Boolean(runtime?.running)}
            >
              <option value={currentWallet.address}>
                {currentWallet.label} ({environment}) - {currentWallet.address}
              </option>
            </select>
          </div>
          <div className="text-xs text-text-muted md:col-span-2">
            交易闭环：先在“钱包管理”完成钱包绑定，再在本页选择策略与钱包启动。运行中禁止切换启动参数。
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            {status === "saved" && (statusText || "配置已保存")}
            {status === "error" && (statusText || "操作失败，请检查自动交易开关、钱包/凭据状态及启动参数")}
            {status === "idle" && (dirty ? "存在未保存修改" : "已与服务端同步")}
          </span>
          <span>
            数据源 /strategy | 运行态 {runtime?.running ? "RUNNING" : "STOPPED"} {runtime?.environment ?? "--"} | 策略{" "}
            {runtime?.activeStrategyId ?? "--"} | 钱包 {runtime?.activeWalletId ?? "--"}
          </span>
        </div>

        <SessionStats runtime={runtime} isLoading={runtimeLoading} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <ModelSelectCard
              enabled={draft.autoTradeEnabled}
              model={draft.model}
              onEnabledChange={(next) => updateDraft({ autoTradeEnabled: next })}
              onModelChange={(next) => updateDraft({ model: next })}
            />

            <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
              <div className="p-4 border-b border-border-dark bg-[#1c2128]">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">monitoring</span>
                  阈值配置
                </h3>
              </div>
              <div className="p-6">
                <ThresholdSlider
                  threshold={draft.triggerThreshold}
                  updateFrequencySec={draft.updateFrequencySec}
                  onThresholdChange={(value) => updateDraft({ triggerThreshold: value })}
                  onUpdateFrequencyChange={(value) => updateDraft({ updateFrequencySec: value })}
                />
              </div>
            </div>
          </div>

          <RiskForm
            maxDailyLoss={draft.maxDailyLoss}
            maxPositionSize={draft.maxPositionSize}
            maxOpenPositions={draft.maxOpenPositions}
            slippageBps={draft.slippageBps}
            onChange={(patch) => updateDraft(patch)}
          />
        </div>
      </div>
    </section>
  );
}

export default function StrategyPage() {
  return (
    <PageTransition>
      <AppShell activeRoute="/strategy" main={<StrategyWorkspace />} />
    </PageTransition>
  );
}
