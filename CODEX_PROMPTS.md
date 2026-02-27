# Codex/Copilot 改进提示词库

> 本文档包含针对 Weather Trader 系统的优先级改进提示词。
> 可直接粘贴到 GitHub Copilot Chat 或代码注释中用于指导改进。

---

## 🔴 优先级 1：立即实施（架构 + 量化基础）

### 1.1 【架构】Event Log 系统 - 订单决策追溯

**场景**：无法追溯每笔订单的完整决策链路；模型参数变化、风控触发过程不可审计。

**需求**：
```
在 backend/app/models.py 中新增 EventLog 表，记录所有关键操作：
- order_intent_created: market_id, bucket_id, side, size, timestamp
- signal_generated: market_id, bucket_id, edge, p_model, p_market, confidence, reason
- risk_check: intent_id, check_type (敞口/库存/熔断), status (pass/fail), reason
- order_executed: order_id, fill_price, fill_qty, slippage_actual
- weather_update: market_id, t_max_sofar, forecast_daily_max, hours_remaining

每条记录包含：
- event_id (UUID)
- timestamp (UTC)
- correlation_id (链接同一次循环的所有事件)
- event_type (str)
- data (JSON)
- created_at

实现能力：
1. 后端提供 GET /api/logs/events 端点，支持 filter by 时间/市场/event_type
2. 后端定时清理超过 30 天的日志
3. 前端新增"决策追溯"标签页，点击订单可展开完整事件链

示例实现思路：
class EventLog(Base):
    __tablename__ = "event_logs"
    id = Column(String, primary_key=True)
    correlation_id = Column(String, index=True)
    event_type = Column(String, index=True)
    data = Column(JSON)
    created_at = Column(DateTime(timezone=True), default=datetime.now)

async def log_event(session, event_type: str, data: dict, correlation_id: str):
    # 在 trade loop 关键位置调用
    pass
```

**代码位置**：
- [backend/app/models.py](backend/app/models.py) - 新增 EventLog 表定义
- [trading_engine/orchestrator.py](trading_engine/orchestrator.py) - 在信号/风控/执行处插入 log_event 调用
- [backend/app/routers/logs.py](backend/app/routers/logs.py) - 新增查询端点

---

### 1.2 【架构】WebSocket 消息去重与断点续历

**场景**：WebSocket 断线或消息重复导致订单状态不同步；无断点续历机制。

**需求**：
```
在 trading_engine/market_data_engine.py 中实现：

1. 消息去重（基于 sequence number）：
   - Polymarket WebSocket 消息应包含 sequence_id
   - 维护 last_seq_id 和 seen_hashes（或 Bloom Filter）
   - 丢弃 sequence_id <= last_seq_id 的消息
   
   示例：
   async def on_orderbook_update(self, msg):
       if msg.get('sequence_id') <= self.last_seq_id:
           logger.debug(f"Dropping duplicate msg seq={msg['sequence_id']}")
           return
       # Process message
       self.last_seq_id = msg['sequence_id']

2. 优雅断线恢复：
   - WebSocket 断开时记录 last_seq_id 和 orderbook snapshot
   - 重连后请求 REST API 获取完整盘口快照
   - 等待 sequence_id > last_seq_id 的消息后恢复订阅
   
   示例：
   async def reconnect_and_resync(self):
       snapshot = await self._fetch_orderbook_snapshot()
       self.orderbook = snapshot
       self.last_seq_id = snapshot['sequence_id']
       await self._reconnect_ws()

3. 订单状态持久化：
   - 启动时从 DB 加载未平仓订单、流动持仓
   - WebSocket 消息处理后立即写 DB
   - 定期（每 10s）全量 reconcile：DB positions == local positions
   
   示例：
   async def periodic_reconcile():
       while True:
           await asyncio.sleep(10)
           db_pos = await fetch_from_db()
           local_pos = self.state.positions
           if db_pos != local_pos:
               logger.error(f"Position mismatch! {db_pos} vs {local_pos}")
               await trigger_emergency_stop()

4. 错误日志完整性：
   - 每次 WebSocket 事件（connect/disconnect/error）及时记入 DB
   - 包含时间、错误码、重连时间戳
```

**代码位置**：
- [trading_engine/market_data_engine.py](trading_engine/market_data_engine.py) - 核心改动
- [trading_engine/models.py](trading_engine/models.py) - 新增 sequence tracking 字段
- [database/schema.sql](database/schema.sql) - 新增 `ws_error_logs` 表

---

### 1.3 【量化】市场心理项纳入概率模型

**场景**：当前概率模型只基于观测/预报温度，忽视市场定价心理，容易被"市场先行"套利。

