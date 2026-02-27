/**
 * 前端主页面（控制台）。
 *
 * 页面职责：
 * 1. 管理登录态与策略状态。
 * 2. 连接 metrics/logs WebSocket 并驱动实时 UI。
 * 3. 组装钱包绑定、密钥管理、策略控制、PnL、风险、日志等模块。
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  activateLiveWallet,
  activatePaperWallet,
  bindWallet,
  bindWalletPrivateKey,
  confirmTradePinReset,
  createWalletBindChallenge,
  createPaperWallet,
  deleteApiKeys,
  deleteLiveWallet,
  deletePaperWallet,
  disconnectWallet,
  getSecurityProfile,
  getStatus,
  getWallet,
  listApiKeys,
  listLiveWallets,
  listPaperWallets,
  login,
  logsWsUrl,
  metricsWsUrl,
  requestEmailBind,
  requestTradePinReset,
  saveApiKeys,
  setTradePin,
  switchEnvironmentWithPin,
  testApiKeys,
  toggleStrategy,
  updateConfig,
  verifyEmailBind,
} from './api'
import ActiveMarketsPanel from './components/ActiveMarketsPanel'
import AlertCenter from './components/AlertCenter'
import AppHeader from './components/AppHeader'
import ApiKeyForm from './components/ApiKeyForm'
import ExposureChart from './components/ExposureChart'
import LoginForm from './components/LoginForm'
import LogViewer from './components/LogViewer'
import PnlChart from './components/PnlChart'
import RiskGauge from './components/RiskGauge'
import SetTradePinForm from './components/SetTradePinForm'
import StrategyControls from './components/StrategyControls'
import TradePinModal from './components/TradePinModal'
import ToastStack, { type ToastItem } from './components/ToastStack'
import WalletConnect from './components/WalletConnect'
import { localizeErrorMessage, useI18n } from './i18n'
import type { LogEvent, MetricTick, StrategyStatus } from './types'

type ViewMode = 'dashboard' | 'wallets'
type PendingPinAction = { kind: 'switch_env'; mode: 'live' | 'paper' }

function viewFromHash(hash: string): ViewMode {
  return hash === '#/wallets' ? 'wallets' : 'dashboard'
}

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
  const { locale, setLocale, t, localeTag } = useI18n()
  const [token, setToken] = useState<string>(localStorage.getItem('token') || '')
  const [view, setView] = useState<ViewMode>(() => viewFromHash(window.location.hash))
  const [sessionNotice, setSessionNotice] = useState('')
  const [status, setStatus] = useState<StrategyStatus>(defaultStatus)
  const [environmentMode, setEnvironmentMode] = useState<'live' | 'paper'>('paper')
  const [securityProfile, setSecurityProfile] = useState({
    email: '',
    email_verified: false,
    trade_pin_set: false,
    trade_pin_locked_until: null as string | null,
    current_env: 'PAPER' as 'REAL' | 'PAPER',
  })
  const [pnlSeries, setPnlSeries] = useState<Array<{ ts: string; pnl: number }>>([])
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [alerts, setAlerts] = useState<string[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pinModalAction, setPinModalAction] = useState<PendingPinAction | null>(null)
  const [pinModalBusy, setPinModalBusy] = useState(false)
  const [pinModalError, setPinModalError] = useState('')
  const metricsWs = useRef<WebSocket | null>(null)
  const logsWs = useRef<WebSocket | null>(null)
  const toastSeq = useRef(1)

  const notify = (kind: 'success' | 'error' | 'info', message: string) => {
    const id = toastSeq.current++
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, 3500)
  }

  const handleLogin = async (username: string, password: string) => {
    const accessToken = await login(username, password)
    localStorage.setItem('token', accessToken)
    setSessionNotice('')
    setToken(accessToken)
  }

  const forceRelogin = () => {
    localStorage.removeItem('token')
    setSessionNotice(t('error.unauthorized'))
    setToken('')
    notify('error', t('error.unauthorized'))
  }

  const handleApiError = (err: unknown, pushAlert = true) => {
    const raw = String(err)
    if (raw.includes('Unauthorized')) {
      forceRelogin()
      return
    }
    if (pushAlert) {
      const msg = localizeErrorMessage(raw, t)
      setAlerts((a) => [msg, ...a].slice(0, 10))
      notify('error', msg)
    }
  }

  const loadStatus = async () => {
    if (!token) return
    const s = await getStatus(token)
    setStatus(s)
  }

  const loadSecurity = async () => {
    if (!token) return
    const profile = await getSecurityProfile(token)
    setSecurityProfile(profile)
    setEnvironmentMode(profile.current_env === 'REAL' ? 'live' : 'paper')
  }

  useEffect(() => {
    if (!token) return
    Promise.all([loadStatus(), loadSecurity()]).catch((e) => handleApiError(e, false))
  }, [token, t])

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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
      setPnlSeries((series) => [...series.slice(-120), { ts: new Date(msg.ts).toLocaleTimeString(localeTag), pnl }])
      if (msg.risk.halted) {
        // Put risk-halt events at the top of alert center.
        setAlerts((a) =>
          [t('app.alert.trading_halted', { reason: msg.risk.halt_reason || t('risk.guard_triggered') }), ...a].slice(0, 10),
        )
      }
    }

    lws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as LogEvent
      setLogs((arr) => [...arr.slice(-199), msg])
      if (msg.level === 'ERROR') {
        setAlerts((a) => [t('app.alert.error', { message: msg.message }), ...a].slice(0, 10))
      }
    }

    mws.onerror = () => setAlerts((a) => [t('app.alert.metrics_disconnected'), ...a].slice(0, 10))
    lws.onerror = () => setAlerts((a) => [t('app.alert.logs_disconnected'), ...a].slice(0, 10))

    return () => {
      clearInterval(ping)
      mws.close()
      lws.close()
    }
  }, [localeTag, t, token])

  const totals = useMemo(() => {
    const exposure = status.positions.reduce((acc, p) => acc + p.quantity * p.avg_price, 0)
    return { exposure }
  }, [status.positions])

  const navigate = (next: ViewMode) => {
    const nextHash = next === 'wallets' ? '#/wallets' : '#/dashboard'
    if (window.location.hash !== nextHash) window.location.hash = nextHash
    setView(next)
  }

  const requestSwitchEnvironment = (mode: 'live' | 'paper') => {
    if (mode === environmentMode) return
    if (!securityProfile.trade_pin_set) {
      notify('error', t('error.trade_pin_not_set'))
      return
    }
    setPinModalError('')
    setPinModalAction({ kind: 'switch_env', mode })
  }

  const confirmPinModal = async (pin: string) => {
    if (!pinModalAction) return
    setPinModalError('')
    setPinModalBusy(true)
    try {
      const nextStatus = await switchEnvironmentWithPin(token, pinModalAction.mode, pin)
      setStatus(nextStatus)
      setEnvironmentMode(pinModalAction.mode)
      notify('success', pinModalAction.mode === 'live' ? t('toast.env_switched_live') : t('toast.env_switched_paper'))
      await loadSecurity()
      setPinModalAction(null)
    } catch (err) {
      const msg = localizeErrorMessage(String(err), t)
      setPinModalError(msg)
    } finally {
      setPinModalBusy(false)
    }
  }

  if (!token) {
    return (
      <main className="login-shell">
        <header className="app-header">
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.subtitle')}</p>
          </div>
          <div className="lang-switch">
            <select aria-label={t('lang.switch_label')} value={locale} onChange={(e) => setLocale(e.target.value as 'zh' | 'en')}>
              <option value="zh">{t('lang.zh')}</option>
              <option value="en">{t('lang.en')}</option>
            </select>
          </div>
        </header>
        {sessionNotice && <div className="alert">{sessionNotice}</div>}
        <LoginForm onLogin={handleLogin} onNotify={notify} />
        <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((x) => x.id !== id))} />
      </main>
    )
  }

  return (
    <main className="dashboard">
      <AppHeader view={view} onViewChange={navigate} environmentMode={environmentMode} onEnvironmentChange={requestSwitchEnvironment} />

      {view === 'wallets' ? (
        <section className="grid wallet-page-grid">
          <WalletConnect
            onNotify={notify}
            onCreateBindChallenge={() =>
              createWalletBindChallenge(token).catch((e) => {
                handleApiError(e, false)
                throw e
              })
            }
            onBindBrowserWallet={(wallet, note, challengeMessage, signature) =>
              bindWallet(token, wallet, note, 137, challengeMessage, signature)
                .then(() => undefined)
                .catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
            }
            onBindPrivateKey={(privateKey, note) =>
              bindWalletPrivateKey(token, privateKey, note).catch((e) => {
                handleApiError(e, false)
                throw e
              })
            }
            onCreatePaperWallet={(initialUsdc, note) =>
              createPaperWallet(token, initialUsdc, note)
                .then(() => getStatus(token))
                .then((s) => {
                  setStatus(s)
                  return loadSecurity()
                })
                .catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
            }
            onActivateLiveWallet={(walletId) =>
              activateLiveWallet(token, walletId).catch((e) => {
                handleApiError(e, false)
                throw e
              })
            }
            onActivatePaperWallet={(walletId) =>
              activatePaperWallet(token, walletId)
                .then(() => getStatus(token))
                .then((s) => {
                  setStatus(s)
                  return loadSecurity()
                })
                .catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
            }
            onDisconnectWallet={() =>
              disconnectWallet(token)
                .then(() => getStatus(token))
                .then((s) => {
                  setStatus(s)
                  return loadSecurity()
                })
                .catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
                .then(() => undefined)
            }
            onDeleteLiveWallet={(walletId) =>
              deleteLiveWallet(token, walletId)
                .then(() => undefined)
                .catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
            }
            onDeletePaperWallet={(walletId) =>
              deletePaperWallet(token, walletId)
                .then(() => undefined)
                .catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
            }
            onFetchWallet={() =>
              getWallet(token).catch((e) => {
                handleApiError(e, false)
                throw e
              })
            }
            onFetchLiveWallets={() =>
              listLiveWallets(token).catch((e) => {
                handleApiError(e, false)
                throw e
              })
            }
            onFetchPaperWallets={() =>
              listPaperWallets(token).catch((e) => {
                handleApiError(e, false)
                throw e
              })
            }
          />
          <div className="wallet-side-column">
            <ApiKeyForm
              onNotify={notify}
              onSave={(k, s, p) =>
                saveApiKeys(token, k, s, p).catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
              }
              onTest={() =>
                testApiKeys(token).catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
              }
              onDelete={() =>
                deleteApiKeys(token).catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
              }
              onFetchStatus={() =>
                listApiKeys(token).catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
              }
              onFetchWallet={() =>
                getWallet(token).catch((e) => {
                  handleApiError(e, false)
                  throw e
                })
              }
            />
            <SetTradePinForm
              email={securityProfile.email}
              emailVerified={securityProfile.email_verified}
              tradePinSet={securityProfile.trade_pin_set}
              onNotify={notify}
              onSetTradePin={(currentPassword, tradePin) =>
                setTradePin(token, currentPassword, tradePin)
                  .then(() => loadSecurity())
                  .then(() => undefined)
                  .catch((e) => {
                    throw new Error(localizeErrorMessage(String(e), t))
                  })
              }
              onRequestBindEmail={(email, currentPassword) =>
                requestEmailBind(token, email, currentPassword)
                  .then((result) => {
                    loadSecurity().catch(() => undefined)
                    return result
                  })
                  .catch((e) => {
                    throw new Error(localizeErrorMessage(String(e), t))
                  })
              }
              onVerifyBindEmail={(email, code) =>
                verifyEmailBind(token, email, code)
                  .then(() => loadSecurity())
                  .then(() => undefined)
                  .catch((e) => {
                    throw new Error(localizeErrorMessage(String(e), t))
                  })
              }
              onRequestTradePinReset={(email) =>
                requestTradePinReset(token, email).catch((e) => {
                  throw new Error(localizeErrorMessage(String(e), t))
                })
              }
              onConfirmTradePinReset={(email, code, newPin) =>
                confirmTradePinReset(token, email, code, newPin)
                  .then(() => loadSecurity())
                  .then(() => undefined)
                  .catch((e) => {
                    throw new Error(localizeErrorMessage(String(e), t))
                  })
              }
            />
          </div>
        </section>
      ) : (
        <>
          <section className="grid">
            <StrategyControls
              running={status.running}
              orderSize={status.config.order_size}
              quoteDelta={status.config.quote_delta}
              dryRun={status.config.dry_run}
              onChange={(size, delta, dry) =>
                updateConfig(token, size, delta, dry)
                  .then(setStatus)
                  .catch((e) => handleApiError(e))
              }
              onToggle={(enabled) =>
                toggleStrategy(token, enabled)
                  .then((s) => {
                    setStatus(s)
                    notify('success', enabled ? t('toast.strategy_started') : t('toast.strategy_stopped'))
                  })
                .catch((e) => handleApiError(e))
              }
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
        </>
      )}
      <TradePinModal
        open={!!pinModalAction}
        title={t('security.pin_for_env')}
        description={t('security.pin_for_env_desc')}
        busy={pinModalBusy}
        error={pinModalError}
        onClose={() => {
          if (pinModalBusy) return
          setPinModalAction(null)
          setPinModalError('')
        }}
        onConfirm={confirmPinModal}
      />
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((x) => x.id !== id))} />
    </main>
  )
}
