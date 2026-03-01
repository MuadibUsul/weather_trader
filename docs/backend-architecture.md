# Backend Architecture (Execution-First)

## 1. Core Objective

Single architecture for Paper/Real trading on Polymarket weather markets:

- same strategy signal path
- same risk policy
- same order lifecycle model
- same event/ledger accounting
- only execution route differs (`paper local matching` vs `real venue adapter`)

## 2. Module Layout (apps/api)

- `modules/execution`
  - `ExecutionApplicationService` (single application entry)
- `modules/orders`
  - API adapter only, delegates to execution app layer
- `modules/strategy`
  - signal generation + runtime loop, delegates order submit to execution app layer
- `modules/markets`
  - market data/integration config
- `modules/system`
  - environment, wallets, credentials, security, audit
- `modules/backtest`
  - research/backtest + official weather paper run
- `modules/control`
  - store/projection, governance, risk helpers

## 3. Unified Execution Flow

`StrategyService -> ExecutionApplicationService -> ModeManager -> PaperEngine | RealEngine`

### ExecutionApplicationService responsibilities

- submit / cancel / list / listOpen / listEvents
- quote + preview
- risk pre-check integration
- market snapshot normalization
- audit + websocket event emission
- persistence orchestration (postgres primary, json fallback)

## 4. Real Execution Router (Dual Channel)

Configured via `REAL_EXECUTION_ROUTE`:

- `gateway`: `HttpExternalVenueGateway` (`REAL_EXECUTION_HTTP_ENDPOINT`)
- `direct`: `DirectPolymarketVenueGateway` (`POLYMARKET_CLOB_HOST`)

If gateway route missing endpoint and strict mode is off, fallback to stub route.

Health endpoint:

- `GET /orders/execution-health`

## 5. Paper Engine Models

`PaperExecutionEngine` supports:

- `mid`
- `depth` / `deterministic_l2`
- `stochastic_impact` (seeded deterministic RNG for reproducible perturbation)

Research endpoint `POST /backtest/weather-paper` supports:

- `paperModel=deterministic_l2|stochastic_impact|both`
- `seed` for reproducible stochastic runs
- outputs `variants` and `sensitivityDelta`

## 6. Persistence Model

Primary persistence in Postgres (`ORDER_STORE_BACKEND=postgres`), json as fallback:

- `ExecOrder`
- `ExecOrderEvent`
- `ExecFill`
- `ExecSettlement`
- `ExecLedgerSnapshot`
- `ExecEngineState`

Behavior:

- restore: postgres first, fallback json
- persist: postgres first, optional json mirror

## 7. Domain Invariants

- lifecycle state is event-driven (`OrderCreated/Accepted/EnteredBook/PartiallyFilled/Filled/Canceled/Expired/Rejected`)
- ledger/pnl derived from fills + settlement only
- paper and real use identical risk checks and accounting rules
- deterministic replay possible with same inputs + seed

## 8. Strategy and Promotion

- `StrategyService` only owns signal + runtime control
- execution details are delegated, no direct engine coupling
- paper-to-real eligibility still uses current gates:
  - positive return
  - drawdown threshold
  - brier threshold
  - minimum fills

## 9. Security

- no hardcoded private keys
- wallet/credential managed in system module
- environment switch guarded by pin + acknowledgements + runtime checks
- all critical ops emit audit logs and websocket events
