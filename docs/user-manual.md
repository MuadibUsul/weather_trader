# WeatherTrader Pro V3 新用户使用手册

版本：V3（适用于当前仓库主线）

## 1. 产品定位

WeatherTrader Pro V3 是面向量化交易场景的后台系统，目标是通过“策略信号 -> 风控校验 -> 订单执行 -> 账本更新”实现可追踪、可复盘的交易流程。

系统有两种全局模式：

- `PAPER`：模拟钱包/模拟资产，仅用于测试验证。
- `REAL`：真实钱包/真实资产，可接入外部执行通道。

两种模式共用同一套策略、风控、撮合、账本逻辑，唯一差异是是否走真实外部执行。

## 2. 环境准备

建议环境：

- Node.js 20+
- npm 10+
- Windows PowerShell / macOS / Linux Shell

可选依赖（不配置也可启动，系统会降级）：

- PostgreSQL（用于 Prisma 数据持久化）
- Redis（用于缓存与实时状态）

## 3. 快速启动

在项目根目录执行：

```bash
npm install
npm run dev
```

启动后访问：

- 前端：`http://localhost:3000`
- API：`http://localhost:3001`

默认重要参数（可用环境变量覆盖）：

- `TRADE_PIN=123456`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

## 4. 首次使用流程（推荐顺序）

1. 打开 `http://localhost:3000/dashboard`。
2. 在顶部模式开关确认当前模式（建议先用 `PAPER`）。
3. 进入“钱包管理”（`/wallet`）配置当前模式的钱包。
4. 进入“API 凭据”（`/credentials`）配置全局凭据健康状态。
5. 进入“策略配置”（`/strategy`）设置模型与风控参数。
6. 启动策略，观察 Session Stats、订单变化、审计日志。
7. 验证稳定后，再切换到 `REAL` 进行真实执行。

## 5. 页面说明

- `/dashboard`：控制台，总览合约、快捷下单、风险仪表、最近订单、终端日志。
- `/markets`：市场全览与标的列表。
- `/orders`：历史订单查询与状态过滤。
- `/strategy`：策略模型、阈值与全局风控配置，支持启动/停止。
- `/settings`：用户资料与安全设置（Trade PIN、MFA、审计日志）。
- `/wallet`：钱包管理（模式相关配置）。
- `/credentials`：API 凭据管理（全局共享，不区分 REAL/PAPER）。

## 6. 模式切换说明（关键）

切换入口只有顶部全局开关。

- 切换到 `PAPER`：用于策略验证，不产生真实资金变动。
- 切换到 `REAL`：需要满足安全与连接条件，交易会涉及真实资产。

切换建议：

1. 先在 `PAPER` 完成回测与小规模验证。
2. 检查风控阈值与 Trade PIN。
3. 确认 REAL 钱包与凭据状态正常。
4. 再切换到 `REAL`。

## 7. 钱包与凭据

### 7.1 钱包管理

`REAL` 模式支持两种绑定方式：

- 插件签名绑定（浏览器插件唤起 + 签名确认）
- 私钥绑定（直接输入私钥进行绑定）

`PAPER` 模式使用模拟钱包配置。

### 7.2 API 凭据

API 凭据为全局配置，不区分 `REAL/PAPER`，字段与 Polymarket 一致：

- `apiKey`
- `secret`
- `passphrase`
- 以及上下文参数：`host` / `chainId` / `signatureType` / `funder` / `walletAddress`

`/credentials` 提供两条标准流程：

1. 导入你在 Polymarket 已创建的 `apiKey/secret/passphrase`（后端加密保存）。
2. 用钱包私钥执行 `createOrDeriveApiKey` 自动派生（后端加密保存）。

## 8. 策略运行与交易闭环

完整交易闭环：

1. 策略读取市场数据并生成信号。
2. 风控引擎校验（最大仓位、限额、滑点等）。
3. 执行层提交订单（REAL/PAPER 分流）。
4. 订单事件推进状态机（accepted/partial/filled/canceled）。
5. 账本按 fill 事件更新仓位、现金、PnL。
6. 前端显示最新状态与审计记录。

## 9. 安全设置

- Trade PIN：关键操作验证（含模式切换）。
- PIN 重置：通过“发送验证码 -> 输入验证码 -> 更新 PIN”链路完成。
- MFA：用于提升安全性；关闭时会提示风险。

## 10. 常见问题排查

### 10.1 页面能打开，但接口数据为空或报错

检查 API 是否可访问：

```bash
curl http://localhost:3001/markets
```

### 10.2 想使用交易所实时合约（Polymarket）

现在可在 `http://localhost:3000/credentials` 页面底部的“交易所实时合约源”模块动态配置：
- `exchangeUrl`（默认 `https://gamma-api.polymarket.com/events`）
- `tagSlug`（默认 `weather`）
- `limit`
- `timeoutMs`

若无法拉取实时合约，请优先排查：

- API 进程是否运行
- 本机网络是否可访问 Polymarket Gamma 接口
- 是否误开启 `POLYMARKET_ALLOW_SEED_FALLBACK=true`（会回退本地 seed）

### 10.3 日志出现 `DATABASE_URL` 缺失

表示未配置 PostgreSQL，系统会以降级模式运行。若要启用数据库，请配置 `DATABASE_URL`。

### 10.4 日志持续出现 Redis warning

表示未连接 Redis，可先忽略；若要消除警告，请启动 Redis 并更新连接配置。

### 10.5 `prisma generate` 报 `EPERM rename`（Windows）

通常是旧 Node 进程占用文件。先结束旧进程后再启动：

```powershell
Get-Process node | Stop-Process -Force
npm run dev
```

## 11. 常用命令

```bash
# 启动前后端
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 全量测试（API + Web + Core）
npm run test

# 生产构建
npm run build
```

## 12. 日志与诊断

推荐关注以下文件：

- `runtime/dev.log`
- `runtime/dev.err.log`

若你需要对外分发给团队，可基于本手册再扩展“运维部署版”与“交易员操作版”两个子文档。
