# Copilot 代码模板库 - Weather Trader 改进方案

> 本文档包含各改进阶段的代码框架模板，Copilot 可直接参考或生成类似结构。

---

## P1.1 Event Log 系统 - 代码模板

### 1. EventLog 数据表定义（models.py 片段）

```python
from sqlalchemy import Column, String, JSON, DateTime, Index
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, UTC
import uuid

class EventLog(Base):
    """交易决策事件日志 - 完整审计链"""
    __tablename__ = "event_logs"
    
    # 主键 & 关联
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    market_id = Column(String, nullable=False, index=True)
    
    # 事件核心
    correlation_id = Column(String(36), index=True)  # 链接同一循环的所有事件
    event_type = Column(String, index=True)  # "signal_generated" / "risk_check" / "order_executed" 等
    event_data = Column(JSON)  # 事件详细数据 (signal data / risk decision / fill info)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)
    
    # 索引加速查询
    __table_args__ = (
        Index('idx_user_market_time', 'user_id', 'market_id', 'created_at'),
        Index('idx_correlation', 'correlation_id'),
    )

# 触发 event log 的关键函数
async def log_event(session: AsyncSession, 
                   user_id: str,
                   event_type: str,
                   event_data: dict,
                   correlation_id: str,
                   market_id: str = None) -> EventLog:
    """
    记录一个交易事件到数据库
    
    参数：
    - event_type: "signal_generated", "risk_check_passed", "risk_check_failed", 
                  "order_submitted", "order_filled", "order_rejected", 
                  "weather_updated", "position_updated"
    - event_data: 包含该事件的关键信息的字典
    - correlation_id: 同一次策略循环的唯一 ID
    """
    log = EventLog(
        user_id=user_id,
        event_type=event_type,
        event_data=event_data,
        correlation_id=correlation_id,
        market_id=market_id or event_data.get('market_id')
    )
    session.add(log)
    await session.commit()
    return log
```

### 2. Orchestrator 中的 Event Logging 集成

```python
# trading_engine/orchestrator.py

import uuid
from datetime import datetime, UTC

class StrategyOrchestrator:
    def __init__(self, ...):
        ...
        self.db_session = None  # 待注入
    
    async def _main_loop(self):
        """修改主循环以嵌入事件日志"""
        while True:
            # 生成本次循环的 correlation_id
            correlation_id = str(uuid.uuid4())
            set_correlation_id(correlation_id)
            
            # 天气更新
            weather_updates = await self._refresh_weather_all()
            
            for market_id, weather in weather_updates.items():
                await log_event(
                    self.db_session,
                    user_id=self.current_user_id,
                    event_type="weather_updated",
                    event_data={
                        "market_id": market_id,
                        "t_max_sofar": weather.t_max_sofar,
                        "forecast_daily_max": weather.forecast_daily_max,
                        "hours_remaining": weather.hours_remaining,
                    },
                    correlation_id=correlation_id,
                    market_id=market_id
                )
            
            # 信号生成
            for signal in signals:
                await log_event(
                    self.db_session,
                    user_id=self.current_user_id,
                    event_type="signal_generated",
                    event_data={
                        "market_id": signal.market_id,
                        "bucket_id": signal.bucket_id,
                        "side": signal.side.value,
                        "edge": signal.edge,
                        "p_model": signal.model_probability,
                        "p_market": signal.market_probability,
                        "confidence": signal.confidence,
                        "reason": signal.reason,
                    },
                    correlation_id=correlation_id,
                    market_id=signal.market_id
                )
                
                # 风控检查
                risk_decision = await self.risk.pre_trade_check(intent, self.state)
                
                if risk_decision.allowed:
                    await log_event(
                        self.db_session,
                        user_id=self.current_user_id,
                        event_type="risk_check_passed",
                        event_data={
                            "market_id": intent.market_id,
                            "bucket_id": intent.bucket_id,
                            "checks": {
                                "exposure": "OK",
                                "inventory": "OK",
                                "volatility": "OK",
                            }
                        },
                        correlation_id=correlation_id,
                        market_id=intent.market_id
                    )
                else:
                    await log_event(
                        self.db_session,
                        user_id=self.current_user_id,
                        event_type="risk_check_failed",
                        event_data={
                            "market_id": intent.market_id,
                            "bucket_id": intent.bucket_id,
                            "reason": risk_decision.reason,
                        },
                        correlation_id=correlation_id,
                        market_id=intent.market_id
                    )
                    continue
                
                # 订单执行
                order = await self.execution.submit_intent(intent, max_slippage=0.05)
                
                if order:
                    await log_event(
                        self.db_session,
                        user_id=self.current_user_id,
                        event_type="order_submitted",
                        event_data={
                            "order_id": order.id,
                            "market_id": order.market_id,
                            "side": order.side.value,
                            "size": order.size,
                            "price": order.price,
                        },
                        correlation_id=correlation_id,
                        market_id=order.market_id
                    )
```