**需求**：
```
改进 trading_engine/probability_engine.py 中的 _compute_distribution_sync 方法：

当前逻辑（过度简化）：
    mu = obs_weight * t_max_sofar + (1 - obs_weight) * forecast_daily_max

改为（融合市场心理）：
    # 1. 计算市场隐含期望
    market_probs = ... # from market quotes
    market_mu = weighted_avg(buckets, weights=market_probs)  # 市场认为的期望温度
    
    # 2. 动态融合权重（根据市场活跃度）
    market_activity = compute_activity_score(orderbook_depth, trade_volume)
    # activity 高 → 市场信息更充分 → 融合权重增加
    alpha = min(0.7, 0.3 + 0.4 * market_activity)  # alpha ∈ [0.3, 0.7]
    
    # 3. 融合后的期望
    mu_fusion = alpha * market_mu + (1 - alpha) * (
        obs_weight * t_max_sofar + (1 - obs_weight) * forecast_daily_max
    )
    
    # 4. 如果 sigma 过大，降低融合权重（模型不自信）
    if sigma > 4.0:
        alpha *= 0.8
    
    mu = mu_fusion

实现细节：
1. 在 ProbabilityEngine.__init__ 中维护 activity_scores: Dict[str, float]
2. 从 MarketDataEngine 监听 orderbook 深度变化，定期（每 5s）更新 activity
3. Activity 计算公式：
   activity = (1 - exp(-depth_L2 / ref_depth)) * trade_velocity_ratio
   其中 depth_L2 = sum of (bid + ask) levels within 1%
   trade_velocity_ratio = trades_last_5min / historical_avg_trades_per_5min
4. 缓存 activity 5 分钟有效期，避免频繁波动

示例类设计：
class Market Psychology:
    def __init__(self):
        self.activity_scores = {}  # market_id -> float
        self.market_mu_cache = {}  # market_id -> (mu, timestamp)
        self.activity_update_freq = 5  # seconds
    
    def compute_market_mu(self, quotes: List[MarketBucketQuote]) -> float:
        """从 market quotes 推导隐含期望"""
        total_weight = sum(q.orderbook.mid_price for q in quotes)
        return sum(q.bucket.mid_temp * q.implied_probability 
                  for q in quotes) / total_weight if total_weight > 0 else None
    
    def compute_activity(self, orderbook) -> float:
        """基于点差、深度、交易量的活跃度评分 [0, 1]"""
        pass
```

**代码位置**：
- [trading_engine/probability_engine.py](trading_engine/probability_engine.py) - 核心改动
- [trading_engine/models.py](trading_engine/models.py) - 新增 Psychology 类
- [trading_engine/market_data_engine.py](trading_engine/market_data_engine.py) - 定期发送 activity 更新信号

---

### 1.4 【量化】Edge 信号去重与粘性过滤

**场景**：信号在短期内来回摇摆（edge 3.1% → 2.9% → 3.2%），导致频繁下单/撤单，损耗手续费。

**需求**：
```
在 trading_engine/signal_engine.py 中新增信号稳定性过滤：

1. 信号粘性窗口（Hysteresis）：
   - 信号从"无"→"有"需要 edge 超过 base_threshold
   - 一旦进入信号，edge 需要跌破 base_threshold - hysteresis_margin 才会取消
   - 防止频繁开关
   
   示例：
   class SignalState:
       def __init__(self):
           self.active_signals = {}  # (market_id, bucket_id) -> Signal
           self.last_signal_time = {}
           self.hysteresis_margin = 0.005  # 0.5%
   
   def has_active_signal(self, market_id, bucket_id, edge):
       key = (market_id, bucket_id)
       if key in self.active_signals:
           old_edge = self.active_signals[key].edge
           # 已有信号，需要跌破更低的阈值才能取消
           cancel_threshold = base_threshold - hysteresis_margin
           if abs(edge) < cancel_threshold:
               del self.active_signals[key]
               return None
           # 保持原信号，edge 更新
           self.active_signals[key].edge = edge
           return self.active_signals[key]
       else:
           # 无信号，需要超过基准阈值才能新建
           if abs(edge) >= base_threshold:
               sig = Signal(...)
               self.active_signals[key] = sig
               return sig
           return None

2. 最小信号间隔（防止高频切换）：
   - 同一桶位 60s 内只能生成一个新信号
   - 快速反向（buy → sell 或反之）需要等待 30s
   
   示例：
   def can_flip_direction(self, market_id, bucket_id, new_side):
       key = (market_id, bucket_id)
       if key not in self.last_signal_time:
           return True
       last_side, last_time = self.last_signal_time[key]
       if new_side != last_side:
           # 反向信号，需等待 30s
           return (now - last_time).total_seconds() > 30
       else:
           # 同向，需等待 60s
           return (now - last_time).total_seconds() > 60

3. Edge 平滑（移动平均）：
   - 计算 edge 的 3 期 EMA，用平滑后的 edge 判断是否触发
   - 减少一次性噪声
   
   示例：
   self.edge_ema = {}  # (market_id, bucket_id) -> float
   
   def smooth_edge(self, key, raw_edge, alpha=0.3):
       if key not in self.edge_ema:
           self.edge_ema[key] = raw_edge
       else:
           self.edge_ema[key] = alpha * raw_edge + (1 - alpha) * self.edge_ema[key]
       return self.edge_ema[key]

4. 信号优先级排序（性价比）：
   - 同一市场多个桶都有信号时，按 edge/spread 比率排序
   - 优先执行"性价比"最高的信号
   
   示例：
   signals = [...]  # 多个 Signal 对象
   signals_sorted = sorted(
       signals, 
       key=lambda s: abs(s.edge) / max(s.spread, 0.001),
       reverse=True
   )
   # 只执行前 N 个（按风险预算）
```

