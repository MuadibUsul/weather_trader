# API Contract

Base URL: `http://localhost:3001`

## REST

### GET /markets

Response `200`:

```json
[
  {
    "id": "NYC_GT_85",
    "title": "NYC > 85°F",
    "location": "New York",
    "odds": 0.65,
    "change24h": 12.5,
    "oi": 452190,
    "live": true
  }
]
```

### POST /orders

Request:

```json
{
  "marketId": "NYC_GT_85",
  "side": "buy",
  "quantity": 500,
  "price": 0.64,
  "environment": "REAL"
}
```

Response `201`:

```json
{
  "id": "#8830",
  "marketId": "NYC_GT_85",
  "side": "buy",
  "quantity": 500,
  "price": 0.64,
  "amount": 320,
  "fee": 0.32,
  "pnl": 0,
  "environment": "REAL",
  "status": "filled",
  "createdAt": "2026-02-27T00:00:00.000Z"
}
```

### GET /orders

Response `200`: `Order[]`

### GET /strategy

Response `200`:

```json
{
  "model": "mean_reversion",
  "autoTradeEnabled": false,
  "triggerThreshold": 0.65,
  "updateFrequencySec": 5,
  "maxDailyLoss": 1000,
  "maxPositionSize": 5000,
  "maxOpenPositions": 3,
  "slippageBps": 50
}
```

### PUT /strategy

Request body与 `GET /strategy` 同结构。

Response `200`: 更新后的策略配置。

### POST /backtest

Request:

```json
{
  "initialCash": 10000,
  "feeRate": 0.001,
  "slippageBps": 10,
  "risk": {
    "maxDrawdownPct": 20,
    "maxPositionPerSymbol": 10000,
    "maxNotionalPerTrade": 100000
  },
  "strategy": {
    "type": "threshold",
    "buyBelow": 0.45,
    "sellAbove": 0.75,
    "quantity": 100
  },
  "candles": [
    {
      "ts": 1,
      "symbol": "NYC_GT_85",
      "open": 0.62,
      "high": 0.66,
      "low": 0.61,
      "close": 0.65
    }
  ]
}
```

Response `200`:

```json
{
  "trades": [],
  "rejectedSignals": [],
  "equityCurve": [
    { "ts": 0, "equity": 10000 },
    { "ts": 1, "equity": 10000 }
  ],
  "metrics": {
    "initialEquity": 10000,
    "finalEquity": 10000,
    "totalReturnPct": 0,
    "maxDrawdownPct": 0,
    "tradeCount": 0,
    "turnover": 0,
    "totalFees": 0,
    "sharpeLike": 0
  },
  "finalCash": 10000,
  "finalPositions": {}
}
```

## WebSocket Events

Gateway: `ws://localhost:3001`

- `price_update`: 实时行情更新
- `order_update`: 订单状态更新
- `risk_alert`: 风控告警
- `system_log`: 系统日志消息

Server emit examples:

```json
{ "event": "price_update", "payload": { "symbol": "NYC_GT_85", "odds": 0.66 } }
```

```json
{ "event": "order_update", "payload": { "id": "#8830", "status": "filled" } }
```

```json
{ "event": "risk_alert", "payload": { "type": "max_drawdown", "value": 22.1 } }
```

```json
{ "event": "system_log", "payload": { "level": "info", "message": "Backtest completed" } }
```
