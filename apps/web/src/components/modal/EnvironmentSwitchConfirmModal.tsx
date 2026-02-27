"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/common/Modal";
import { PinInput } from "./PinInput";
import { useUiStore } from "@/store/ui-store";

export function EnvironmentSwitchConfirmModal() {
  const open = useUiStore((s) => s.modalOpen);
  const close = useUiStore((s) => s.closeModal);
  const environment = useUiStore((s) => s.environment);
  const setEnvironment = useUiStore((s) => s.setEnvironment);

  const [error, setError] = useState(false);
  const [pin, setPin] = useState("");

  const nextEnv = useMemo(() => (environment === "REAL" ? "PAPER" : "REAL"), [environment]);

  function handleComplete(value: string) {
    setPin(value);
    setError(false);
  }

  function confirm() {
    if (pin !== "123456") {
      setError(true);
      return;
    }
    setEnvironment(nextEnv);
    setPin("");
    setError(false);
    close();
  }

  return (
    <Modal open={open} onClose={close}>
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      <div className="p-6 md:p-8">
        <div className="flex flex-col items-center text-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center relative">
            <span className="material-symbols-outlined text-[32px] text-primary">security_key</span>
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-accent-warning rounded-full border-2 border-[#161B22]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">环境切换确认</h2>
            <p className="text-xs text-primary font-mono mt-1">{environment} TRADING → {nextEnv} EXECUTION</p>
          </div>
        </div>

        <div className="bg-accent-warning/10 border border-accent-warning/20 rounded-lg p-3 mb-6 flex gap-3 text-left">
          <span className="material-symbols-outlined text-accent-warning shrink-0 mt-0.5">warning</span>
          <p className="text-sm text-text-muted leading-relaxed">
            你正在切换到
            <span className="text-accent-warning font-bold"> {nextEnv} 环境</span>。真实环境会调用真实钱包资产并产生链上开销。
          </p>
        </div>

        <div className="mb-8">
          <label className="block text-xs font-bold text-text-muted uppercase mb-3 text-center tracking-wider">
            输入 6 位 Trade PIN 码
          </label>
          <PinInput onComplete={handleComplete} error={error} />
          {error ? (
            <motion.p
              className="text-center text-[10px] text-accent-error mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              PIN 校验失败，请重试（演示 PIN: 123456）
            </motion.p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <button
            className="flex-1 py-3 px-4 rounded-lg border border-border-dark hover:bg-border-dark/50 text-text-muted font-medium transition-colors"
            onClick={close}
          >
            取消
          </button>
          <button
            className="flex-1 py-3 px-4 rounded-lg bg-gradient-to-r from-primary to-green-500 hover:from-primary-dark hover:to-green-600 text-surface-dark font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
            onClick={confirm}
          >
            <span>确认切换</span>
            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </button>
        </div>
      </div>

      <div className="bg-[#0D1117]/50 py-3 px-6 text-center border-t border-border-dark">
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-text-muted">
          <span className="material-symbols-outlined text-[12px]">lock</span>
          <span>Secured by Hardware Enclave</span>
        </div>
      </div>
    </Modal>
  );
}