**代码位置**：
- [trading_engine/signal_engine.py](trading_engine/signal_engine.py) - 主要改动
- [trading_engine/models.py](trading_engine/models.py) - 新增 SignalState 类

---

## 🟡 优先级 2：重要补强（架构 + 产品）

### 2.1 【架构】SAGA Pattern - 订单与仓位一致性

**场景**：订单成交、仓位更新、风控状态三者可能不一致，导致账户爆炸。

**需求**：
```
在 trading_engine/orchestrator.py 中实现订单生命周期 Saga：

使用补偿事务模式：
1. Order Created
   → 2. Risk Pre-Check Passed
   → 3. Market Order Executed
   → 4. Position Updated
   → 5. Risk Post-Check & Snapshot Saved
   
如果任何环节失败，执行反向补偿：
   5💥 → 4c (撤销本地仓位更新)
   4💥 → 3c (调用 cancel order API)
   3💥 → 2c (释放风控锁定)

实现框架：
class OrderSaga:
    def __init__(self):
        self.state = "initial"  # initial → checked → submitted → filled → confirmed
        self.intent = None
        self.order = None
        self.error = None
    
    async def execute(self):
        try:
            # Step 1: 风控前检
            self.state = "checking"
            risk_ok = await risk_manager.pre_trade_check(self.intent)
            if not risk_ok:
                raise RiskViolation(risk_ok.reason)
            
            # Step 2: 下单
            self.state = "submitting"
            self.order = await execution.submit_intent(self.intent)
            if not self.order:
                raise ExecutionFailed("Order rejected by broker")
            
            # Step 3: 等待成交（带超时）
            self.state = "filled"
            fill = await self._wait_for_fill(timeout=30)
            if not fill:
                # 超时 → 撤单补偿
                await execution.cancel_order(self.order.id)
                raise FillTimeout()
            
            # Step 4: 更新仓位
            self.state = "updating_position"
            await state.apply_fill(fill)
            
            # Step 5: 风控后检
            self.state = "post_checking"
            post_ok = await risk_manager.on_fill(fill)
            if not post_ok:
                # 风控爆炸 → 反向平仓
                await execution.submit_intent(OrderIntent(
                    market_id=self.intent.market_id,
                    bucket_id=self.intent.bucket_id,
                    side=opposite_side(self.intent.side),
                    size=fill.quantity
                ))
                raise RiskViolationPost()
            
            self.state = "confirmed"
        except Exception as e:
            self.error = e
            await self.compensate()
            raise
    
    async def compensate(self):
        """补偿逻辑"""
        if self.state == "filled":
            # 已成交，需要反向平仓
            logger.error(f"Saga failed at {self.state}, compensating...")
            # 但不真的平仓，改为 halt + alert + manual review
            await risk_manager.emergency_stop(f"Saga compensation: {self.error}")
        elif self.state == "submitting":
            # 下单阶段失败，直接返回
            pass
        # 其他状态无需补偿
```

**代码位置**：
- [trading_engine/orchestrator.py](trading_engine/orchestrator.py) - 新增 OrderSaga 类
- [trading_engine/models.py](trading_engine/models.py) - 新增 SagaState enum

---

### 2.2 【产品】账户资金实时显示与推送

**场景**：前端无法展示账户余额、已用保证金、可用资金；无交易推送提醒。

