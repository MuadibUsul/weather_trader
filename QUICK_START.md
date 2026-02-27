# Copilot 改进方案：快速启动指南

> 本文档提供按优先级执行改进方案的**实施步骤**和**Copilot 交互例样**。

---

## 📋 三份文档说明

| 文档 | 用途 | 访问方式 |
|------|------|---------|
| **CODEX_PROMPTS.md** | 完整的提示词库，按优先级分类，包含所有改进需求的详细描述 | 作为 Copilot Chat 的输入 |
| **COPILOT_TEMPLATES.md** | 代码模板和框架，直接可用，减少生成代码的差异性 | 粘贴到代码编辑区或作为 Copilot 参考 |
| **QUICK_START.md** | 本文档，快速实施路线和交互例样 | 按步骤执行 |

---

## 🚀 快速启动：优先级 1（2-3 周）

### Step 1: Event Log 系统（3 天）

**目标**：记录所有交易决策过程，支持审计和追溯。

**Copilot 交互示例**：

```
用户：帮我在 backend/app/models.py 中添加 EventLog 表定义。
要求：
- 支持记录 signal_generated, risk_check_passed/failed, order_submitted, order_executed 等事件类型
- 每条记录包含 event_type, event_data (JSON), correlation_id, created_at
- 提供创建 EventLog 实例的异步函数 log_event()

参考文档: COPILOT_TEMPLATES.md 中的 1. EventLog 数据表定义

Copilot 会：
1. 读取当前 models.py 风格
2. 生成符合风格的 EventLog 类
3. 添加数据库迁移脚本
4. 给出调用示例
```

**实施清单**：
- [ ] 在 `backend/app/models.py` 中添加 EventLog 表
- [ ] 运行数据库迁移：`alembic upgrade head`
- [ ] 在 `backend/app/routers/logs.py` 中添加 3 个查询端点（list / detail / trace）
- [ ] 在 `trading_engine/orchestrator.py` 中集成 `log_event()` 调用（10+ 处）
- [ ] 编写单元测试：`tests/test_event_log.py`
- [ ] 验证：查询端点能正确返回事件日志

**验收标准**：
- 后端可正确记录信号、风控、订单等事件
- GET /api/logs/events 能查询最近 7 天的日志（分页）
- GET /api/logs/trace/{correlation_id} 能展示完整决策链

---

### Step 2: WebSocket 断点续历（4-5 天）

**目标**：WebSocket 断线后能优雅重连并恢复盘口状态，无订单丢失。

**Copilot 交互示例**：

```
用户：改进 trading_engine/market_data_engine.py，实现以下功能：
1. 消息去重：维护 last_seq_id，丢弃 sequence_id <= last_seq_id 的消息
2. 断线恢复：保存快照并支持从 REST API 重新拉取完整盘口
3. 定期对账：Orchestrator 每 10s 对账 DB 和本地持仓，不一致时触发 emergency_stop

参考代码: COPILOT_TEMPLATES.md 中的 P1.2 WebSocket 断点续历

Copilot 会：
1. 生成带 last_seq_id 和 seen_hashes 的 MarketDataEngine 增强版
2. 生成 reconnect_and_resync() 方法
3. 在 Orchestrator 中生成新的 _reconcile_positions() 方法
```

**实施清单**：
- [ ] 改进 `MarketDataEngine.__init__()` 添加 `last_seq_id` 和 `seen_message_hashes`
- [ ] 实现 `on_orderbook_update()` 去重逻辑
- [ ] 实现 `on_websocket_disconnect()` 快照保存
- [ ] 实现 `reconnect_and_resync()` 重新同步
- [ ] 在 `StrategyOrchestrator._main_loop()` 中加入 10s 周期的 `_reconcile_positions()`
- [ ] 编写集成测试：模拟 WebSocket 断线与重连场景

**验收标准**：
- WebSocket 断线 → 无信号生成 → 重连成功 → 恢复信号生成
- 对账检测到不一致时正确触发 emergency_stop 和日志记录
- 回测中不出现"订单丢失"的情况

---

### Step 3: 市场心理项概率模型（5 天）

**目标**：概率模型融合市场信息，避免被市场先行套利。

**Copilot 交互示例**：