### 3. 查询 API 端点（routers/logs.py）

```python
from fastapi import APIRouter, Query, Depends
from sqlalchemy import select

router = APIRouter(prefix="/api/logs", tags=["logs"])

@router.get("/events")
async def list_events(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    event_type: str = Query(None),
    market_id: str = Query(None),
    days: int = Query(7, ge=1, le=90),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
) -> dict:
    """查询用户的事件日志"""
    stmt = select(EventLog).where(EventLog.user_id == user.id)
    
    if event_type:
        stmt = stmt.where(EventLog.event_type == event_type)
    if market_id:
        stmt = stmt.where(EventLog.market_id == market_id)
    
    # 时间范围
    cutoff = datetime.now(UTC) - timedelta(days=days)
    stmt = stmt.where(EventLog.created_at >= cutoff)
    
    # 分页
    stmt = stmt.order_by(EventLog.created_at.desc()).limit(limit).offset(offset)
    
    result = await session.execute(stmt)
    events = result.scalars().all()
    
    return {
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "data": e.event_data,
                "market_id": e.market_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
        "count": len(events)
    }

@router.get("/events/{event_id}")
async def get_event_detail(event_id: str, session: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """获取单个事件的完整详情"""
    stmt = select(EventLog).where(
        (EventLog.id == event_id) & 
        (EventLog.user_id == user.id)
    )
    event = (await session.execute(stmt)).scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {
        "id": event.id,
        "event_type": event.event_type,
        "correlation_id": event.correlation_id,
        "data": event.event_data,
        "market_id": event.market_id,
        "created_at": event.created_at.isoformat(),
    }

@router.get("/trace/{correlation_id}")
async def trace_trading_decision(
    correlation_id: str, 
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
) -> dict:
    """追溯一笔交易的完整决策链"""
    stmt = select(EventLog).where(
        (EventLog.correlation_id == correlation_id) &
        (EventLog.user_id == user.id)
    ).order_by(EventLog.created_at.asc())
    
    result = await session.execute(stmt)
    events = result.scalars().all()
    
    if not events:
        raise HTTPException(status_code=404, detail="Trace not found")
    
    return {
        "correlation_id": correlation_id,
        "timeline": [
            {
                "event_type": e.event_type,
                "timestamp": e.created_at.isoformat(),
                "data": e.event_data,
            }
            for e in events
        ]
    }
```

---

## P1.2 WebSocket 断点续历 - 代码模板

### 1. MarketDataEngine 增强版（关键部分）