**需求**：
```
在 backend/app 中实现账户资金管理：

1. 新增 AccountBalance 数据模型（models.py）：
   class AccountBalance(Base):
       __tablename__ = "account_balances"
       id = Column(String, primary_key=True)
       user_id = Column(String, ForeignKey("users.id"))
       total_usdc = Column(Float)  # 账户总资金
       available_usdc = Column(Float)  # 可用（未被冻结）
       reserved_usdc = Column(Float)  # 风控冻结
       realized_pnl = Column(Float)  # 已实现盈亏
       unrealized_pnl = Column(Float)  # 未实现盈亏（按 mark-to-market）
       updated_at = Column(DateTime(timezone=True))
   
   class TransactionLog(Base):
       __tablename__ = "transaction_logs"
       id = Column(String, primary_key=True)
       user_id = Column(String, ForeignKey("users.id"))
       tx_type = Column(String)  # "deposit" / "withdrawal" / "fee" / "pnl_realization"
       amount = Column(Float)
       description = Column(String)
       created_at = Column(DateTime(timezone=True))

2. 新增 REST 端点（routers/wallet.py）：
   GET /api/wallet/balance
   返回：
   {
       "total_usdc": 10000.0,
       "available_usdc": 8000.0,
       "reserved_usdc": 2000.0,
       "realized_pnl": 120.5,
       "unrealized_pnl": -45.3,
       "last_update": "2026-02-27T10:30:00Z"
   }
   
   GET /api/wallet/transactions
   返回交易历史列表（分页 + filter by 类型）

3. WebSocket 实时推送（services/streams.py）：
   /ws/balance-updates
   推送消息格式：
   {
       "type": "balance_update",
       "data": {
           "available_usdc": 8000.0,
           "unrealized_pnl": -45.3,
           "last_fill": {
               "order_id": "xxx",
               "fill_price": 0.35,
               "fill_qty": 100,
               "timestamp": "2026-02-27T10:30:00Z"
           }
       }
   }

4. 交易引擎集成（trading_engine/orchestrator.py）：
   每次 Fill 后调用：
   await update_account_balance(
       user_id=...,
       fill=fill,
       db_session=...
   )
   
   函数逻辑：
   - 根据成交笔数刷新 realized_pnl
   - 根据当前盘口价格刷新 unrealized_pnl
   - 更新 available = total - reserved - pnl_loss
   - 推送消息到连接的所有 WS clients

5. 前端集成（frontend/src/components）：
   新增 BalancePanel.tsx：
   - 显示总资金、可用、已用、已实现/未实现盈亏
   - 实时订阅 /ws/balance-updates
   - 成交时动画闪烁提醒
   - 点击显示交易明细
```

**代码位置**：
- [backend/app/models.py](backend/app/models.py) - 新增 AccountBalance, TransactionLog
- [backend/app/routers/wallet.py](backend/app/routers/wallet.py) - 新增端点
- [backend/app/services/streams.py](backend/app/services/streams.py) - WebSocket 推送
- [frontend/src/components/BalancePanel.tsx](frontend/src/components/BalancePanel.tsx) - 前端页面

---

### 2.3 【产品】订单历史与详情查询系统

**场景**：用户无法查看已撤销/已拒订单；不知道成交成本。

**需求**：
```
在 backend/app/routers/orders.py 中扩展查询端点：

1. 改进 Order 数据表（models.py）：
   class Order(Base):
       __tablename__ = "orders"
       ...
       # 新增字段
       target_price = Column(Float)  # 目标价（模型推荐）
       reason = Column(String)  # 信号原因（tail_convergence / mispricing）
       strategy_reason = Column(String)  # 来自信号的 strategy_reason
       signal_edge = Column(Float)  # 触发时的 edge
       risk_check_passed = Column(Boolean)  # 是否通过风控
       rejection_reason = Column(String)  # 若拒，被谁拒（风控/broker）
       final_status = Column(String)  # NEW / ACKED / PARTIAL / FILLED / CANCELED / REJECTED / EXPIRED

2. 新增查询端点：
   GET /api/orders/history?limit=50&offset=0&status=FILLED&days=7
   返回：
   {
       "total": 150,
       "orders": [
           {
               "id": "order-123",
               "market_id": "xxx",
               "bucket_id": "temp-70-75",
               "side": "BUY",
               "size": 25,
               "target_price": 0.35,
               "status": "FILLED",
               "final_status": "FILLED",
               "fills": [
                   {
                       "fill_id": "fill-1",
                       "qty": 15,
                       "price": 0.34,
                       "fee": 0.51,  // qty * price * taker_fee
                       "timestamp": "2026-02-27T10:30:00Z"
                   },
                   {
                       "fill_id": "fill-2",
                       "qty": 10,
                       "price": 0.345,
                       "fee": 0.345,
                       "timestamp": "2026-02-27T10:30:05Z"
                   }
               ],
               "avg_fill_price": 0.342,
               "total_filled": 25,
               "total_cost": 8.55,  // 含手续费
               "reason": "tail_convergence",
               "signal_edge": 0.045,
               "created_at": "2026-02-27T10:30:00Z",
               "updated_at": "2026-02-27T10:30:10Z"
           },
           ...
       ]
   }
   
   GET /api/orders/{order_id}/details
   返回订单完整信息 + 关联事件链（取自 event_logs 表）

3. 查询优化：
   创建索引：(user_id, created_at DESC) 加速日期范围查询
   创建索引：(user_id, status) 加速状态筛选

4. 前端集成（frontend/src/components）：
   新增 OrderHistoryPanel.tsx：
   - 表格展示订单历史（FILLED / CANCELED / REJECTED）
   - 可展开行显示 fills 明细
   - 筛选器：日期、市场、状态、side
   - 点击订单显示 side panel：
     * 完整订单信息
     * 成交明细（avg price / total fee）
     * 触发信号的关键数据（edge / p_model / p_market）
     * 决策链（event log 树）
```

