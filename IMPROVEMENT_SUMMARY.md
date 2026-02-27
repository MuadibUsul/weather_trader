README: Copilot 改进提示词库使用说明
===================================

## 📂 文件清单

本次生成的改进方案包含 **4 份文档**，均存放在项目根目录：

```
weather_trader/
├── CODEX_PROMPTS.md           ⭐ 完整提示词库（优先级 1-3，8 个模块）
├── COPILOT_TEMPLATES.md       ⭐ 代码模板与框架（即插即用）
├── QUICK_START.md             ⭐ 实施路线与交互例样（快速上手）
├── IMPROVEMENT_SUMMARY.md     📋 本文件（概览与指南）
└── ...（其他项目文件）
```

---

## 🎯 文档用途速查

| 文档 | 用途 | 阅读时间 | 何时打开 |
|------|------|---------|---------|
| **CODEX_PROMPTS.md** | 详细的需求描述 + 实现思路 | 30-45 min | 理解全貌，制定计划 |
| **COPILOT_TEMPLATES.md** | 可直接参考的代码框架 | 20-30 min | 与 Copilot 交互时粘贴 |
| **QUICK_START.md** | 按优先级的实施步骤 + 交互例样 | 15-20 min | 开始执行某个具体任务 |
| **IMPROVEMENT_SUMMARY.md** | 本文件，使用导航 | 5 min | 快速定位需要的内容 |

---

## 🚀 快速开始（3 步）

### 1️⃣ 阅读全景（10 分钟）

```
打开 CODEX_PROMPTS.md 第一页：
- 了解三个优先级的分类
- 扫一眼每个模块的简介
- 评估 当前团队能投入的时间
```

### 2️⃣ 选择起点（决策 < 5 分钟）

```
根据你的情况选择入手点：

时间充足（2-3 周）？ → 执行 优先级 P1 四个模块（完整架构改进）
时间有限（1-2 周）？ → 只做 P1.1（Event Log）+ P1.2（WebSocket）
急忙落地（< 1 周）？ → 先做 P2（产品功能，用户体验最快反馈）
```

### 3️⃣ 执行第一项（1-3 天）

```
以 优先级 P1.1（Event Log 系统）为例：

① 打开文件编辑器，新建终端
② 打开 COPILOT_TEMPLATES.md，找到"P1.1 EventLog 系统"部分
③ 复制模板代码（EventLog 表定义 + log_event 函数）
④ 粘贴到 Copilot Chat：
   "请参考这个模板，在 backend/app/models.py 中实现 EventLog 表"
⑤ Copilot 生成代码 → 粘贴到项目 → 运行迁移 → 集成到 orchestrator.py
⑥ 测试与提交
```

---

## 📋 按优先级的模块列表

### 🔴 P1: 架构基础（2-3 周，必做）

| # | 模块 | 文件位置 | 提示词文档位置 | 模板位置 | 预期工期 |
|----|------|---------|---------------|---------|---------|
| **1.1** | Event Log 系统 | [backend/app/models.py](backend/app/models.py) | CODEX_PROMPTS.md 1.1 | COPILOT_TEMPLATES.md P1.1 | 3 天 |
| **1.2** | WebSocket 断点续历 | [trading_engine/market_data_engine.py](trading_engine/market_data_engine.py) | CODEX_PROMPTS.md 1.2 | COPILOT_TEMPLATES.md P1.2 | 4-5 天 |
| **1.3** | 市场心理项融合 | [trading_engine/probability_engine.py](trading_engine/probability_engine.py) | CODEX_PROMPTS.md 1.3 | COPILOT_TEMPLATES.md P1.3 | 5 天 |
| **1.4** | 信号粘性过滤 | [trading_engine/signal_engine.py](trading_engine/signal_engine.py) | CODEX_PROMPTS.md 1.4 | COPILOT_TEMPLATES.md P1.4 | 4 天 |

**核心收益**：
- ✅ 交易决策完全可追溯
- ✅ WebSocket 断线无影响
- ✅ 模型质量提升 5-10%
- ✅ 信号稳定，手续费降低

---

### 🟡 P2: 产品完整性（1-2 周，重要）

| # | 模块 | 相关文件 | 提示词位置 | 预期工期 |
|----|------|---------|-----------|---------|
| **2.1** | SAGA 一致性 | [trading_engine/orchestrator.py](trading_engine/orchestrator.py) | CODEX_PROMPTS.md 2.1 | 无模板 | 3 天 |
| **2.2** | 账户资金实时显示 | [backend/app/models.py](backend/app/models.py) + [frontend/src/](frontend/src/) | CODEX_PROMPTS.md 2.2 | 无专用模板 | 3 天 |
| **2.3** | 订单历史查询 | [backend/app/routers/orders.py](backend/app/routers/orders.py) | CODEX_PROMPTS.md 2.3 | 无专用模板 | 3 天 |
| **2.4** | 告警系统 | [backend/app/services/alert_service.py](backend/app/services/alert_service.py) | CODEX_PROMPTS.md 2.4 | 无专用模板 | 2 天 |

