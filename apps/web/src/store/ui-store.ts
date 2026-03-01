"use client";

import type {
  CredentialProfileDto,
  Environment,
  EnvironmentProfileDto,
  RuntimeStatusDto,
  SecuritySettingsDto,
  SystemStateDto,
  WalletProfileDto,
} from "@weather-trader/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeAccent = "primary" | "surface" | "dark";

type Preferences = {
  emailNotice: boolean;
  popupNotice: boolean;
  themeAccent: ThemeAccent;
};

type TradeIntent = {
  marketId: string;
  source: "dashboard" | "markets";
  ts: number;
};

type UiState = {
  environment: Environment;
  modalOpen: boolean;
  profiles: Record<Environment, EnvironmentProfileDto>;
  runtime: RuntimeStatusDto;
  security: SecuritySettingsDto;
  preferences: Preferences;
  tradeIntent: TradeIntent | null;
  setEnvironment: (env: Environment) => void;
  hydrateSystemState: (state: SystemStateDto) => void;
  openModal: () => void;
  closeModal: () => void;
  updateWallet: (env: Environment, patch: Partial<WalletProfileDto>) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  setTradeIntent: (intent: Omit<TradeIntent, "ts">) => void;
  clearTradeIntent: () => void;
};

const defaultCredential: CredentialProfileDto = {
  keyName: "WeatherTrader_Master_Key",
  healthy: true,
  lastHeartbeat: "刚刚",
  scope: "trade",
};

const defaultProfiles: Record<Environment, EnvironmentProfileDto> = {
  REAL: {
    executionLabel: "REAL EXECUTION",
    purpose: "生产环境，使用真实钱包和真实资产交易，目标是稳定盈利。",
    riskHint: "真实环境会产生链上费用与真实盈亏。",
    wallet: {
      label: "Real Wallet",
      address: "0x71C...aBcd",
      balance: 5432.1,
      unit: "USDC",
      connected: true,
      isSimulated: false,
      bindingMethod: "MANUAL",
      boundAt: null,
    },
    credential: { ...defaultCredential },
  },
  PAPER: {
    executionLabel: "PAPER SIMULATION",
    purpose: "模拟环境，使用模拟钱包和模拟资产验证策略质量。",
    riskHint: "无真实资金风险，适合策略调参与回测验证。",
    wallet: {
      label: "Paper Wallet",
      address: "paper://wallet/sim-001",
      balance: 100000,
      unit: "V-USDC",
      connected: true,
      isSimulated: true,
      bindingMethod: "SIMULATED",
      boundAt: null,
    },
    credential: { ...defaultCredential },
  },
};

const defaultPreferences: Preferences = {
  emailNotice: true,
  popupNotice: true,
  themeAccent: "primary",
};

const defaultRuntime: RuntimeStatusDto = {
  polymarketGateway: {
    source: "bootstrapping",
    latencyMs: null,
    status: "down",
    lastCheckedAt: null,
  },
  oracle: {
    source: "bootstrapping",
    delaySec: null,
    status: "down",
    lastSyncedAt: null,
  },
};

const defaultSecurity: SecuritySettingsDto = {
  mfaEnabled: true,
  tradePinSet: true,
  updatedAt: new Date(0).toISOString(),
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      environment: "PAPER",
      modalOpen: false,
      profiles: defaultProfiles,
      runtime: defaultRuntime,
      security: defaultSecurity,
      preferences: defaultPreferences,
      tradeIntent: null,
      setEnvironment: (environment) => set({ environment }),
      hydrateSystemState: (state) =>
        set({
          environment: state.environment,
          profiles: {
            REAL: {
              ...state.profiles.REAL,
              wallet: {
                ...state.profiles.REAL.wallet,
                bindingMethod: state.profiles.REAL.wallet.bindingMethod ?? "MANUAL",
                boundAt: state.profiles.REAL.wallet.boundAt ?? null,
              },
            },
            PAPER: {
              ...state.profiles.PAPER,
              wallet: {
                ...state.profiles.PAPER.wallet,
                bindingMethod: state.profiles.PAPER.wallet.bindingMethod ?? "SIMULATED",
                boundAt: state.profiles.PAPER.wallet.boundAt ?? null,
              },
            },
          },
          runtime: state.runtime,
          security: state.security ?? defaultSecurity,
        }),
      openModal: () => set({ modalOpen: true }),
      closeModal: () => set({ modalOpen: false }),
      updateWallet: (env, patch) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [env]: {
              ...state.profiles[env],
              wallet: {
                ...state.profiles[env].wallet,
                ...patch,
              },
            },
          },
        })),
      updatePreferences: (patch) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...patch,
          },
        })),
      setTradeIntent: (intent) =>
        set({
          tradeIntent: {
            ...intent,
            ts: Date.now(),
          },
        }),
      clearTradeIntent: () => set({ tradeIntent: null }),
    }),
    {
      name: "wt-ui-store",
      partialize: (state) => ({
        environment: state.environment,
        profiles: state.profiles,
        runtime: state.runtime,
        security: state.security,
        preferences: state.preferences,
      }),
    },
  ),
);

export type {
  CredentialProfileDto as CredentialProfile,
  Environment,
  EnvironmentProfileDto as EnvironmentProfile,
  Preferences,
  SecuritySettingsDto as SecuritySettings,
  ThemeAccent,
  TradeIntent,
  WalletProfileDto as WalletProfile,
};
