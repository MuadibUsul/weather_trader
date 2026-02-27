import { useState } from 'react'
import { useI18n } from '../i18n'

type Props = {
  email: string
  emailVerified: boolean
  tradePinSet: boolean
  onSetTradePin: (currentPassword: string, tradePin: string) => Promise<void>
  onRequestBindEmail: (email: string, currentPassword: string) => Promise<{ debug_code?: string }>
  onVerifyBindEmail: (email: string, code: string) => Promise<void>
  onRequestTradePinReset: (email: string) => Promise<{ debug_code?: string }>
  onConfirmTradePinReset: (email: string, code: string, newPin: string) => Promise<void>
  onNotify: (kind: 'success' | 'error' | 'info', message: string) => void
}

export default function SetTradePinForm({
  email,
  emailVerified,
  tradePinSet,
  onSetTradePin,
  onRequestBindEmail,
  onVerifyBindEmail,
  onRequestTradePinReset,
  onConfirmTradePinReset,
  onNotify,
}: Props) {
  const { t } = useI18n()
  const [currentPassword, setCurrentPassword] = useState('')
  const [tradePin, setTradePin] = useState('')
  const [tradePinConfirm, setTradePinConfirm] = useState('')
  const [emailValue, setEmailValue] = useState(email || '')
  const [emailCode, setEmailCode] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetPin, setResetPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [debugCode, setDebugCode] = useState('')

  const submitSetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (tradePin.length !== 6 || tradePinConfirm.length !== 6 || tradePin !== tradePinConfirm) {
      setError(t('security.trade_pin_mismatch'))
      return
    }
    setBusy(true)
    try {
      await onSetTradePin(currentPassword, tradePin)
      setCurrentPassword('')
      setTradePin('')
      setTradePinConfirm('')
      onNotify('success', t('toast.trade_pin_saved'))
    } catch (err) {
      const msg = String(err)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const requestBindEmail = async () => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const result = await onRequestBindEmail(emailValue.trim(), currentPassword)
      setDebugCode(result.debug_code || '')
      onNotify('info', t('toast.email_code_sent'))
    } catch (err) {
      const msg = String(err)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const verifyEmail = async () => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await onVerifyBindEmail(emailValue.trim(), emailCode.trim())
      setEmailCode('')
      onNotify('success', t('toast.email_verified'))
    } catch (err) {
      const msg = String(err)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const requestResetPin = async () => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const result = await onRequestTradePinReset(emailValue.trim())
      setDebugCode(result.debug_code || '')
      onNotify('info', t('toast.trade_pin_reset_code_sent'))
    } catch (err) {
      const msg = String(err)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const confirmResetPin = async () => {
    if (busy) return
    setError('')
    if (resetPin.length !== 6) {
      setError(t('security.trade_pin_format'))
      return
    }
    setBusy(true)
    try {
      await onConfirmTradePinReset(emailValue.trim(), resetCode.trim(), resetPin)
      setResetCode('')
      setResetPin('')
      onNotify('success', t('toast.trade_pin_reset_done'))
    } catch (err) {
      const msg = String(err)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card security-card">
      <div className="security-header">
        <h3>{t('security.title')}</h3>
        <div className="security-status-list">
          <span className={`status-chip ${tradePinSet ? 'ok' : ''}`}>
            {t('security.trade_pin_state')}: {tradePinSet ? t('security.set') : t('security.not_set')}
          </span>
          <span className={`status-chip ${emailVerified ? 'ok' : ''}`}>
            {t('security.email_state')}: {emailVerified ? t('security.verified') : t('security.unverified')}
          </span>
        </div>
      </div>

      <section className="security-section">
        <h4>{t('security.section_set_pin')}</h4>
        <p className="subtle">{t('security.section_set_pin_desc')}</p>
        <form onSubmit={submitSetPin} className="security-form">
          <label>
            {t('security.current_password')}
            <span className="required" aria-hidden="true">*</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label>
            {t('security.trade_pin')}
            <span className="required" aria-hidden="true">*</span>
            <input value={tradePin} maxLength={6} inputMode="numeric" onChange={(e) => setTradePin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          <label>
            {t('security.trade_pin_confirm')}
            <span className="required" aria-hidden="true">*</span>
            <input
              value={tradePinConfirm}
              maxLength={6}
              inputMode="numeric"
              onChange={(e) => setTradePinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
          <div className="security-actions">
            <button type="submit" disabled={busy}>{busy ? t('security.saving') : t('security.save_trade_pin')}</button>
          </div>
        </form>
      </section>

      <section className="security-section">
        <h4>{t('security.section_bind_email')}</h4>
        <p className="subtle">{t('security.section_bind_email_desc')}</p>
        <div className="security-form">
          <label>
            {t('security.email')}
            <span className="required" aria-hidden="true">*</span>
            <input value={emailValue} onChange={(e) => setEmailValue(e.target.value)} />
          </label>
          <label>
            {t('security.email_code')}
            <span className="required" aria-hidden="true">*</span>
            <input value={emailCode} maxLength={6} onChange={(e) => setEmailCode(e.target.value)} />
          </label>
          <div className="security-actions">
            <button type="button" onClick={requestBindEmail} disabled={busy}>{t('security.send_email_code')}</button>
            <button type="button" className="secondary" onClick={verifyEmail} disabled={busy}>{t('security.verify_email')}</button>
          </div>
        </div>
      </section>

      <section className="security-section">
        <h4>{t('security.section_reset_pin')}</h4>
        <p className="subtle">{t('security.section_reset_pin_desc')}</p>
        <div className="security-form">
          <label>
            {t('security.reset_code')}
            <span className="required" aria-hidden="true">*</span>
            <input value={resetCode} maxLength={6} onChange={(e) => setResetCode(e.target.value)} />
          </label>
          <label>
            {t('security.new_trade_pin')}
            <span className="required" aria-hidden="true">*</span>
            <input value={resetPin} maxLength={6} inputMode="numeric" onChange={(e) => setResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          <div className="security-actions">
            <button type="button" onClick={requestResetPin} disabled={busy}>{t('security.request_trade_pin_reset')}</button>
            <button type="button" className="secondary" onClick={confirmResetPin} disabled={busy}>{t('security.confirm_trade_pin_reset')}</button>
          </div>
        </div>
      </section>

      {debugCode && (
        <p className="subtle">
          {t('security.debug_code')}: <code>{debugCode}</code>
        </p>
      )}
      {error && <p className="error security-error">{error}</p>}
    </div>
  )
}