**核心收益**：
- ✅ 用户能看到账户资金和成交历史
- ✅ 风控触发立即告警（邮件/Slack）
- ✅ 交易-订单-仓位一致性保证

---

### 🟢 P3: 高级优化（1+ 周，加分）

| # | 模块 | 相关文件 | 提示词位置 |
|----|------|---------|-----------|
| **3.1** | Inventory-Aware 报价 | [trading_engine/signal_engine.py](trading_engine/signal_engine.py) | CODEX_PROMPTS.md 3.1 |
| **3.2** | 动态 Kelly 头寸 | [trading_engine/risk_manager.py](trading_engine/risk_manager.py) | CODEX_PROMPTS.md 3.2 |
| **3.3** | 回测成本精算 | [backtesting/engine.py](backtesting/engine.py) | CODEX_PROMPTS.md 3.3 |
| **3.4** | 市场行情看板 | [backend/app/routers/markets.py](backend/app/routers/markets.py) | CODEX_PROMPTS.md 3.4 |

---

## 🎓 使用技巧

### 技巧 1：与 Copilot 互动的黄金句式

```python
# ✅ 推荐做法
"帮我在 [文件路径] 中实现 [功能]。
要求：[3-5 条清晰需求]
参考代码/模板：[粘贴 COPILOT_TEMPLATES.md 的相关部分]
预期返回：[想要什么样的输出]"

# ❌ 容易失败的做法
"给我写一个 [宽泛描述]"  # 太模糊，Copilot 容易歪楼
```

### 技巧 2：分解复杂任务

```
❌ 一步走：
"实现完整的 Event Log 系统"
↓
大概率：代码不完整，有 bug

✅ 分步走：
① "生成 EventLog 表定义"（1 条 prompt）
② "生成 log_event() 函数"（1 条 prompt）
③ "在 orchestrator 中集成调用"（1 条 prompt）
④ "生成查询 API 端点"（1 条 prompt）
↓
结果：稳定，可控，容易迭代
```

### 技巧 3：参考现有代码风格

```
在每个 prompt 中加上：
"参考现有的 [模块].py 的代码风格，确保一致性"

Copilot 会自动分析现有代码的：
- Naming convention (snake_case vs CamelCase)
- Type hints 风格
- Error handling 方式
- Docstring 格式
```

### 技巧 4：逐一验证生成的代码

```
① 语法检查：代码是否能 import + 运行
② 功能检查：是否符合期望的输入/输出
③ 集成检查：与现有代码的交互是否正确
④ 测试编写：覆盖至少 80% 的代码路径

如果 Copilot 生成的代码有问题：
"这段代码在 [具体位置] 有问题。
错误是：[错误信息]。
请修复 [具体部分] 的逻辑。"
```

---

## ⏱️ 时间规划示例

### 方案 A：充足时间（3 周）

```
Week 1：
  ✓ P1.1 Event Log 系统（3 天）
  ✓ P1.2 WebSocket 断点续历（4-5 天，跨周到 Day 8）

Week 2：
  ✓ P1.3 市场心理项融合（5 天）
  ✓ P1.4 信号粘性过滤（3 天）

Week 3：
  ✓ P2 产品功能（账户显示、订单历史、告警）
  ✓ 测试 & 修复 bugs

总收益：完整的架构改进 + 产品体验升级
```

### 方案 B：有限时间（2 周）

```
Week 1：
  ✓ P1.1 Event Log 系统（3 天）
  ✓ P1.2 WebSocket 断点续历（4 天）

Week 2：
  ✓ P2.2 + P2.3 账户显示 & 订单历史（4 天）
  ✓ 测试 & 集成

总收益：核心架构 + 基础产品功能
```

### 方案 C：时间紧张（1 周）

```
Day 1-3：
  ✓ P1.1 Event Log（实现最小版本）

Day 4-7：
  ✓ P2.2 + P2.3（账户和订单历史）
  ✓ P2.4（告警系统）

总收益：快速提升用户体验（资金可见 + 历史可查 + 告警）
  
后续可慢慢补完 P1 的其他三项
```

---

## 🔍 如何查找特定功能

### 我想实现 [功能]，应该看哪个文档？

```
查找流程：

1. 打开 QUICK_START.md
2. 在"优先级列表"中找到你的目标功能
3. 记下"提示词文档位置"与"模板位置"
4. 打开对应文档：
   - CODEX_PROMPTS.md（理解需求）
   - COPILOT_TEMPLATES.md（获取代码框架）
5. 复制内容，与 Copilot 交互
```

### 快速导航表

