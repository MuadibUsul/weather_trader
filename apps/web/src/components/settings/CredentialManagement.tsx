"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/common/Button";
import {
  ApiError,
  createOrDerivePolymarketCredential,
  getMarketsIntegrationConfig,
  importPolymarketCredential,
  updateMarketsIntegrationConfig,
} from "@/lib/api";
import { useUiStore, type CredentialProfile } from "@/store/ui-store";

type SignatureType = "0" | "1" | "2";
type Section = "import" | "derive" | "integration";

type ImportDraft = {
  host: string;
  chainId: string;
  signatureType: SignatureType;
  funder: string;
  walletAddress: string;
  apiKey: string;
  secret: string;
  passphrase: string;
};

type DeriveDraft = {
  host: string;
  chainId: string;
  signatureType: SignatureType;
  funder: string;
  privateKey: string;
};

type IntegrationDraft = {
  exchangeUrl: string;
  tagSlug: string;
  limit: string;
  timeoutMs: string;
};

function fieldClass() {
  return "h-9 w-full rounded-lg border border-border-dark bg-background-dark px-3 text-sm text-white outline-none focus:border-primary";
}

function short(value?: string | null) {
  if (!value) return "未设置";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function mapApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === "invalid_wallet_address") {
      return "钱包地址格式不正确，请检查为 0x 开头的 40 位地址。";
    }
    return error.code;
  }
  return fallback;
}

function buildImportDraft(credential: CredentialProfile): ImportDraft {
  return {
    host: credential.host ?? "https://clob.polymarket.com",
    chainId: String(credential.chainId ?? 137),
    signatureType: String(credential.signatureType ?? 1) as SignatureType,
    funder: credential.funder ?? credential.walletAddress ?? "",
    walletAddress: credential.walletAddress ?? "",
    apiKey: credential.apiKey ?? "",
    secret: "",
    passphrase: "",
  };
}

function buildDeriveDraft(credential: CredentialProfile): DeriveDraft {
  return {
    host: credential.host ?? "https://clob.polymarket.com",
    chainId: String(credential.chainId ?? 137),
    signatureType: String(credential.signatureType ?? 1) as SignatureType,
    funder: credential.funder ?? credential.walletAddress ?? "",
    privateKey: "",
  };
}