**代码位置**：
- [backend/app/models.py](backend/app/models.py) - Order 表新增字段
- [backend/app/routers/orders.py](backend/app/routers/orders.py) - 新增查询端点
- [database/schema.sql](database/schema.sql) - 新增索引
- [frontend/src/components/OrderHistoryPanel.tsx](frontend/src/components/OrderHistoryPanel.tsx) - 前端页面

---

### 2.4 【产品】告警系统与多渠道推送

**场景**：风控触发（敞口超限、回撤限制、熔断）后用户无法实时知晓。

**需求**：
```
在 backend/app/services 中实现告警模块：

1. 新增 Alert 表和告警引擎（models.py + alert_service.py）：
   class Alert(Base):
       __tablename__ = "alerts"
       id = Column(String, primary_key=True)
       user_id = Column(String, ForeignKey("users.id"))
       alert_type = Column(String)  # RISK / TRADE / SYSTEM / INFO
       severity = Column(String)  # CRITICAL / WARNING / INFO
       title = Column(String)
       message = Column(String)
       data = Column(JSON)  # 关键数据快照
       read = Column(Boolean, default=False)
       created_at = Column(DateTime(timezone=True))

2. 告警触发点（trading_engine/risk_manager.py）：
   async def emergency_stop(self, reason: str):
       await alert_service.trigger_alert(
           user_id=...,
           alert_type="RISK",
           severity="CRITICAL",
           title="紧急停机",
           message=f"交易已暂停: {reason}",
           data={"reason": reason, "timestamp": now()}
       )
   
   async def on_exposure_limit_hit(self):
       await alert_service.trigger_alert(
           user_id=...,
           alert_type="RISK",
           severity="WARNING",
           title="敞口接近限制",
           message=f"当前敞口 {current_exposure} / {max_exposure}",
           data={"current": current_exposure, "max": max_exposure}
       )

3. 告警推送渠道（alert_service.py）：
   class AlertService:
       async def trigger_alert(self, **kwargs):
           alert = Alert(**kwargs)
           await db.save(alert)
           
           # 多渠道推送
           await self._push_websocket(alert)  # 实时通知已连接用户
           await self._send_email(alert)  # 邮件
           await self._send_slack(alert)  # Slack webhook
           await self._send_webhook(alert)  # 自定义 webhook
       
       async def _push_websocket(self, alert):
           # 通过 WebSocket 推送给连接的该用户
           await broadcast_to_user(alert.user_id, {
               "type": "alert",
               "severity": alert.severity,
               "title": alert.title,
               "message": alert.message,
               "timestamp": alert.created_at.isoformat()
           })
       
       async def _send_email(self, alert):
           if alert.severity in ["CRITICAL", "WARNING"]:
               # 调用邮件服务
               pass
       
       async def _send_slack(self, alert):
           # 调用 Slack API
           pass

4. 前端告警中心（frontend/src/components/AlertCenter.tsx）：
   - 中心面板显示最近 20 条告警
   - 红色气泡计数显示未读 CRITICAL 告警数
   - 点击告警显示完整信息 + 数据快照
   - 支持标记已读、批量删除

5. 环境变量配置（.env.example）：
   ALERT_EMAIL_ENABLED=true
   ALERT_EMAIL_TO=your@email.com
   ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/...
   ALERT_CUSTOM_WEBHOOK_URL=https://your-system.com/alert
```

**代码位置**：
- [backend/app/models.py](backend/app/models.py) - Alert 表
- [backend/app/services/alert_service.py](backend/app/services/alert_service.py) - 告警引擎
- [trading_engine/risk_manager.py](trading_engine/risk_manager.py) - 集成告警触发
- [backend/app/routers/alerts.py](backend/app/routers/alerts.py) - REST 端点
- [frontend/src/components/AlertCenter.tsx](frontend/src/components/AlertCenter.tsx) - 前端页面

---

## 🟢 优先级 3：加分改进（量化 + 产品）

### 3.1 【量化】Inventory-Aware 报价调整

**场景**：库存多的情况下继续按固定 quote_delta 报价，导致脱手困难。

