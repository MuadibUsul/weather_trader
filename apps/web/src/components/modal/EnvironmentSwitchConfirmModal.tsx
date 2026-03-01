"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/common/Modal";
import { ApiError, getEnvStatus, switchEnvironment } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { PinInput } from "./PinInput";

function mapError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "切换失败，请稍后重试。";
  }

  switch (error.code) {
    case "invalid_trade_pin":
      return "Trade PIN 错误，请重新输入。";
    case "acknowledgement_required":
      return "请先确认风险提示后再切换。";
    case "wallet_not_connected":
      return "目标环境钱包未连接，无法切换。";
    case "credential_unhealthy":
      return "目标环境 API 凭据异常，无法切换。";
    case "no_real_approved_strategy":
      return "暂无通过 REAL 审批的策略，禁止切换。";
    case "real_wallet_not_connected":
      return "REAL 钱包未连接，无法切换。";
    case "real_credential_unhealthy":
      return "REAL 凭据异常，无法切换。";
    case "real_gateway_not_configured":
      return "REAL 交易网关未配置，无法切换。";
    default:
      return `切换失败：${error.code}`;
  }
}

function mapGuardReason(reason: string): string {
  switch (reason) {
    case "real_wallet_not_connected":
      return "REAL 钱包未连接";
    case "real_credential_unhealthy":
      return "REAL 凭据异常";
    case "no_real_approved_strategy":
      return "没有通过审批的 REAL 策略";
    case "real_gateway_not_configured":
      return "REAL 执行网关未配置";
    default:
      return reason;
  }
}

export function EnvironmentSwitchConfirmModal() {
  const queryClient = useQueryClient();

  const open = useUiStore((s) => s.modalOpen);
  const close = useUiStore((s) => s.closeModal);
  const environment = useUiStore((s) => s.environment);
  const profiles = useUiStore((s) => s.profiles);
  const hydrateSystemState = useUiStore((s) => s.hydrateSystemState);

  const [pin, setPin] = useState("");
  const [errorText, setErrorText] = useState("");
  const [pinError, setPinError] = useState(false);

  const nextEnv = useMemo(() => (environment === "REAL" ? "PAPER" : "REAL"), [environment]);
  const currentProfile = profiles[environment];
  const nextProfile = profiles[nextEnv];
  const { data: envStatus } = useQuery({
    queryKey: ["env-status", nextEnv],
    queryFn: () => getEnvStatus(nextEnv),
    enabled: open,
    refetchInterval: open ? 5000 : false,
    retry: 1,
  });
  const guardReasons = envStatus?.reasons ?? [];

  const switchMutation = useMutation({
    mutationFn: () =>
      switchEnvironment({
        target: nextEnv,
        pin,
        acknowledged: true,
      }),
    onSuccess: async (state) => {
      hydrateSystemState(state);
      setErrorText("");
      setPinError(false);
      close();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["system-state"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ]);
    },
    onError: (error) => {
      setPinError(true);
      setErrorText(mapError(error));
    },
  });

  useEffect(() => {
    if (!open) {
      setPin("");
      setErrorText("");
      setPinError(false);
    }
  }, [open]);

  function handleComplete(value: string) {
    setPin(value);
    setPinError(false);
    setErrorText("");
  }

  function confirm() {
    if (pin.length !== 6) {
      setErrorText("请输入 6 位 Trade PIN。");
      setPinError(true);
      return;
    }

    switchMutation.mutate();
  }

  return (
    <Modal open={open} onClose={switchMutation.isPending ? undefined : close}>
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      <div className="p-6 md:p-7">
        <div className="flex flex-col items-center text-center gap-2.5 mb-5">
          <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center relative">
            <span className="material-symbols-outlined text-[24px] text-primary">security_key</span>
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-accent-warning rounded-full border-2 border-[#161B22]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">环境模式切换确认</h2>
            <p className="text-xs text-primary font-mono mt-1">
              {currentProfile.executionLabel} → {nextProfile.executionLabel}
            </p>
          </div>
        </div>

        <div className="bg-accent-warning/10 border border-accent-warning/20 rounded-lg p-3 mb-4 text-left">
          <p className="text-xs text-accent-warning leading-relaxed">
            这是全局执行模式切换。系统会同时切换钱包资产、API 凭据、下单通道与风控域，而不是只改变按钮状态。
          </p>
          {guardReasons.length > 0 ? (
            <div className="mt-2 space-y-1">
              {guardReasons.map((reason) => (
                <div key={reason} className="text-[11px] text-accent-error">
                  • {mapGuardReason(reason)}
                </div>
              ))}
              <div className="text-[11px] text-accent-warning">可切换环境，但满足告警前将限制 REAL 自动交易启动。</div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border border-border-dark bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">当前模式</div>
            <div className="text-sm font-semibold text-white">{environment}</div>
            <div className="text-xs text-text-muted mt-1">
              {currentProfile.wallet.isSimulated ? "模拟钱包/模拟资产" : "真实钱包/真实资产"}
            </div>
            <div className="text-xs text-text-muted mt-1 truncate">{currentProfile.credential.keyName}</div>
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">目标模式</div>
            <div className="text-sm font-semibold text-primary">{nextEnv}</div>
            <div className="text-xs text-text-muted mt-1">
              {nextProfile.wallet.isSimulated ? "模拟钱包/模拟资产" : "真实钱包/真实资产"}
            </div>
            <div className="text-xs text-text-muted mt-1 truncate">{nextProfile.credential.keyName}</div>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-[11px] font-bold text-text-muted uppercase mb-2 text-center tracking-wider">
            输入 6 位 Trade PIN
          </label>
          <PinInput onComplete={handleComplete} error={pinError} />
          {errorText ? (
            <motion.p
              className="text-center text-[11px] text-accent-error mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {errorText}
            </motion.p>
          ) : null}
        </div>

        <div className="flex gap-2.5">
          <button
            className="flex-1 h-9 px-3 rounded-lg border border-border-dark hover:bg-border-dark/50 text-text-muted text-sm font-medium transition-colors disabled:opacity-50"
            onClick={close}
            disabled={switchMutation.isPending}
          >
            取消
          </button>
          <button
            className="flex-1 h-9 px-3 rounded-lg bg-gradient-to-r from-primary to-green-500 hover:from-primary-dark hover:to-green-600 text-surface-dark text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={confirm}
            disabled={switchMutation.isPending}
          >
            <span>{switchMutation.isPending ? "切换中..." : `确认切换到 ${nextEnv}`}</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="bg-[#0D1117]/50 py-2.5 px-6 text-center border-t border-border-dark">
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-text-muted">
          <span className="material-symbols-outlined text-[12px]">lock</span>
          <span>Secured by Trade PIN + Environment Guardrail</span>
        </div>
      </div>
    </Modal>
  );
}
