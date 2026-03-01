"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateSecuritySettingsDto } from "@weather-trader/shared";
import { Button } from "@/components/common/Button";
import { Toggle } from "@/components/common/Toggle";
import { ApiError, requestTradePinResetCode, updateSecuritySettings } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function mapSecurityError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "保存失败，请稍后重试";
  }

  switch (error.code) {
    case "pin_reset_email_code_required":
      return "请先输入邮箱验证码";
    case "pin_reset_email_code_expired":
      return "验证码已过期，请重新发送";
    case "pin_reset_email_code_invalid":
      return "邮箱验证码错误";
    case "pin_reset_code_cooldown":
      return "验证码发送过于频繁，请稍后重试";
    default:
      return `保存失败：${error.code}`;
  }
}

export function SecurityCard() {
  const queryClient = useQueryClient();

  const security = useUiStore((s) => s.security);
  const hydrateSystemState = useUiStore((s) => s.hydrateSystemState);

  const [mfa, setMfa] = useState(security.mfaEnabled);
  const [pinDraft, setPinDraft] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [awaitingEmailCode, setAwaitingEmailCode] = useState(false);
  const [pinMessage, setPinMessage] = useState("当前 PIN 状态：已设置");
  const [codeHint, setCodeHint] = useState("");

  useEffect(() => {
    setMfa(security.mfaEnabled);
    setPinMessage(`当前 PIN 状态：${security.tradePinSet ? "已设置" : "未设置"}（更新于 ${formatTime(security.updatedAt)}）`);
  }, [security]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateSecuritySettingsDto) => updateSecuritySettings(payload),
    onSuccess: async (nextState, payload) => {
      hydrateSystemState(nextState);

      if (payload.newTradePin) {
        setPinDraft("");
        setEmailCode("");
        setCodeHint("");
        setAwaitingEmailCode(false);
        setPinMessage(`PIN 已更新（${formatTime(nextState.security.updatedAt)}）`);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["system-state"] }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ]);
    },
    onError: (error) => {
      setPinMessage(mapSecurityError(error));
    },
  });

  const requestCodeMutation = useMutation({
    mutationFn: requestTradePinResetCode,
    onSuccess: (payload) => {
      const debugTail = payload.debugCode ? `（开发验证码: ${payload.debugCode}）` : "";
      setCodeHint(`验证码已发送至 ${payload.destination}${debugTail}`);
      setAwaitingEmailCode(true);
      setPinMessage("验证码发送成功，请查收邮件");
    },
    onError: (error) => {
      setPinMessage(mapSecurityError(error));
    },
  });

  function handleMfaChange(checked: boolean) {
    setMfa(checked);
    saveMutation.mutate({ mfaEnabled: checked });
  }

  function updatePin() {
    if (!/^\d{6}$/.test(pinDraft)) {
      setPinMessage("PIN 必须是 6 位数字");
      return;
    }

    if (!awaitingEmailCode) {
      requestCodeMutation.mutate();
      return;
    }

    if (!/^\d{6}$/.test(emailCode)) {
      setPinMessage("请输入 6 位邮箱验证码");
      return;
    }

    saveMutation.mutate({ mfaEnabled: mfa, newTradePin: pinDraft, emailCode });
  }

  function resendResetCode() {
    requestCodeMutation.mutate();
  }

  function cancelPinResetFlow() {
    setAwaitingEmailCode(false);
    setEmailCode("");
    setCodeHint("");
    setPinMessage(`当前 PIN 状态：${security.tradePinSet ? "已设置" : "未设置"}（更新于 ${formatTime(security.updatedAt)}）`);
  }

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">security</span>
          安全管理
        </h3>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/10 border border-secondary/20">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
          <span className="text-xs text-secondary font-medium">账户安全评分: 高</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-black/20 rounded-lg p-3 border border-border-dark">
          <h4 className="text-sm font-bold text-white mb-2">Trade PIN 设置</h4>
          <p className="text-xs text-text-muted mb-3">关键交易前二次确认，切换到 REAL 前会校验 Trade PIN。</p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-muted">当前状态</label>
              <div className="text-sm text-primary font-mono mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                {pinMessage}
              </div>
              {codeHint ? <div className="mt-1 text-[11px] text-text-muted">{codeHint}</div> : null}
            </div>

            <div>
              <label className="text-xs text-text-muted">重置 PIN</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="flex-1 h-9 bg-background-dark border border-border-dark text-white text-sm rounded px-3 outline-none focus:border-primary font-mono tracking-widest"
                  maxLength={6}
                  placeholder="输入 6 位新 PIN"
                  type="password"
                  disabled={saveMutation.isPending}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-w-20"
                  onClick={updatePin}
                  disabled={saveMutation.isPending || requestCodeMutation.isPending}
                >
                  {saveMutation.isPending ? "保存中" : requestCodeMutation.isPending ? "发送中" : awaitingEmailCode ? "确认更新" : "发送验证码"}
                </Button>
              </div>
              {awaitingEmailCode ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="flex-1 h-9 bg-background-dark border border-border-dark text-white text-sm rounded px-3 outline-none focus:border-primary font-mono tracking-widest"
                    maxLength={6}
                    placeholder="输入 6 位邮箱验证码"
                    disabled={requestCodeMutation.isPending || saveMutation.isPending}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-w-16"
                    onClick={resendResetCode}
                    disabled={requestCodeMutation.isPending || saveMutation.isPending}
                  >
                    重发
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-w-16"
                    onClick={cancelPinResetFlow}
                    disabled={requestCodeMutation.isPending || saveMutation.isPending}
                  >
                    取消
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-black/20 rounded-lg p-3 border border-border-dark flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white mb-2">多因子认证 (MFA)</h4>
            <p className="text-xs text-text-muted mb-3">建议开启 MFA 以降低误操作风险（关闭时仍可切换 REAL）。</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white font-medium">MFA 状态</span>
              <Toggle checked={mfa} onChange={handleMfaChange} size="sm" />
            </div>
          </div>

          <div className="bg-accent-warning/10 border border-accent-warning/20 p-3 rounded">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-accent-warning text-[16px] mt-0.5">warning</span>
              <p className="text-[11px] text-accent-warning leading-tight">
                {mfa ? "MFA 已启用：REAL 切换风险较低。" : "MFA 已关闭：存在安全风险，但系统仍允许切换到 REAL。"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