```
用户：改进 trading_engine/probability_engine.py 中的概率计算。
需求：
1. 新增 MarketActivity 数据类，包含 depth_score, volume_score, spread_tightness, composite
2. 计算 market_mu（市场隐含期望）：加权平均市场中价和概率
3. 计算 market_activity：基于 depth、volume、spread 的综合评分 [0-1]
4. 动态融合权重 alpha = 0.3 + 0.4 * market_activity, 融合 mu = alpha * market_mu + (1-alpha) * weather_mu
5. 若 sigma > 4，降低 alpha 到 0.8 倍

参考代码: COPILOT_TEMPLATES.md 中的 P1.3 市场心理项概率模型

结果：
- _compute_distribution_sync() 传入 market_mu 和 market_activity 参数
- 计算概率时使用融合后的 mu
```

**实施清单**：
- [ ] 定义 `MarketActivity` 数据类
- [ ] 实现 `_compute_market_mu(quotes)` 方法
- [ ] 实现 `_compute_market_activity_sync(quotes)` 方法
- [ ] 改进 `_compute_distribution_sync()` 支持融合计算
- [ ] 更改 `compute_distribution()` 签名接收 `quotes` 参数
- [ ] 在 Orchestrator 中调用时传入 quotes
- [ ] 单元测试：验证 alpha 根据 activity 变化

**验收标准**：
- 高活跃度市场（depth > 1000）→ alpha 接近 0.7，融合权重偏向市场
- 低活跃度市场 → alpha ～ 0.3，融合权重偏向气象模型
- 整体模型 sharpe 比原来提升 5-10%（回测数据）

---

### Step 4: Edge 信号粘性过滤（4 天）

**目标**：防止信号频繁摇摆，减少手续费损耗。

**Copilot 交互示例**：

```
用户：改进 trading_engine/signal_engine.py，实现信号粘性过滤。
需求：
1. 新增 SignalState 类，追踪 active_signals, last_signal_time, edge_ema
2. 粘性过滤（Hysteresis）：信号开启需要 |edge| >= threshold，取消需要 |edge| < threshold - 0.5%
3. EMA 平滑 edge：alpha = 0.3，平滑后的 edge 用于判断
4. 最小信号间隔：同向 60s，反向需等待 30s
5. 信号按性价比排序（edge / spread）

参考代码: COPILOT_TEMPLATES.md 中的 P1.4 Edge 信号粘性过滤

结果：
- generate_signals() 返回更稳定、低频的信号
```

**实施清单**：
- [ ] 定义 `SignalState` 数据类和初始化
- [ ] 实现 `_smooth_edge()` EMA 平滑方法
- [ ] 实现 `_apply_hysteresis()` 粘性过滤逻辑
- [ ] 实现 `_check_signal_interval()` 最小间隔检查
- [ ] 实现 `_rank_by_sharpe()` 性价比排序
- [ ] 集成到 `generate_signals()` 主流程
- [ ] 单元测试：模拟边界情况（edge 在 threshold 附近摇摆）

**验收标准**：
- 信号频率下降 30-50%
- 同一桶位短期内来回切换的情况消除
- 回测中手续费总额下降 5-10%

---

## 🟡 优先级 2（1-2 周）

### Step 5-8: 产品功能（此阶段）

**推荐顺序**：
1. **账户资金实时显示**（3 天）
   - 添加 AccountBalance 表、BalancePanel 组件、WebSocket 推送
   
2. **订单历史查询**（3 天）
   - 扩展 Order 表、新增历史查询端点、前端 OrderHistoryPanel
   
3. **告警系统**（2 天）
   - Alert 表、alert_service、多渠道推送（邮件/Slack）、前端 AlertCenter
   
4. **市场行情看板**（2 天）
   - MarketSnapshot 表、markets REST 端点、WebSocket 推送、MarketsPanel 组件

**Copilot 交互示例**（以账户资金为例）：

```
用户：帮我在 backend/app 中实现账户资金管理系统。
需求：
1. models.py：新增 AccountBalance 表（total_usdc, available_usdc, reserved_usdc, realized_pnl, unrealized_pnl）
2. routers/wallet.py：新增 GET /api/wallet/balance 和 GET /api/wallet/transactions
3. services/streams.py：WebSocket /ws/balance-updates 推送实时余额更新
4. 集成到 trading_engine/orchestrator.py：每次 on_fill 后更新余额

参考: CODEX_PROMPTS.md 的 2.2 【产品】账户资金实时显示与推送

Copilot 会生成：
- AccountBalance 和 TransactionLog 表定义
- get_account_balance() 和 update_balance_on_fill() 函数
- WebSocket 消息编码器
- 前端 BalancePanel.tsx 示意代码
```

