import { describe, expect, it } from "vitest";
import { Wallet, getAddress } from "ethers";
import { ControlStoreService } from "../control/control.store";
import { ControlStrategyGovernanceService } from "../control/control.strategy-governance.service";
import { SystemService } from "./system.service";

class FakeEventsGateway {
  emitSystemLog(_payload: unknown) {}
  emitRiskAlert(_payload: unknown) {}
  emitOrderUpdate(_payload: unknown) {}
}

class FakeMarketsService {
  async getMarkets() {
    return [];
  }
}

function createService() {
  const store = new ControlStoreService();
  const governance = new ControlStrategyGovernanceService(store);
  const service = new SystemService(
    new FakeEventsGateway() as never,
    new FakeMarketsService() as never,
    store as never,
    governance as never,
  );
  return { service, store, governance };
}

describe("SystemService wallet binding", () => {
  it("binds REAL wallet via private key and stores canonical address", async () => {
    const { service } = createService();
    const wallet = Wallet.createRandom();

    try {
      const state = await service.bindRealWalletByPrivateKey(wallet.privateKey);
      const bound = state.profiles.REAL.wallet;

      expect(bound.address).toBe(getAddress(wallet.address));
      expect(bound.bindingMethod).toBe("PRIVATE_KEY");
      expect(bound.connected).toBe(true);
      expect(bound.isSimulated).toBe(false);
    } finally {
      service.onModuleDestroy();
    }
  });

  it("binds REAL wallet via plugin challenge + signature", async () => {
    const { service } = createService();
    const wallet = Wallet.createRandom();

    try {
      const challenge = service.requestRealWalletPluginChallenge(wallet.address);
      const signature = await wallet.signMessage(challenge.message);
      const state = await service.confirmRealWalletPluginBinding(wallet.address, signature);
      const bound = state.profiles.REAL.wallet;

      expect(bound.address).toBe(getAddress(wallet.address));
      expect(bound.bindingMethod).toBe("PLUGIN_SIGNATURE");
      expect(bound.connected).toBe(true);
    } finally {
      service.onModuleDestroy();
    }
  });

  it("rejects mismatched plugin signature", async () => {
    const { service } = createService();
    const wallet = Wallet.createRandom();
    const attacker = Wallet.createRandom();

    try {
      const challenge = service.requestRealWalletPluginChallenge(wallet.address);
      const wrongSignature = await attacker.signMessage(challenge.message);
      await expect(service.confirmRealWalletPluginBinding(wallet.address, wrongSignature)).rejects.toThrowError(
        "invalid_wallet_signature",
      );
    } finally {
      service.onModuleDestroy();
    }
  });

  it("requires email verification code when rotating trade pin", () => {
    const { service } = createService();

    try {
      expect(() => service.updateSecurity({ mfaEnabled: true, newTradePin: "654321" })).toThrowError(
        "pin_reset_email_code_required",
      );
    } finally {
      service.onModuleDestroy();
    }
  });

  it("allows switching to REAL with warnings when no approved strategy", () => {
    const { service } = createService();
    try {
      service.updateCredential({ healthy: true, keyName: "real-key", scope: "trade", lastHeartbeat: "just now" }, "REAL");
      service.updateSecurity({ mfaEnabled: true });
      const next = service.switchEnvironment("REAL", "123456", true);
      expect(next.environment).toBe("REAL");
    } finally {
      service.onModuleDestroy();
    }
  });

  it("rotates trade pin and allows REAL switch after approval", () => {
    const { service, store, governance } = createService();

    try {
      const strategyId = store.getDefaultStrategyId();
      store.patchStrategy(strategyId, { status: "eligible" });
      governance.requestReal(strategyId, { reason: "pass" }, "tester");
      governance.approveReal(
        strategyId,
        {
          riskLimits: {
            maxDailyLoss: 1000,
            maxPositionSize: 5000,
            maxOpenPositions: 3,
            maxSlippageBps: 80,
          },
          initialAllocationPct: 10,
        },
        "risk",
      );

      service.updateCredential({ healthy: true, keyName: "real-key", scope: "trade", lastHeartbeat: "just now" }, "REAL");
      service.requestTradePinResetCode();
      const code = (service as unknown as { pinResetCodeState: { code: string } }).pinResetCodeState.code;
      service.updateSecurity({ mfaEnabled: true, newTradePin: "654321", emailCode: code });
      const next = service.switchEnvironment("REAL", "654321", true);
      expect(next.environment).toBe("REAL");
    } finally {
      service.onModuleDestroy();
    }
  });

  it("imports polymarket credential in PAPER env using bound REAL wallet and syncs to both envs", async () => {
    const { service } = createService();
    const wallet = Wallet.createRandom();

    try {
      await service.bindRealWalletByPrivateKey(wallet.privateKey);
      const state = service.importPolymarketCredential({
        host: "https://clob.polymarket.com",
        chainId: 137,
        signatureType: 1,
        funder: wallet.address,
        walletAddress: wallet.address,
        apiKey: "pk-test-001",
        secret: "secret-test-001",
        passphrase: "passphrase-test-001",
      });

      expect(state.environment).toBe("PAPER");
      expect(state.profiles.REAL.credential.apiKey).toBe("pk-test-001");
      expect(state.profiles.PAPER.credential.apiKey).toBe("pk-test-001");
      expect(state.profiles.REAL.credential.walletAddress).toBe(getAddress(wallet.address).toLowerCase());
      expect(state.profiles.PAPER.credential.walletAddress).toBe(getAddress(wallet.address).toLowerCase());
      expect(state.profiles.REAL.credential.healthy).toBe(true);
      expect(state.profiles.PAPER.credential.healthy).toBe(true);
    } finally {
      service.onModuleDestroy();
    }
  });

  it("allows credential import without requiring REAL wallet binding", () => {
    const { service } = createService();

    try {
      const externalWallet = Wallet.createRandom().address;
      const state = service.importPolymarketCredential({
        host: "https://clob.polymarket.com",
        chainId: 137,
        signatureType: 1,
        funder: externalWallet,
        walletAddress: externalWallet,
        apiKey: "pk-test-001",
        secret: "secret-test-001",
        passphrase: "passphrase-test-001",
      });
      expect(state.profiles.REAL.credential.walletAddress).toBe(getAddress(externalWallet).toLowerCase());
      expect(state.profiles.REAL.credential.apiKey).toBe("pk-test-001");
    } finally {
      service.onModuleDestroy();
    }
  });

  it("provides real wallet status checks", async () => {
    const { service } = createService();
    const wallet = Wallet.createRandom();
    try {
      await service.bindRealWalletByPrivateKey(wallet.privateKey);
      service.updateCredential({ healthy: true, keyName: "k", scope: "trade", lastHeartbeat: "just now" }, "REAL");
      const status = service.getRealWalletStatus();
      expect(status.wallet.address).toBe(getAddress(wallet.address));
      expect(status.checks.walletConnected).toBe(true);
      expect(status.checks.addressFormat).toBe(true);
      expect(status.checks.credentialHealthy).toBe(true);
      expect(status.ready).toBeTypeOf("boolean");
    } finally {
      service.onModuleDestroy();
    }
  });

  it("unbinds real wallet and forces PAPER mode when currently REAL", async () => {
    const { service } = createService();
    const wallet = Wallet.createRandom();
    try {
      await service.bindRealWalletByPrivateKey(wallet.privateKey);
      service.updateCredential({ healthy: true, keyName: "k", scope: "trade", lastHeartbeat: "just now" }, "REAL");
      service.updateSecurity({ mfaEnabled: true });
      service.switchEnvironment("REAL", "123456", true);
      const state = service.unbindRealWallet("test");
      expect(state.environment).toBe("PAPER");
      expect(state.profiles.REAL.wallet.connected).toBe(false);
      expect(state.profiles.REAL.wallet.bindingMethod).toBe("MANUAL");
    } finally {
      service.onModuleDestroy();
    }
  });
});
