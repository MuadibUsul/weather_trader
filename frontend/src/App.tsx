/**
 * 前端主页面（控制台）。
 *
 * 页面职责：
 * 1. 管理登录态与策略状态。
 * 2. 连接 metrics/logs WebSocket 并驱动实时 UI。
 * 3. 组装钱包绑定、密钥管理、策略控制、PnL、风险、日志等模块。
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { bindWallet, getStatus, getTrades, login, logsWsUrl, metricsWsUrl, saveApiKeys, toggleStrategy, updateConfig } from './api'
import ActiveMarketsPanel from './components/ActiveMarketsPanel'
import AlertCenter from './components/AlertCenter'
import ApiKeyForm from './components/ApiKeyForm'
import ExposureChart from './components/ExposureChart'
import LoginForm from './components/LoginForm'
import LogViewer from './components/LogViewer'
import PnlChart from './components/PnlChart'
import RiskGauge from './components/RiskGauge'
import StrategyControls from './components/StrategyControls'
import WalletConnect from './components/WalletConnect'
import type { LogEvent, MetricTick, StrategyStatus } from './types'

const defaultStatus: StrategyStatus = {
  running: false,
  started_at: null,
  market_count: 0,
  open_orders: 0,
  positions: [],
  metrics: {},
  risk: { total_exposure: 0, max_drawdown: 0, halted: false, halt_reason: '' },
  fill_count: 0,
  config: { order_size: 25, quote_delta: 0.01, dry_run: true },
}

export default function App() {
  const [token, setToken] = useState<string>(localStorage.getItem('token') || '')
  const [status, setStatus] = useState<StrategyStatus>(defaultStatus)
  const [pnlSeries, setPnlSeries] = useState<Array<{ ts: string; pnl: number }>>([])
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [alerts, setAlerts] = useState<string[]>([])
  const metricsWs = useRef<WebSocket | null>(null)
  const logsWs = useRef<WebSocket | null>(null)

  const handleLogin = async (username: string, password: string) => {
    const t = await login(username, password)
    localStorage.setItem('token', t)
    setToken(t)
  }

  const loadStatus = async () => {
    if (!token) return
    const s = await getStatus(token)
    setStatus(s)
  }

  useEffect(() => {
    if (!token) return
    loadStatus().catch((e) => setAlerts((a) => [String(e), ...a].slice(0, 10)))
  }, [token])

  useEffect(() => {
    if (!token) return

    const mws = new WebSocket(metricsWsUrl())
    const lws = new WebSocket(logsWsUrl())
    metricsWs.current = mws
    logsWs.current = lws

    const ping = setInterval(() => {
      if (mws.readyState === WebSocket.OPEN) mws.send('ping')
      if (lws.readyState === WebSocket.OPEN) lws.send('ping')
    }, 5000)

    mws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as MetricTick
      if (msg.type !== 'metrics') return
      setStatus((prev) => ({
        ...prev,
        running: msg.running,
        metrics: msg.metrics,
        risk: msg.risk,
        positions: msg.positions,
      }))
      const pnl = Number(msg.metrics.realized_pnl || 0) + Number(msg.metrics.unrealized_pnl || 0)
      setPnlSeries((series) => [...series.slice(-120), { ts: new Date(msg.ts).toLocaleTimeString(), pnl }])
      if (msg.risk.halted) {
        // 风控熔断类事件在告警中心置顶展示。
        setAlerts((a) => [`Trading halted: ${msg.risk.halt_reason || 'risk guard'}`, ...a].slice(0, 10))
      }
    }

    lws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as LogEvent
      setLogs((arr) => [...arr.slice(-199), msg])
      if (msg.level === 'ERROR') {
        setAlerts((a) => [`Error: ${msg.message}`, ...a].slice(0, 10))
      }
    }

    mws.onerror = () => setAlerts((a) => ['Metrics websocket disconnected', ...a].slice(0, 10))
    lws.onerror = () => setAlerts((a) => ['Logs websocket disconnected', ...a].slice(0, 10))

    return () => {
      clearInterval(ping)
      mws.close()
      lws.close()
    }
  }, [token])

  const totals = useMemo(() => {
    const exposure = status.positions.reduce((acc, p) => acc + p.quantity * p.avg_price, 0)
    return { exposure }
  }, [status.positions])

  if (!token) {
    return (
      <main className="login-shell">
        <LoginForm onLogin={handleLogin} />
      </main>
    )
  }

  return (
    <main className="dashboard">
      <header className="hero">
        <div>
          <h1>Weather Market Operator Console</h1>
          <p>Alpha extraction engine for Polymarket temperature buckets</p>
        </div>
      </header>

      <section className="grid top-grid">
        <WalletConnect onBound={(wallet) => bindWallet(token, wallet)} />
        <ApiKeyForm onSave={(k, s, p) => saveApiKeys(token, k, s, p)} />
        <StrategyControls
          running={status.running}
          orderSize={status.config.order_size}
          quoteDelta={status.config.quote_delta}
          dryRun={status.config.dry_run}
          onChange={(size, delta, dry) => updateConfig(token, size, delta, dry).then(setStatus)}
          onToggle={(enabled) => toggleStrategy(token, enabled).then(setStatus)}
        />
      </section>

      <section className="grid mid-grid">
        <PnlChart data={pnlSeries} />
        <ExposureChart positions={status.positions} />
      </section>

      <section className="grid bottom-grid">
        <ActiveMarketsPanel positions={status.positions} />
        <RiskGauge
          totalExposure={status.risk.total_exposure || totals.exposure}
          maxDrawdown={status.risk.max_drawdown}
          halted={status.risk.halted}
          haltReason={status.risk.halt_reason}
        />
        <AlertCenter alerts={alerts} />
      </section>

      <section className="grid logs-grid">
        <LogViewer logs={logs} />
      </section>
    </main>
  )
}
