"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getExposurePanel } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

type Props = {
  range: "1D" | "7D" | "30D" | "ALL";
};

const ADDRESS_RE = /0x[a-fA-F0-9]{16,}/g;

function renderBar(value: number) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-black/30">
      <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function normalizeAddress(raw: string) {
  return raw.trim().toLowerCase();
}

function findAddressLike(raw: string) {
  const matched = raw.match(ADDRESS_RE);
  return matched?.[0] ?? null;
}

function isAddressLike(raw: string) {
  return findAddressLike(raw) !== null;
}

export function ExposurePanel({ range }: Props) {
  const env = useUiStore((s) => s.environment);
  const profiles = useUiStore((s) => s.profiles);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["exposure-panel", env, range],
    queryFn: () => getExposurePanel({ env, range }),
    refetchInterval: 10_000,
  });

  const walletAliasMap = useMemo(() => {
    const aliases = new Map<string, string>();

    const knownWallets = [
      { address: profiles.REAL.wallet.address, label: profiles.REAL.wallet.label || "真实钱包" },
      { address: profiles.PAPER.wallet.address, label: profiles.PAPER.wallet.label || "模拟钱包" },
    ];
    for (const wallet of knownWallets) {
      const extracted = findAddressLike(wallet.address);
      if (extracted) {
        aliases.set(normalizeAddress(extracted), wallet.label);
      }
    }

    if (!data) {
      return aliases;
    }

    const unknownAddresses = new Set<string>();

    for (const row of data.city) {
      const extracted = findAddressLike(row.name);
      if (extracted) {
        const key = normalizeAddress(extracted);
        if (!aliases.has(key)) {
          unknownAddresses.add(key);
        }
      }
    }

    for (const risk of data.tailRisk) {
      const matches = risk.message.match(ADDRESS_RE) ?? [];
      for (const addr of matches) {
        const key = normalizeAddress(addr);
        if (!aliases.has(key)) {
          unknownAddresses.add(key);
        }
      }
    }

    let seq = 1;
    for (const address of unknownAddresses) {
      aliases.set(address, `钱包备注-${seq}`);
      seq += 1;
    }

    return aliases;
  }, [data, profiles.PAPER.wallet.address, profiles.PAPER.wallet.label, profiles.REAL.wallet.address, profiles.REAL.wallet.label]);

  const cityRows = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.city.slice(0, 5).map((item) => {
      const extracted = findAddressLike(item.name);
      if (!extracted) {
        return item;
      }
      const alias = walletAliasMap.get(normalizeAddress(extracted)) ?? "钱包备注";
      return {
        ...item,
        name: alias,
      };
    });
  }, [data, walletAliasMap]);

  const tailRiskRows = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.tailRisk.map((item) => {
      const nextMessage = item.message.replace(ADDRESS_RE, (raw) => {
        const alias = walletAliasMap.get(normalizeAddress(raw));
        return alias ?? "钱包备注";
      });
      return {
        ...item,
        message: nextMessage,
      };
    });
  }, [data, walletAliasMap]);

  if (isLoading) {
    return <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-sm text-text-muted">风险结构加载中...</div>;
  }
  if (isError || !data) {
    return <div className="rounded-xl border border-accent-error/30 bg-accent-error/10 p-4 text-sm text-accent-error">风险结构加载失败</div>;
  }

  return (
    <section className="rounded-xl border border-border-dark bg-surface-dark p-4">
      <h3 className="mb-3 text-sm font-bold text-white">当前风险结构图</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="mb-2 text-xs text-text-muted">城市暴露</div>
          <div className="space-y-2">
            {cityRows.map((item) => (
              <div key={`${item.name}-${item.value}`}>
                <div className="flex justify-between text-xs">
                  <span>{item.name}</span>
                  <span>{item.value.toFixed(1)}%</span>
                </div>
                {renderBar(item.value)}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="mb-2 text-xs text-text-muted">日期暴露</div>
          <div className="space-y-2">
            {data.date.slice(0, 5).map((item) => (
              <div key={item.key}>
                <div className="flex justify-between text-xs">
                  <span>{item.key}</span>
                  <span>{item.value.toFixed(1)}%</span>
                </div>
                {renderBar(item.value)}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="mb-2 text-xs text-text-muted">尾部风险提示</div>
          <div className="space-y-2">
            {tailRiskRows.map((item, idx) => (
              <div
                key={`${idx}-${item.message}`}
                className={`rounded border p-2 text-xs ${
                  item.level === "critical"
                    ? "border-accent-error/40 text-accent-error"
                    : item.level === "warning"
                      ? "border-accent-warning/40 text-accent-warning"
                      : "border-border-dark text-text-muted"
                }`}
              >
                {item.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
