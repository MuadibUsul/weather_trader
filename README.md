# Weather Trader（中文详细文档）

Weather Trader 是一个面向 Polymarket 天气市场（每日最高温离散温度桶）的自动化量化交易系统工程，包含实盘引擎、后端 API、前端控制台、回测框架、数据库与容器化部署能力。

## 1. 项目目标

系统重点覆盖三类可交易 alpha：

1. 尾盘概率收敛（Tail Convergence）
2. 盘中错价回归（Intraday Mispricing）
3. 微观结构价差收益（Spread/Microstructure）

整体设计目标：

- 可长期运行：模块解耦、可扩展、具备容错
- 可稳定迭代：策略、风控、执行与监控分层
- 可观测：结构化日志、可查询状态、实时指标流
- 可验证：回测与参数扫描可复现核心逻辑

## 2. 工程结构

```text
weather_trader/
├─ backend/                 # FastAPI 后端（鉴权、配置、控制、查询）
│  └─ app/
│     ├─ routers/           # REST 路由
│     ├─ services/          # 引擎服务、流推送、加密辅助
│     ├─ auth.py            # JWT 与密码认证
│     ├─ db.py              # 数据库连接与会话
│     ├─ models.py          # ORM 表结构
│     └─ main.py            # 应用入口
├─ trading_engine/          # 实盘交易引擎
│  ├─ weather_engine.py     # 天气采集与特征构建
│  ├─ market_data_engine.py # 盘口流处理与订单簿维护
│  ├─ probability_engine.py # 温度桶概率建模
│  ├─ signal_engine.py      # 交易信号生成
│  ├─ execution_engine.py   # 限价执行与订单生命周期
│  ├─ risk_manager.py       # 交易前后风控
│  └─ orchestrator.py       # 主循环编排
├─ backtesting/             # 回测与参数扫描
├─ frontend/                # 前端控制台（React + TypeScript）
├─ database/                # SQL 结构、迁移脚本、示例市场
├─ scripts/                 # 启动与健康检查脚本
├─ docker-compose.yml       # 一键部署编排
├─ .env.example             # 环境变量模板
└─ README.md
```

## 3. 实时交易链路

主链路由 `StrategyOrchestrator` 驱动：

1. `WeatherDataEngine` 拉取站点观测 + 小时预报并构造快照
2. `MarketDataEngine` 订阅 WebSocket 并维护本地订单簿
3. `ProbabilityEngine` 计算桶概率分布 `p_model`
4. `SignalEngine` 计算 `edge = p_model - p_market` 并输出信号
5. `RiskManager` 执行交易前硬约束（敞口、库存、熔断）
6. `ExecutionEngine` 限价下单（支持 dry-run、撤单重挂、滑点约束）
7. 同步成交、更新仓位、输出指标到 API 与前端

## 4. 核心模块说明

### 4.1 天气引擎（`trading_engine/weather_engine.py`）

能力：

- 解析 Polymarket resolution URL（提取站点和日期）
- 时区归一化（站点本地日）
- 计算 `t_max_sofar`、`forecast_daily_max`、`forecast_upper_bound`
- 内存缓存 + 指数退避重试

### 4.2 盘口引擎（`trading_engine/market_data_engine.py`）

能力：

- 处理快照与增量消息
- 维护买卖盘前 20 档
- 输出 `mid/spread/depth/slippage` 供信号与执行使用

### 4.3 概率引擎（`trading_engine/probability_engine.py`）

模型要点：

- 动态波动衰减：`sigma(t)=sigma0*exp(-k*time_progress)`
- 桶概率：`CDF(upper)-CDF(lower)`
- 自动归一化确保 `sum(p)=1`
- 通过线程池执行 CPU 模型，避免阻塞事件循环

### 4.4 信号引擎（`trading_engine/signal_engine.py`）

信号条件：

- `edge = p_model - p_market`
- `|edge| > edge_threshold + transaction_cost_buffer`

过滤器：

- 点差过滤
- 深度过滤
- 尾盘窗口分类（`tail_convergence`）

### 4.5 执行引擎（`trading_engine/execution_engine.py`）

执行约束：

- 仅限价单
- 下单前滑点约束
- 支持 dry-run 本地撮合
- 支持 cancel/replace
- 跟踪 `NEW/ACKED/PARTIAL/FILLED/CANCELED/REJECTED`

