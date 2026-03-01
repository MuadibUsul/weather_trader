# API Contract (Backend Truth Source)

Base URL: `http://localhost:3001`

## Shared Enums

- Environment: `PAPER | REAL`
- Order status (API view): `open | filled | cancelled`
- Side: `buy | sell`

## Orders

### GET `/orders`

Query:

- `environment?: PAPER|REAL`
- `status?: open|filled|cancelled`
- `page?: number` (default `1`)
- `limit?: number` (default `200`)

Response `200`:

```json
[
  {
    "id": "ODM6FC1GX009",
    "strategyId": "strategy-default-001",
    "walletId": "paper://wallet/sim-934487",
    "contractName": "圣保罗2月28日最高气温会低于或等于19°C吗？",
    "marketId": "0x...",
    "side": "sell",
    "quantity": 26949.12,
    "price": 0.12,
    "amount": 3233.89,
    "fee": 3.23,
    "pnl": 0,
    "environment": "PAPER",
    "status": "filled",
    "createdAt": "2026-03-01T00:32:11.000Z"
  }
]
```

### GET `/orders/open`

Query:

- `environment?: PAPER|REAL`
- `limit?: number` (1..2000, default 200)

Response `200`: `OrderView[]`

### GET `/orders/:orderId/events`

Query:

- `limit?: number` (1..1000, default 100)

Response `200`: `OrderLifecycleEventDto[]`

### POST `/orders`

Request:

```json
{
  "marketId": "0x...",
  "side": "buy",
  "quantity": 1200,
  "price": 0.13,
  "orderType": "limit",
  "slippageBps": 50,
  "strategyId": "edge-baseline-main",
  "runId": "run_xxx",
  "walletId": "paper://wallet/sim-934487"
}
```

Response `201`: `OrderView`

### POST `/orders/:orderId/cancel`

Request:

```json
{
  "reason": "manual_cancel"
}
```

Response `201`: canceled `OrderView`

### GET `/orders/execution-health`

Response `200`:

```json
{
  "route": {
    "configured": "gateway",
    "resolved": "stub",
    "ready": false
  },
  "persistence": {
    "enabled": true,
    "backend": "postgres",
    "postgresPrimary": true,
    "mirrorJson": false
  }
}
```

## Strategy

### GET `/strategy`

Response `200`: strategy config.

### GET `/strategy/runtime`

Response `200`: runtime status (`running/ticks/signals/executedOrders/rejectedOrders/sessionPnl/...`).

### PUT `/strategy`

Update strategy config.

### POST `/strategy/start`

Start auto-trading session.

### POST `/strategy/stop`

Stop auto-trading session.

## Markets

### GET `/markets`

Return current market list (Polymarket weather oriented).

### GET `/markets/integration`

Return market source integration config.

### PUT `/markets/integration`

Update market source integration config.

## Backtest / Paper Research

### POST `/backtest`

Generic candle backtest endpoint.

### POST `/backtest/weather-paper`

Official weather paper research endpoint.

Request fields (all optional with defaults):

- `initialCash`
- `feeRate`
- `slippageBps`
- `matchingModel`: `mid | depth`
- `paperModel`: `deterministic_l2 | stochastic_impact | both`
- `seed`
- `edgeThreshold`
- `minConfidence`
- `orderNotional`
- `marketLimit`
- `fidelitySec`
- `syntheticSpread`
- `syntheticDepth`

Response `200` includes:

- primary result: `report`, `snapshot`, `forecastEval`, `auditJsonl`
- `modelVariant`
- `variants` (when `paperModel=both`, includes both deterministic and stochastic result blocks)
- `sensitivityDelta` (`totalReturnDelta`, `brierDelta`)
- `realEligibility`
- `sourceMeta`
- `executionConfig`

## System

### GET `/system/state`

Return global runtime state (`environment`, `profiles`, `runtime`, `security`).

### POST `/system/environment/switch`

Switch global mode.

### PUT `/system/profiles/:environment/wallet`

Update wallet profile.

### POST `/system/wallet/real/plugin/challenge`

Request plugin wallet challenge.

### POST `/system/wallet/real/plugin/confirm`

Confirm plugin wallet binding.

### POST `/system/wallet/real/private-key/bind`

Bind real wallet from private key.

### PUT `/system/credential`

Update credential profile.

### POST `/system/credential/polymarket/create-or-derive`

Create/derive Polymarket API credential.

### POST `/system/credential/polymarket/import`

Import existing Polymarket API credential.

### GET `/system/security`

Return security settings.

### POST `/system/security/trade-pin/code`

Request trade pin reset code.

### PUT `/system/security`

Update security settings.

### GET `/system/audit`

Query audit logs.

## Common Errors

- `environment_mismatch_with_global_mode`
- `wallet_not_connected`
- `credential_unhealthy`
- `invalid_order_params`
- `final_order_size_zero`
- `insufficient_balance`
- `order_not_found`
- `order_not_cancelable`
- `cancel_failed`
- `real_gateway_not_configured`
- `external_gateway_unavailable`