```python
# trading_engine/market_data_engine.py

from collections import deque
import hashlib

class MarketDataEngine:
    def __init__(self, settings: EngineSettings):
        self.settings = settings
        self.last_seq_id = 0
        self.last_snapshot_time = None
        self.seen_message_hashes = deque(maxlen=1000)  # 去重窗口
    
    async def on_orderbook_update(self, msg: dict):
        """处理 WebSocket orderbook 更新，带去重"""
        # 序列号检查
        seq_id = msg.get('sequence_id', None)
        if seq_id and seq_id <= self.last_seq_id:
            logger.debug(f"Dropping duplicate/old message seq={seq_id} <= last_seq={self.last_seq_id}")
            return
        
        # 哈希去重（备选方案）
        msg_hash = hashlib.md5(
            f"{seq_id}:{msg.get('timestamp')}:{msg.get('bucket_id')}".encode()
        ).hexdigest()
        
        if msg_hash in self.seen_message_hashes:
            logger.debug(f"Duplicate message hash detected, skipping")
            return
        
        self.seen_message_hashes.append(msg_hash)
        
        # 处理消息
        self.last_seq_id = seq_id or self.last_seq_id + 1
        await self._process_orderbook_update(msg)
    
    async def on_websocket_disconnect(self):
        """WebSocket 断线处理"""
        logger.warning(f"WebSocket disconnected. Last seq_id: {self.last_seq_id}")
        
        # 保存快照到内存
        snapshot = {
            "last_seq_id": self.last_seq_id,
            "orderbooks": {
                bucket_id: {
                    "bids": list(ob.bids),
                    "asks": list(ob.asks),
                }
                for bucket_id, ob in self.orderbooks.items()
            },
            "disconnect_time": datetime.now(UTC).isoformat()
        }
        
        # TODO: 可选地持久化到 Redis 或数据库
        return snapshot
    
    async def reconnect_and_resync(self, snapshot: dict = None):
        """重连并重新同步盘口"""
        logger.info("Attempting to resync orderbook...")
        
        try:
            # 从 REST API 获取完整快照
            full_snapshot = await self._fetch_full_orderbook_snapshot()
            
            # 恢复本地盘口
            for bucket_id, ob_data in full_snapshot.items():
                self.orderbooks[bucket_id] = OrderBook.from_dict(ob_data)
            
            # 更新序列号
            self.last_seq_id = full_snapshot.get('_sequence_id', 0)
            
            logger.info(f"Resync complete. Latest seq_id: {self.last_seq_id}")
            
            # 重新连接 WebSocket
            await self._reconnect_ws()
            
            return True
        
        except Exception as e:
            logger.error(f"Resync failed: {e}", exc_info=True)
            return False
    
    async def _fetch_full_orderbook_snapshot(self) -> dict:
        """从 Polymarket REST API 获取完整快照"""
        # 调用 Polymarket GET /orderbook/{market_id} 
        # 返回格式应包含 sequence_id 和完整订单簿
        pass
```

### 2. 定期 Reconciliation（在 Orchestrator 中）

```python
# trading_engine/orchestrator.py

class StrategyOrchestrator:
    def __init__(self, ...):
        ...
        self._last_reconcile_time = None
    
    async def _main_loop(self):
        while True:
            ...
            
            # 每 10 秒执行一次 reconcile
            now = datetime.now(UTC)
            if self._last_reconcile_time is None or \
               (now - self._last_reconcile_time).total_seconds() > 10:
                
                reconcile_ok = await self._reconcile_positions()
                if not reconcile_ok:
                    logger.critical("Position reconciliation failed, triggering emergency stop")
                    await self.risk.emergency_stop("position_mismatch")
                
                self._last_reconcile_time = now
            
            await asyncio.sleep(0.1)
    
    async def _reconcile_positions(self) -> bool:
        """
        对账：DB 持仓 == 本地持仓
        
        返回 True 如果对账成功，False 如果检测到不一致
        """
        # 从数据库加载持仓
        db_positions = await self._fetch_db_positions()
        
        # 本地持仓
        local_positions = self.state.positions
        
        # 逐个对比
        for (market_id, bucket_id), pos in local_positions.items():
            db_pos = db_positions.get((market_id, bucket_id))
            if not db_pos or db_pos.quantity != pos.quantity:
                logger.error(
                    f"Position mismatch for {market_id}:{bucket_id}. "
                    f"DB: {db_pos.quantity if db_pos else 'missing'}, "
                    f"Local: {pos.quantity}"
                )
                return False
        
        return True
```

---

## P1.3 市场心理项概率模型 - 代码模板

### 1. 改进的 ProbabilityEngine