export function CredentialManagement() {
  const queryClient = useQueryClient();
  const environment = useUiStore((s) => s.environment);
  const profiles = useUiStore((s) => s.profiles);
  const hydrateSystemState = useUiStore((s) => s.hydrateSystemState);
  const credential = profiles[environment].credential;
  const credentialWalletAddress = useMemo(() => credential.walletAddress?.trim() ?? "", [credential.walletAddress]);
  const baselineJson = useMemo(() => JSON.stringify(credential), [credential]);

  const [activeSection, setActiveSection] = useState<Section>("import");
  const [importDraft, setImportDraft] = useState(buildImportDraft(credential));
  const [deriveDraft, setDeriveDraft] = useState(buildDeriveDraft(credential));
  const [integrationDraft, setIntegrationDraft] = useState<IntegrationDraft>({
    exchangeUrl: "",
    tagSlug: "weather",
    limit: "60",
    timeoutMs: "6000",
  });
  const [message, setMessage] = useState("");
  const [latestSecret, setLatestSecret] = useState<{ apiKey: string; secret: string; passphrase: string } | null>(null);

  useEffect(() => {
    const next = JSON.parse(baselineJson) as CredentialProfile;
    setImportDraft(buildImportDraft(next));
    setDeriveDraft(buildDeriveDraft(next));
    setMessage("");
  }, [baselineJson]);

  const integrationQuery = useQuery({
    queryKey: ["markets-integration-config"],
    queryFn: getMarketsIntegrationConfig,
    retry: 1,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!integrationQuery.data) return;
    setIntegrationDraft({
      exchangeUrl: integrationQuery.data.exchangeUrl,
      tagSlug: integrationQuery.data.tagSlug,
      limit: String(integrationQuery.data.limit),
      timeoutMs: String(integrationQuery.data.timeoutMs),
    });
  }, [integrationQuery.data]);

  const importMutation = useMutation({
    mutationFn: () =>
      importPolymarketCredential({
        host: importDraft.host.trim(),
        chainId: Number(importDraft.chainId),
        signatureType: Number(importDraft.signatureType) as 0 | 1 | 2,
        funder: importDraft.funder.trim(),
        walletAddress: importDraft.walletAddress.trim(),
        apiKey: importDraft.apiKey.trim(),
        secret: importDraft.secret.trim(),
        passphrase: importDraft.passphrase.trim(),
      }),
    onSuccess: async (state) => {
      hydrateSystemState(state);
      setImportDraft((prev) => ({ ...prev, secret: "", passphrase: "" }));
      setMessage("导入成功，凭据已加密保存。");
      await queryClient.invalidateQueries({ queryKey: ["system-state"] });
    },
    onError: (error) => setMessage(`导入失败：${mapApiError(error, "polymarket_credential_import_failed")}`),
  });

  const deriveMutation = useMutation({
    mutationFn: () =>
      createOrDerivePolymarketCredential({
        host: deriveDraft.host.trim(),
        chainId: Number(deriveDraft.chainId),
        signatureType: Number(deriveDraft.signatureType) as 0 | 1 | 2,
        funder: deriveDraft.funder.trim(),
        privateKey: deriveDraft.privateKey.trim(),
      }),
    onSuccess: async (response) => {
      hydrateSystemState(response.state);
      setDeriveDraft((prev) => ({ ...prev, privateKey: "" }));
      setLatestSecret({ apiKey: response.apiKey, secret: response.secret, passphrase: response.passphrase });
      setMessage("创建成功，凭据已加密保存。");
      await queryClient.invalidateQueries({ queryKey: ["system-state"] });
    },
    onError: (error) => setMessage(`创建失败：${mapApiError(error, "polymarket_credential_derive_failed")}`),
  });

  const integrationMutation = useMutation({
    mutationFn: () =>
      updateMarketsIntegrationConfig({
        exchangeUrl: integrationDraft.exchangeUrl.trim(),
        tagSlug: integrationDraft.tagSlug.trim(),
        limit: Number(integrationDraft.limit),
        timeoutMs: Number(integrationDraft.timeoutMs),
      }),
    onSuccess: async () => {
      setMessage("交易所源配置已保存。");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["markets-integration-config"] }),
        queryClient.invalidateQueries({ queryKey: ["markets"] }),
      ]);
    },
    onError: (error) => setMessage(`保存失败：${mapApiError(error, "markets_integration_update_failed")}`),
  });

  const statusText = credential.apiKey ? "已配置" : "未配置";
  const statusClass = credential.apiKey ? "text-primary" : "text-accent-warning";

  return (
    <section className="h-full overflow-y-auto pb-5">
      <div className="mx-auto w-full max-w-[920px] space-y-4">
        <div className="border-b border-border-dark pb-3">
          <h2 className="text-3xl font-bold text-white">API 凭据配置</h2>
          <p className="mt-1 text-sm text-text-muted">当前环境：{environment}。页面默认收敛显示，避免信息分散。</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border-dark bg-surface-dark p-3">
            <div className="text-xs text-text-muted">状态</div>
            <div className={`mt-1 font-semibold ${statusClass}`}>{statusText}</div>
          </div>
          <div className="rounded-xl border border-border-dark bg-surface-dark p-3">
            <div className="text-xs text-text-muted">API Key</div>
            <div className="mt-1 font-mono text-white">{short(credential.apiKey)}</div>
          </div>
          <div className="rounded-xl border border-border-dark bg-surface-dark p-3">
            <div className="text-xs text-text-muted">凭据地址</div>
            <div className="mt-1 font-mono text-white">{short(credentialWalletAddress)}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border-dark bg-surface-dark p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button size="sm" variant={activeSection === "import" ? "primary" : "ghost"} onClick={() => setActiveSection("import")}>导入凭据</Button>
            <Button size="sm" variant={activeSection === "derive" ? "primary" : "ghost"} onClick={() => setActiveSection("derive")}>私钥创建</Button>
            <Button size="sm" variant={activeSection === "integration" ? "primary" : "ghost"} onClick={() => setActiveSection("integration")}>高级源配置</Button>
          </div>

          {activeSection === "import" && (
            <div className="space-y-3">
              <input value={importDraft.funder} onChange={(e) => setImportDraft((p) => ({ ...p, funder: e.target.value }))} className={fieldClass()} placeholder="Funder Address (0x...)" />
              <input value={importDraft.walletAddress} onChange={(e) => setImportDraft((p) => ({ ...p, walletAddress: e.target.value }))} className={fieldClass()} placeholder="Credential Wallet Address (0x...)" />
              <input value={importDraft.apiKey} onChange={(e) => setImportDraft((p) => ({ ...p, apiKey: e.target.value }))} className={fieldClass()} placeholder="API Key" />
              <input type="password" value={importDraft.secret} onChange={(e) => setImportDraft((p) => ({ ...p, secret: e.target.value }))} className={fieldClass()} placeholder="Secret" />
              <input type="password" value={importDraft.passphrase} onChange={(e) => setImportDraft((p) => ({ ...p, passphrase: e.target.value }))} className={fieldClass()} placeholder="Passphrase" />
              <Button
                size="sm"
                onClick={() => importMutation.mutate()}
                disabled={
                  importMutation.isPending ||
                  !importDraft.funder.trim() ||
                  !importDraft.walletAddress.trim() ||
                  !importDraft.apiKey.trim() ||
                  !importDraft.secret.trim() ||
                  !importDraft.passphrase.trim()
                }
              >
                {importMutation.isPending ? "保存中..." : "导入并保存"}
              </Button>
            </div>
          )}

          {activeSection === "derive" && (
            <div className="space-y-3">
              <input value={deriveDraft.funder} onChange={(e) => setDeriveDraft((p) => ({ ...p, funder: e.target.value }))} className={fieldClass()} placeholder="Funder Address (0x...)" />
              <input type="password" value={deriveDraft.privateKey} onChange={(e) => setDeriveDraft((p) => ({ ...p, privateKey: e.target.value }))} className={fieldClass()} placeholder="输入私钥（0x...）" />
              <Button size="sm" onClick={() => deriveMutation.mutate()} disabled={deriveMutation.isPending || !deriveDraft.funder.trim() || !deriveDraft.privateKey.trim()}>
                {deriveMutation.isPending ? "创建中..." : "创建 / 派生 API Key"}
              </Button>
            </div>
          )}

          {activeSection === "integration" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={integrationDraft.exchangeUrl} onChange={(e) => setIntegrationDraft((p) => ({ ...p, exchangeUrl: e.target.value }))} className={`${fieldClass()} md:col-span-2`} placeholder="exchangeUrl" />
              <input value={integrationDraft.tagSlug} onChange={(e) => setIntegrationDraft((p) => ({ ...p, tagSlug: e.target.value }))} className={fieldClass()} placeholder="tagSlug" />
              <input type="number" value={integrationDraft.limit} onChange={(e) => setIntegrationDraft((p) => ({ ...p, limit: e.target.value }))} className={fieldClass()} placeholder="limit" />
              <input type="number" value={integrationDraft.timeoutMs} onChange={(e) => setIntegrationDraft((p) => ({ ...p, timeoutMs: e.target.value }))} className={fieldClass()} placeholder="timeoutMs" />
              <Button size="sm" onClick={() => integrationMutation.mutate()} disabled={integrationMutation.isPending || integrationQuery.isLoading}>
                {integrationMutation.isPending ? "保存中..." : "保存高级配置"}
              </Button>
            </div>
          )}
        </div>

        {latestSecret && (
          <div className="rounded-xl border border-accent-warning/35 bg-accent-warning/10 p-4 text-xs">
            <div className="font-semibold text-white">本次返回明文（仅显示一次）</div>
            <div className="mt-2 space-y-1 font-mono text-accent-warning">
              <div>apiKey: {latestSecret.apiKey}</div>
              <div>secret: {latestSecret.secret}</div>
              <div>passphrase: {latestSecret.passphrase}</div>
            </div>
          </div>
        )}

        {message && <div className="rounded-lg border border-border-dark bg-surface-dark p-3 text-sm text-text-muted">{message}</div>}
      </div>
    </section>
  );
}
