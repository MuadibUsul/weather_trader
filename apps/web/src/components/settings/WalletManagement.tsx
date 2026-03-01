"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import {
  ApiError,
  bindRealWalletPrivateKey,
  confirmRealWalletPluginBinding,
  getAuditLogs,
  getRealWalletStatus,
  getWalletSnapshot,
  requestRealWalletPluginChallenge,
  unbindRealWallet,
  updateWalletProfile,
} from "@/lib/api";
import { useUiStore, type WalletProfile } from "@/store/ui-store";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type MaybeInjectedProvider = EthereumProvider & {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isOKXWallet?: boolean;
  providers?: MaybeInjectedProvider[];
};

function parseNumber(input: string, fallback: number) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function generatePaperWalletAddress() {
  const chars = "0123456789abcdef";
  let hex = "";
  for (let idx = 0; idx < 40; idx += 1) {
    hex += chars[Math.floor(Math.random() * chars.length)] ?? "0";
  }
  return `0x${hex}`;
}

function formatBoundAt(value?: string | null) {
  if (!value) {
    return "未绑定";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function mapBindError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "绑定失败，请稍后重试";
  }

  switch (error.code) {
    case "wallet_user_rejected":
      return "你已取消钱包授权或签名。";
    case "invalid_wallet_address":
      return "钱包地址无效，请检查插件账户。";
    case "wallet_challenge_expired":
      return "签名挑战已过期，请重新发起插件连接。";
    case "invalid_wallet_signature":
      return "签名校验失败，请重新连接插件。";
    case "invalid_private_key":
      return "私钥格式无效，请输入 64 位十六进制私钥。";
    default:
      return `绑定失败：${error.code}`;
  }
}

function resolveInjectedProvider(): MaybeInjectedProvider | null {
  const runtime = window as Window & {
    ethereum?: MaybeInjectedProvider;
    okxwallet?: MaybeInjectedProvider;
    coinbaseWalletExtension?: MaybeInjectedProvider;
    rabby?: MaybeInjectedProvider;
  };

  const maybeEthereum = runtime.ethereum;
  if (maybeEthereum?.providers && Array.isArray(maybeEthereum.providers) && maybeEthereum.providers.length > 0) {
    const ranked = [...maybeEthereum.providers].sort((a, b) => {
      const score = (item: MaybeInjectedProvider) =>
        Number(Boolean(item.isMetaMask)) * 4 +
        Number(Boolean(item.isRabby)) * 3 +
        Number(Boolean(item.isCoinbaseWallet)) * 2 +
        Number(Boolean(item.isOKXWallet));
      return score(b) - score(a);
    });
    const picked = ranked.find((item) => typeof item.request === "function");
    if (picked) {
      return picked;
    }
  }

  const directCandidates: Array<MaybeInjectedProvider | undefined> = [
    runtime.ethereum,
    runtime.okxwallet,
    runtime.coinbaseWalletExtension,
    runtime.rabby,
  ];
  return directCandidates.find((item) => item && typeof item.request === "function") ?? null;
}

function toHexUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

function isUserRejectedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const text = error.message.toLowerCase();
  return text.includes("rejected") || text.includes("denied") || text.includes("user rejected");
}