### 4.6 风控（`trading_engine/risk_manager.py`）

每笔交易前检查：

- 单市场敞口上限
- 全局敞口上限
- 单桶库存限制
- 波动熔断
- 回撤熔断
- 紧急停机

### 4.7 回测（`backtesting/`）

能力：

- 历史天气与盘口对齐重放
- 策略逻辑复现 + 滑点模型成交
- 输出 PnL 路径与指标（Sharpe、回撤、胜率、edge 衰减）
- 参数扫描（sweep）支持

## 5. 后端 API

默认地址：`http://localhost:8000`

### 鉴权

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### 钱包与密钥

- `POST /api/wallet/bind`
- `GET /api/wallet`
- `POST /api/keys`
- `GET /api/keys`

### 策略控制

- `GET /api/strategy/status`
- `POST /api/strategy/config`
- `POST /api/strategy/toggle`

### 交易与指标

- `GET /api/orders`
- `GET /api/orders/trades`
- `GET /api/metrics/pnl`
- `GET /api/metrics/risk`
- `GET /api/logs`

### WebSocket

- `/ws/metrics` 实时指标
- `/ws/logs` 实时日志

## 6. 前端功能

前端技术栈：React + TypeScript + Vite + Recharts + ethers

页面能力：

1. 登录鉴权
2. Polygon 钱包连接
3. API Key 保存
4. 参数调节（order size / quote delta / dry-run）
5. 策略启停
6. 实时 PnL 图
7. 风险仪表盘
8. 持仓与交易日志
9. 告警中心

## 7. 环境变量说明

请先复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

关键变量：

- `DATABASE_URL`：PostgreSQL 连接
- `REDIS_URL`：Redis 连接（可选）
- `POLYMARKET_WS_URL`：盘口 WebSocket 地址
- `POLYMARKET_REST_URL`：下单 REST 地址
- `POLYMARKET_API_KEY/SECRET/PASSPHRASE`：交易凭证
- `WEATHER_API_BASE_URL`：天气 API 基地址
- `DRY_RUN`：是否仅仿真执行
- `JWT_SECRET`：JWT 签名密钥

## 8. 启动方式

### 8.1 Docker（推荐）

```bash
docker compose up --build
```

访问：

- 前端：`http://localhost:5173`
- 后端文档：`http://localhost:8000/docs`

### 8.2 本地开发启动

```bash
python -m pip install -r requirements.txt
cd frontend && npm install && cd ..
uvicorn backend.app.main:app --reload --port 8000
npm --prefix frontend run dev
```

## 9. 回测使用

单次回测：

```bash
python -m backtesting --weather data/weather.csv --market data/market.csv --out out.json
```

参数扫描：

```bash
python -m backtesting --weather data/weather.csv --market data/market.csv --sweep --grid data/grid.json --out sweep.json
```

## 10. 测试

### 10.1 后端 + 交易引擎（pytest）

```bash
python -m pytest -q
```

当前已覆盖：

- 鉴权工具函数（密码哈希与 token）
- 关键 API 路由（health、strategy）
- 概率模型、信号生成、风控校验、dry-run 执行

### 10.2 前端（vitest）

```bash
npm --prefix frontend run test
```

当前已覆盖：

- API 封装（login 与 ws 地址）
- 关键交互组件（StrategyControls、RiskGauge）

## 11. 数据库

- 建表脚本：`database/schema.sql`
- 初始化迁移：`database/migrations/001_init.sql`
- 示例市场配置：`database/sample_markets.json`

核心数据表：

- `orders`, `trades`, `performance_history`, `risk_events`
- `market_metadata`, `weather_cache`, `strategy_configs`
- `users`, `wallet_bindings`, `api_keys`

## 12. 安全与生产建议

1. 实盘前长期 dry-run 验证
2. 限制账户总资金与单市场暴露
3. base64 示例加密应替换为 KMS/HSM
4. 统一日志接入 ELK/OpenSearch/Datadog
5. 配置 CI：测试、静态检查、镜像扫描、发布门禁

## 13. 风险声明

- 本项目仅为系统工程实现示例，不构成投资建议。
- 自动化交易存在真实资金风险，请先小规模、低风险参数运行。

## 14. 默认账号（开发环境）

- 用户名：`admin`
- 密码：`admin123`

建议首次登录后立即修改。