| 我要做... | 打开这个... | 位置 |
|---------|----------|------|
| 记录交易决策链 | CODEX_PROMPTS.md | 1.1 |
| 处理 WebSocket 断线 | CODEX_PROMPTS.md + COPILOT_TEMPLATES.md | 1.2 |
| 改进概率模型 | CODEX_PROMPTS.md + COPILOT_TEMPLATES.md | 1.3 |
| 稳定订单信号 | CODEX_PROMPTS.md + COPILOT_TEMPLATES.md | 1.4 |
| 显示项目资金 | CODEX_PROMPTS.md | 2.2 |
| 查询赢利历史 | CODEX_PROMPTS.md | 2.3 |
| 发送告警通知 | CODEX_PROMPTS.md | 2.4 |
| 调整报价宽度 | CODEX_PROMPTS.md | 3.1 |
| 动态调整下单量 | CODEX_PROMPTS.md | 3.2 |
| 精确回测成本 | CODEX_PROMPTS.md | 3.3 |

---

## ✅ 检查清单

实施前，确保：

- [ ] 阅读过 CODEX_PROMPTS.md 的优先级说明（5 min）
- [ ] 选定了第一个要实施的模块（P1.1 推荐）
- [ ] 安装了最新的 GitHub Copilot 扩展（VS Code）
- [ ] 有 2-3 天的不间断编码时间
- [ ] 团队成员已知晓本方案的目标和时间表

---

## 🆘 遇到问题

| 问题 | 解决方案 |
|------|---------|
| Copilot 生成的代码无法运行 | 复制完整的 import 块，让 Copilot 参考；指出具体错误 |
| 不知道从哪里开始 | 按 QUICK_START.md 的"实施清单"顺序走 |
| 需要修改需求 | 在 CODEX_PROMPTS.md 对应的提示词中加注 `[自定义需求]` |
| 功能交互复杂，Copilot 难以一次生成 | 分解成多个小 prompt，逐步构建 |
| 代码生成后与现有代码风格不符 | 在 prompt 中强调"参考现有代码风格" |

---

## 📞 反馈与迭代

实施过程中，如发现：
- 提示词描述不清 → 补充说明，更新文档
- 代码模板有误 → 修正模板
- 时间预估不对 → 调整后续规划

**建议**：每完成一个模块，记录实际耗时与遇到的坑，持续优化。

---

## 🎉 预期成果

完整实施后，Weather Trader 系统将达到：

```
架构稳定性：★★★★★
- 完整的审计链
- 断线无影响
- 数据一致性保证
- 交易决策透明

交易质量：★★★★★
- 模型融合市场信息
- 信号稳定低频
- 手续费优化

用户体验：★★★★☆
- 资金余额可见
- 订单交易历史可查
- 风控告警即时
- 行情看板完整

技术债清理：★★★★☆
- 核心模块现代化
- 错误处理完善
- 测试覆盖度提升
```

---

**祝开发顺利！如有疑问，参考三份详细文档。** 🚀

---

## 附录：文档内容速览

### CODEX_PROMPTS.md 包含：

```
P1（实施优先级）：
├─ 1.1 Event Log 系统
├─ 1.2 WebSocket 消息去重与断点续历
├─ 1.3 市场心理项纳入概率模型
└─ 1.4 Edge 信号去重与粘性过滤

P2（重要补强）：
├─ 2.1 SAGA Pattern 一致性
├─ 2.2 账户资金实时显示
├─ 2.3 订单历史与详情查询
└─ 2.4 告警系统与多渠道推送

P3（加分改进）：
├─ 3.1 Inventory-Aware 报价调整
├─ 3.2 动态 Kelly 头寸管理
├─ 3.3 回测成本与滑点精算
└─ 3.4 市场行情看板
```

### COPILOT_TEMPLATES.md 包含：

```
P1.1（Event Log）：
├─ EventLog 表定义
├─ log_event() 函数
├─ Orchestrator 集成
└─ 查询 API 端点

P1.2（WebSocket）：
├─ MarketDataEngine 增强版
├─ 消息去重逻辑
├─ 断线恢复流程
└─ 定期对账实现

P1.3（概率融合）：
├─ MarketActivity 类
├─ _compute_market_mu 方法
├─ _compute_market_activity_sync 方法
├─ 改进的 _compute_distribution_sync

P1.4（信号粘性）：
├─ SignalState 类
├─ _smooth_edge 方法
├─ _apply_hysteresis 方法
├─ _check_signal_interval 方法
└─ _rank_by_sharpe 方法
```

### QUICK_START.md 包含：

```
├─ 三份文档说明
├─ 3 步快速开始
├─ 优先级模块明细表
├─ 与 Copilot 互动技巧
├─ 时间规划示例（A/B/C 三种方案）
├─ 快速导航表
└─ 检查清单和故障排查
```

---

**End of IMPROVEMENT_SUMMARY.md**