**需求**：
```
在 trading_engine/signal_engine.py 中实现库存相关报价微调：

class InventoryAwareQuoting:
    def __init__(self, settings):
        self.settings = settings
        self.base_delta = settings.default_quote_delta  # 0.01
    
    def adjust_quote_delta(self, market_id: str, bucket_id: str, 
                          position: Position, market_equilibrium) -> float:
        """
        根据库存状态调整报价宽度（quote_delta）
        
        逻辑：
        - 库存为 0：用基准 delta
        - 库存正（持有多）：delta 增大（报价变宽），加快脱手
        - 库存负（持有空）：delta 增大（报价变宽），加快回补
        """
        if position.quantity == 0:
            return self.base_delta
        
        # 库存比率 = 当前库存 / 单次订单大小
        inventory_ratio = abs(position.quantity) / self.settings.order_size
        
        # delta 放大倍数，库存越多放大越大
        # inventory_ratio = 0 → multiplier = 1.0
        # inventory_ratio = 1 → multiplier = 1.3
        # inventory_ratio = 2 → multiplier = 1.5（上限）
        multiplier = 1.0 + min(0.5, 0.3 * min(2.0, inventory_ratio))
        
        return min(0.05, self.base_delta * multiplier)

实现集成：
在 signal_engine.generate_signals() 中：
    for quote in quotes:
        ...
        delta = self.inventory_aware_quoting.adjust_quote_delta(
            market_id=quote.market_id,
            bucket_id=quote.bucket.bucket_id,
            position=state.get_position(quote.market_id, quote.bucket.bucket_id),
            equilibrium=quote.mid_price
        )
        
        if edge >= base_threshold:
            target_price = max(0.01, min(0.99, p_model - delta))
        else:
            target_price = max(0.01, min(0.99, p_model + delta))
```

**代码位置**：
- [trading_engine/signal_engine.py](trading_engine/signal_engine.py) - 新增 InventoryAwareQuoting 类

---

### 3.2 【量化】动态 Kelly 头寸管理

**场景**：order_size 固定为 25，不管模型置信度和历史胜率。

**需求**：
```
在 trading_engine/risk_manager.py 中实现 Kelly 头寸一体化：

from math import log

class KellyFractionManager:
    def __init__(self):
        self.win_rate = 0.5  # 初始 50%
        self.avg_win = 0.01  # 平均赢利 1%
        self.avg_loss = 0.01  # 平均亏损 1%
        self.update_freq = 100  # 每成交 100 笔更新一次
        self.recent_fills = deque(maxlen=100)  # 最近 100 笔成交
    
    def update_from_fill(self, fill: Fill):
        """每笔成交后在线更新胜率统计"""
        pnl_pct = fill.pnl / (fill.price * fill.quantity)
        self.recent_fills.append({
            'pnl_pct': pnl_pct,
            'is_win': pnl_pct > 0.001  # > 0.1% 才算赢
        })
        
        if len(self.recent_fills) == 100:
            # 更新统计信息
            wins = sum(1 for f in self.recent_fills if f['is_win'])
            self.win_rate = wins / 100
            
            win_pnls = [f['pnl_pct'] for f in self.recent_fills if f['is_win']]
            loss_pnls = [f['pnl_pct'] for f in self.recent_fills if not f['is_win']]
            
            self.avg_win = sum(win_pnls) / len(win_pnls) if win_pnls else 0.01
            self.avg_loss = abs(sum(loss_pnls) / len(loss_pnls)) if loss_pnls else 0.01
    
    def compute_kelly_fraction(self) -> float:
        """
        Kelly formula: f* = (p * b - q) / b
        其中：
        - p = 胜率
        - q = 1 - p
        - b = avg_win / avg_loss （赔率）
        
        Kelly fraction 是最优化单笔下注比例。
        我们用它来调整 order_size。
        """
        if self.avg_loss == 0:
            return 0.25  # 保守值
        
        p = self.win_rate
        q = 1 - p
        b = self.avg_win / self.avg_loss
        
        kelly_f = (p * b - q) / b if b > 0 else 0
        
        # Kelly fraction 通常太激进，用 partial Kelly（如 25% Kelly）
        partial_f = kelly_f * 0.25
        
        # 限制在 [0.05, 0.3] 范围内
        return max(0.05, min(0.3, partial_f))
    
    def compute_dynamic_order_size(self, account_equity: float, 
                                   base_order_size: float = 25.0) -> float:
        """
        基于 Kelly fraction 动态调整订单大小
        
        核心思路：
        order_size = base_order_size * kelly_fraction / 0.25
        （假设 base 对应 25% Kelly）
        """
        kelly_f = self.compute_kelly_fraction()
        multiplier = kelly_f / 0.25  # 0.25 是保守的初始 Kelly 比
        
        dynamic_size = base_order_size * multiplier
        
        # 限制最大下单量（按账户1%）
        max_by_account = account_equity * 0.01
        
        return min(dynamic_size, max_by_account)

实现集成（orchestrator.py）：
class StrategyOrchestrator:
    def __init__(self, ...):
        ...
        self.kelly_mgr = KellyFractionManager()
    
    async def _evaluate_and_trade_cycle(self):
        # 生成信号
        signals = ...
        
        # 计算动态 order_size
        dynamic_size = self.kelly_mgr.compute_dynamic_order_size(
            account_equity=self.state.metrics.equity,
            base_order_size=self.config.order_size
        )
        
        for signal in signals:
            # 用 dynamic_size 而非 self.config.order_size
            intent = OrderIntent(
                market_id=signal.market_id,
                bucket_id=signal.bucket_id,
                side=signal.side,
                price=signal.target_price,
                size=dynamic_size
            )
            order = await self.execution.submit_intent(intent)
            if order:
                # 成交后更新 Kelly 统计
                pass  # on_fill 会调用
    
    async def on_fill(self, fill: Fill):
        """成交后更新 Kelly 统计"""
        self.kelly_mgr.update_from_fill(fill)
        # 其他逻辑
```