async function signChallenge(provider: EthereumProvider, message: string, address: string): Promise<string> {
  const hexMessage = toHexUtf8(message);
  const attempts: Array<{ method: string; params: unknown[] }> = [
    { method: "personal_sign", params: [message, address] },
    { method: "personal_sign", params: [hexMessage, address] },
    { method: "personal_sign", params: [address, message] },
    { method: "personal_sign", params: [address, hexMessage] },
    { method: "eth_sign", params: [address, hexMessage] },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const result = await provider.request({
        method: attempt.method,
        params: attempt.params,
      });
      if (typeof result === "string" && result) {
        return result;
      }
    } catch (error) {
      if (isUserRejectedError(error)) {
        throw new ApiError("wallet_user_rejected", 400, "wallet_user_rejected");
      }
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw new ApiError("invalid_wallet_signature", 400, `invalid_wallet_signature:${lastError.message}`);
  }
  throw new ApiError("invalid_wallet_signature", 400, "invalid_wallet_signature");
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function WalletManagement() {
  const queryClient = useQueryClient();

  const environment = useUiStore((s) => s.environment);
  const profiles = useUiStore((s) => s.profiles);
  const hydrateSystemState = useUiStore((s) => s.hydrateSystemState);

  const [draft, setDraft] = useState<WalletProfile>(profiles[environment].wallet);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [bindMethod, setBindMethod] = useState<"plugin" | "private_key">("plugin");
  const [privateKey, setPrivateKey] = useState("");
  const [bindMessage, setBindMessage] = useState("");

  useEffect(() => {
    setDraft(profiles[environment].wallet);
    setStatus("idle");
    setPrivateKey("");
    setBindMessage("");
  }, [environment, profiles]);

  const baseline = profiles[environment].wallet;
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [baseline, draft]);
  const isReal = environment === "REAL";
  const realWalletStatusQuery = useQuery({
    queryKey: ["real-wallet-status"],
    queryFn: () => getRealWalletStatus(),
    enabled: isReal,
    retry: 1,
    refetchInterval: 5000,
  });
  const realWalletAuditQuery = useQuery({
    queryKey: ["real-wallet-audit"],
    queryFn: () => getAuditLogs(120),
    enabled: isReal,
    retry: 1,
  });
  const { data: walletSnapshot, isLoading: walletSnapshotLoading } = useQuery({
    queryKey: ["wallet-snapshot", environment],
    queryFn: () => getWalletSnapshot({ environment }),
    enabled: !isReal,
    retry: 1,
    refetchInterval: 5000,
  });

  async function onStateChanged(message: string, nextState: Awaited<ReturnType<typeof updateWalletProfile>>) {
    hydrateSystemState(nextState);
    setStatus("saved");
    setBindMessage(message);
    setPrivateKey("");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["system-state"] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      queryClient.invalidateQueries({ queryKey: ["wallet-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["audit"] }),
      queryClient.invalidateQueries({ queryKey: ["real-wallet-status"] }),
      queryClient.invalidateQueries({ queryKey: ["real-wallet-audit"] }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: (nextWallet: WalletProfile) =>
      updateWalletProfile(environment, {
        ...nextWallet,
        isSimulated: environment === "PAPER",
      }),
    onSuccess: async (state) => {
      await onStateChanged("钱包配置已保存", state);
    },
    onError: () => {
      setStatus("error");
    },
  });

  const pluginBindMutation = useMutation({
    mutationFn: async () => {
      const provider = resolveInjectedProvider();
      if (!provider) {
        throw new ApiError("wallet_plugin_unavailable", 400, "wallet_plugin_unavailable");
      }

      let accountsRaw = await provider.request({ method: "eth_accounts" });
      let accounts = Array.isArray(accountsRaw) ? (accountsRaw as string[]) : [];
      if (!accounts[0]) {
        accountsRaw = await provider.request({ method: "eth_requestAccounts" });
        accounts = Array.isArray(accountsRaw) ? (accountsRaw as string[]) : [];
      }
      const address = typeof accounts[0] === "string" ? accounts[0] : "";
      if (!address) {
        throw new ApiError("wallet_account_missing", 400, "wallet_account_missing");
      }

      const challenge = await requestRealWalletPluginChallenge({ address });
      const signatureRaw = await signChallenge(provider, challenge.message, address);

      return confirmRealWalletPluginBinding({
        address,
        signature: signatureRaw,
      });
    },
    onSuccess: async (state) => {
      await onStateChanged("插件签名绑定成功", state);
    },
    onError: (error) => {
      setStatus("error");
      if (error instanceof ApiError && error.code === "wallet_plugin_unavailable") {
        setBindMessage("未检测到浏览器钱包插件，请先安装并解锁钱包。");
        return;
      }
      if (error instanceof ApiError && error.code === "wallet_account_missing") {
        setBindMessage("未读取到钱包账户，请在插件中授权账户访问。");
        return;
      }
      setBindMessage(mapBindError(error));
    },
  });

  const privateKeyBindMutation = useMutation({
    mutationFn: async () => {
      const value = privateKey.trim();
      if (!value) {
        throw new ApiError("invalid_private_key", 400, "invalid_private_key");
      }
      return bindRealWalletPrivateKey({ privateKey: value });
    },
    onSuccess: async (state) => {
      await onStateChanged("私钥绑定成功", state);
    },
    onError: (error) => {
      setStatus("error");
      setBindMessage(mapBindError(error));
    },
  });

  const unbindMutation = useMutation({
    mutationFn: async () => unbindRealWallet({ reason: "manual_unbind_from_wallet_page" }),
    onSuccess: async (state) => {
      await onStateChanged("REAL 钱包已解绑", state);
    },
    onError: (error) => {
      setStatus("error");
      setBindMessage(mapBindError(error));
    },
  });

  function updateDraft(patch: Partial<WalletProfile>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setStatus("idle");
  }

  function saveWallet() {
    saveMutation.mutate(draft);
  }

  function createPaperWallet() {
    const next: WalletProfile = {
      ...draft,
      label: draft.label.trim() || "Paper Wallet",
      address: generatePaperWalletAddress(),
      balance: Math.max(0, parseNumber(String(draft.balance), 100000)),
      unit: "V-USDC",
      connected: true,
      isSimulated: true,
      bindingMethod: "SIMULATED",
      boundAt: null,
    };
    setDraft(next);
    saveMutation.mutate(next);
  }

  function connectByPlugin() {
    setBindMessage("");
    pluginBindMutation.mutate();
  }

  function bindByPrivateKey() {
    setBindMessage("");
    privateKeyBindMutation.mutate();
  }

  function unbindWallet() {
    const confirmed = window.confirm("确定解绑当前 REAL 钱包吗？解绑后会自动切回 PAPER。");
    if (!confirmed) {
      return;
    }
    setBindMessage("");
    unbindMutation.mutate();
  }

  const walletAudits = useMemo(
    () =>
      (realWalletAuditQuery.data ?? [])
        .filter((item) => item.action.startsWith("WALLET_"))
        .slice(0, 8),
    [realWalletAuditQuery.data],
  );

  return (
    <section className="h-full overflow-y-auto pb-4">
      <div className="w-full max-w-[1240px] mx-auto space-y-4">
        <div className="flex flex-wrap items-end justify-between border-b border-border-dark pb-3 gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">钱包管理</h2>
            <p className="text-sm text-text-muted mt-1">仅编辑当前全局模式对应的钱包配置。</p>
          </div>
        </div>

        <div
          className={`relative overflow-hidden rounded-xl border p-4 ${
            isReal
              ? "border-accent-warning/35 bg-gradient-to-r from-accent-warning/12 via-accent-warning/5 to-surface-dark"
              : "border-info/35 bg-gradient-to-r from-info/12 via-info/5 to-surface-dark"
          }`}
        >
          <div className={`absolute inset-y-0 left-0 w-1 ${isReal ? "bg-accent-warning" : "bg-info"}`} />
          <div className="pl-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-[16px] ${isReal ? "text-accent-warning" : "text-info"}`}>
                {isReal ? "verified_user" : "science"}
              </span>
              <span className="text-xs font-semibold text-white">{isReal ? "REAL 资金交易提示" : "PAPER 模拟交易提示"}</span>
              <Badge variant={isReal ? "warning" : "primary"}>{environment}</Badge>
            </div>
            <div className="text-xs leading-relaxed">
              <p className="text-white/90">{profiles[environment].purpose}</p>
              <p className={`mt-1 ${isReal ? "text-accent-warning/85" : "text-info/85"}`}>{profiles[environment].riskHint}</p>
            </div>
          </div>
        </div>

        {isReal ? (
          <div className="bg-surface-dark rounded-xl border border-border-dark p-4 space-y-4">
            <h3 className="text-sm font-bold text-white">REAL 钱包绑定方式</h3>

            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-text-muted">
                  绑定地址: <span className="text-white font-mono">{profiles.REAL.wallet.address}</span>
                  <span className="mx-2">|</span>
                  绑定方式: <span className="text-white">{profiles.REAL.wallet.bindingMethod ?? "MANUAL"}</span>
                  <span className="mx-2">|</span>
                  绑定时间: <span className="text-white">{formatBoundAt(profiles.REAL.wallet.boundAt)}</span>
                </div>
                <Badge variant={realWalletStatusQuery.data?.ready ? "primary" : "warning"}>
                  {realWalletStatusQuery.data?.ready ? "READY" : "CHECK REQUIRED"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                <div className="rounded border border-border-dark px-2 py-1">
                  <span className="text-text-muted">walletConnected</span>
                  <div className={realWalletStatusQuery.data?.checks.walletConnected ? "text-primary font-semibold" : "text-accent-error font-semibold"}>
                    {realWalletStatusQuery.data?.checks.walletConnected ? "PASS" : "FAIL"}
                  </div>
                </div>
                <div className="rounded border border-border-dark px-2 py-1">
                  <span className="text-text-muted">addressFormat</span>
                  <div className={realWalletStatusQuery.data?.checks.addressFormat ? "text-primary font-semibold" : "text-accent-error font-semibold"}>
                    {realWalletStatusQuery.data?.checks.addressFormat ? "PASS" : "FAIL"}
                  </div>
                </div>
                <div className="rounded border border-border-dark px-2 py-1">
                  <span className="text-text-muted">credentialHealthy</span>
                  <div className={realWalletStatusQuery.data?.checks.credentialHealthy ? "text-primary font-semibold" : "text-accent-error font-semibold"}>
                    {realWalletStatusQuery.data?.checks.credentialHealthy ? "PASS" : "FAIL"}
                  </div>
                </div>
                <div className="rounded border border-border-dark px-2 py-1">
                  <span className="text-text-muted">gatewayReady</span>
                  <div className={realWalletStatusQuery.data?.checks.gatewayReady ? "text-primary font-semibold" : "text-accent-error font-semibold"}>
                    {realWalletStatusQuery.data?.checks.gatewayReady ? "PASS" : "FAIL"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => realWalletStatusQuery.refetch()} disabled={realWalletStatusQuery.isFetching}>
                  {realWalletStatusQuery.isFetching ? "检测中..." : "连接自检"}
                </Button>
                <Button size="sm" variant="ghost" onClick={unbindWallet} disabled={unbindMutation.isPending}>
                  {unbindMutation.isPending ? "解绑中..." : "解绑钱包"}
                </Button>
              </div>
              {realWalletStatusQuery.data?.warnings.length ? (
                <div className="mt-2 text-xs text-accent-warning">
                  Warnings: {realWalletStatusQuery.data.warnings.join(", ")}
                </div>
              ) : null}
            </div>

            <div className="inline-flex rounded-lg border border-border-dark overflow-hidden">
              <button
                className={`h-8 px-3 text-xs transition-colors ${
                  bindMethod === "plugin" ? "bg-primary/15 text-primary" : "text-text-muted hover:text-white hover:bg-white/5"
                }`}
                onClick={() => setBindMethod("plugin")}
              >
                插件签名连接
              </button>
              <button
                className={`h-8 px-3 text-xs border-l border-border-dark transition-colors ${
                  bindMethod === "private_key" ? "bg-primary/15 text-primary" : "text-text-muted hover:text-white hover:bg-white/5"
                }`}
                onClick={() => setBindMethod("private_key")}
              >
                私钥绑定
              </button>
            </div>

            {bindMethod === "plugin" ? (
              <div className="rounded-lg border border-border-dark bg-background-dark p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white">浏览器插件唤起 + 签名绑定</p>
                  <p className="text-xs text-text-muted mt-1">兼容 EIP-1193 标准钱包（如 MetaMask / Rabby / OKX 等），读取账户并完成签名绑定。</p>
                </div>
                <Button size="sm" onClick={connectByPlugin} disabled={pluginBindMutation.isPending}>
                  {pluginBindMutation.isPending ? "连接中..." : "连接插件并签名"}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-border-dark bg-background-dark p-3 space-y-3">
                <div>
                  <p className="text-sm text-white">直接输入私钥绑定</p>
                  <p className="text-xs text-text-muted mt-1">仅用于推导地址并完成绑定，不在前后端持久化保存私钥明文。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="输入 64 位十六进制私钥（支持 0x 前缀）"
                    type="password"
                    className="flex-1 min-w-[280px] h-9 rounded-lg border border-border-dark bg-[#0D1117] px-3 text-sm text-white font-mono outline-none focus:border-primary"
                  />
                  <Button size="sm" onClick={bindByPrivateKey} disabled={privateKeyBindMutation.isPending}>
                    {privateKeyBindMutation.isPending ? "绑定中..." : "私钥绑定"}
                  </Button>
                </div>
              </div>
            )}

            <div className="text-xs text-text-muted">
              当前绑定方式: <span className="text-white font-medium">{draft.bindingMethod ?? "MANUAL"}</span>
              <span className="mx-2">|</span>
              最近绑定时间: <span className="text-white font-medium">{formatBoundAt(draft.boundAt)}</span>
            </div>

            <div className="rounded-lg border border-border-dark bg-background-dark overflow-hidden">
              <div className="px-3 py-2 border-b border-border-dark text-xs font-semibold text-white">绑定审计记录</div>
              {realWalletAuditQuery.isLoading ? (
                <div className="px-3 py-3 text-xs text-text-muted">加载中...</div>
              ) : walletAudits.length === 0 ? (
                <div className="px-3 py-3 text-xs text-text-muted">暂无绑定相关记录</div>
              ) : (
                <div className="divide-y divide-border-dark">
                  {walletAudits.map((row) => (
                    <div key={row.id} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white font-medium">{row.action}</span>
                        <span className={row.status === "SUCCESS" ? "text-primary" : "text-accent-error"}>{row.status}</span>
                      </div>
                      <div className="text-text-muted mt-1">{row.detail}</div>
                      <div className="text-text-muted/80 mt-1">{new Date(row.ts).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {bindMessage ? <div className="text-xs text-primary">{bindMessage}</div> : null}
          </div>
        ) : null}

        {!isReal ? (
          <div className="bg-surface-dark rounded-xl border border-border-dark p-4 space-y-4">
            <h3 className="text-sm font-bold text-white">PAPER 模拟交易账户（账本同构）</h3>

            {walletSnapshotLoading ? (
              <div className="text-xs text-text-muted">正在加载模拟账户账本...</div>
            ) : walletSnapshot ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border-dark bg-background-dark p-3">
                    <div className="text-[11px] text-text-muted">可用资金</div>
                    <div className="text-sm font-bold text-white mt-1">{formatAmount(walletSnapshot.availableCash)} {walletSnapshot.unit}</div>
                  </div>
                  <div className="rounded-lg border border-border-dark bg-background-dark p-3">
                    <div className="text-[11px] text-text-muted">冻结资金</div>
                    <div className="text-sm font-bold text-white mt-1">{formatAmount(walletSnapshot.reservedCash)} {walletSnapshot.unit}</div>
                  </div>
                  <div className="rounded-lg border border-border-dark bg-background-dark p-3">
                    <div className="text-[11px] text-text-muted">持仓市值</div>
                    <div className="text-sm font-bold text-white mt-1">{formatAmount(walletSnapshot.marketValue)} {walletSnapshot.unit}</div>
                  </div>
                  <div className="rounded-lg border border-border-dark bg-background-dark p-3">
                    <div className="text-[11px] text-text-muted">账户净值</div>
                    <div className="text-sm font-bold text-primary mt-1">{formatAmount(walletSnapshot.equity)} {walletSnapshot.unit}</div>
                  </div>
                  <div className="rounded-lg border border-border-dark bg-background-dark p-3">
                    <div className="text-[11px] text-text-muted">未实现 PnL</div>
                    <div className={`text-sm font-bold mt-1 ${walletSnapshot.unrealizedPnl >= 0 ? "text-primary" : "text-accent-error"}`}>
                      {formatAmount(walletSnapshot.unrealizedPnl)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border-dark bg-background-dark p-3">
                    <div className="text-[11px] text-text-muted">已实现 + 结算 PnL</div>
                    <div className={`text-sm font-bold mt-1 ${walletSnapshot.realizedPnl + walletSnapshot.settledPnl >= 0 ? "text-primary" : "text-accent-error"}`}>
                      {formatAmount(walletSnapshot.realizedPnl + walletSnapshot.settledPnl)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border-dark bg-background-dark p-3">
                    <div className="text-[11px] text-text-muted">24h 手续费</div>
                    <div className="text-sm font-bold text-white mt-1">{formatAmount(walletSnapshot.fees24h)}</div>
                  </div>
                  <div className="rounded-lg border border-border-dark bg-background-dark p-3">
                    <div className="text-[11px] text-text-muted">24h 成交额</div>
                    <div className="text-sm font-bold text-white mt-1">{formatAmount(walletSnapshot.turnover24h)}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-border-dark bg-background-dark p-3 text-xs text-text-muted flex flex-wrap gap-x-4 gap-y-1">
                  <span>钱包地址: <span className="text-white font-mono">{walletSnapshot.walletId}</span></span>
                  <span>Open Orders: <span className="text-white">{walletSnapshot.openOrders}</span></span>
                  <span>Live Positions: <span className="text-white">{walletSnapshot.livePositions}</span></span>
                  <span>24h Fills: <span className="text-white">{walletSnapshot.fills24h}</span></span>
                  <span>更新时间: <span className="text-white">{new Date(walletSnapshot.updatedAt).toLocaleTimeString()}</span></span>
                </div>

                <div className="rounded-lg border border-border-dark bg-background-dark overflow-hidden">
                  <div className="px-3 py-2 border-b border-border-dark text-xs font-semibold text-white">持仓明细（Mark-to-Market）</div>
                  {walletSnapshot.positions.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-text-muted">暂无持仓，执行策略后将在此显示按市场估值的浮动盈亏。</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-text-muted border-b border-border-dark">
                            <th className="px-3 py-2 text-left">Market</th>
                            <th className="px-3 py-2 text-left">Outcome</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Avg</th>
                            <th className="px-3 py-2 text-right">Mark</th>
                            <th className="px-3 py-2 text-right">Mkt Value</th>
                            <th className="px-3 py-2 text-right">Unrealized</th>
                          </tr>
                        </thead>
                        <tbody>
                          {walletSnapshot.positions.map((row) => (
                            <tr key={row.key} className="border-b border-border-dark/50">
                              <td className="px-3 py-2 text-white font-mono">{row.marketId}</td>
                              <td className="px-3 py-2 text-white">{row.outcomeId}</td>
                              <td className="px-3 py-2 text-right text-white">{row.quantity.toFixed(3)}</td>
                              <td className="px-3 py-2 text-right text-white">{row.averageCost.toFixed(4)}</td>
                              <td className="px-3 py-2 text-right text-white">{row.markPrice.toFixed(4)}</td>
                              <td className="px-3 py-2 text-right text-white">{formatAmount(row.marketValue)}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${row.unrealizedPnl >= 0 ? "text-primary" : "text-accent-error"}`}>
                                {formatAmount(row.unrealizedPnl)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-accent-error">无法读取模拟账户账本，请稍后刷新。</div>
            )}

            <div className="rounded-lg border border-border-dark bg-background-dark p-4">
              <h4 className="text-xs font-semibold text-white mb-3">模拟账户参数</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">钱包名称</label>
                  <input
                    value={draft.label}
                    onChange={(e) => updateDraft({ label: e.target.value })}
                    className="w-full h-9 rounded-lg border border-border-dark bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">手动调账（V-USDC）</label>
                  <input
                    value={draft.balance}
                    onChange={(e) => updateDraft({ balance: Math.max(0, parseNumber(e.target.value, draft.balance)) })}
                    type="number"
                    min={0}
                    className="w-full h-9 rounded-lg border border-border-dark bg-[#0D1117] px-3 text-sm text-white font-mono outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-text-muted">模拟钱包地址</label>
                  <div className="h-9 rounded-lg border border-border-dark bg-[#0D1117] px-3 flex items-center justify-between">
                    <span className="text-sm text-white font-mono truncate">{draft.address}</span>
                    <Badge variant="secondary">PAPER</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-text-muted">
                  {status === "saved" && "保存成功"}
                  {status === "error" && "保存失败，请稍后重试"}
                  {status === "idle" && (dirty ? "有未保存修改" : "已与当前环境配置同步")}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDraft(baseline)} disabled={!dirty || saveMutation.isPending}>
                    重置
                  </Button>
                  <Button size="sm" variant="secondary" onClick={createPaperWallet} disabled={saveMutation.isPending}>
                    创建新模拟钱包
                  </Button>
                  <Button size="sm" onClick={saveWallet} disabled={!dirty || saveMutation.isPending}>
                    {saveMutation.isPending ? "保存中..." : "保存参数"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
