# Weather Trader Rebuild Plan (2026-02-28)

## 1. Diagnosis

- Core execution path in `orders` still relied on a simplified generic engine, while advanced `polymarket` paper/real engines existed mostly in research/backtest flow.
- Several UI areas showed placeholder interactions without backend-backed lifecycle data (for example static order timeline).
- Paper research path still exposed `mock` scenario, which can contaminate production gating decisions.
- Mode switch existed, but runtime behavior was not consistently auditable at order-lifecycle level from UI to backend.

## 2. Target Architecture

- Keep one strategy/risk/signal path for both `PAPER` and `REAL`.
- Restrict execution difference to transport/funds only:
  - `PAPER`: local matching + ledger
  - `REAL`: external venue gateway + same ledger/event schema
- Make lifecycle auditable:
  - Every order must have replayable lifecycle events.
  - UI reads lifecycle from API, not hardcoded timeline content.
- Paper validation uses official Polymarket weather data only for promotion-to-real decisions.

## 3. Milestones

1. M1 (completed in this pass): Remove shell behavior and enforce official paper baseline.
2. M2: Migrate live order execution path from legacy generic trading engine to polymarket `ExecutionEngine` abstraction.
3. M3: Add cancel/open-order lifecycle APIs and deterministic replay endpoints.
4. M4: Real-mode safety hardening (kill switch linkage, stricter limits, gateway contract tests, fail-closed defaults).
5. M5: Walk-forward/report automation and promotion workflow (`paper_pass -> real_small`).

## 4. M1 Delivered

- Removed `mock` path from weather paper API/UI entry.
- `paper:report` now runs official-data-backed flow only.
- Added order lifecycle API:
  - `GET /orders/:orderId/events`
- Added lifecycle persistence in order store (`orderEvents`).
- Replaced static order timeline UI with real API-driven lifecycle rendering.

## 5. Acceptance for This Pass

- No hardcoded lifecycle timeline on orders page.
- Paper report script produces official weather report JSON.
- Typecheck passes for `shared/api/web`.
- Orders contract tests pass with lifecycle assertions.