**代码位置**：
- [trading_engine/risk_manager.py](trading_engine/risk_manager.py) - 新增 KellyFractionManager 类
- [trading_engine/orchestrator.py](trading_engine/orchestrator.py) - 集成动态 order_size

---

### 3.3 【量化】回测成本与滑点精算

**场景**：回测出的 Sharpe 无法解释实盘差距；滑点模型过简。

**需求**：
```
在 backtesting/engine.py 中完善 fill 模型：

1. 手续费精算：
   class FillSimulator:
       def __init__(self, taker_fee_pct=0.002, maker_fee_pct=0.0):
           self.taker_fee_pct = taker_fee_pct  # Polymarket 实际 0.2%
           self.maker_fee_pct = maker_fee_pct  # 主动单手续费
       
       def simulate_fill(self, side: str, limit_price: float, 
                        best_bid: float, best_ask: float, 
                        size: float, depth: float) -> tuple:
           """
           返回：(fill_ok: bool, fill_price: float, fill_qty: float, fee: float)
           """
           if side == "buy":
               if limit_price < best_ask:
                   return False, 0, 0, 0  # 无法成交
               
               # 按 depth 分配成交量
               fill_qty = min(size, depth * 0.5)  # 消耗 50% depth 才能全部成交
               fill_price = best_ask + (limit_price - best_ask) * 0.3  # 改进提前
               
               # 手续费 = 成交额 * taker_fee_pct
               fee = fill_qty * fill_price * self.taker_fee_pct
               
               return True, fill_price, fill_qty, fee
           
           # side == "sell" 拆展开...

2. 市场冲击模型（简化 Almgren-Chriss）：
   def compute_market_impact(self, side: str, size: float, 
                            total_volume_per_min: float) -> float:
       """
       市场冲击 = sqrt(size / total_volume) * base_impact
       大单冲击点差更多
       """
       impact_ratio = size / max(total_volume_per_min, 1.0)
       base_impact = 0.02  # 2 个基点
       
       # sqrt 缓和增长
       return min(0.1, base_impact * (impact_ratio ** 0.4))

3. 回测中使用：
   在 BacktestEngine.run() 中：
   
   fill_simulator = FillSimulator(taker_fee_pct=0.002)
   market_impact = MarketImpactModel()
   
   for _, row in merged.iterrows():
       ...
       
       # 计算实际成交价（包含冲击）
       impact = market_impact.compute_market_impact(
           side=side,
           size=self.config.order_size,
           total_volume_per_min=row['recent_trade_volume']
       )
       adjusted_target = target if side == "buy" else target - impact
       
       ok, fill_price, fill_qty, fee = fill_simulator.simulate_fill(
           side=side,
           limit_price=adjusted_target,
           best_bid=row['best_bid'],
           best_ask=row['best_ask'],
           size=self.config.order_size,
           depth=row['depth']
       )
       
       if ok:
           # PnL 计算包含手续费
           entry_cost = fill_qty * fill_price + fee
           ...

4. 回测输出对标（backtesting/metrics.py）：
   在 PerfMetrics 中新增：
   {
       ...
       "total_fees_paid": sum of all fill fees,
       "gross_pnl": PnL before fees,
       "net_pnl": PnL after fees,
       "fee_drag": total_fees / gross_abs_wins,  # 手续费吞噬比
       ...
   }
```

**代码位置**：
- [backtesting/slippage.py](backtesting/slippage.py) - 改进 simulate_fill_price，加入手续费
- [backtesting/engine.py](backtesting/engine.py) - 集成市场冲击
- [backtesting/metrics.py](backtesting/metrics.py) - 新增费用指标

---

### 3.4 【产品】市场行情看板

