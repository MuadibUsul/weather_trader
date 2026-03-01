import { createCipheriv, createHash, randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { BadRequestException, Injectable, Logger, OnModuleDestroy, UnauthorizedException } from "@nestjs/common";
import type {
  AuditLogDto,
  CreateOrDerivePolymarketCredentialRequestDto,
  CreateOrDerivePolymarketCredentialResponseDto,
  CredentialProfileDto,
  Environment,
  EnvironmentProfileDto,
  ImportPolymarketCredentialRequestDto,
  PluginWalletChallengeDto,
  RealWalletStatusDto,
  RuntimeStatusDto,
  SecuritySettingsDto,
  SystemStateDto,
  TradePinResetCodeResponseDto,
  UpdateSecuritySettingsDto,
  WalletProfileDto,
} from "@weather-trader/shared";
import { EventsGateway } from "../../gateway/events.gateway";
import { ControlStoreService } from "../control/control.store";
import { ControlStrategyGovernanceService } from "../control/control.strategy-governance.service";
import { MarketsService } from "../markets/markets.service";

const defaultCredential: CredentialProfileDto = {
  provider: "POLYMARKET",
  host: process.env.POLYMARKET_CLOB_HOST ?? "https://clob.polymarket.com",
  chainId: Number(process.env.POLYMARKET_CHAIN_ID ?? 137),
  signatureType: Number(process.env.POLYMARKET_SIGNATURE_TYPE ?? 1) as 0 | 1 | 2,
  funder: "",
  walletAddress: "",
  apiKey: "",
  keyName: "NOT_CONFIGURED",
  healthy: false,
  lastHeartbeat: "未验证",
  scope: "clob:l2",
  lastDerivedAt: null,
  encryptedStored: false,
  secretMasked: "",
  passphraseMasked: "",
};

const defaultProfiles: Record<Environment, EnvironmentProfileDto> = {
  REAL: {
    executionLabel: "REAL EXECUTION",
    purpose: "生产环境，使用真实钱包和真实资产交易，目标是稳定盈利。",
    riskHint: "真实环境会产生链上费用与真实盈亏，请确认风控阈值与凭据权限。",
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
    purpose: "模拟环境，使用模拟钱包和模拟资产验证策略效果。",
    riskHint: "不会产生真实资产损失，适合回测验证和策略调参。",
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

type WalletBindChallenge = {
  address: string;
  message: string;
  expiresAtMs: number;
};

type PinResetCodeState = {
  code: string;
  expiresAtMs: number;
  lastSentAtMs: number;
};

type CredentialSecretVault = {
  encryptedSecret: string | null;
  encryptedPassphrase: string | null;
};

type PersistedSystemStore = {
  version: 2;
  environment: Environment;
  profiles: Record<Environment, EnvironmentProfileDto>;
  security: SecuritySettingsDto;
  tradePin: string;
  auditSeq: number;
  auditLogs: AuditLogDto[];
  credentialVault?: CredentialSecretVault;
};

const SYSTEM_STORE_VERSION = 2;

@Injectable()
export class SystemService implements OnModuleDestroy {
  private readonly logger = new Logger(SystemService.name);
  private readonly storePath = resolve(process.cwd(), process.env.SYSTEM_STORE_PATH ?? "runtime/system-store.json");
  private readonly persistenceEnabled = process.env.SYSTEM_PERSISTENCE !== "off" && process.env.NODE_ENV !== "test";
  private readonly credentialEncryptionKey = this.resolveCredentialEncryptionKey();
  private credentialVault: CredentialSecretVault = {
    encryptedSecret: null,
    encryptedPassphrase: null,
  };
  private environment: Environment = "PAPER";
  private profiles: Record<Environment, EnvironmentProfileDto> = this.deepClone(defaultProfiles);
  private tradePin = process.env.TRADE_PIN ?? "123456";
  private security: SecuritySettingsDto = {
    mfaEnabled: true,
    tradePinSet: true,
    updatedAt: new Date().toISOString(),
  };
  private readonly gatewayProbeUrl = process.env.POLYMARKET_GATEWAY_HEALTH_URL;
  private readonly runtimeProbeIntervalMs = Math.max(2000, Number(process.env.RUNTIME_PROBE_INTERVAL_MS ?? 4000));
  private readonly runtimeProbeTimeoutMs = Math.max(1000, Number(process.env.RUNTIME_PROBE_TIMEOUT_MS ?? 3000));
  private readonly requireRealGateway =
    process.env.NODE_ENV !== "test" && process.env.REAL_EXECUTION_REQUIRED !== "false";
  private readonly runtime: RuntimeStatusDto = {
    polymarketGateway: {
      source: process.env.POLYMARKET_GATEWAY_HEALTH_URL ?? "internal:markets-adapter",
      latencyMs: null,
      status: "down",
      lastCheckedAt: null,
    },
    oracle: {
      source:
        process.env.ORACLE_HEALTH_URL ??
        "https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current=temperature_2m",
      delaySec: null,
      status: "down",
      lastSyncedAt: null,
    },
  };
  private runtimeProbeTimer: NodeJS.Timeout | null = null;
  private runtimeProbeBusy = false;
  private lastOracleSuccessAtMs: number | null = null;
  private readonly walletBindChallengeTtlMs = 2 * 60 * 1000;
  private readonly walletBindChallenges = new Map<string, WalletBindChallenge>();
  private readonly pinResetCodeTtlMs = 5 * 60 * 1000;
  private readonly pinResetCodeCooldownMs = 60 * 1000;
  private readonly pinResetCodeTargetEmail = process.env.TRADE_PIN_RESET_EMAIL ?? "trader@example.com";
  private pinResetCodeState: PinResetCodeState | null = null;
  private auditSeq = 1;
  private readonly auditLogs: AuditLogDto[] = [];

  constructor(
    private readonly events: EventsGateway,
    private readonly markets: MarketsService,
    private readonly controlStore: ControlStoreService,
    private readonly governance: ControlStrategyGovernanceService,
  ) {
    if (this.persistenceEnabled) {
      this.restoreState();
    }
    this.pushAudit("SYSTEM_BOOT", "SUCCESS", "system initialized", this.environment);
    this.startRuntimeProbe();
  }

  onModuleDestroy(): void {
    if (this.runtimeProbeTimer) {
      clearInterval(this.runtimeProbeTimer);
      this.runtimeProbeTimer = null;
    }
  }

  getState(): SystemStateDto {
    this.refreshOracleDelay();
    return {
      environment: this.environment,
      profiles: this.deepClone(this.profiles),
      runtime: this.deepClone(this.runtime),
      security: this.deepClone(this.security),
    };
  }

  getEnvironment(): Environment {
    return this.environment;
  }

  getProfile(environment: Environment): EnvironmentProfileDto {
    this.assertEnvironment(environment);
    return this.deepClone(this.profiles[environment]);
  }

  ensureExecutionReady(environment: Environment): EnvironmentProfileDto {
    this.assertEnvironment(environment);
    const profile = this.profiles[environment];

    if (!profile.wallet.connected) {
      throw new BadRequestException("wallet_not_connected");
    }

    if (!profile.credential.healthy) {
      throw new BadRequestException("credential_unhealthy");
    }

    return this.deepClone(profile);
  }

  switchEnvironment(target: Environment, pin: string, acknowledged: boolean): SystemStateDto {
    this.assertEnvironment(target);

    if (!acknowledged) {
      this.pushAudit("ENV_SWITCH", "FAILED", "acknowledgement_required", this.environment);
      throw new BadRequestException("acknowledgement_required");
    }

    if (pin !== this.tradePin) {
      this.pushAudit("ENV_SWITCH", "FAILED", "invalid_trade_pin", this.environment);
      throw new UnauthorizedException("invalid_trade_pin");
    }

    if (target === "REAL" && !this.security.mfaEnabled) {
      this.pushAudit("ENV_SWITCH_WARN", "SUCCESS", "mfa_disabled_real_switch", this.environment);
      this.events.emitSystemLog({
        level: "warning",
        message: "Switching to REAL with MFA disabled",
        payload: {
          environment: this.environment,
          target,
          mfaEnabled: this.security.mfaEnabled,
        },
      });
    }

    const targetProfile = this.profiles[target];
    if (!targetProfile.wallet.connected) {
      this.pushAudit("ENV_SWITCH", "FAILED", "wallet_not_connected", this.environment);
      throw new BadRequestException("wallet_not_connected");
    }

    const guard = this.governance.computeEnvStatus(target, {
      walletConnected: targetProfile.wallet.connected,
      credentialHealthy: targetProfile.credential.healthy,
      realGatewayReady: this.isRealGatewayReady(),
    });
    if (!guard.realReady) {
      this.pushAudit("ENV_SWITCH_WARN", "SUCCESS", `switch with warnings: ${guard.reasons.join(",")}`, this.environment);
      this.controlStore.addRiskEvent({
        env: target,
        scope: "portfolio",
        strategyId: null,
        marketId: null,
        type: "env_switch",
        severity: "medium",
        payload: {
          allowed: true,
          warning: true,
          reasons: guard.reasons,
          from: this.environment,
          target,
        },
      });
    }

    if (target === this.environment) {
      return this.getState();
    }

    const from = this.environment;
    this.environment = target;
    this.pushAudit("ENV_SWITCH", "SUCCESS", `${from} -> ${target}`, target);
    this.controlStore.addRiskEvent({
      env: target,
      scope: "portfolio",
      strategyId: null,
      marketId: null,
      type: "env_switch",
      severity: "low",
      payload: {
        allowed: true,
        from,
        target,
      },
    });
    this.events.emitSystemLog({
      level: "info",
      message: `Environment switched: ${from} -> ${target}`,
      payload: this.getState(),
    });

    return this.getState();
  }

  getEnvStatus(target: Environment): { realReady: boolean; reasons: string[] } {
    this.assertEnvironment(target);
    return this.governance.computeEnvStatus(target, {
      walletConnected: this.profiles[target].wallet.connected,
      credentialHealthy: this.profiles[target].credential.healthy,
      realGatewayReady: this.isRealGatewayReady(),
    });
  }

  private isRealGatewayReady(): boolean {
    if (!this.requireRealGateway) {
      return true;
    }
    return Boolean(process.env.REAL_EXECUTION_HTTP_ENDPOINT?.trim());
  }

  updateWallet(environment: Environment, next: WalletProfileDto): SystemStateDto {
    this.assertEnvironment(environment);

    if (environment === "REAL") {
      const current = this.profiles.REAL.wallet;
      this.profiles.REAL.wallet = {
        ...current,
        label: next.label,
        unit: next.unit,
        balance: next.balance,
        isSimulated: false,
      };
      this.pushAudit("WALLET_UPDATE", "SUCCESS", "real wallet metadata updated", environment);
      this.events.emitSystemLog({
        level: "info",
        message: "Wallet metadata updated (REAL)",
        payload: this.profiles.REAL.wallet,
      });
      return this.getState();
    }

    this.profiles.PAPER.wallet = {
      ...next,
      isSimulated: true,
      bindingMethod: "SIMULATED",
      boundAt: null,
    };
    this.pushAudit("WALLET_UPDATE", "SUCCESS", "wallet updated for PAPER", "PAPER");
    this.events.emitSystemLog({ level: "info", message: "Wallet updated (PAPER)", payload: this.profiles.PAPER.wallet });
    return this.getState();
  }

  getRealWalletStatus(): RealWalletStatusDto {
    const wallet = this.deepClone(this.profiles.REAL.wallet);
    const checks = {
      walletConnected: wallet.connected,
      addressFormat: /^0x[0-9a-fA-F]{40}$/.test(wallet.address.trim()),
      credentialHealthy: this.profiles.REAL.credential.healthy,
      gatewayReady: this.isRealGatewayReady(),
    };
    const warnings: string[] = [];
    if (!checks.walletConnected) {
      warnings.push("wallet_not_connected");
    }
    if (!checks.addressFormat) {
      warnings.push("wallet_address_invalid");
    }
    if (!checks.credentialHealthy) {
      warnings.push("credential_unhealthy");
    }
    if (!checks.gatewayReady) {
      warnings.push("real_gateway_not_ready");
    }
    return {
      wallet,
      checks,
      ready: Object.values(checks).every(Boolean),
      warnings,
      updatedAt: new Date().toISOString(),
    };
  }

  unbindRealWallet(reason = "manual_unbind"): SystemStateDto {
    const wasConnected = this.profiles.REAL.wallet.connected;
    this.profiles.REAL.wallet = {
      ...this.profiles.REAL.wallet,
      address: "unbound://real-wallet",
      connected: false,
      isSimulated: false,
      bindingMethod: "MANUAL",
      boundAt: null,
    };
    this.walletBindChallenges.clear();

    this.pushAudit("WALLET_UNBIND", "SUCCESS", `real wallet unbound (${reason})`, "REAL");
    this.events.emitSystemLog({
      level: "warning",
      message: "Real wallet unbound",
      payload: { reason },
    });

    if (wasConnected && this.environment === "REAL") {
      this.environment = "PAPER";
      this.pushAudit("ENV_SWITCH", "SUCCESS", "REAL -> PAPER (wallet_unbind)", "PAPER");
      this.events.emitSystemLog({
        level: "warning",
        message: "Environment switched to PAPER after wallet unbind",
        payload: { reason },
      });
    }

    return this.getState();
  }

  requestRealWalletPluginChallenge(rawAddress: string): PluginWalletChallengeDto {
    const address = this.normalizeAddress(rawAddress);
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date().toISOString();
    const expiresAtMs = Date.now() + this.walletBindChallengeTtlMs;
    const message = [
      "WeatherTrader Pro V3 Wallet Bind",
      `Address: ${address}`,
      `Nonce: ${nonce}`,
      `IssuedAt: ${issuedAt}`,
    ].join("\n");

    this.walletBindChallenges.set(address, {
      address,
      message,
      expiresAtMs,
    });

    this.pushAudit("WALLET_BIND_CHALLENGE", "SUCCESS", `challenge issued for ${address}`, "REAL");
    return {
      address,
      message,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  async confirmRealWalletPluginBinding(rawAddress: string, signature: string): Promise<SystemStateDto> {
    const address = this.normalizeAddress(rawAddress);
    const challenge = this.walletBindChallenges.get(address);

    if (!challenge || challenge.expiresAtMs < Date.now()) {
      this.walletBindChallenges.delete(address);
      this.pushAudit("WALLET_BIND_PLUGIN", "FAILED", "wallet_challenge_expired", "REAL");
      throw new BadRequestException("wallet_challenge_expired");
    }

    try {
      const { getAddress, verifyMessage } = await import("ethers");
      const recovered = getAddress(verifyMessage(challenge.message, signature));
      if (recovered.toLowerCase() !== address) {
        this.pushAudit("WALLET_BIND_PLUGIN", "FAILED", "invalid_wallet_signature", "REAL");
        throw new UnauthorizedException("invalid_wallet_signature");
      }

      this.walletBindChallenges.delete(address);
      return this.bindRealWalletAddress(recovered, "PLUGIN_SIGNATURE", "real wallet bound via plugin signature");
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.pushAudit("WALLET_BIND_PLUGIN", "FAILED", "invalid_wallet_signature", "REAL");
      throw new UnauthorizedException("invalid_wallet_signature");
    }
  }

  async bindRealWalletByPrivateKey(rawPrivateKey: string): Promise<SystemStateDto> {
    const privateKey = this.normalizePrivateKey(rawPrivateKey);

    try {
      const { Wallet } = await import("ethers");
      const wallet = new Wallet(privateKey);
      return this.bindRealWalletAddress(wallet.address, "PRIVATE_KEY", "real wallet bound via private key");
    } catch {
      this.pushAudit("WALLET_BIND_PRIVATE_KEY", "FAILED", "invalid_private_key", "REAL");
      throw new BadRequestException("invalid_private_key");
    }
  }

  patchWallet(environment: Environment, patch: Partial<WalletProfileDto>, detail = "wallet patched"): SystemStateDto {
    this.assertEnvironment(environment);
    this.profiles[environment].wallet = { ...this.profiles[environment].wallet, ...patch };
    this.pushAudit("WALLET_PATCH", "SUCCESS", detail, environment);
    return this.getState();
  }

  updateCredential(next: Partial<CredentialProfileDto>, environment: Environment = this.environment): SystemStateDto {
    this.assertEnvironment(environment);
    const current = this.getCurrentCredential(environment);
    const merged: CredentialProfileDto = {
      ...current,
      ...next,
    };

    this.profiles[environment].credential = { ...merged };

    this.pushAudit("CREDENTIAL_UPDATE", "SUCCESS", `credential metadata updated (${environment})`, environment);
    this.events.emitSystemLog({ level: "info", message: "Credential metadata updated", payload: { environment, merged } });
    return this.getState();
  }

  importPolymarketCredential(input: ImportPolymarketCredentialRequestDto): SystemStateDto {
    const host = this.normalizeHost(input.host);
    const chainId = this.normalizeChainId(input.chainId);
    const signatureType = this.normalizeSignatureType(input.signatureType);
    const funder = this.normalizeAddress(input.funder);
    const walletAddress = this.normalizeAddress(input.walletAddress);
    const apiKey = this.requireString(input.apiKey, "polymarket_api_key_missing");
    const secret = this.requireString(input.secret, "polymarket_api_secret_missing");
    const passphrase = this.requireString(input.passphrase, "polymarket_api_passphrase_missing");

    this.applyPolymarketCredential({
      host,
      chainId,
      signatureType,
      funder,
      walletAddress,
      apiKey,
      secret,
      passphrase,
    });

    this.pushAudit("CREDENTIAL_IMPORT", "SUCCESS", `polymarket key imported for ${walletAddress}`, this.environment);
    this.events.emitSystemLog({
      level: "info",
      message: "Polymarket API key imported",
      payload: {
        walletAddress,
        funder,
        chainId,
        signatureType,
        host,
        apiKey,
      },
    });
    return this.getState();
  }

  async createOrDerivePolymarketCredential(
    input: CreateOrDerivePolymarketCredentialRequestDto,
  ): Promise<CreateOrDerivePolymarketCredentialResponseDto> {
    const host = this.normalizeHost(input.host);
    const chainId = this.normalizeChainId(input.chainId);
    const signatureType = this.normalizeSignatureType(input.signatureType);
    const funder = this.normalizeAddress(input.funder);
    const privateKey = this.normalizePrivateKey(input.privateKey);

    try {
      const { ClobClient } = await import("@polymarket/clob-client");
      const { Wallet } = await import("ethers");

      const signer = new Wallet(privateKey);
      const walletAddress = this.normalizeAddress(signer.address);

      const bootstrapClient = new ClobClient(
        host,
        chainId as 137 | 80002,
        signer as never,
        undefined,
        signatureType as 0 | 1 | 2,
        funder,
      );
      const creds = await bootstrapClient.createOrDeriveApiKey();

      const apiKey = this.requireString(creds.key, "polymarket_api_key_missing");
      const secret = this.requireString(creds.secret, "polymarket_api_secret_missing");
      const passphrase = this.requireString(creds.passphrase, "polymarket_api_passphrase_missing");
      this.applyPolymarketCredential({
        host,
        chainId,
        signatureType,
        funder,
        walletAddress,
        apiKey,
        secret,
        passphrase,
      });

      this.pushAudit(
        "CREDENTIAL_DERIVE",
        "SUCCESS",
        `polymarket key derived for ${walletAddress} (${funder})`,
        this.environment,
      );
      this.events.emitSystemLog({
        level: "info",
        message: "Polymarket API key created/derived",
        payload: {
          walletAddress,
          funder,
          chainId,
          signatureType,
          host,
          apiKey,
        },
      });

      return {
        state: this.getState(),
        apiKey,
        secret,
        passphrase,
        walletAddress,
      };
    } catch {
      this.pushAudit("CREDENTIAL_DERIVE", "FAILED", "polymarket_credential_derive_failed", this.environment);
      throw new BadRequestException("polymarket_credential_derive_failed");
    }
  }

  getSecurity(): SecuritySettingsDto {
    return this.deepClone(this.security);
  }

  requestTradePinResetCode(): TradePinResetCodeResponseDto {
    const now = Date.now();
    if (this.pinResetCodeState && now - this.pinResetCodeState.lastSentAtMs < this.pinResetCodeCooldownMs) {
      this.pushAudit("TRADE_PIN_CODE_REQUEST", "FAILED", "pin_reset_code_cooldown", this.environment);
      throw new BadRequestException("pin_reset_code_cooldown");
    }

    const code = this.generateSixDigitCode();
    const expiresAtMs = now + this.pinResetCodeTtlMs;
    this.pinResetCodeState = {
      code,
      expiresAtMs,
      lastSentAtMs: now,
    };

    const destination = this.maskEmail(this.pinResetCodeTargetEmail);
    this.pushAudit("TRADE_PIN_CODE_REQUEST", "SUCCESS", `verification code sent to ${destination}`, this.environment);
    this.events.emitSystemLog({
      level: "info",
      message: "Trade PIN reset verification code issued",
      payload: {
        destination,
        expiresAt: new Date(expiresAtMs).toISOString(),
        ...(process.env.NODE_ENV === "production" ? {} : { debugCode: code }),
      },
    });

    return {
      destination,
      expiresAt: new Date(expiresAtMs).toISOString(),
      ...(process.env.NODE_ENV === "production" ? {} : { debugCode: code }),
    };
  }

  updateSecurity(next: UpdateSecuritySettingsDto): SystemStateDto {
    if (next.newTradePin) {
      this.assertValidPinResetEmailCode(next.emailCode);
    }

    this.security = {
      ...this.security,
      mfaEnabled: next.mfaEnabled,
      updatedAt: new Date().toISOString(),
    };

    if (next.newTradePin) {
      this.tradePin = next.newTradePin;
      this.security.tradePinSet = true;
      this.pinResetCodeState = null;
      this.pushAudit("TRADE_PIN_UPDATE", "SUCCESS", "trade pin rotated", this.environment);
    }

    this.pushAudit("SECURITY_UPDATE", "SUCCESS", `mfa:${next.mfaEnabled ? "on" : "off"}`, this.environment);
    this.events.emitSystemLog({ level: "info", message: "Security settings updated", payload: this.getSecurity() });
    return this.getState();
  }

  getAuditLogs(limit = 50): AuditLogDto[] {
    return this.auditLogs.slice(0, limit);
  }

  recordAudit(action: string, status: AuditLogDto["status"], detail: string, environment = this.environment): void {
    this.pushAudit(action, status, detail, environment);
  }

  private pushAudit(action: string, status: AuditLogDto["status"], detail: string, environment: Environment): void {
    const item: AuditLogDto = {
      id: `A-${this.auditSeq++}`,
      ts: new Date().toISOString(),
      action,
      status,
      detail,
      environment,
    };

    this.auditLogs.unshift(item);
    if (this.persistenceEnabled) {
      this.persistState();
    }
    this.events.emitSystemLog({ level: "info", message: `audit:${action}`, payload: item });
  }

  private startRuntimeProbe(): void {
    void this.refreshRuntimeMetrics();
    this.runtimeProbeTimer = setInterval(() => {
      void this.refreshRuntimeMetrics();
    }, this.runtimeProbeIntervalMs);
  }

  private async refreshRuntimeMetrics(): Promise<void> {
    if (this.runtimeProbeBusy) {
      return;
    }

    this.runtimeProbeBusy = true;
    try {
      await Promise.all([this.refreshGatewayStatus(), this.refreshOracleStatus()]);
    } finally {
      this.runtimeProbeBusy = false;
    }
  }

  private async refreshGatewayStatus(): Promise<void> {
    const latencyMs = this.gatewayProbeUrl ? await this.ping(this.gatewayProbeUrl) : await this.measureMarketsAdapterLatency();
    this.runtime.polymarketGateway = {
      ...this.runtime.polymarketGateway,
      latencyMs,
      status: this.classifyGateway(latencyMs),
      lastCheckedAt: new Date().toISOString(),
    };
  }

  private async measureMarketsAdapterLatency(): Promise<number | null> {
    const started = Date.now();
    try {
      await this.markets.getMarkets();
      return Math.max(1, Date.now() - started);
    } catch {
      return null;
    }
  }

  private async refreshOracleStatus(): Promise<void> {
    const latencyMs = await this.ping(this.runtime.oracle.source);
    if (latencyMs !== null) {
      this.lastOracleSuccessAtMs = Date.now();
    }

    this.refreshOracleDelay();
  }

  private refreshOracleDelay(): void {
    if (!this.lastOracleSuccessAtMs) {
      this.runtime.oracle = {
        ...this.runtime.oracle,
        delaySec: null,
        status: "down",
        lastSyncedAt: null,
      };
      return;
    }

    const delaySec = Math.max(0, Math.floor((Date.now() - this.lastOracleSuccessAtMs) / 1000));
    this.runtime.oracle = {
      ...this.runtime.oracle,
      delaySec,
      status: this.classifyOracle(delaySec),
      lastSyncedAt: new Date(this.lastOracleSuccessAtMs).toISOString(),
    };
  }

  private classifyGateway(latencyMs: number | null): RuntimeStatusDto["polymarketGateway"]["status"] {
    if (latencyMs === null) {
      return "down";
    }

    if (latencyMs <= 350) {
      return "ok";
    }

    return "degraded";
  }

  private classifyOracle(delaySec: number): RuntimeStatusDto["oracle"]["status"] {
    if (delaySec <= 4) {
      return "fresh";
    }

    if (delaySec <= 15) {
      return "stale";
    }

    return "down";
  }

  private async ping(url: string): Promise<number | null> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.runtimeProbeTimeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        return null;
      }

      return Math.max(1, Date.now() - started);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertEnvironment(environment: string): asserts environment is Environment {
    if (environment !== "REAL" && environment !== "PAPER") {
      throw new BadRequestException("invalid_environment");
    }
  }

  private bindRealWalletAddress(
    address: string,
    method: "PLUGIN_SIGNATURE" | "PRIVATE_KEY",
    detail: string,
  ): SystemStateDto {
    this.profiles.REAL.wallet = {
      ...this.profiles.REAL.wallet,
      address,
      connected: true,
      isSimulated: false,
      bindingMethod: method,
      boundAt: new Date().toISOString(),
    };

    const action = method === "PLUGIN_SIGNATURE" ? "WALLET_BIND_PLUGIN" : "WALLET_BIND_PRIVATE_KEY";
    this.pushAudit(action, "SUCCESS", detail, "REAL");
    this.events.emitSystemLog({
      level: "info",
      message: detail,
      payload: {
        environment: "REAL",
        address,
        method,
      },
    });

    return this.getState();
  }

  private normalizeAddress(rawAddress: string): string {
    const address = rawAddress.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new BadRequestException("invalid_wallet_address");
    }

    return address.toLowerCase();
  }

  private normalizePrivateKey(rawPrivateKey: string): string {
    const trimmed = rawPrivateKey.trim();
    const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
      throw new BadRequestException("invalid_private_key");
    }

    return normalized;
  }

  private getCurrentCredential(environment: Environment): CredentialProfileDto {
    return this.deepClone(this.profiles[environment].credential ?? defaultCredential);
  }

  private normalizeHost(rawHost: string): string {
    const text = rawHost.trim();
    if (!text) {
      throw new BadRequestException("polymarket_host_required");
    }

    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new BadRequestException("polymarket_host_invalid");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new BadRequestException("polymarket_host_invalid");
    }

    return url.toString().replace(/\/+$/, "");
  }

  private normalizeChainId(chainId: number): 137 | 80002 {
    if (chainId !== 137 && chainId !== 80002) {
      throw new BadRequestException("polymarket_chain_id_invalid");
    }

    return chainId;
  }

  private normalizeSignatureType(signatureType: number): 0 | 1 | 2 {
    if (signatureType !== 0 && signatureType !== 1 && signatureType !== 2) {
      throw new BadRequestException("polymarket_signature_type_invalid");
    }

    return signatureType;
  }

  private applyPolymarketCredential(input: {
    host: string;
    chainId: 137 | 80002;
    signatureType: 0 | 1 | 2;
    funder: string;
    walletAddress: string;
    apiKey: string;
    secret: string;
    passphrase: string;
  }): void {
    this.credentialVault = {
      encryptedSecret: this.encryptCredentialSecret(input.secret),
      encryptedPassphrase: this.encryptCredentialSecret(input.passphrase),
    };

    const nextCredential: CredentialProfileDto = {
      provider: "POLYMARKET",
      host: input.host,
      chainId: input.chainId,
      signatureType: input.signatureType,
      funder: input.funder,
      walletAddress: input.walletAddress,
      apiKey: input.apiKey,
      keyName: input.apiKey,
      healthy: true,
      lastHeartbeat: "刚刚",
      scope: "clob:l2",
      lastDerivedAt: new Date().toISOString(),
      encryptedStored: true,
      secretMasked: this.maskSecret(input.secret),
      passphraseMasked: this.maskSecret(input.passphrase),
    };

    this.profiles.REAL.credential = { ...nextCredential };
    this.profiles.PAPER.credential = { ...nextCredential };
  }

  private requireString(value: unknown, errorCode: string): string {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    throw new BadRequestException(errorCode);
  }

  private resolveCredentialEncryptionKey(): Buffer {
    const configured = process.env.POLYMARKET_CREDENTIAL_ENCRYPTION_KEY?.trim();
    if (!configured) {
      return createHash("sha256").update("weather-trader-default-credential-key").digest();
    }

    return createHash("sha256").update(configured).digest();
  }

  private encryptCredentialSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.credentialEncryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
  }

  private maskSecret(raw: string): string {
    const text = raw.trim();
    if (text.length <= 6) {
      return "******";
    }
    return `${text.slice(0, 3)}***${text.slice(-3)}`;
  }

  private assertValidPinResetEmailCode(code: string | undefined): void {
    if (!code) {
      this.pushAudit("TRADE_PIN_UPDATE", "FAILED", "pin_reset_email_code_required", this.environment);
      throw new BadRequestException("pin_reset_email_code_required");
    }

    if (!this.pinResetCodeState || this.pinResetCodeState.expiresAtMs < Date.now()) {
      this.pinResetCodeState = null;
      this.pushAudit("TRADE_PIN_UPDATE", "FAILED", "pin_reset_email_code_expired", this.environment);
      throw new BadRequestException("pin_reset_email_code_expired");
    }

    if (code !== this.pinResetCodeState.code) {
      this.pushAudit("TRADE_PIN_UPDATE", "FAILED", "pin_reset_email_code_invalid", this.environment);
      throw new UnauthorizedException("pin_reset_email_code_invalid");
    }
  }

  private generateSixDigitCode(): string {
    return String(Math.floor(100_000 + Math.random() * 900_000));
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split("@");
    if (!name || !domain) {
      return "***";
    }

    const head = name.slice(0, Math.min(2, name.length));
    return `${head}***@${domain}`;
  }

  private restoreState(): void {
    try {
      if (!existsSync(this.storePath)) {
        return;
      }

      const raw = readFileSync(this.storePath, "utf8");
      const data = JSON.parse(raw) as Partial<PersistedSystemStore>;
      if (
        data.version !== SYSTEM_STORE_VERSION ||
        (data.environment !== "REAL" && data.environment !== "PAPER") ||
        !data.profiles ||
        !data.security ||
        typeof data.tradePin !== "string" ||
        !Array.isArray(data.auditLogs) ||
        typeof data.auditSeq !== "number"
      ) {
        this.logger.warn("System store format invalid, skip restore");
        return;
      }

      this.environment = data.environment;
      this.profiles = this.deepClone(data.profiles);
      this.security = this.deepClone(data.security);
      this.tradePin = data.tradePin;
      this.credentialVault = {
        encryptedSecret:
          typeof data.credentialVault?.encryptedSecret === "string" ? data.credentialVault.encryptedSecret : null,
        encryptedPassphrase:
          typeof data.credentialVault?.encryptedPassphrase === "string"
            ? data.credentialVault.encryptedPassphrase
            : null,
      };
      this.auditSeq = Math.max(1, data.auditSeq);
      this.auditLogs.splice(0, this.auditLogs.length, ...data.auditLogs.slice(0, 500));
      this.logger.log(`System store restored: env=${this.environment}, audits=${this.auditLogs.length}`);
    } catch (error) {
      this.logger.warn(`System store restore failed: ${(error as Error).message}`);
    }
  }

  private persistState(): void {
    try {
      const payload: PersistedSystemStore = {
        version: SYSTEM_STORE_VERSION,
        environment: this.environment,
        profiles: this.deepClone(this.profiles),
        security: this.deepClone(this.security),
        tradePin: this.tradePin,
        auditSeq: this.auditSeq,
        auditLogs: this.auditLogs.slice(0, 500),
        credentialVault: this.credentialVault,
      };

      mkdirSync(dirname(this.storePath), { recursive: true });
      writeFileSync(this.storePath, JSON.stringify(payload, null, 2), "utf8");
    } catch (error) {
      this.logger.warn(`System store persist failed: ${(error as Error).message}`);
    }
  }
  private deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}





