---

## 🟢 优先级 3（1+ 周）

快速参考（不展示详细步骤，Copilot 应能快速处理）：
- **Inventory-Aware 报价**：InventoryAwareQuoting 类，调整 quote_delta
- **动态 Kelly 头寸**：KellyFractionManager，根据胜率和赔率调整 order_size
- **回测成本精算**：FillSimulator + MarketImpactModel，精确模拟手续费和市场冲击

---

## 💡 Copilot Chat 常用提示词模板

### 场景 1：生成数据表

```
帮我在 backend/app/models.py 中添加一个 [表名] 表。
要求：
- 字段列表：[字段1], [字段2], ...
- 关键索引：...
- 时间戳字段：created_at, updated_at

参考现有表的风格，并生成数据库迁移脚本。
```

### 场景 2：实现 API 端点

```
在 backend/app/routers/[module].py 中新增端点 [GET/POST] [/api/path]。
需求：
- 输入参数：[参数列表 + 类型 + 验证规则]
- 输出格式：[JSON 结构 + 说明]
- 涉及的数据库操作：[查询 / 更新 / 删除]
- 权限要求：[需要认证 / 可选]

使用 FastAPI 风格，返回适当的 HTTP 状态码。
```

### 场景 3：改进交易逻辑

```
改进 trading_engine/[module].py 中的 [方法名] 方法。
当前问题：[现状问题 / 性能瓶颈 / 功能缺陷]

改进方向：
1. ...
2. ...
3. ...

参考: [相关模板位置]

生成改进后的代码，并列出所有改动点。
```

### 场景 4：编写测试

```
为 trading_engine/[module].py::ClassName 编写单元测试。
覆盖场景：
- 正常流程：...
- 边界情况：...
- 错误处理：...

使用 pytest + asyncio（如果是异步函数），生成 tests/[test_file].py。
```

---

## ✅ 执行检查清单

| 项 | 优先级 | 预期工期 | 状态 |
|----|--------|---------|------|
| Event Log 系统 | P1 | 3d | ⏳ |
| WebSocket 断点续历 | P1 | 4-5d | ⏳ |
| 市场心理项融合 | P1 | 5d | ⏳ |
| 信号粘性过滤 | P1 | 4d | ⏳ |
| 账户资金实时显示 | P2 | 3d | ⏳ |
| 订单历史与详情 | P2 | 3d | ⏳ |
| 告警系统 | P2 | 2d | ⏳ |
| 市场行情看板 | P2 | 2d | ⏳ |
| Inventory-Aware 报价 | P3 | 1-2d | ⏳ |
| 动态 Kelly 头寸 | P3 | 2-3d | ⏳ |
| 回测成本精算 | P3 | 2-3d | ⏳ |

---

## 📞 遇到问题时

### 问题 1：Copilot 生成的代码与项目风格不符
**解决**：在 prompt 中补充 `参考现有代码: [相关文件路径]`，让 Copilot 对齐风格。

### 问题 2：代码生成不完整（只有框架，缺少细节逻辑）
**解决**：拆分需求，先生成主逻辑，再要求 Copilot "补充 [具体部分] 的实现细节"。

### 问题 3：生成代码有 import 错误
**解决**：粘贴完整的 import 块到 prompt，让 Copilot 参考。

### 问题 4：异步函数生成有误
**解决**：明确约定 `使用 asyncio 和 aiohttp / SQLAlchemy async`，并给出示例。

---

## 🎯 成功标志

实施完成后，系统应达到：

✅ **架构稳定性**
- 订单生命周期完整追溯（Event Log）
- WebSocket 断线无订单丢失（断点续历）
- 数据一致性自动校验（定期 reconcile）

✅ **交易质量**
- 模型融合市场心理，sharpe 提升
- 信号稳定低频，手续费降低
- 风控决策透明可审计

✅ **用户体验**
- 账户余额实时显示
- 订单和成交历史可查
- 风控事件即时告警
- 市场行情一览无遗

---

**祝顺利！如有问题，请参考 CODEX_PROMPTS.md 和 COPILOT_TEMPLATES.md。** 🚀