**场景**：用户无法一览所有可交易市场的当前报价、流动性。

**需求**：
```
在 backend/app/routers 中新增 markets 端点：

1. 新增数据模型（models.py）：
   class MarketSnapshot(Base):
       __tablename__ = "market_snapshots"
       id = Column(String, primary_key=True)
       market_id = Column(String, index=True)
       bucket_id = Column(String)
       best_bid = Column(Float)
       best_ask = Column(Float)
       mid_price = Column(Float)
       spread = Column(Float)
       depth_ask = Column(Float)  # top 5 档深度
       depth_bid = Column(Float)
       last_trade_price = Column(Float)
       volume_24h = Column(Float)
       implied_prob = Column(Float)
       timestamp = Column(DateTime(timezone=True))

2. 新增 REST 端点（routers/markets.py）：
   GET /api/markets/active
   返回当前所有活跃市场的桶位快照：
   {
       "markets": [
           {
               "market_id": "poly-123",
               "market_name": "NYC High Temp 2026-02-28",
               "buckets": [
                   {
                       "bucket_id": "temp-50-55",
                       "bucket_name": "50-55°F",
                       "best_bid": 0.15,
                       "best_ask": 0.17,
                       "mid": 0.16,
                       "spread": 0.02,
                       "spread_pct": 12.5,
                       "depth_bid": 500,
                       "depth_ask": 450,
                       "implied_probability": 0.16,
                       "last_trade": {"price": 0.16, "qty": 100, "time": "..."},
                       "volume_24h": 25000,
                       "liquidity_score": 0.85  # 0-1, bid+ask depth > 1000 → 1.0
                   },
                   ...
               ]
           },
           ...
       ],
       "timestamp": "2026-02-27T10:30:00Z"
   }
   
   GET /api/markets/{market_id}/orderbook?bucket_id=temp-70-75
   返回完整订单簿（top 10 档）：
   {
       "bids": [
           {"price": 0.34, "qty": 100},
           {"price": 0.33, "qty": 250},
           ...
       ],
       "asks": [
           {"price": 0.35, "qty": 150},
           {"price": 0.36, "qty": 200},
           ...
       ]
   }

3. 前端行情页面（frontend/src/components/MarketsPanel.tsx）：
   功能：
   - 市场列表（可搜索、过滤）
   - 桶位行情表格：bid/ask/spread/depth/volume
   - 行情颜色地热图：spread 越小越绿，流动性越好越深
   - 实时刷新（订阅 WebSocket 流）
   - 点击桶位可跳到交易页面

4. WebSocket 实时行情推送（services/streams.py）：
   /ws/market-snapshot
   推送格式：
   {
       "type": "market_snapshot",
       "market_id": "poly-123",
       "bucket_id": "temp-70-75",
       "best_bid": 0.34,
       "best_ask": 0.36,
       "mid": 0.35,
       "spread": 0.02,
       "timestamp": "2026-02-27T10:30:01Z"
   }
```

**代码位置**：
- [backend/app/models.py](backend/app/models.py) - 新增 MarketSnapshot 表
- [backend/app/routers/markets.py](backend/app/routers/markets.py) - 新增端点
- [backend/app/services/streams.py](backend/app/services/streams.py) - WebSocket 推送
- [frontend/src/components/MarketsPanel.tsx](frontend/src/components/MarketsPanel.tsx) - 前端页面

---

## 📋 总结：提示词使用指南

### 如何使用本文档

1. **选择优先级**(按推荐顺序)：
   - 🔴 P1 优先：架构稳定性和量化基础（预留 2-3 周）
   - 🟡 P2 重要：产品完整性（预留 1-2 周）
   - 🟢 P3 加分：高级功能（预留 1+ 周）

2. **粘贴到 Copilot**：
   - 打开 VS Code 的 Copilot Chat（Ctrl + I）
   - 复制项目部分的完整提示词
   - Copilot 会理解上下文并生成代码框架

3. **示例使用流程**：
   ```
   用户：请借鉴"1.1 Event Log 系统"的需求，在 backend/app/models.py 中创建 EventLog 表
   
   Copilot 会：
   - 读取现有 models.py 结构
   - 按风格添加 EventLog 类定义
   - 建议数据库迁移脚本
   - 给出调用示例
   ```

4. **逐个实施**：
   - 先从"1.1"→"1.2"→...依序推进
   - 完成一个功能须跑通单元测试
   - 提交 PR 后再开启下一个

---

**最后建议**：
- 建议团队先集中完成 P1 的 3 项（Event Log、WebSocket 恢复、概率模型改进）
- 这三项是系统稳定性和决策质量的基础
- 之后再推进 P2 的 4 项产品功能和交易体验
- P3 是锦上添花，可根据实际反馈灵活调整

祝编码愉快！🚀
