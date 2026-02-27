# 🚀 Copilot 改进方案速查卡（一页纸版）

> 打印或放在第二屏，随时参考

---

## 📂 四份文档快速定位

```
首次使用？      → IMPROVEMENT_SUMMARY.md（5 min 入门）
理解全景？      → CODEX_PROMPTS.md（30 min 概览）
开始编码？      → COPILOT_TEMPLATES.md（复制代码框架）
执行具体项？    → QUICK_START.md（按步骤来）
```

---

## ⏱️ 优先级速查（按建议顺序）

### 🔴 P1（架构基础，2-3 周）

| # | 模块 | 工期 | Copilot 提示词位置 | 代码模板位置 |
|----|------|------|-----------------|----------|
| 1.1 | Event Log | 3d | CODEX§1.1 | TEMPLATE§P1.1 |
| 1.2 | WebSocket 恢复 | 4-5d | CODEX§1.2 | TEMPLATE§P1.2 |
| 1.3 | 市场心理融合 | 5d | CODEX§1.3 | TEMPLATE§P1.3 |
| 1.4 | 信号粘性过滤 | 4d | CODEX§1.4 | TEMPLATE§P1.4 |

### 🟡 P2（产品功能，1-2 周）

| 2.1 | SAGA 一致性 | 3d | CODEX§2.1 | — |
| 2.2 | 账户资金显示 | 3d | CODEX§2.2 | — |
| 2.3 | 订单历史查询 | 3d | CODEX§2.3 | — |
| 2.4 | 告警系统 | 2d | CODEX§2.4 | — |

### 🟢 P3（高级优化，1+ 周）

| 3.1 | Inventory 报价 | 2d | CODEX§3.1 | — |
| 3.2 | 动态 Kelly | 3d | CODEX§3.2 | — |
| 3.3 | 回测成本精 | 3d | CODEX§3.3 | — |
| 3.4 | 行情看板 | 2d | CODEX§3.4 | — |

---

## 💬 与 Copilot 交互的黄金模板

### 模板 A：生成数据表

```
帮我在 backend/app/models.py 中添加 [表名] 表。

字段：[字段 1, 字段 2, 字段 3...]
索引：[哪些字段需要索引]

参考现有代码风格。
```

### 模板 B：生成 API 端点

```
在 backend/app/routers/[模块].py 中新增 [GET/POST] [路径]。

输入：[参数 + 类型]
输出：[返回 JSON 格式]
权限：[是否需要认证]

使用 FastAPI。
```

### 模板 C：改进交易逻辑

```
改进 trading_engine/[模块].py 的 [方法]。

当前问题：[描述问题]
改进方向：[3-5 个要点]

参考：COPILOT_TEMPLATES.md 的 [对应部分]

列出所有改动点。
```

### 模板 D：编写单元测试

```
为 [模块] 编写单元测试。

覆盖：
- 正常流程
- 边界情况
- 错误处理

使用 pytest，生成 tests/[test_file].py。
```

---

## ✅ 逐项实施清单（P1 示例）

### P1.1：Event Log 系统（3 天）

- [ ] Day 1 上午：生成 EventLog 表 + 迁移脚本
- [ ] Day 1 下午：测试表创建，生成 log_event() 函数
- [ ] Day 2：集成到 orchestrator.py（10+ 处调用点）
- [ ] Day 2：生成查询 API（GET /api/logs/events 等）
- [ ] Day 3：单元测试 + 集成测试
- [ ] Day 3：验证：前端能查看完整事件链
- [ ] ✅：Pass & merge

### P1.2：WebSocket 恢复（4-5 天）

- [ ] Day 1：生成 market_data_engine 消息去重逻辑
- [ ] Day 2：生成 reconnect_and_resync() 方法
- [ ] Day 2-3：测试重连场景（模拟断线）
- [ ] Day 3：生成 _reconcile_positions() 方法
- [ ] Day 4：集成到 orchestrator 主循环
- [ ] Day 4-5：端到端测试，处理 edge cases
- [ ] ✅：Pass & merge

---

## 🎯 我应该从哪里开始？

```
Q1：有 2-3 周时间？
  → 执行完整 P1 四项（架构改进全覆盖）

Q2：只有 1-2 周？
  → P1.1 + P1.2 + P2（快速提升基础稳定性和用户体验）

Q3：只有 5-7 天？
  → P1.1（Event Log）+ P2.2/2.3（账户和历史）

Q4：不确定？
  → 直接从 P1.1 开始（最基础，影响最大）
    完成后自动获得动力去做下一个 ✨
```

---

## 🔧 常见问题速答

| 问题 | 答案 |
|------|------|
| Copilot 生成的代码报错？ | 贴完整 import，指出错误，让 Copilot 改 |
| 代码风格不一致？ | Prompt 中加"参考 [文件路径] 的风格" |
| 不知道怎么集成？ | 打开 QUICK_START.md，看"实施步骤"章节 |
| 需要修改需求？ | 参考 CODEX_PROMPTS.md 对应部分，自定义调整 |
| 单元测试总是失败？ | 分解测试，先测小模块，再集成测试 |
| 进度卡住了？ | 回到 IMPROVEMENT_SUMMARY.md，找故障排查章节 |

---

## 📊 关键指标对标

实施完成后，系统应达到：

| 方面 | 当前 | 目标 | 来自模块 |
|------|------|------|---------|
| 模型 Sharpe（回测） | ~ | +5-10% | P1.3 |
| 信号频率 | 高频摇摆 | 稳定低频 | P1.4 |
| 手续费总额 | 基准 | -5-10% | P1.4 |
| WebSocket 复原时间 | >30s（丢单）| <10s（无损） | P1.2 |
| 订单可追溯性 | 0% | 100% | P1.1 |
| 用户看到余额 | ❌ | ✅ | P2.2 |
| 告警延迟 | >10min | <1s | P2.4 |
| 订单历史可查 | ❌ | ✅ | P2.3 |

---

## 🎉 成功标志

看到这些，说明改进成功了：

```
✅ Event Log 表有数据，前端能追溯完整决策链
✅ WebSocket 断线 → 10s 内恢复，无订单丢失
✅ 概率模型融合市场信息后，回测 Sharpe +5%
✅ 同一桶位 60s 内最多只有 1 个新信号
✅ 账户余额实时显示，超过限额立即告警
✅ 都能查看 30 天的订单和成交历史
✅ 告警通过邮件/Slack 即时推送
```

---

## 📞 需要帮助？

| 资源 | 何时用 |
|------|--------|
| IMPROVEMENT_SUMMARY.md | 不知道从哪里开始 |
| CODEX_PROMPTS.md | 理解需求和实现思路 |
| COPILOT_TEMPLATES.md | 快速获取代码框架 |
| QUICK_START.md | 按步骤执行某个模块 |
| 本卡（REFCARD.md） | 快速查询和时间规划 |

---

## 🚀 启动清单

在开始前，确认：

- [ ] GitHub Copilot 已安装且激活
- [ ] VS Code 版本 ≥ 1.90
- [ ] 本地环境已 setup（pip install -r requirements.txt）
- [ ] 团队知晓时间投入和目标成果
- [ ] 选定了第一个要实施的模块（推荐 P1.1）
- [ ] 有 2-3 个不间断的开发时段

**准备好了？打开 CODEX_PROMPTS.md，让我们开始吧！** 🎯

---

*Last Updated: 2026-02-27*
*Weather Trader Improvement Package v1.0*
