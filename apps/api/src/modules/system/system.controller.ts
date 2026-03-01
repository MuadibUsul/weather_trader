import { Body, Controller, Get, Param, Put, Post, Query } from "@nestjs/common";
import type { Environment } from "@weather-trader/shared";
import { ListAuditDto } from "./dto/list-audit.dto";
import { SwitchEnvironmentDto } from "./dto/switch-environment.dto";
import { UpdateCredentialDto } from "./dto/update-credential.dto";
import { UpdateSecurityDto } from "./dto/update-security.dto";
import { UpdateWalletDto } from "./dto/update-wallet.dto";
import { RequestPluginWalletChallengeDto } from "./dto/request-plugin-wallet-challenge.dto";
import { ConfirmPluginWalletBindingDto } from "./dto/confirm-plugin-wallet-binding.dto";
import { BindPrivateKeyWalletDto } from "./dto/bind-private-key-wallet.dto";
import { CreateOrDerivePolymarketCredentialDto } from "./dto/create-or-derive-polymarket-credential.dto";
import { ImportPolymarketCredentialDto } from "./dto/import-polymarket-credential.dto";
import { SystemService } from "./system.service";
import { UnbindRealWalletDto } from "./dto/unbind-real-wallet.dto";

@Controller("system")
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get("state")
  getState() {
    return this.systemService.getState();
  }

  @Post("environment/switch")
  switchEnvironment(@Body() dto: SwitchEnvironmentDto) {
    return this.systemService.switchEnvironment(dto.target, dto.pin, dto.acknowledged);
  }

  @Put("profiles/:environment/wallet")
  updateWallet(@Param("environment") environment: Environment, @Body() dto: UpdateWalletDto) {
    return this.systemService.updateWallet(environment, dto);
  }

  @Post("wallet/real/plugin/challenge")
  requestRealPluginChallenge(@Body() dto: RequestPluginWalletChallengeDto) {
    return this.systemService.requestRealWalletPluginChallenge(dto.address);
  }

  @Post("wallet/real/plugin/confirm")
  confirmRealPluginBinding(@Body() dto: ConfirmPluginWalletBindingDto) {
    return this.systemService.confirmRealWalletPluginBinding(dto.address, dto.signature);
  }

  @Post("wallet/real/private-key/bind")
  bindRealPrivateKey(@Body() dto: BindPrivateKeyWalletDto) {
    return this.systemService.bindRealWalletByPrivateKey(dto.privateKey);
  }

  @Get("wallet/real/status")
  getRealWalletStatus() {
    return this.systemService.getRealWalletStatus();
  }

  @Post("wallet/real/unbind")
  unbindRealWallet(@Body() dto: UnbindRealWalletDto) {
    return this.systemService.unbindRealWallet(dto.reason);
  }

  @Put("profiles/:environment/credential")
  updateCredentialLegacy(@Param("environment") environment: Environment, @Body() dto: UpdateCredentialDto) {
    return this.systemService.updateCredential(dto, environment);
  }

  @Put("credential")
  updateCredential(@Body() dto: UpdateCredentialDto) {
    return this.systemService.updateCredential(dto);
  }

  @Post("credential/polymarket/create-or-derive")
  createOrDerivePolymarketCredential(@Body() dto: CreateOrDerivePolymarketCredentialDto) {
    return this.systemService.createOrDerivePolymarketCredential(dto);
  }

  @Post("credential/polymarket/import")
  importPolymarketCredential(@Body() dto: ImportPolymarketCredentialDto) {
    return this.systemService.importPolymarketCredential(dto);
  }

  @Get("security")
  getSecurity() {
    return this.systemService.getSecurity();
  }

  @Post("security/trade-pin/code")
  requestTradePinResetCode() {
    return this.systemService.requestTradePinResetCode();
  }

  @Put("security")
  updateSecurity(@Body() dto: UpdateSecurityDto) {
    return this.systemService.updateSecurity(dto);
  }

  @Get("audit")
  getAudit(@Query() query: ListAuditDto) {
    return this.systemService.getAuditLogs(query.limit);
  }
}