```python
# trading_engine/probability_engine.py

import math
from typing import Dict, Optional, Deque
from collections import deque
from dataclasses import dataclass

@dataclass
class MarketActivity:
    """市场活跃度评分"""
    depth_score: float  # 深度评分 [0, 1]
    volume_score: float  # 成交量评分 [0, 1]
    spread_tightness: float  # 点差紧度评分 [0, 1]
    composite: float  # 综合评分 [0, 1]

class ProbabilityEngine:
    def __init__(self, settings: EngineSettings) -> None:
        self.settings = settings
        self._executor = ThreadPoolExecutor(max_workers=4)
        
        # 市场心理参数
        self.market_activity_cache: Dict[str, (MarketActivity, float)] = {}
        self.market_activity_ttl = 5.0  # 5 秒缓存
    
    async def compute_distribution(self, 
                                   weather: WeatherSnapshot, 
                                   buckets: Iterable[BucketRange],
                                   quotes: List[MarketBucketQuote] = None) -> Dict[str, float]:
        """
        改进版：支持市场心理融合
        
        quotes: market quotes，用于计算 market_mu 和活跃度
        """
        loop = asyncio.get_running_loop()
        bucket_list = list(buckets)
        
        # 计算市场心理项（可选）
        market_mu = None
        market_activity = None
        
        if quotes:
            market_mu = self._compute_market_mu(quotes)
            market_activity = await self._compute_market_activity(quotes)
        
        return await loop.run_in_executor(
            self._executor,
            self._compute_distribution_sync,
            weather,
            bucket_list,
            market_mu,
            market_activity
        )
    
    def _compute_market_mu(self, quotes: List[MarketBucketQuote]) -> Optional[float]:
        """从 market quotes 推导隐含期望温度"""
        if not quotes:
            return None
        
        total_prob = 0.0
        weighted_temp = 0.0
        
        for quote in quotes:
            prob = quote.implied_probability
            # 用桶的中垂线温度加权
            mid_temp = (quote.bucket.lower + quote.bucket.upper) / 2.0
            
            weighted_temp += mid_temp * prob
            total_prob += prob
        
        if total_prob < 1e-9:
            return None
        
        return weighted_temp / total_prob
    
    async def _compute_market_activity(self, quotes: List[MarketBucketQuote]) -> MarketActivity:
        """计算市场活跃度"""
        # 这是异步的，但可能很快，所以在线程池中运行
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self._executor,
            self._compute_market_activity_sync,
            quotes
        )
    
    def _compute_market_activity_sync(self, quotes: List[MarketBucketQuote]) -> MarketActivity:
        """同步计算市场活跃度"""
        if not quotes:
            return MarketActivity(0.0, 0.0, 0.0, 0.0)
        
        # 深度评分
        avg_depth = sum(q.orderbook.depth_within(0.01) for q in quotes) / len(quotes)
        depth_score = min(1.0, avg_depth / 1000.0)  # 1000 为参考深度
        
        # 成交量评分（需要从 quotes 中获取最近交易量）
        volume_score = 0.5  # 简化，实际需要从市场数据获取
        
        # 点差紧度评分
        avg_spread = sum(q.orderbook.spread() for q in quotes) / len(quotes)
        spread_tightness = 1.0 - min(1.0, avg_spread / 0.1)  # 0.1 为参考点差
        
        # 综合评分（加权平均）
        composite = 0.3 * depth_score + 0.3 * volume_score + 0.4 * spread_tightness
        
        return MarketActivity(
            depth_score=depth_score,
            volume_score=volume_score,
            spread_tightness=spread_tightness,
            composite=composite
        )
    
    def _compute_distribution_sync(self,
                                   weather: WeatherSnapshot,
                                   buckets: List[BucketRange],
                                   market_mu: Optional[float] = None,
                                   market_activity: Optional[MarketActivity] = None) -> Dict[str, float]:
        """改进的同步模型计算（融合市场心理）"""
        
        hours = max(0.0, min(24.0, weather.hours_remaining))
        
        # 动态 sigma 衰减
        sigma = max(0.35, self.settings.model_sigma0 * math.exp(
            -self.settings.model_decay_k * (24 - hours)
        ))
        
        # 观测权重（临近结算时权重增加）
        obs_weight = 1.0 - (hours / 24.0)
        
        # 基础气象期望
        weather_mu = obs_weight * weather.t_max_sofar + \
                     (1 - obs_weight) * weather.forecast_daily_max
        
        # 融合市场心理
        if market_mu is not None and market_activity is not None:
            # 动态融合权重：市场活跃度高 → 市场信息权重增加
            activity_factor = market_activity.composite  # [0, 1]
            alpha = 0.3 + 0.4 * activity_factor  # alpha ∈ [0.3, 0.7]
            
            # 如果模型不自信（sigma 大），降低市场权重
            if sigma > 4.0:
                alpha *= 0.8
            
            # 融合期望
            mu = alpha * market_mu + (1 - alpha) * weather_mu
        else:
            mu = weather_mu
        
        # 概率计算（同原逻辑）
        probs: Dict[str, float] = {}
        for bucket in buckets:
            upper_prob = self._normal_cdf((bucket.upper - mu) / sigma)
            lower_prob = self._normal_cdf((bucket.lower - mu) / sigma)
            p = max(0.0, upper_prob - lower_prob)
            probs[bucket.bucket_id] = p
        
        # 归一化
        total = sum(probs.values())
        if total <= 1e-12:
            uniform = 1.0 / max(1, len(buckets))
            return {b.bucket_id: uniform for b in buckets}
        
        return {k: v / total for k, v in probs.items()}
    
    def _normal_cdf(self, z: float) -> float:
        """标准正态分布 CDF"""
        return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
```

---

## P1.4 Edge 信号粘性过滤 - 代码模板

```python
# trading_engine/signal_engine.py

from dataclasses import dataclass, field
from datetime import datetime, UTC, timedelta
from typing import Dict, Tuple

@dataclass
class SignalState:
    """追踪信号状态，实现粘性过滤"""
    active_signals: Dict[Tuple[str, str], 'Signal'] = field(default_factory=dict)
    last_signal_time: Dict[Tuple[str, str], (str, datetime)] = field(default_factory=dict)
    edge_ema: Dict[Tuple[str, str], float] = field(default_factory=dict)
    
    hysteresis_margin: float = 0.005  # 0.5% 滞后
    min_signal_interval: float = 60.0  # 秒
    min_flip_interval: float = 30.0  # 反向信号最小间隔
    ema_alpha: float = 0.3  # EMA 平滑系数

class SignalEngine:
    """改进版信号引擎，带粘性过滤"""
    
    def __init__(self, settings: EngineSettings) -> None:
        self.settings = settings
        self.signal_state = SignalState()
    
    def generate_signals(self,
                        weather: WeatherSnapshot,
                        model_probs: Dict[str, float],
                        quotes: List[MarketBucketQuote],
                        state: 'StrategyState' = None) -> List['Signal']:
        """
        生成信号，带粘性过滤和平滑
        """
        candidate_signals: List['Signal'] = []
        base_threshold = self.settings.edge_threshold + self.settings.transaction_cost_buffer
        tail_window_hours = self.settings.tail_minutes / 60.0
        
        for quote in quotes:
            # 流动性过滤
            ob = quote.orderbook
            spread = ob.spread()
            depth = ob.depth_within(spread_width=0.08)
            
            if spread > self.settings.max_spread:
                continue
            if depth < self.settings.min_liquidity_depth:
                continue
            
            bucket_id = quote.bucket.bucket_id
            p_model = model_probs.get(bucket_id, 0.0)
            p_market = quote.implied_probability
            raw_edge = p_model - p_market
            
            # Edge 平滑（EMA）
            key = (quote.market_id, bucket_id)
            smoothed_edge = self._smooth_edge(key, raw_edge)
            
            # 粘性过滤：判断是否应该生成/取消信号
            signal_action = self._apply_hysteresis(key, smoothed_edge, base_threshold)
            
            if signal_action is None:
                # 信号取消或无效
                if key in self.signal_state.active_signals:
                    del self.signal_state.active_signals[key]
                continue
            
            side, confidence = signal_action
            
            # 最小信号间隔检查
            if not self._check_signal_interval(key, side):
                continue
            
            # 生成候选信号
            candidate_signals.append(
                Signal(
                    market_id=quote.market_id,
                    bucket_id=bucket_id,
                    side=side,
                    edge=smoothed_edge,
                    model_probability=p_model,
                    market_probability=p_market,
                    target_price=max(0.01, min(0.99, p_model - (0.02 if side == Side.BUY else -0.02))),
                    confidence=confidence,
                    reason="tail_convergence" if weather.hours_remaining <= tail_window_hours else "intraday_mispricing",
                )
            )
        
        # 按性价比排序（可选：取 top N）
        candidate_signals = self._rank_by_sharpe(candidate_signals)
        
        return candidate_signals[:10]  # 限制同时执行的信号数
    
    def _smooth_edge(self, key: Tuple[str, str], raw_edge: float) -> float:
        """EMA 平滑 edge"""
        if key not in self.signal_state.edge_ema:
            self.signal_state.edge_ema[key] = raw_edge
        else:
            alpha = self.signal_state.ema_alpha
            self.signal_state.edge_ema[key] = \
                alpha * raw_edge + (1 - alpha) * self.signal_state.edge_ema[key]
        
        return self.signal_state.edge_ema[key]
    
    def _apply_hysteresis(self, key: Tuple[str, str], edge: float, 
                         threshold: float) -> Optional[Tuple['Side', float]]:
        """
        粘性过滤：确定是否生成信号的决策
        返回 (side, confidence) 或 None
        """
        has_active = key in self.signal_state.active_signals
        
        if has_active:
            # 已有信号，用更高的取消阈值
            cancel_threshold = threshold - self.signal_state.hysteresis_margin
            
            if abs(edge) < cancel_threshold:
                # 信号取消
                return None
            else:
                # 信号保持
                old_signal = self.signal_state.active_signals[key]
                return old_signal.side, min(1.0, abs(edge) / (threshold * 2.0))
        else:
            # 无信号，用基准阈值判断是否新建
            if abs(edge) >= threshold:
                side = Side.BUY if edge > 0 else Side.SELL
                confidence = min(1.0, abs(edge) / (threshold * 2.0))
                return side, confidence
            else:
                return None
    
    def _check_signal_interval(self, key: Tuple[str, str], new_side: 'Side') -> bool:
        """检查是否满足最小信号间隔！"""
        now = datetime.now(UTC)
        
        if key not in self.signal_state.last_signal_time:
            self.signal_state.last_signal_time[key] = (str(new_side), now)
            return True
        
        last_side_str, last_time = self.signal_state.last_signal_time[key]
        last_side = Side[last_side_str]
        elapsed = (now - last_time).total_seconds()
        
        if new_side != last_side:
            # 反向信号，需等待 min_flip_interval
            if elapsed > self.signal_state.min_flip_interval:
                self.signal_state.last_signal_time[key] = (str(new_side), now)
                return True
        else:
            # 同向，需等待 min_signal_interval
            if elapsed > self.signal_state.min_signal_interval:
                self.signal_state.last_signal_time[key] = (str(new_side), now)
                return True
        
        return False
    
    def _rank_by_sharpe(self, signals: List['Signal']) -> List['Signal']:
        """按性价比排序（edge / spread 比）"""
        def sharpe_score(sig: 'Signal') -> float:
            spread = sig.market_probability * 0.02  # 估算点差
            return abs(sig.edge) / max(spread, 0.001)
        
        return sorted(signals, key=sharpe_score, reverse=True)
```

---

## 快速参考：模板使用清单

| 模块 | 代码位置 | 关键类 | 集成点 |
|------|---------|--------|--------|
| Event Log | `backend/app/models.py` | `EventLog` | Orchestrator._main_loop |
| WebSocket 恢复 | `trading_engine/market_data_engine.py` | MarketDataEngine | 连接/重连处理 |
| 概率融合 | `trading_engine/probability_engine.py` | ProbabilityEngine | compute_distribution |
| 信号粘性 | `trading_engine/signal_engine.py` | SignalState, SignalEngine | generate_signals |

---

祝编码顺利！这些模板应能减少 Copilot 的理解成本。🚀
